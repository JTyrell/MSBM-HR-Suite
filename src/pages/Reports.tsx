/* eslint-disable @typescript-eslint/no-explicit-any */
 
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useFeatureFlag } from "@/hooks/useFeatureFlag";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart3 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

export default function Reports() {
  const { isAdmin, isHR } = useAuth();
  const rptEnabled = useFeatureFlag("enabled_reporting");
  const [departments, setDepartments] = useState<Record<string, any>[]>([]);
  const [deptFilter, setDeptFilter] = useState("all");
  const [headcount, setHeadcount] = useState<Record<string, any>[]>([]);
  const [attendanceSummary, setAttendanceSummary] = useState<Record<string, any>[]>([]);
  const [payrollSummary, setPayrollSummary] = useState<Record<string, any>[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const [deptRes, profilesRes, attendanceRes, payrollRes] = await Promise.all([
        supabase.from("departments").select("*").order("name"),
        supabase.from("profiles").select("department_id, status, role_tier, departments(name)").eq("status", "active"),
        supabase.from("attendance_records").select("status, clock_in").gte("clock_in", new Date(Date.now() - 30 * 86400000).toISOString()),
        supabase.from("payroll_records").select("gross_pay, net_pay, tax_deductions, pay_periods(name)").order("created_at", { ascending: false }).limit(200),
      ]);

      setDepartments(deptRes.data || []);

      // Headcount by department
      const deptCounts: Record<string, number> = {};
      (profilesRes.data || []).forEach((p: Record<string, any>) => {
        const name = p.departments?.name || "Unassigned";
        deptCounts[name] = (deptCounts[name] || 0) + 1;
      });
      setHeadcount(Object.entries(deptCounts).map(([name, count]) => ({ name, count })));

      // Attendance summary (last 30 days)
      const attCounts: Record<string, number> = { valid: 0, invalid: 0, pending: 0 };
      (attendanceRes.data || []).forEach((a: Record<string, any>) => {
        if (attCounts[a.status] !== undefined) attCounts[a.status]++;
      });
      setAttendanceSummary(Object.entries(attCounts).map(([name, value]) => ({ name, value })));

      // Payroll by period
      const periodTotals: Record<string, { gross: number; net: number; tax: number }> = {};
      (payrollRes.data || []).forEach((r: Record<string, any>) => {
        const period = r.pay_periods?.name || "Unknown";
        if (!periodTotals[period]) periodTotals[period] = { gross: 0, net: 0, tax: 0 };
        periodTotals[period].gross += Number(r.gross_pay);
        periodTotals[period].net += Number(r.net_pay);
        periodTotals[period].tax += Number(r.tax_deductions);
      });
      setPayrollSummary(Object.entries(periodTotals).slice(0, 6).map(([name, v]) => ({
        name: name.length > 15 ? name.slice(0, 15) + "â€¦" : name,
        gross: Math.round(v.gross),
        net: Math.round(v.net),
        tax: Math.round(v.tax),
      })));

      setLoading(false);
    };
    fetch();
  }, []);

  if (!rptEnabled) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Reporting is not enabled. Contact your administrator.</p>
      </div>
    );
  }

  if (!isAdmin && !isHR) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Reports are available to administrators only.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-slide-up">
      <div>
        <h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
          <BarChart3 className="h-7 w-7 text-primary" /> Reports
        </h1>
        <p className="text-muted-foreground mt-1">Labor analytics, compliance summaries, and workforce insights</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      ) : (
        <div className="grid gap-6">
          {/* Headcount by Department */}
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="font-display">Headcount by Department</CardTitle>
                <CardDescription>Active employees across departments</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={headcount}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis dataKey="name" fontSize={12} />
                    <YAxis fontSize={12} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Attendance (30 days) */}
            <Card>
              <CardHeader>
                <CardTitle className="font-display">Attendance Status (30 days)</CardTitle>
                <CardDescription>Clock-in validation breakdown</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie data={attendanceSummary} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                      {attendanceSummary.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Payroll Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="font-display">Payroll Summary by Period</CardTitle>
              <CardDescription>Gross pay, net pay, and tax deductions</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={payrollSummary}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="name" fontSize={11} />
                  <YAxis fontSize={12} />
                  <Tooltip formatter={(v: number) => `$${v.toLocaleString()}`} />
                  <Legend />
                  <Bar dataKey="gross" name="Gross Pay" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="net" name="Net Pay" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="tax" name="Tax" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
