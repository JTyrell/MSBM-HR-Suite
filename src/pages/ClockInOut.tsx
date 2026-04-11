import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function ClockInOut() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [activeRecord, setActiveRecord] = useState<any>(null);
  const [lastAction, setLastAction] = useState<{ type: string; success: boolean; message: string } | null>(null);

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

  useEffect(() => { fetchActiveRecord(); }, [fetchActiveRecord]);

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

  useEffect(() => { getLocation(); }, []);

  const handleClockIn = async () => {
    if (!coords || !user) return;
    setLoading(true);
    try {
      // Check geofence via edge function
      const res = await supabase.functions.invoke("validate-geofence", {
        body: { latitude: coords.lat, longitude: coords.lng, user_id: user.id },
      });

      if (res.error || !res.data?.valid) {
        setLastAction({ type: "clock-in", success: false, message: res.data?.message || "You are outside the designated work zone" });
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
      setLastAction({ type: "clock-in", success: true, message: `Clocked in at ${res.data.geofence_name || "work site"}` });
      toast.success("Clock-in successful!");
      fetchActiveRecord();
    } catch (err: any) {
      toast.error(err.message);
      setLastAction({ type: "clock-in", success: false, message: err.message });
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
      setLastAction({ type: "clock-out", success: true, message: "Successfully clocked out" });
      toast.success("Clock-out successful!");
      setActiveRecord(null);
    } catch (err: any) {
      toast.error(err.message);
      setLastAction({ type: "clock-out", success: false, message: err.message });
    }
    setLoading(false);
  };

  const isClockedIn = !!activeRecord;

  return (
    <div className="max-w-lg mx-auto space-y-6 animate-slide-up">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">Clock In / Out</h1>
        <p className="text-muted-foreground mt-1">Your location is verified against your assigned geofence</p>
      </div>

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
                {locationLoading ? "Acquiring location..." : coords ? "Location acquired" : "Location unavailable"}
              </p>
              {coords && (
                <p className="text-xs text-muted-foreground">
                  {coords.lat.toFixed(6)}, {coords.lng.toFixed(6)}
                </p>
              )}
            </div>
            <Button variant="ghost" size="sm" className="ml-auto" onClick={getLocation} disabled={locationLoading}>
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
                isClockedIn ? "bg-destructive hover:bg-destructive/90" : "bg-primary hover:bg-primary/90"
              }`}
              onClick={isClockedIn ? handleClockOut : handleClockIn}
              disabled={loading || !coords}
            >
              {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : isClockedIn ? "OUT" : "IN"}
            </Button>
            {isClockedIn && <div className="absolute inset-0 rounded-full border-4 border-success animate-pulse-ring pointer-events-none" />}
          </div>
          <p className="text-sm text-muted-foreground text-center max-w-xs">
            {isClockedIn ? "Press OUT to clock out. Your location will be recorded." : "Press IN to clock in. GPS verification required."}
          </p>
        </CardContent>
      </Card>

      {/* Last action feedback */}
      {lastAction && (
        <Card className={lastAction.success ? "border-success/30 bg-success/5" : "border-destructive/30 bg-destructive/5"}>
          <CardContent className="flex items-center gap-3 py-4">
            {lastAction.success ? (
              <CheckCircle className="h-5 w-5 text-success shrink-0" />
            ) : (
              <XCircle className="h-5 w-5 text-destructive shrink-0" />
            )}
            <div>
              <p className="text-sm font-medium">{lastAction.success ? "Success" : "Failed"}</p>
              <p className="text-xs text-muted-foreground">{lastAction.message}</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
