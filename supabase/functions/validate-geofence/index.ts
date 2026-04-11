import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { latitude, longitude, user_id } = await req.json();

    if (!latitude || !longitude || !user_id) {
      return new Response(
        JSON.stringify({ valid: false, message: "Missing latitude, longitude, or user_id" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user's profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", user_id)
      .single();

    if (!profile) {
      return new Response(
        JSON.stringify({ valid: false, message: "Employee profile not found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 }
      );
    }

    // Get assigned geofences for this employee
    const { data: assignments } = await supabase
      .from("employee_geofences")
      .select("geofence_id")
      .eq("employee_id", profile.id);

    // Get all active geofences (assigned ones, or all if no assignments)
    let geofenceQuery = supabase.from("geofences").select("*").eq("is_active", true);

    if (assignments && assignments.length > 0) {
      const ids = assignments.map((a: any) => a.geofence_id);
      geofenceQuery = geofenceQuery.in("id", ids);
    }

    const { data: geofences } = await geofenceQuery;

    if (!geofences || geofences.length === 0) {
      // If no geofences exist at all, allow clock-in (first-time setup)
      return new Response(
        JSON.stringify({ valid: true, message: "No geofences configured - clock-in allowed", geofence_id: null, geofence_name: "Unassigned" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if point is within any geofence using simple distance calculation
    for (const geofence of geofences) {
      const distance = haversineDistance(
        latitude, longitude,
        Number(geofence.latitude), Number(geofence.longitude)
      );

      if (distance <= Number(geofence.radius_meters)) {
        return new Response(
          JSON.stringify({
            valid: true,
            message: `Within geofence: ${geofence.name}`,
            geofence_id: geofence.id,
            geofence_name: geofence.name,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    return new Response(
      JSON.stringify({ valid: false, message: "You are outside all designated work zones" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ valid: false, message: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}
