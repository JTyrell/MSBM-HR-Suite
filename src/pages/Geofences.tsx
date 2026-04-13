import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Map, Plus, Trash2, Shield } from "lucide-react";
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

// ── Main Page ────────────────────────────────────────────────
export default function Geofences() {
  const { isAdmin, isHR } = useAuth();
  const [geofences, setGeofences] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);

  if (!isAdmin && !isHR) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <Shield className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 className="font-display text-xl font-bold">Access Denied</h2>
            <p className="text-muted-foreground mt-2">Only HR administrators and system administrators can manage geofences.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const fetchGeofences = async () => {
    const { data } = await supabase
      .from("geofences")
      .select("*, departments(name)")
      .order("created_at", { ascending: false });
    setGeofences(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchGeofences();
  }, []);

  // ── Initialise Overview Map ──
  const initOverviewMap = useCallback(() => {
    if (!mapContainerRef.current || geofences.length === 0) return;
    // Destroy existing map on re-render
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    const activeGeofences = geofences.filter((g) => g.is_active);
    const center: [number, number] = activeGeofences.length > 0
      ? [Number(activeGeofences[0].longitude), Number(activeGeofences[0].latitude)]
      : [Number(geofences[0].longitude), Number(geofences[0].latitude)];

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center,
      zoom: 13,
    });

    map.addControl(new mapboxgl.NavigationControl(), "top-right");

    map.on("load", () => {
      const fencesToShow = activeGeofences.length > 0 ? activeGeofences : geofences;
      fencesToShow.forEach((g: any, idx: number) => {
        const lat = Number(g.latitude);
        const lng = Number(g.longitude);
        const radius = Number(g.radius_meters) || 100;
        const circle = generateCircleGeoJSON(lat, lng, radius);

        map.addSource(`geofence-${idx}`, { type: "geojson", data: circle });
        map.addLayer({
          id: `geofence-fill-${idx}`,
          type: "fill",
          source: `geofence-${idx}`,
          paint: {
            "fill-color": "hsl(243, 75%, 59%)",
            "fill-opacity": 0.15,
          },
        });
        map.addLayer({
          id: `geofence-outline-${idx}`,
          type: "line",
          source: `geofence-${idx}`,
          paint: {
            "line-color": "hsl(243, 75%, 59%)",
            "line-width": 2,
          },
        });

        new mapboxgl.Marker({ color: "hsl(243, 75%, 59%)" })
          .setLngLat([lng, lat])
          .setPopup(new mapboxgl.Popup().setText(g.name))
          .addTo(map);
      });

      // Fit bounds to show all geofences
      if (fencesToShow.length > 1) {
        const bounds = new mapboxgl.LngLatBounds();
        fencesToShow.forEach((g: any) => bounds.extend([Number(g.longitude), Number(g.latitude)]));
        map.fitBounds(bounds, { padding: 60, maxZoom: 15 });
      }
    });

    mapRef.current = map;
  }, [geofences]);

  useEffect(() => {
    initOverviewMap();
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [initOverviewMap]);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this geofence?")) return;
    const { error } = await supabase.from("geofences").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Geofence deleted");
      fetchGeofences();
    }
  };

  const toggleActive = async (id: string, current: boolean) => {
    const { error } = await supabase
      .from("geofences")
      .update({ is_active: !current })
      .eq("id", id);
    if (error) toast.error(error.message);
    else fetchGeofences();
  };

  return (
    <div className="space-y-6 animate-slide-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <Map className="h-7 w-7 text-primary" /> Geofences
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage work location boundaries for attendance verification
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" /> Add Geofence
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="font-display">Create Geofence</DialogTitle>
            </DialogHeader>
            <GeofenceForm
              onSuccess={() => {
                setDialogOpen(false);
                fetchGeofences();
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Map overview */}
      {geofences.length > 0 && (
        <Card>
          <CardContent className="p-0 overflow-hidden rounded-lg">
            <div ref={mapContainerRef} className="h-[300px] md:h-[400px] w-full" />
          </CardContent>
        </Card>
      )}

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
            </div>
          ) : geofences.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No geofences created yet
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Coordinates</TableHead>
                  <TableHead>Radius</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {geofences.map((g) => (
                  <TableRow key={g.id}>
                    <TableCell className="font-medium">{g.name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {Number(g.latitude).toFixed(5)},{" "}
                      {Number(g.longitude).toFixed(5)}
                    </TableCell>
                    <TableCell>{g.radius_meters}m</TableCell>
                    <TableCell>{g.departments?.name || "—"}</TableCell>
                    <TableCell>
                      <Badge
                        className="cursor-pointer"
                        variant={g.is_active ? "default" : "secondary"}
                        onClick={() => toggleActive(g.id, g.is_active)}
                      >
                        {g.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(g.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Geofence Create Form ─────────────────────────────────────
function GeofenceForm({ onSuccess }: { onSuccess: () => void }) {
  const [name, setName] = useState("");
  const [lat, setLat] = useState(40.7128);
  const [lng, setLng] = useState(-74.006);
  const [radius, setRadius] = useState(100);
  const [loading, setLoading] = useState(false);
  const formMapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<mapboxgl.Map | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);

  // Keep a ref to the latest coordinates so the click handler always uses the current value
  const coordsRef = useRef({ lat, lng, radius });
  useEffect(() => {
    coordsRef.current = { lat, lng, radius };
  }, [lat, lng, radius]);

  // Initialise form map
  useEffect(() => {
    if (!formMapRef.current) return;

    const map = new mapboxgl.Map({
      container: formMapRef.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: [lng, lat],
      zoom: 14,
    });

    const marker = new mapboxgl.Marker({ color: "hsl(243, 75%, 59%)", draggable: true })
      .setLngLat([lng, lat])
      .addTo(map);

    markerRef.current = marker;

    marker.on("dragend", () => {
      const lngLat = marker.getLngLat();
      setLat(lngLat.lat);
      setLng(lngLat.lng);
    });

    map.on("load", () => {
      const circle = generateCircleGeoJSON(lat, lng, radius);
      map.addSource("preview-fence", { type: "geojson", data: circle });
      map.addLayer({
        id: "preview-fence-fill",
        type: "fill",
        source: "preview-fence",
        paint: { "fill-color": "hsl(243, 75%, 59%)", "fill-opacity": 0.2 },
      });
      map.addLayer({
        id: "preview-fence-line",
        type: "line",
        source: "preview-fence",
        paint: { "line-color": "hsl(243, 75%, 59%)", "line-width": 2 },
      });
    });

    map.on("click", (e) => {
      const newLat = e.lngLat.lat;
      const newLng = e.lngLat.lng;
      setLat(newLat);
      setLng(newLng);
      marker.setLngLat([newLng, newLat]);
      const src = map.getSource("preview-fence") as mapboxgl.GeoJSONSource;
      if (src) src.setData(generateCircleGeoJSON(newLat, newLng, coordsRef.current.radius));
    });

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
    // Centre only set once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update circle preview when lat/lng/radius change
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !map.isStyleLoaded()) return;
    const src = map.getSource("preview-fence") as mapboxgl.GeoJSONSource;
    if (src) src.setData(generateCircleGeoJSON(lat, lng, radius));
    markerRef.current?.setLngLat([lng, lat]);
  }, [lat, lng, radius]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const polygon = {
      type: "Polygon",
      coordinates: [generateCircleGeoJSON(lat, lng, radius).geometry.coordinates[0]],
    };

    const { error } = await supabase.from("geofences").insert({
      name,
      latitude: lat,
      longitude: lng,
      radius_meters: radius,
      polygon,
    });

    if (error) toast.error(error.message);
    else {
      toast.success("Geofence created");
      onSuccess();
    }
    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>Name</Label>
        <Input
          placeholder="Main Office"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </div>
      <div ref={formMapRef} className="h-[250px] rounded-lg overflow-hidden border" />
      <p className="text-xs text-muted-foreground">
        Click on the map or drag the marker to set the center point
      </p>
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>Latitude</Label>
          <Input
            type="number"
            step="any"
            value={lat}
            onChange={(e) => setLat(parseFloat(e.target.value))}
          />
        </div>
        <div className="space-y-2">
          <Label>Longitude</Label>
          <Input
            type="number"
            step="any"
            value={lng}
            onChange={(e) => setLng(parseFloat(e.target.value))}
          />
        </div>
        <div className="space-y-2">
          <Label>Radius (m)</Label>
          <Input
            type="number"
            value={radius}
            onChange={(e) => setRadius(parseInt(e.target.value))}
            min={10}
            max={10000}
          />
        </div>
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Creating..." : "Create Geofence"}
      </Button>
    </form>
  );
}
