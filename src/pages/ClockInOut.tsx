import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;

// ── Helpers ──────────────────────────────────────────────────
function generateCircleGeoJSON(
  lat: number,
  lng: number,
  radiusMeters: number,
  points = 64
): GeoJSON.Feature<GeoJSON.Polygon> {
  const coords: [number, number][] = [];
  const earthRadius = 6371000;
  for (let i = 0; i <= points; i++) {
    const angle = (i / points) * 2 * Math.PI;
    const dLat = (radiusMeters / earthRadius) * Math.cos(angle);
    const dLng =
      (radiusMeters / (earthRadius * Math.cos((lat * Math.PI) / 180))) *
      Math.sin(angle);
    coords.push([lng + (dLng * 180) / Math.PI, lat + (dLat * 180) / Math.PI]);
  }
  return {
    type: "Feature",
    properties: {},
    geometry: { type: "Polygon", coordinates: [coords] },
  };
}

export default function ClockInOut() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [activeRecord, setActiveRecord] = useState<Record<string, unknown> | null>(null);
  const [lastAction, setLastAction] = useState<{
    type: string;
    success: boolean;
    message: string;
  } | null>(null);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const userMarkerRef = useRef<mapboxgl.Marker | null>(null);

  const fetchActiveRecord = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("attendance_records")
      .select("*")
      .eq("user_id", user.id)
      .is("clock_out", null)
      .order("clock_in", { ascending: false })
      .limit(1)
      .maybeSingle();
    setActiveRecord(data);
  }, [user]);

  useEffect(() => {
    fetchActiveRecord();
  }, [fetchActiveRecord]);

  const getLocation = () => {
    setLocationLoading(true);
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser");
      setLocationLoading(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocationLoading(false);
      },
      (err) => {
        toast.error(`Location error: ${err.message}`);
        setLocationLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  useEffect(() => {
    getLocation();
  }, []);

  // ── Initialise Mapbox map when coords are available ──
  useEffect(() => {
    if (!coords || !mapContainerRef.current) return;

    // Only init once
    if (mapRef.current) {
      // Just update marker position
      userMarkerRef.current?.setLngLat([coords.lng, coords.lat]);
      return;
    }

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: [coords.lng, coords.lat],
      zoom: 15,
    });

    map.addControl(new mapboxgl.NavigationControl(), "top-right");

    // User marker — pulsing blue dot
    const el = document.createElement("div");
    el.className = "user-location-marker";
    el.style.cssText = `
      width: 18px; height: 18px; border-radius: 50%;
      background: hsl(243, 75%, 59%); border: 3px solid white;
      box-shadow: 0 0 0 4px hsla(243, 75%, 59%, 0.3), 0 2px 8px rgba(0,0,0,0.3);
    `;
    const marker = new mapboxgl.Marker({ element: el })
      .setLngLat([coords.lng, coords.lat])
      .setPopup(new mapboxgl.Popup().setText("Your location"))
      .addTo(map);
    userMarkerRef.current = marker;

    // Load nearby geofences and render them
    map.on("load", async () => {
      const { data: geofences } = await supabase
        .from("geofences")
        .select("*")
        .eq("is_active", true);

      if (geofences && geofences.length > 0) {
        geofences.forEach((g: Record<string, unknown>, idx: number) => {
          const lat = Number(g.latitude);
          const lng = Number(g.longitude);
          const radius = Number(g.radius_meters) || 100;
          const circle = generateCircleGeoJSON(lat, lng, radius);

          map.addSource(`fence-${idx}`, { type: "geojson", data: circle });
          map.addLayer({
            id: `fence-fill-${idx}`,
            type: "fill",
            source: `fence-${idx}`,
            paint: {
              "fill-color": "hsl(142, 71%, 45%)",
              "fill-opacity": 0.12,
            },
          });
          map.addLayer({
            id: `fence-line-${idx}`,
            type: "line",
            source: `fence-${idx}`,
            paint: {
              "line-color": "hsl(142, 71%, 45%)",
              "line-width": 2,
              "line-dasharray": [2, 2],
            },
          });

          new mapboxgl.Marker({ color: "hsl(142, 71%, 45%)", scale: 0.6 })
            .setLngLat([lng, lat])
            .setPopup(new mapboxgl.Popup().setText(g.name))
            .addTo(map);
        });

        // Fit bounds to include user + all fences
        const bounds = new mapboxgl.LngLatBounds();
        bounds.extend([coords.lng, coords.lat]);
        geofences.forEach((g: Record<string, unknown>) =>
          bounds.extend([Number(g.longitude), Number(g.latitude)])
        );
        map.fitBounds(bounds, { padding: 60, maxZoom: 16 });
      }
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      userMarkerRef.current = null;
    };
    // Only re-init when coords first become available
  }, [coords]);

  const handleClockIn = async () => {
    if (!coords || !user) return;
    setLoading(true);
    try {
      // Check geofence via edge function
      const res = await supabase.functions.invoke("validate-geofence", {
        body: { latitude: coords.lat, longitude: coords.lng, user_id: user.id },
      });

      if (res.error || !res.data?.valid) {
        setLastAction({
          type: "clock-in",
          success: false,
          message: res.data?.message || "You are outside the designated work zone",
        });
        toast.error("Clock-in failed: Outside geofence");
        setLoading(false);
        return;
      }

      const { error } = await supabase.from("attendance_records").insert({
        user_id: user.id,
        clock_in: new Date().toISOString(),
        clock_in_lat: coords.lat,
        clock_in_lng: coords.lng,
        geofence_id: res.data.geofence_id,
        status: "valid",
      });

      if (error) throw error;
      setLastAction({
        type: "clock-in",
        success: true,
        message: `Clocked in at ${res.data.geofence_name || "work site"}`,
      });
      toast.success("Clock-in successful!");
      fetchActiveRecord();
    } catch (err: unknown) {
      if (err instanceof Error) {
        toast.error(err.message);
        setLastAction({ type: "clock-in", success: false, message: err.message });
      }
    }
    setLoading(false);
  };

  const handleClockOut = async () => {
    if (!coords || !activeRecord) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from("attendance_records")
        .update({
          clock_out: new Date().toISOString(),
          clock_out_lat: coords.lat,
          clock_out_lng: coords.lng,
        })
        .eq("id", activeRecord.id);

      if (error) throw error;
      setLastAction({
        type: "clock-out",
        success: true,
        message: "Successfully clocked out",
      });
      toast.success("Clock-out successful!");
      setActiveRecord(null);
    } catch (err: unknown) {
      if (err instanceof Error) {
        toast.error(err.message);
        setLastAction({
          type: "clock-out",
          success: false,
          message: err.message,
        });
      }
    }
    setLoading(false);
  };

  const isClockedIn = !!activeRecord;

  return (
    <div className="max-w-lg mx-auto space-y-6 animate-slide-up">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">
          Clock In / Out
        </h1>
        <p className="text-muted-foreground mt-1">
          Your location is verified against your assigned geofence
        </p>
      </div>

      {/* Mapbox Location Map */}
      <Card>
        <CardContent className="p-0 overflow-hidden rounded-lg">
          <div ref={mapContainerRef} className="h-[200px] w-full" />
        </CardContent>
      </Card>

      {/* Location status */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center gap-3">
            {locationLoading ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            ) : coords ? (
              <MapPin className="h-5 w-5 text-success" />
            ) : (
              <XCircle className="h-5 w-5 text-destructive" />
            )}
            <div>
              <p className="text-sm font-medium">
                {locationLoading
                  ? "Acquiring location..."
                  : coords
                    ? "Location acquired"
                    : "Location unavailable"}
              </p>
              {coords && (
                <p className="text-xs text-muted-foreground">
                  {coords.lat.toFixed(6)}, {coords.lng.toFixed(6)}
                </p>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto"
              onClick={getLocation}
              disabled={locationLoading}
            >
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Clock action */}
      <Card className="overflow-hidden">
        <div className={`h-2 ${isClockedIn ? "bg-success" : "bg-muted"}`} />
        <CardHeader className="text-center">
          <CardTitle className="font-display text-xl">
            {isClockedIn ? "You are clocked in" : "Ready to clock in"}
          </CardTitle>
          {isClockedIn && activeRecord && (
            <p className="text-sm text-muted-foreground">
              Since {new Date(activeRecord.clock_in).toLocaleTimeString()}
            </p>
          )}
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4 pb-8">
          <div className="relative">
            <Button
              size="lg"
              className={`h-28 w-28 rounded-full text-lg font-display font-bold shadow-lg ${
                isClockedIn
                  ? "bg-destructive hover:bg-destructive/90"
                  : "bg-primary hover:bg-primary/90"
              }`}
              onClick={isClockedIn ? handleClockOut : handleClockIn}
              disabled={loading || !coords}
            >
              {loading ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : isClockedIn ? (
                "OUT"
              ) : (
                "IN"
              )}
            </Button>
            {isClockedIn && (
              <div className="absolute inset-0 rounded-full border-4 border-success animate-pulse-ring pointer-events-none" />
            )}
          </div>
          <p className="text-sm text-muted-foreground text-center max-w-xs">
            {isClockedIn
              ? "Press OUT to clock out. Your location will be recorded."
              : "Press IN to clock in. GPS verification required."}
          </p>
        </CardContent>
      </Card>

      {/* Last action feedback */}
      {lastAction && (
        <Card
          className={
            lastAction.success
              ? "border-success/30 bg-success/5"
              : "border-destructive/30 bg-destructive/5"
          }
        >
          <CardContent className="flex items-center gap-3 py-4">
            {lastAction.success ? (
              <CheckCircle className="h-5 w-5 text-success shrink-0" />
            ) : (
              <XCircle className="h-5 w-5 text-destructive shrink-0" />
            )}
            <div>
              <p className="text-sm font-medium">
                {lastAction.success ? "Success" : "Failed"}
              </p>
              <p className="text-xs text-muted-foreground">
                {lastAction.message}
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
