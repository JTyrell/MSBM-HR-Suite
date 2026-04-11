import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { DollarSign, Plus, Play, CheckCircle, Loader2 } from "lucide-react";

export default function Payroll() {
  const { isAdmin, isHR } = useAuth();
  const [periods, setPeriods] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [processing, setProcessing] = useState<string | null>(null);

  const fetchPeriods = async () => {
    const { data } = await supabase
      .from("pay_periods")
      .select("*")
      .order("start_date", { ascending: false });
    setPeriods(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchPeriods(); }, []);

  const handleRunPayroll = async (periodId: string) => {
    setProcessing(periodId);
    try {
      const res = await supabase.functions.invoke("calculate-payroll", {
        body: { pay_period_id: periodId },
      });
      if (res.error) throw new Error(res.error.message);
      toast.success(`Payroll calculated: ${res.data?.records_created || 0} records processed`);
      fetchPeriods();
    } catch (err: any) {
      toast.error(err.message);
    }
    setProcessing(null);
  };

  const handleFinalize = async (periodId: string) => {
    if (!confirm("Finalize this payroll period? This cannot be undone.")) return;
    const { error } = await supabase
      .from("pay_periods")
      .update({ status: "completed" })
      .eq("id", periodId);
    if (error) toast.error(error.message);
    else { toast.success("Payroll finalized"); fetchPeriods(); }
  };

  return (
    <div className="space-y-6 animate-slide-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <DollarSign className="h-7 w-7 text-primary" /> Payroll
          </h1>
          <p className="text-muted-foreground mt-1">Manage payroll periods and run calculations</p>
        </div>
        {(isAdmin || isHR) && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" /> New Period</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle className="font-display">Create Pay Period</DialogTitle></DialogHeader>
              <PayPeriodForm onSuccess={() => { setDialogOpen(false); fetchPeriods(); }} />
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>
          ) : periods.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">No pay periods created yet</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Period</TableHead>
                  <TableHead>Start</TableHead>
                  <TableHead>End</TableHead>
                  <TableHead>Pay Date</TableHead>
                  <TableHead>Status</TableHead>
                  {(isAdmin || isHR) && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {periods.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell>{new Date(p.start_date).toLocaleDateString()}</TableCell>
                    <TableCell>{new Date(p.end_date).toLocaleDateString()}</TableCell>
                    <TableCell>{p.pay_date ? new Date(p.pay_date).toLocaleDateString() : "—"}</TableCell>
                    <TableCell>
                      <Badge variant={
                        p.status === "completed" ? "default" :
                        p.status === "processing" ? "secondary" : "outline"
                      }>
                        {p.status}
                      </Badge>
                    </TableCell>
                    {(isAdmin || isHR) && (
                      <TableCell className="text-right space-x-2">
                        {p.status === "draft" && (
                          <Button size="sm" variant="outline" onClick={() => handleRunPayroll(p.id)} disabled={!!processing}>
                            {processing === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4 mr-1" />}
                            Calculate
                          </Button>
                        )}
                        {p.status === "processing" && (
                          <Button size="sm" onClick={() => handleFinalize(p.id)}>
                            <CheckCircle className="h-4 w-4 mr-1" /> Finalize
                          </Button>
                        )}
                      </TableCell>
                    )}
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

function PayPeriodForm({ onSuccess }: { onSuccess: () => void }) {
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [payDate, setPayDate] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.from("pay_periods").insert({
      name,
      start_date: startDate,
      end_date: endDate,
      pay_date: payDate || null,
    });
    if (error) toast.error(error.message);
    else { toast.success("Pay period created"); onSuccess(); }
    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>Period Name</Label>
        <Input placeholder="e.g. January 2026 - Biweekly 1" value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Start Date</Label>
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label>End Date</Label>
          <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Pay Date (optional)</Label>
        <Input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} />
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Creating..." : "Create Period"}
      </Button>
    </form>
  );
}
