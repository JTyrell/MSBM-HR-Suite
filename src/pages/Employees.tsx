/* eslint-disable @typescript-eslint/no-explicit-any */
 
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Users, Search, UserPlus, Copy, Check } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export default function Employees() {
  const { isAdmin, isHR } = useAuth();
  const [employees, setEmployees] = useState<Record<string, any>[]>([]);
   
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Invite dialog state
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [inviteResult, setInviteResult] = useState<{ resetLink: string; name: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [inviteForm, setInviteForm] = useState({
    email: "",
    first_name: "",
    last_name: "",
    department_id: "",
    job_title: "",
    pay_rate: "",
    pay_type: "hourly",
  });

  const fetchData = async () => {
    const [emp, dept] = await Promise.all([
      supabase.from("profiles").select("*, departments(name)").order("created_at", { ascending: false }),
      supabase.from("departments").select("*").order("name"),
    ]);
    setEmployees(emp.data || []);
    setDepartments(dept.data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filtered = employees.filter((e) => {
    if (!search) return true;
    const name = `${e.first_name} ${e.last_name} ${e.email}`.toLowerCase();
    return name.includes(search.toLowerCase());
  });

  const resetInviteForm = () => {
    setInviteForm({
      email: "", first_name: "", last_name: "",
      department_id: "", job_title: "", pay_rate: "", pay_type: "hourly",
    });
    setInviteResult(null);
    setCopied(false);
  };

  const handleInvite = async () => {
    if (!inviteForm.email || !inviteForm.first_name || !inviteForm.last_name) {
      toast.error("Email, first name, and last name are required");
      return;
    }
    setInviting(true);
    try {
      const { data, error } = await supabase.functions.invoke("invite-employee", {
        body: {
          email: inviteForm.email.trim(),
          first_name: inviteForm.first_name.trim(),
          last_name: inviteForm.last_name.trim(),
          department_id: inviteForm.department_id || null,
          job_title: inviteForm.job_title.trim() || null,
          pay_rate: inviteForm.pay_rate ? Number(inviteForm.pay_rate) : 0,
          pay_type: inviteForm.pay_type,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success(data.message || "Employee invited successfully");

      if (data.reset_link) {
        setInviteResult({
          resetLink: data.reset_link,
          name: `${inviteForm.first_name} ${inviteForm.last_name}`,
        });
      } else {
        setInviteOpen(false);
        resetInviteForm();
      }
      fetchData();
    } catch (err: unknown) {
      if (err instanceof Error) {
        toast.error(err.message || "Failed to invite employee");
      } else {
        toast.error("Failed to invite employee");
      }
    }
    setInviting(false);
  };

  const copyLink = async () => {
    if (!inviteResult?.resetLink) return;
    await navigator.clipboard.writeText(inviteResult.resetLink);
    setCopied(true);
    toast.success("Reset link copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6 animate-slide-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <Users className="h-7 w-7 text-primary" /> Employees
          </h1>
          <p className="text-muted-foreground mt-1">Manage your workforce</p>
        </div>
        {(isAdmin || isHR) && (
          <Button onClick={() => { resetInviteForm(); setInviteOpen(true); }}>
            <UserPlus className="h-4 w-4 mr-2" /> Invite Employee
          </Button>
        )}
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search employees..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">No employees found</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Job Title</TableHead>
                  <TableHead>Pay Type</TableHead>
                  <TableHead>Pay Rate</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="font-medium">{e.first_name} {e.last_name}</TableCell>
                    <TableCell className="text-muted-foreground">{e.email}</TableCell>
                    <TableCell>{e.departments?.name || "â€”"}</TableCell>
                    <TableCell>{e.job_title || "â€”"}</TableCell>
                    <TableCell><Badge variant="secondary">{e.pay_type}</Badge></TableCell>
                    <TableCell>${Number(e.pay_rate).toFixed(2)}</TableCell>
                    <TableCell>
                      <Badge variant={e.status === "active" ? "default" : "secondary"}>{e.status}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* ===== INVITE EMPLOYEE DIALOG ===== */}
      <Dialog open={inviteOpen} onOpenChange={(open) => { if (!open) { setInviteOpen(false); resetInviteForm(); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display">
              {inviteResult ? "Employee Invited" : "Invite New Employee"}
            </DialogTitle>
          </DialogHeader>

          {inviteResult ? (
            /* â”€â”€ Success: Show reset link â”€â”€ */
            <div className="space-y-4 py-2">
              <div className="rounded-lg bg-success/10 border border-success/30 p-4">
                <p className="text-sm font-medium text-success mb-1">âœ“ {inviteResult.name} has been created</p>
                <p className="text-xs text-muted-foreground">
                  Share the link below so they can set their password and log in for the first time.
                </p>
              </div>
              <div className="space-y-2">
                <Label>Password Reset Link</Label>
                <div className="flex gap-2">
                  <Input
                    value={inviteResult.resetLink}
                    readOnly
                    className="text-xs font-mono bg-muted"
                  />
                  <Button size="icon" variant="outline" onClick={copyLink}>
                    {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  This link expires after use. The employee will set their own password.
                </p>
              </div>
              <DialogFooter>
                <Button onClick={() => { setInviteOpen(false); resetInviteForm(); }}>Done</Button>
              </DialogFooter>
            </div>
          ) : (
            /* â”€â”€ Invite form â”€â”€ */
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>First Name *</Label>
                  <Input
                    placeholder="John"
                    value={inviteForm.first_name}
                    onChange={(e) => setInviteForm({ ...inviteForm, first_name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Last Name *</Label>
                  <Input
                    placeholder="Doe"
                    value={inviteForm.last_name}
                    onChange={(e) => setInviteForm({ ...inviteForm, last_name: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Email *</Label>
                <Input
                  type="email"
                  placeholder="john.doe@company.com"
                  value={inviteForm.email}
                  onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Department</Label>
                  <Select value={inviteForm.department_id} onValueChange={(v) => setInviteForm({ ...inviteForm, department_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                    <SelectContent>
                      {departments.map((d) => (
                        <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Job Title</Label>
                  <Input
                    placeholder="Software Engineer"
                    value={inviteForm.job_title}
                    onChange={(e) => setInviteForm({ ...inviteForm, job_title: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Pay Rate</Label>
                  <Input
                    type="number"
                    placeholder="0.00"
                    value={inviteForm.pay_rate}
                    onChange={(e) => setInviteForm({ ...inviteForm, pay_rate: e.target.value })}
                    min={0}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Pay Type</Label>
                  <Select value={inviteForm.pay_type} onValueChange={(v) => setInviteForm({ ...inviteForm, pay_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hourly">Hourly</SelectItem>
                      <SelectItem value="salary">Salary</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => { setInviteOpen(false); resetInviteForm(); }} disabled={inviting}>
                  Cancel
                </Button>
                <Button onClick={handleInvite} disabled={inviting}>
                  {inviting ? "Inviting..." : "Send Invite"}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
