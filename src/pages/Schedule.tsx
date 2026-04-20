/* eslint-disable @typescript-eslint/no-explicit-any */
 
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useFeatureFlag } from "@/hooks/useFeatureFlag";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { CalendarClock, Plus, ChevronLeft, ChevronRight, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

interface Shift {
  id: string;
  employee_id: string;
  department_id: string | null;
  title: string | null;
  start_time: string;
  end_time: string;
  break_minutes: number;
  status: string;
  color: string;
  notes: string | null;
  profiles?: { first_name: string; last_name: string };
}

export default function Schedule() {
  const { isAdmin, isHR, user } = useAuth();
  const wfmEnabled = useFeatureFlag("enabled_workforce_mgmt");
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [employees, setEmployees] = useState<Record<string, any>[]>([]);
  const [departments, setDepartments] = useState<Record<string, any>[]>([]);
  const [loading, setLoading] = useState(true);
  const [weekOffset, setWeekOffset] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [conflicts, setConflicts] = useState<Record<string, any>[]>([]);

  const [form, setForm] = useState({
    employee_id: "",
    department_id: "",
    title: "",
    date: "",
    start_hour: "09",
    start_min: "00",
    end_hour: "17",
    end_min: "00",
    break_minutes: "60",
    notes: "",
    color: "#3b82f6",
  });

  // Calculate week boundaries
  const weekDays = useMemo(() => {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay() + (weekOffset * 7));
    startOfWeek.setHours(0, 0, 0, 0);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + i);
      return d;
    });
  }, [weekOffset]);

  const fetchData = async () => {
    const weekStart = weekDays[0].toISOString();
    const weekEnd = weekDays[6].toISOString().replace("T00:", "T23:");

    const [shiftsRes, empRes, deptRes] = await Promise.all([
      supabase
        .from("shifts")
        .select("*, profiles!shifts_employee_id_fkey(first_name, last_name)")
        .gte("start_time", weekStart)
        .lte("start_time", weekEnd)
        .neq("status", "cancelled")
        .order("start_time"),
      supabase.from("profiles").select("user_id, first_name, last_name, department_id").eq("status", "active"),
      supabase.from("departments").select("*").order("name"),
    ]);

    setShifts((shiftsRes.data as Shift[]) || []);
    setEmployees(empRes.data || []);
    setDepartments(deptRes.data || []);
    setLoading(false);
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchData(); }, [weekOffset]);

  if (!wfmEnabled) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Workforce management is not enabled. Contact your administrator.</p>
      </div>
    );
  }

  const getShiftsForDay = (date: Date) =>
    shifts.filter(s => new Date(s.start_time).toDateString() === date.toDateString());

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const checkConflicts = async () => {
    if (!form.employee_id || !form.date) return;
    const startTime = `${form.date}T${form.start_hour}:${form.start_min}:00`;
    const endTime = `${form.date}T${form.end_hour}:${form.end_min}:00`;

    try {
      const { data } = await supabase.functions.invoke("evaluate-scheduling-conflicts", {
        body: {
          employee_id: form.employee_id,
          start_time: startTime,
          end_time: endTime,
          department_id: form.department_id || null,
          break_minutes: Number(form.break_minutes),
        },
      });
      setConflicts(data?.conflicts || []);
    } catch { /* ignore */ }
  };

  const handleCreate = async () => {
    if (!form.employee_id || !form.date) {
      toast.error("Employee and date are required");
      return;
    }
    setSaving(true);
    const startTime = `${form.date}T${form.start_hour}:${form.start_min}:00`;
    const endTime = `${form.date}T${form.end_hour}:${form.end_min}:00`;

    const { error } = await supabase.from("shifts").insert({
      employee_id: form.employee_id,
      department_id: form.department_id || null,
      title: form.title || null,
      start_time: startTime,
      end_time: endTime,
      break_minutes: Number(form.break_minutes),
      notes: form.notes || null,
      color: form.color,
      status: "published",
      created_by: user?.id,
    });

    if (error) toast.error(error.message);
    else {
      toast.success("Shift created");
      setDialogOpen(false);
      setConflicts([]);
      fetchData();
    }
    setSaving(false);
  };

  const weekLabel = `${weekDays[0].toLocaleDateString(undefined, { month: "short", day: "numeric" })} â€” ${weekDays[6].toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`;

  return (
    <div className="space-y-6 animate-slide-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <CalendarClock className="h-7 w-7 text-primary" /> Schedule
          </h1>
          <p className="text-muted-foreground mt-1">Manage workforce shifts and schedules</p>
        </div>
        {(isAdmin || isHR) && (
          <Button onClick={() => { setDialogOpen(true); setConflicts([]); }}>
            <Plus className="h-4 w-4 mr-2" /> New Shift
          </Button>
        )}
      </div>

      {/* Week Navigation */}
      <div className="flex items-center justify-between">
        <Button variant="outline" size="icon" onClick={() => setWeekOffset(w => w - 1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="text-center">
          <p className="font-display font-semibold">{weekLabel}</p>
          {weekOffset !== 0 && (
            <button className="text-xs text-primary hover:underline" onClick={() => setWeekOffset(0)}>
              Today
            </button>
          )}
        </div>
        <Button variant="outline" size="icon" onClick={() => setWeekOffset(w => w + 1)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Week Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      ) : (
        <div className="grid grid-cols-7 gap-2">
          {weekDays.map((day, i) => {
            const dayShifts = getShiftsForDay(day);
            const isToday = day.toDateString() === new Date().toDateString();
            return (
              <Card key={i} className={isToday ? "border-primary/50 bg-primary/5" : ""}>
                <CardHeader className="pb-2 pt-3 px-3">
                  <CardTitle className="text-xs font-medium text-muted-foreground">
                    {DAYS[day.getDay()]}
                  </CardTitle>
                  <p className={`text-lg font-display font-bold ${isToday ? "text-primary" : ""}`}>
                    {day.getDate()}
                  </p>
                </CardHeader>
                <CardContent className="px-2 pb-2 space-y-1">
                  {dayShifts.length === 0 ? (
                    <p className="text-xs text-muted-foreground/50 py-2 text-center">â€”</p>
                  ) : (
                    dayShifts.map(s => (
                      <div
                        key={s.id}
                        className="rounded-md px-2 py-1.5 text-xs text-white"
                        style={{ backgroundColor: s.color || "#3b82f6" }}
                      >
                        <p className="font-semibold truncate">
                          {s.profiles?.first_name} {s.profiles?.last_name?.[0]}.
                        </p>
                        <p className="opacity-80">
                          {formatTime(s.start_time)} â€“ {formatTime(s.end_time)}
                        </p>
                        {s.title && <p className="opacity-70 truncate">{s.title}</p>}
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create Shift Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display">Create Shift</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Employee *</Label>
              <Select
                value={form.employee_id}
                onValueChange={(v) => { setForm({ ...form, employee_id: v }); setTimeout(checkConflicts, 100); }}
              >
                <SelectTrigger><SelectValue placeholder="Select employee..." /></SelectTrigger>
                <SelectContent>
                  {employees.map(e => (
                    <SelectItem key={e.user_id} value={e.user_id}>
                      {e.first_name} {e.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Date *</Label>
                <Input
                  type="date"
                  value={form.date}
                  onChange={(e) => { setForm({ ...form, date: e.target.value }); setTimeout(checkConflicts, 100); }}
                />
              </div>
              <div className="space-y-2">
                <Label>Department</Label>
                <Select value={form.department_id} onValueChange={(v) => setForm({ ...form, department_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>
                    {departments.map(d => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Time</Label>
                <div className="flex gap-1">
                  <Input className="w-16" value={form.start_hour} onChange={e => setForm({ ...form, start_hour: e.target.value })} maxLength={2} />
                  <span className="self-center">:</span>
                  <Input className="w-16" value={form.start_min} onChange={e => setForm({ ...form, start_min: e.target.value })} maxLength={2} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>End Time</Label>
                <div className="flex gap-1">
                  <Input className="w-16" value={form.end_hour} onChange={e => setForm({ ...form, end_hour: e.target.value })} maxLength={2} />
                  <span className="self-center">:</span>
                  <Input className="w-16" value={form.end_min} onChange={e => setForm({ ...form, end_min: e.target.value })} maxLength={2} />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Break (minutes)</Label>
                <Input type="number" value={form.break_minutes} onChange={e => setForm({ ...form, break_minutes: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Title/Role</Label>
                <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="e.g. Front Desk" />
              </div>
            </div>

            {/* Conflict Warnings */}
            {conflicts.length > 0 && (
              <div className="space-y-2">
                {conflicts.map((c, i) => (
                  <div key={i} className={`flex items-start gap-2 rounded-md p-3 text-sm ${
                    c.severity === "error" ? "bg-destructive/10 text-destructive" : "bg-warning/10 text-warning"
                  }`}>
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>{c.message}</span>
                  </div>
                ))}
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Cancel</Button>
              <Button onClick={handleCreate} disabled={saving || conflicts.some(c => c.severity === "error")}>
                {saving ? "Creating..." : "Create Shift"}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
