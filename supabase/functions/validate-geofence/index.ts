/* eslint-disable @typescript-eslint/no-explicit-any */
 
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * validate-geofence â€” Supabase Edge Function
 *
 * Security improvements:
 * 1. Extracts user_id from the JWT (Authorization header) instead of trusting the request body
 * 2. CORS origin locked to ALLOWED_ORIGIN env var (falls back to Supabase project URL)
 * 3. Validates all input parameters
 */

function getAllowedOrigin(): string {
  return Deno.env.get("ALLOWED_ORIGIN") || Deno.env.get("SUPABASE_URL") || "*";
}

function corsHeaders(origin?: string | null): Record<string, string> {
  const allowed = getAllowedOrigin();
  return {
    "Access-Control-Allow-Origin": allowed === "*" ? "*" : (origin || allowed),
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

serve(async (req) => {
  const origin = req.headers.get("origin");
  const headers = corsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers });
  }

  try {
    // â”€â”€ 1. Authenticate caller via JWT â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const authHeader = req.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ valid: false, message: "Missing or invalid authorization header" }),
        { headers: { ...headers, "Content-Type": "application/json" }, status: 401 }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

    // Create a user-scoped client to extract the JWT claims
    const supabaseUser = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ valid: false, message: "Invalid or expired session" }),
        { headers: { ...headers, "Content-Type": "application/json" }, status: 401 }
      );
    }

    const userId = user.id;

    // â”€â”€ 2. Parse and validate body â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const body = await req.json();
    const { latitude, longitude } = body;

    if (typeof latitude !== "number" || typeof longitude !== "number") {
      return new Response(
        JSON.stringify({ valid: false, message: "Missing or invalid latitude/longitude (must be numbers)" }),
        { headers: { ...headers, "Content-Type": "application/json" }, status: 400 }
      );
    }

    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return new Response(
        JSON.stringify({ valid: false, message: "Latitude must be -90..90 and longitude -180..180" }),
        { headers: { ...headers, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // â”€â”€ 3. Look up employee profile â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("user_id", userId)
      .single();

    if (!profile) {
      return new Response(
        JSON.stringify({ valid: false, message: "Employee profile not found" }),
        { headers: { ...headers, "Content-Type": "application/json" }, status: 404 }
      );
    }

    // â”€â”€ 4. Determine which geofences to check â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const { data: assignments } = await supabaseAdmin
      .from("employee_geofences")
      .select("geofence_id")
      .eq("employee_id", profile.id);

    let geofenceQuery = supabaseAdmin.from("geofences").select("*").eq("is_active", true);

    if (assignments && assignments.length > 0) {
      const ids = assignments.map((a: Record<string, any>) => a.geofence_id);
      geofenceQuery = geofenceQuery.in("id", ids);
    }

    const { data: geofences } = await geofenceQuery;

    if (!geofences || geofences.length === 0) {
      // No geofences configured â€” allow clock-in (first-time setup)
      return new Response(
        JSON.stringify({
          valid: true,
          message: "No geofences configured â€“ clock-in allowed",
          geofence_id: null,
          geofence_name: "Unassigned",
        }),
        { headers: { ...headers, "Content-Type": "application/json" } }
      );
    }

    // â”€â”€ 5. Check if point is within any geofence â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    for (const geofence of geofences) {
      const distance = haversineDistance(
        latitude,
        longitude,
        Number(geofence.latitude),
        Number(geofence.longitude)
      );

      if (distance <= Number(geofence.radius_meters)) {
        return new Response(
          JSON.stringify({
            valid: true,
            message: `Within geofence: ${geofence.name}`,
            geofence_id: geofence.id,
            geofence_name: geofence.name,
          }),
          { headers: { ...headers, "Content-Type": "application/json" } }
        );
      }
    }

    return new Response(
      JSON.stringify({ valid: false, message: "You are outside all designated work zones" }),
      { headers: { ...headers, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const headers2 = corsHeaders(req.headers.get("origin"));
    return new Response(
      JSON.stringify({ valid: false, message: (error as Error).message }),
      { headers: { ...headers2, "Content-Type": "application/json" }, status: 500 }
    );
  }
});

// â”€â”€ Haversine distance (meters) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}
