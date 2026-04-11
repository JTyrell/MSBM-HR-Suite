import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { DollarSign } from "lucide-react";

export default function PayStubs() {
  const { user } = useAuth();
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      if (!user) return;
      const { data } = await supabase
        .from("payroll_records")
        .select("*, pay_periods(name, start_date, end_date, pay_date)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      setRecords(data || []);
      setLoading(false);
    };
    fetch();
  }, [user]);

  return (
    <div className="space-y-6 animate-slide-up">
      <div>
        <h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
          <DollarSign className="h-7 w-7 text-primary" /> Pay Stubs
        </h1>
        <p className="text-muted-foreground mt-1">View your pay history and earnings breakdown</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>
      ) : records.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12 text-muted-foreground">No pay stubs available yet</CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {records.map((r) => (
            <Card key={r.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="font-display text-lg">{r.pay_periods?.name}</CardTitle>
                  <Badge variant={r.status === "finalized" ? "default" : "secondary"}>{r.status}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {r.pay_periods?.start_date && new Date(r.pay_periods.start_date).toLocaleDateString()} — {r.pay_periods?.end_date && new Date(r.pay_periods.end_date).toLocaleDateString()}
                </p>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Regular Hours</p>
                    <p className="font-display font-bold text-lg">{Number(r.regular_hours).toFixed(1)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Overtime Hours</p>
                    <p className="font-display font-bold text-lg">{Number(r.overtime_hours).toFixed(1)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Gross Pay</p>
                    <p className="font-display font-bold text-lg text-success">${Number(r.gross_pay).toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Net Pay</p>
                    <p className="font-display font-bold text-lg text-primary">${Number(r.net_pay).toFixed(2)}</p>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Tax</p>
                    <p className="font-medium">-${Number(r.tax_deductions).toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Benefits</p>
                    <p className="font-medium">-${Number(r.benefit_deductions).toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Other</p>
                    <p className="font-medium">-${Number(r.other_deductions).toFixed(2)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
