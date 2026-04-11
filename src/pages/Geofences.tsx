import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Map, Plus, Trash2, Edit2 } from "lucide-react";
import { MapContainer, TileLayer, Marker, Circle, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix leaflet default icon
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

export default function Geofences() {
  const [geofences, setGeofences] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  const fetchGeofences = async () => {
    const { data } = await supabase.from("geofences").select("*, departments(name)").order("created_at", { ascending: false });
    setGeofences(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchGeofences(); }, []);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this geofence?")) return;
    const { error } = await supabase.from("geofences").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Geofence deleted"); fetchGeofences(); }
  };

  const toggleActive = async (id: string, current: boolean) => {
    const { error } = await supabase.from("geofences").update({ is_active: !current }).eq("id", id);
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
          <p className="text-muted-foreground mt-1">Manage work location boundaries for attendance verification</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" /> Add Geofence</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle className="font-display">Create Geofence</DialogTitle></DialogHeader>
            <GeofenceForm onSuccess={() => { setDialogOpen(false); fetchGeofences(); }} />
          </DialogContent>
        </Dialog>
      </div>

      {/* Map overview */}
      {geofences.length > 0 && (
        <Card>
          <CardContent className="p-0 overflow-hidden rounded-lg">
            <div className="h-[300px] md:h-[400px]">
              <MapContainer
                center={[Number(geofences[0]?.latitude) || 0, Number(geofences[0]?.longitude) || 0]}
                zoom={13}
                className="h-full w-full"
              >
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OpenStreetMap contributors' />
                {geofences.filter(g => g.is_active).map((g) => (
                  <Circle
                    key={g.id}
                    center={[Number(g.latitude), Number(g.longitude)]}
                    radius={Number(g.radius_meters) || 100}
                    pathOptions={{ color: "hsl(243, 75%, 59%)", fillOpacity: 0.15 }}
                  />
                ))}
                {geofences.filter(g => g.is_active).map((g) => (
                  <Marker key={`m-${g.id}`} position={[Number(g.latitude), Number(g.longitude)]} />
                ))}
              </MapContainer>
            </div>
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
            <div className="text-center py-12 text-muted-foreground">No geofences created yet</div>
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
                    <TableCell className="text-xs text-muted-foreground">{Number(g.latitude).toFixed(5)}, {Number(g.longitude).toFixed(5)}</TableCell>
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
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(g.id)}>
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

function GeofenceForm({ onSuccess }: { onSuccess: () => void }) {
  const [name, setName] = useState("");
  const [lat, setLat] = useState(40.7128);
  const [lng, setLng] = useState(-74.006);
  const [radius, setRadius] = useState(100);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const polygon = {
      type: "Polygon",
      coordinates: [generateCirclePolygon(lat, lng, radius)],
    };

    const { error } = await supabase.from("geofences").insert({
      name,
      latitude: lat,
      longitude: lng,
      radius_meters: radius,
      polygon,
    });

    if (error) toast.error(error.message);
    else { toast.success("Geofence created"); onSuccess(); }
    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>Name</Label>
        <Input placeholder="Main Office" value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div className="h-[250px] rounded-lg overflow-hidden border">
        <MapContainer center={[lat, lng]} zoom={14} className="h-full w-full">
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OpenStreetMap' />
          <Marker position={[lat, lng]} />
          <Circle center={[lat, lng]} radius={radius} pathOptions={{ color: "hsl(243, 75%, 59%)", fillOpacity: 0.15 }} />
          <MapClickHandler onLocationSelect={(la, ln) => { setLat(la); setLng(ln); }} />
        </MapContainer>
      </div>
      <p className="text-xs text-muted-foreground">Click on the map to set the center point</p>
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>Latitude</Label>
          <Input type="number" step="any" value={lat} onChange={(e) => setLat(parseFloat(e.target.value))} />
        </div>
        <div className="space-y-2">
          <Label>Longitude</Label>
          <Input type="number" step="any" value={lng} onChange={(e) => setLng(parseFloat(e.target.value))} />
        </div>
        <div className="space-y-2">
          <Label>Radius (m)</Label>
          <Input type="number" value={radius} onChange={(e) => setRadius(parseInt(e.target.value))} min={10} max={10000} />
        </div>
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Creating..." : "Create Geofence"}
      </Button>
    </form>
  );
}

function MapClickHandler({ onLocationSelect }: { onLocationSelect: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onLocationSelect(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function generateCirclePolygon(lat: number, lng: number, radiusMeters: number, points = 32): [number, number][] {
  const coords: [number, number][] = [];
  const earthRadius = 6371000;
  for (let i = 0; i <= points; i++) {
    const angle = (i / points) * 2 * Math.PI;
    const dLat = (radiusMeters / earthRadius) * Math.cos(angle);
    const dLng = (radiusMeters / (earthRadius * Math.cos((lat * Math.PI) / 180))) * Math.sin(angle);
    coords.push([lng + (dLng * 180) / Math.PI, lat + (dLat * 180) / Math.PI]);
  }
  return coords;
}
