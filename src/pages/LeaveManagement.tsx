/* eslint-disable @typescript-eslint/no-explicit-any */
 
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useFeatureFlag } from "@/hooks/useFeatureFlag";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Umbrella, Plus, Check, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

const LEAVE_TYPES = [
  { value: "vacation", label: "Vacation" },
  { value: "sick", label: "Sick Leave" },
  { value: "personal", label: "Personal Day" },
  { value: "maternity", label: "Maternity Leave" },
  { value: "paternity", label: "Paternity Leave" },
  { value: "bereavement", label: "Bereavement" },
  { value: "other", label: "Other" },
];

export default function LeaveManagement() {
  const { user, isAdmin, isHR } = useAuth();
  const wfmEnabled = useFeatureFlag("enabled_workforce_mgmt");
  const [requests, setRequests] = useState<Record<string, any>[]>([]);
  const [balances, setBalances] = useState<Record<string, any>[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ leave_type: "vacation", start_date: "", end_date: "", notes: "" });

  const fetchData = async () => {
    const [reqRes, balRes] = await Promise.all([
      isAdmin || isHR
        ? supabase.from("time_off_requests").select("*, profiles!time_off_requests_user_id_fkey(first_name, last_name)").order("created_at", { ascending: false }).limit(50)
        : supabase.from("time_off_requests").select("*").eq("user_id", user?.id).order("created_at", { ascending: false }),
      supabase.from("leave_balances").select("*").eq("user_id", user?.id).eq("year", new Date().getFullYear()),
    ]);
    setRequests(reqRes.data || []);
    setBalances(balRes.data || []);
    setLoading(false);
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (user) fetchData(); }, [user]);

  if (!wfmEnabled) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Workforce management is not enabled.</p>
      </div>
    );
  }

  const handleSubmit = async () => {
    if (!form.start_date || !form.end_date) { toast.error("Dates required"); return; }
    setSaving(true);
    const { error } = await supabase.from("time_off_requests").insert({
      user_id: user?.id,
      leave_type: form.leave_type,
      start_date: form.start_date,
      end_date: form.end_date,
      notes: form.notes || null,
    });
    if (error) toast.error(error.message);
    else { toast.success("Leave request submitted"); setDialogOpen(false); fetchData(); }
    setSaving(false);
  };

  const handleDecision = async (id: string, status: "approved" | "rejected") => {
    const { error } = await supabase.from("time_off_requests").update({
      status, approver_id: user?.id, decided_at: new Date().toISOString(),
    }).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success(`Request ${status}`); fetchData(); }
  };

  const statusColor = (s: string) => s === "approved" ? "default" : s === "rejected" ? "destructive" : "secondary";

  return (
    <div className="space-y-6 animate-slide-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <Umbrella className="h-7 w-7 text-primary" /> Leave Management
          </h1>
          <p className="text-muted-foreground mt-1">
            {isAdmin || isHR ? "Manage employee leave requests" : "Request and track your time off"}
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" /> Request Leave
        </Button>
      </div>

      {/* Leave Balances */}
      {balances.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-3">
          {balances.map(b => (
            <Card key={b.id}>
              <CardContent className="py-4">
                <p className="text-sm text-muted-foreground capitalize">{b.leave_type}</p>
                <p className="text-2xl font-display font-bold">
                  {(Number(b.total_days) + Number(b.carried_over) - Number(b.used_days)).toFixed(1)}
                  <span className="text-sm font-normal text-muted-foreground ml-1">days remaining</span>
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Requests List */}
      <Card>
        <CardHeader><CardTitle className="font-display">Leave Requests</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>
          ) : requests.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No leave requests</p>
          ) : (
            <div className="space-y-3">
              {requests.map(r => (
                <div key={r.id} className="flex items-center justify-between border rounded-lg p-4">
                  <div>
                    {(isAdmin || isHR) && r.profiles && (
                      <p className="font-medium">{r.profiles.first_name} {r.profiles.last_name}</p>
                    )}
                    <p className="text-sm capitalize">{r.leave_type}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(r.start_date).toLocaleDateString()} â€” {new Date(r.end_date).toLocaleDateString()}
                    </p>
                    {r.notes && <p className="text-xs text-muted-foreground mt-1">{r.notes}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={statusColor(r.status)}>{r.status}</Badge>
                    {(isAdmin || isHR) && r.status === "pending" && (
                      <>
                        <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => handleDecision(r.id, "approved")}>
                          <Check className="h-4 w-4 text-success" />
                        </Button>
                        <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => handleDecision(r.id, "rejected")}>
                          <X className="h-4 w-4 text-destructive" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Request Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-display">Request Time Off</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Leave Type</Label>
              <Select value={form.leave_type} onValueChange={v => setForm({ ...form, leave_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LEAVE_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Input type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>End Date</Label>
                <Input type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Reason for leave..." />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Cancel</Button>
              <Button onClick={handleSubmit} disabled={saving}>{saving ? "Submitting..." : "Submit Request"}</Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
