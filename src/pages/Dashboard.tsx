import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, Users, DollarSign, MapPin, AlertTriangle, CheckCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export default function Dashboard() {
  const { profile, isAdmin, isHR } = useAuth();
  const [stats, setStats] = useState({ todayClockIns: 0, totalEmployees: 0, pendingPayroll: 0, activeGeofences: 0, missedClockOuts: 0 });

  useEffect(() => {
    const fetchStats = async () => {
      const today = new Date().toISOString().split("T")[0];

      const [attendance, employees, payPeriods, geofences] = await Promise.all([
        supabase.from("attendance_records").select("id, clock_out", { count: "exact" }).gte("clock_in", today),
        supabase.from("profiles").select("id", { count: "exact" }),
        supabase.from("pay_periods").select("id", { count: "exact" }).eq("status", "draft"),
        supabase.from("geofences").select("id", { count: "exact" }).eq("is_active", true),
      ]);

      const missed = attendance.data?.filter(r => !r.clock_out).length || 0;

      setStats({
        todayClockIns: attendance.count || 0,
        totalEmployees: employees.count || 0,
        pendingPayroll: payPeriods.count || 0,
        activeGeofences: geofences.count || 0,
        missedClockOuts: missed,
      });
    };
    fetchStats();
  }, []);

  const greeting = `Good ${new Date().getHours() < 12 ? "morning" : new Date().getHours() < 17 ? "afternoon" : "evening"}, ${profile?.first_name || "there"}`;

  return (
    <div className="space-y-6 animate-slide-up">
      <div>
        <h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight">{greeting}</h1>
        <p className="text-muted-foreground mt-1">
          {isAdmin || isHR ? "Here's your organization overview" : "Here's your work summary"}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Clock} label="Today's Clock-ins" value={stats.todayClockIns} color="text-primary" />
        {(isAdmin || isHR) && <StatCard icon={Users} label="Total Employees" value={stats.totalEmployees} color="text-success" />}
        {(isAdmin || isHR) && <StatCard icon={MapPin} label="Active Geofences" value={stats.activeGeofences} color="text-warning" />}
        {(isAdmin || isHR) && <StatCard icon={DollarSign} label="Pending Payroll" value={stats.pendingPayroll} color="text-primary" />}
      </div>

      {(isAdmin || isHR) && stats.missedClockOuts > 0 && (
        <Card className="border-warning/30 bg-warning/5">
          <CardContent className="flex items-center gap-3 py-4">
            <AlertTriangle className="h-5 w-5 text-warning" />
            <p className="text-sm font-medium">
              {stats.missedClockOuts} employee(s) have not clocked out today.
            </p>
          </CardContent>
        </Card>
      )}

      {!isAdmin && !isHR && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="font-display text-lg flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-success" />
                Quick Clock In
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">Use geolocation to clock in at your assigned work site.</p>
              <a href="/clock" className="inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 transition">
                <MapPin className="h-4 w-4 mr-2" /> Go to Clock In
              </a>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="font-display text-lg flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-primary" />
                Latest Pay Stub
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">View your most recent pay information and download stubs.</p>
              <a href="/pay-stubs" className="inline-flex items-center justify-center rounded-md bg-secondary text-secondary-foreground px-4 py-2 text-sm font-medium hover:bg-secondary/80 transition">
                View Pay Stubs
              </a>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: number; color: string }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 py-5">
        <div className={`flex h-12 w-12 items-center justify-center rounded-xl bg-accent ${color}`}>
          <Icon className="h-6 w-6" />
        </div>
        <div>
          <p className="text-2xl font-display font-bold">{value}</p>
          <p className="text-sm text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}
