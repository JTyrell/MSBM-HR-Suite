import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Clock, Search } from "lucide-react";

export default function Attendance() {
  const { user, isAdmin, isHR } = useAuth();
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    const fetch = async () => {
      let query = supabase
        .from("attendance_records")
        .select("*, profiles!attendance_records_user_id_fkey(first_name, last_name), geofences(name)")
        .order("clock_in", { ascending: false })
        .limit(100);

      if (!isAdmin && !isHR) {
        query = query.eq("user_id", user?.id);
      }

      const { data } = await query;
      setRecords(data || []);
      setLoading(false);
    };
    fetch();
  }, [user, isAdmin, isHR]);

  const filtered = records.filter((r) => {
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    if (search) {
      const name = `${r.profiles?.first_name || ""} ${r.profiles?.last_name || ""}`.toLowerCase();
      if (!name.includes(search.toLowerCase())) return false;
    }
    return true;
  });

  const formatDuration = (clockIn: string, clockOut: string | null) => {
    if (!clockOut) return "Active";
    const ms = new Date(clockOut).getTime() - new Date(clockIn).getTime();
    const hrs = Math.floor(ms / 3600000);
    const mins = Math.floor((ms % 3600000) / 60000);
    return `${hrs}h ${mins}m`;
  };

  return (
    <div className="space-y-6 animate-slide-up">
      <div>
        <h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
          <Clock className="h-7 w-7 text-primary" /> Attendance Records
        </h1>
        <p className="text-muted-foreground mt-1">
          {isAdmin || isHR ? "View all employee attendance history" : "Your attendance history"}
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by name..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="valid">Valid</SelectItem>
            <SelectItem value="invalid">Invalid</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">No attendance records found</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  {(isAdmin || isHR) && <TableHead>Employee</TableHead>}
                  <TableHead>Date</TableHead>
                  <TableHead>Clock In</TableHead>
                  <TableHead>Clock Out</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => (
                  <TableRow key={r.id}>
                    {(isAdmin || isHR) && (
                      <TableCell className="font-medium">
                        {r.profiles?.first_name} {r.profiles?.last_name}
                      </TableCell>
                    )}
                    <TableCell>{new Date(r.clock_in).toLocaleDateString()}</TableCell>
                    <TableCell>{new Date(r.clock_in).toLocaleTimeString()}</TableCell>
                    <TableCell>{r.clock_out ? new Date(r.clock_out).toLocaleTimeString() : "—"}</TableCell>
                    <TableCell>{formatDuration(r.clock_in, r.clock_out)}</TableCell>
                    <TableCell className="text-xs">{r.geofences?.name || "Unknown"}</TableCell>
                    <TableCell>
                      <Badge variant={r.status === "valid" ? "default" : r.status === "invalid" ? "destructive" : "secondary"}>
                        {r.status}
                      </Badge>
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
