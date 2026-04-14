import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import JaComplianceFields from "@/components/compliance/JaComplianceFields";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  Shield, Users, Building2, Search, UserCog, Plus, Trash2,
  Activity, UserCheck, UserX, Edit, BarChart3, ClipboardList,
  CheckSquare, Clock, FileText,
} from "lucide-react";

type Profile = {
  id: string; user_id: string; first_name: string; last_name: string;
  email: string; phone: string | null; department_id: string | null;
  job_title: string | null; pay_rate: number; pay_type: "hourly" | "salary";
  hire_date: string | null; status: string; avatar_url: string | null;
  created_at: string; departments?: { name: string } | null;
};
type UserRole = { id: string; user_id: string; role: "admin" | "hr_manager" | "employee"; created_at: string };
type Department = { id: string; name: string; description: string | null; created_at: string };
type AuditLog = { id: string; actor_id: string; action: string; entity_type: string; entity_id: string | null; details: any; created_at: string };

const ROLE_COLORS: Record<string, string> = { admin: "destructive", hr_manager: "default", employee: "secondary" };

const ACTION_ICONS: Record<string, typeof Edit> = {
  user_updated: Edit, role_added: UserCog, role_removed: Trash2,
  dept_created: Plus, dept_updated: Edit, dept_deleted: Trash2,
  bulk_status_change: CheckSquare, bulk_department_change: Building2, bulk_role_add: UserCog,
};

export default function CRMPage() {
  const { isAdmin, user } = useAuth();
  const [tab, setTab] = useState("overview");

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  // Selections for bulk
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState("");
  const [bulkValue, setBulkValue] = useState("");
  const [bulkDialog, setBulkDialog] = useState(false);

  // Dialogs
  const [editUser, setEditUser] = useState<Profile | null>(null);
  const [roleDialog, setRoleDialog] = useState<{ userId: string; userName: string } | null>(null);
  const [newRole, setNewRole] = useState<string>("employee");
  const [deptDialog, setDeptDialog] = useState(false);
  const [deptForm, setDeptForm] = useState({ name: "", description: "" });
  const [editDept, setEditDept] = useState<Department | null>(null);

  const [editForm, setEditForm] = useState({
    first_name: "", last_name: "", email: "", phone: "", job_title: "",
    department_id: "", pay_rate: "", pay_type: "hourly" as string, status: "active",
  });

  const logAudit = useCallback(async (action: string, entity_type: string, entity_id: string | null, details: any = {}) => {
    if (!user) return;
    await supabase.from("audit_logs").insert({ actor_id: user.id, action, entity_type, entity_id, details });
  }, [user]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [p, r, d, a] = await Promise.all([
      supabase.from("profiles").select("*, departments(name)").order("created_at", { ascending: false }),
      supabase.from("user_roles").select("*"),
      supabase.from("departments").select("*").order("name"),
      supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(100),
    ]);
    setProfiles((p.data as Profile[]) || []);
    setRoles((r.data as UserRole[]) || []);
    setDepartments((d.data as Department[]) || []);
    setAuditLogs((a.data as AuditLog[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const getUserRoles = (userId: string) => roles.filter((r) => r.user_id === userId);
  const activeCount = profiles.filter((p) => p.status === "active").length;
  const inactiveCount = profiles.filter((p) => p.status !== "active").length;
  const adminCount = roles.filter((r) => r.role === "admin").length;
  const hrCount = roles.filter((r) => r.role === "hr_manager").length;

  const filtered = profiles.filter((p) => {
    if (!search) return true;
    const haystack = `${p.first_name} ${p.last_name} ${p.email} ${p.job_title || ""}`.toLowerCase();
    return haystack.includes(search.toLowerCase());
  });

  const getActorName = (actorId: string) => {
    const p = profiles.find((pr) => pr.user_id === actorId);
    return p ? `${p.first_name} ${p.last_name}` : actorId.slice(0, 8);
  };

  // Toggle selection
  const toggleSelect = (userId: string) => {
    setSelectedUsers((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };
  const toggleAll = () => {
    if (selectedUsers.size === filtered.length) setSelectedUsers(new Set());
    else setSelectedUsers(new Set(filtered.map((p) => p.id)));
  };

  // --- User Edit ---
  const openEditUser = (p: Profile) => {
    setEditUser(p);
    setEditForm({
      first_name: p.first_name, last_name: p.last_name, email: p.email,
      phone: p.phone || "", job_title: p.job_title || "",
      department_id: p.department_id || "", pay_rate: String(p.pay_rate),
      pay_type: p.pay_type, status: p.status,
    });
  };

  const MAX_FIELD_LEN = 255;
  const sanitize = (val: string) => val.trim().slice(0, MAX_FIELD_LEN);

  const saveUser = async () => {
    if (!editUser || saving) return;
    const firstName = sanitize(editForm.first_name);
    const lastName = sanitize(editForm.last_name);
    if (!firstName || !lastName) { toast.error("First and last name are required"); return; }
    setSaving(true);
    const updates = {
      first_name: firstName, last_name: lastName,
      phone: sanitize(editForm.phone) || null, job_title: sanitize(editForm.job_title) || null,
      department_id: editForm.department_id || null, pay_rate: Math.max(0, Number(editForm.pay_rate) || 0),
      pay_type: editForm.pay_type as "hourly" | "salary", status: editForm.status,
    };
    const { error } = await supabase.from("profiles").update(updates).eq("id", editUser.id);
    if (error) { toast.error(error.message); setSaving(false); return; }
    await logAudit("user_updated", "profile", editUser.id, { changes: updates, user_name: `${editUser.first_name} ${editUser.last_name}` });
    toast.success("User updated");
    setEditUser(null);
    setSaving(false);
    fetchAll();
  };

  // --- Role Management ---
  const addRole = async () => {
    if (!roleDialog || saving) return;
    setSaving(true);
    const { error } = await supabase.from("user_roles").insert({ user_id: roleDialog.userId, role: newRole as any });
    if (error) { toast.error(error.code === "23505" ? "User already has this role" : error.message); setSaving(false); return; }
    await logAudit("role_added", "user_role", roleDialog.userId, { role: newRole, user_name: roleDialog.userName });
    toast.success("Role added");
    setRoleDialog(null);
    setSaving(false);
    fetchAll();
  };

  const removeRole = async (roleId: string, roleName?: string, userName?: string) => {
    if (saving) return;
    if (!confirm(`Remove the "${roleName}" role from ${userName || "this user"}?`)) return;
    setSaving(true);
    const { error } = await supabase.from("user_roles").delete().eq("id", roleId);
    if (error) { toast.error(error.message); setSaving(false); return; }
    await logAudit("role_removed", "user_role", roleId, { role: roleName, user_name: userName });
    toast.success("Role removed");
    setSaving(false);
    fetchAll();
  };

  // --- Department Management ---
  const saveDept = async () => {
    if (saving) return;
    const deptName = sanitize(deptForm.name);
    if (!deptName) { toast.error("Name required"); return; }
    if (deptName.length < 2) { toast.error("Department name must be at least 2 characters"); return; }
    setSaving(true);
    if (editDept) {
      const { error } = await supabase.from("departments").update({ name: deptName, description: sanitize(deptForm.description) || null }).eq("id", editDept.id);
      if (error) { toast.error(error.message); setSaving(false); return; }
      await logAudit("dept_updated", "department", editDept.id, { name: deptName });
      toast.success("Department updated");
    } else {
      const { data, error } = await supabase.from("departments").insert({ name: deptName, description: sanitize(deptForm.description) || null }).select("id").single();
      if (error) { toast.error(error.message); setSaving(false); return; }
      await logAudit("dept_created", "department", data?.id, { name: deptName });
      toast.success("Department created");
    }
    setDeptDialog(false); setEditDept(null); setDeptForm({ name: "", description: "" });
    setSaving(false);
    fetchAll();
  };

  const deleteDept = async (id: string, name?: string) => {
    if (saving) return;
    if (!confirm(`Permanently delete department "${name || id}"? Employees in this department will be unassigned.`)) return;
    setSaving(true);
    const { error } = await supabase.from("departments").delete().eq("id", id);
    if (error) { toast.error(error.message); setSaving(false); return; }
    await logAudit("dept_deleted", "department", id, { name });
    toast.success("Department deleted");
    setSaving(false);
    fetchAll();
  };

  // --- Bulk Actions ---
  const executeBulk = async () => {
    if (saving) return;
    if (selectedUsers.size === 0) { toast.error("No users selected"); return; }
    const ids = Array.from(selectedUsers);
    const names = ids.map((id) => {
      const p = profiles.find((pr) => pr.id === id);
      return p ? `${p.first_name} ${p.last_name}` : id;
    });

    setSaving(true);
    if (bulkAction === "status") {
      const { error } = await supabase.from("profiles").update({ status: bulkValue }).in("id", ids);
      if (error) { toast.error(error.message); setSaving(false); return; }
      await logAudit("bulk_status_change", "profile", null, { count: ids.length, status: bulkValue, users: names });
      toast.success(`Updated ${ids.length} user(s) to ${bulkValue}`);
    } else if (bulkAction === "department") {
      const { error } = await supabase.from("profiles").update({ department_id: bulkValue || null }).in("id", ids);
      if (error) { toast.error(error.message); setSaving(false); return; }
      const dept = departments.find((d) => d.id === bulkValue);
      await logAudit("bulk_department_change", "profile", null, { count: ids.length, department: dept?.name || "None", users: names });
      toast.success(`Moved ${ids.length} user(s)`);
    } else if (bulkAction === "role") {
      let successCount = 0;
      for (const profileId of ids) {
        const p = profiles.find((pr) => pr.id === profileId);
        if (!p) continue;
        const { error } = await supabase.from("user_roles").insert({ user_id: p.user_id, role: bulkValue as any });
        if (!error) successCount++;
      }
      await logAudit("bulk_role_add", "user_role", null, { count: successCount, role: bulkValue, users: names });
      toast.success(`Added role to ${successCount} user(s)`);
    }
    setBulkDialog(false); setBulkAction(""); setBulkValue(""); setSelectedUsers(new Set());
    setSaving(false);
    fetchAll();
  };

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <Shield className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 className="font-display text-xl font-bold">Access Denied</h2>
            <p className="text-muted-foreground mt-2">Only system administrators can access the CRM panel.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-slide-up">
      <div>
        <h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
          <Shield className="h-7 w-7 text-primary" /> CRM Panel
        </h1>
        <p className="text-muted-foreground mt-1">Comprehensive user & application management</p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid w-full grid-cols-6 max-w-3xl">
          <TabsTrigger value="overview"><BarChart3 className="h-4 w-4 mr-1" />Overview</TabsTrigger>
          <TabsTrigger value="users"><Users className="h-4 w-4 mr-1" />Users</TabsTrigger>
          <TabsTrigger value="roles"><UserCog className="h-4 w-4 mr-1" />Roles</TabsTrigger>
          <TabsTrigger value="departments"><Building2 className="h-4 w-4 mr-1" />Depts</TabsTrigger>
          <TabsTrigger value="audit"><ClipboardList className="h-4 w-4 mr-1" />Audit</TabsTrigger>
          <TabsTrigger value="activity"><Activity className="h-4 w-4 mr-1" />Activity</TabsTrigger>
        </TabsList>

        {/* ===== OVERVIEW ===== */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
            <Card><CardContent className="pt-6 flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center"><Users className="h-6 w-6 text-primary" /></div>
              <div><p className="text-2xl font-bold">{profiles.length}</p><p className="text-xs text-muted-foreground">Total Users</p></div>
            </CardContent></Card>
            <Card><CardContent className="pt-6 flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-green-500/10 flex items-center justify-center"><UserCheck className="h-6 w-6 text-green-500" /></div>
              <div><p className="text-2xl font-bold">{activeCount}</p><p className="text-xs text-muted-foreground">Active</p></div>
            </CardContent></Card>
            <Card><CardContent className="pt-6 flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-orange-500/10 flex items-center justify-center"><UserX className="h-6 w-6 text-orange-500" /></div>
              <div><p className="text-2xl font-bold">{inactiveCount}</p><p className="text-xs text-muted-foreground">Inactive</p></div>
            </CardContent></Card>
            <Card><CardContent className="pt-6 flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-accent/50 flex items-center justify-center"><Building2 className="h-6 w-6 text-accent-foreground" /></div>
              <div><p className="text-2xl font-bold">{departments.length}</p><p className="text-xs text-muted-foreground">Departments</p></div>
            </CardContent></Card>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-base">Role Distribution</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {[
                  { label: "Admins", count: adminCount, color: "bg-destructive" },
                  { label: "HR Managers", count: hrCount, color: "bg-primary" },
                  { label: "Employees", count: roles.filter((r) => r.role === "employee").length, color: "bg-muted-foreground" },
                ].map((r) => (
                  <div key={r.label} className="flex items-center justify-between">
                    <div className="flex items-center gap-2"><div className={`h-3 w-3 rounded-full ${r.color}`} /><span className="text-sm">{r.label}</span></div>
                    <span className="text-sm font-semibold">{r.count}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Recent Users</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {profiles.slice(0, 5).map((p) => (
                  <div key={p.id} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">{p.first_name[0]}{p.last_name[0]}</div>
                      <div><p className="font-medium">{p.first_name} {p.last_name}</p><p className="text-xs text-muted-foreground">{p.email}</p></div>
                    </div>
                    <Badge variant={p.status === "active" ? "default" : "secondary"}>{p.status}</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ===== USERS (with bulk) ===== */}
        <TabsContent value="users" className="space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search users..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            {selectedUsers.size > 0 && (
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="gap-1"><CheckSquare className="h-3 w-3" />{selectedUsers.size} selected</Badge>
                <Button size="sm" variant="outline" onClick={() => { setBulkAction("status"); setBulkValue("active"); setBulkDialog(true); }}>Change Status</Button>
                <Button size="sm" variant="outline" onClick={() => { setBulkAction("department"); setBulkValue(""); setBulkDialog(true); }}>Move Department</Button>
                <Button size="sm" variant="outline" onClick={() => { setBulkAction("role"); setBulkValue("employee"); setBulkDialog(true); }}>Add Role</Button>
              </div>
            )}
          </div>

          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="flex items-center justify-center py-12"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10">
                          <Checkbox checked={selectedUsers.size === filtered.length && filtered.length > 0} onCheckedChange={toggleAll} />
                        </TableHead>
                        <TableHead>User</TableHead>
                        <TableHead>Roles</TableHead>
                        <TableHead>Department</TableHead>
                        <TableHead>Job Title</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Pay</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((p) => {
                        const userRoles = getUserRoles(p.user_id);
                        return (
                          <TableRow key={p.id} data-state={selectedUsers.has(p.id) ? "selected" : undefined}>
                            <TableCell><Checkbox checked={selectedUsers.has(p.id)} onCheckedChange={() => toggleSelect(p.id)} /></TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">{p.first_name[0]}{p.last_name[0]}</div>
                                <div><p className="font-medium text-sm">{p.first_name} {p.last_name}</p><p className="text-xs text-muted-foreground">{p.email}</p></div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1 flex-wrap">
                                {userRoles.map((r) => (<Badge key={r.id} variant={ROLE_COLORS[r.role] as any} className="text-xs capitalize">{r.role.replace("_", " ")}</Badge>))}
                              </div>
                            </TableCell>
                            <TableCell className="text-sm">{p.departments?.name || "—"}</TableCell>
                            <TableCell className="text-sm">{p.job_title || "—"}</TableCell>
                            <TableCell><Badge variant={p.status === "active" ? "default" : "secondary"}>{p.status}</Badge></TableCell>
                            <TableCell className="text-sm">${Number(p.pay_rate).toFixed(2)}/{p.pay_type === "hourly" ? "hr" : "yr"}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                <Button variant="ghost" size="icon" onClick={() => openEditUser(p)} title="Edit"><Edit className="h-4 w-4" /></Button>
                                <Button variant="ghost" size="icon" onClick={() => { setRoleDialog({ userId: p.user_id, userName: `${p.first_name} ${p.last_name}` }); setNewRole("employee"); }} title="Roles"><UserCog className="h-4 w-4" /></Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== ROLES ===== */}
        <TabsContent value="roles" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">All Role Assignments</CardTitle><CardDescription>View and manage role assignments across all users</CardDescription></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow><TableHead>User</TableHead><TableHead>Role</TableHead><TableHead>Assigned</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                <TableBody>
                  {roles.map((r) => {
                    const p = profiles.find((pr) => pr.user_id === r.user_id);
                    const name = p ? `${p.first_name} ${p.last_name}` : r.user_id;
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium text-sm">{name}</TableCell>
                        <TableCell><Badge variant={ROLE_COLORS[r.role] as any} className="capitalize">{r.role.replace("_", " ")}</Badge></TableCell>
                        <TableCell className="text-sm text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => removeRole(r.id, r.role, name)} title="Remove"><Trash2 className="h-4 w-4" /></Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== DEPARTMENTS ===== */}
        <TabsContent value="departments" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => { setDeptDialog(true); setEditDept(null); setDeptForm({ name: "", description: "" }); }}><Plus className="h-4 w-4 mr-1.5" /> Add Department</Button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {departments.map((d) => {
              const count = profiles.filter((p) => p.department_id === d.id).length;
              return (
                <Card key={d.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-base">{d.name}</CardTitle>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditDept(d); setDeptForm({ name: d.name, description: d.description || "" }); setDeptDialog(true); }}><Edit className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteDept(d.id, d.name)}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    </div>
                    {d.description && <CardDescription className="text-xs">{d.description}</CardDescription>}
                  </CardHeader>
                  <CardContent><p className="text-sm text-muted-foreground">{count} employee{count !== 1 ? "s" : ""}</p></CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* ===== AUDIT LOG ===== */}
        <TabsContent value="audit" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><ClipboardList className="h-5 w-5" />Audit Trail</CardTitle>
              <CardDescription>Complete log of all administrative actions</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {auditLogs.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground"><FileText className="h-8 w-8 mx-auto mb-2 opacity-50" /><p>No audit entries yet</p></div>
              ) : (
                <Table>
                  <TableHeader><TableRow><TableHead>Time</TableHead><TableHead>Actor</TableHead><TableHead>Action</TableHead><TableHead>Target</TableHead><TableHead>Details</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {auditLogs.map((log) => {
                      const Icon = ACTION_ICONS[log.action] || FileText;
                      return (
                        <TableRow key={log.id}>
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{new Date(log.created_at).toLocaleString()}</TableCell>
                          <TableCell className="text-sm font-medium">{getActorName(log.actor_id)}</TableCell>
                          <TableCell><Badge variant="outline" className="gap-1 capitalize text-xs"><Icon className="h-3 w-3" />{log.action.replace(/_/g, " ")}</Badge></TableCell>
                          <TableCell className="text-sm">{log.entity_type}</TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{log.details?.user_name || log.details?.name || log.details?.role || JSON.stringify(log.details).slice(0, 60)}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== ACTIVITY DASHBOARD ===== */}
        <TabsContent value="activity" className="space-y-6">
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
            <Card><CardContent className="pt-6 flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center"><ClipboardList className="h-6 w-6 text-primary" /></div>
              <div><p className="text-2xl font-bold">{auditLogs.length}</p><p className="text-xs text-muted-foreground">Total Actions</p></div>
            </CardContent></Card>
            <Card><CardContent className="pt-6 flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-green-500/10 flex items-center justify-center"><Clock className="h-6 w-6 text-green-500" /></div>
              <div><p className="text-2xl font-bold">{auditLogs.filter((l) => new Date(l.created_at) > new Date(Date.now() - 86400000)).length}</p><p className="text-xs text-muted-foreground">Last 24h</p></div>
            </CardContent></Card>
            <Card><CardContent className="pt-6 flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-blue-500/10 flex items-center justify-center"><Users className="h-6 w-6 text-blue-500" /></div>
              <div><p className="text-2xl font-bold">{new Set(auditLogs.map((l) => l.actor_id)).size}</p><p className="text-xs text-muted-foreground">Active Admins</p></div>
            </CardContent></Card>
            <Card><CardContent className="pt-6 flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-orange-500/10 flex items-center justify-center"><CheckSquare className="h-6 w-6 text-orange-500" /></div>
              <div><p className="text-2xl font-bold">{auditLogs.filter((l) => l.action.startsWith("bulk_")).length}</p><p className="text-xs text-muted-foreground">Bulk Ops</p></div>
            </CardContent></Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-base">Actions by Type</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {Object.entries(
                  auditLogs.reduce<Record<string, number>>((acc, l) => { acc[l.action] = (acc[l.action] || 0) + 1; return acc; }, {})
                ).sort(([, a], [, b]) => b - a).map(([action, count]) => {
                  const Icon = ACTION_ICONS[action] || FileText;
                  return (
                    <div key={action} className="flex items-center justify-between">
                      <div className="flex items-center gap-2"><Icon className="h-4 w-4 text-muted-foreground" /><span className="text-sm capitalize">{action.replace(/_/g, " ")}</span></div>
                      <span className="text-sm font-semibold">{count}</span>
                    </div>
                  );
                })}
                {auditLogs.length === 0 && <p className="text-sm text-muted-foreground">No activity yet</p>}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Top Active Admins</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {Object.entries(
                  auditLogs.reduce<Record<string, number>>((acc, l) => { acc[l.actor_id] = (acc[l.actor_id] || 0) + 1; return acc; }, {})
                ).sort(([, a], [, b]) => b - a).slice(0, 5).map(([actorId, count]) => (
                  <div key={actorId} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">{getActorName(actorId).slice(0, 2).toUpperCase()}</div>
                      <span className="text-sm">{getActorName(actorId)}</span>
                    </div>
                    <Badge variant="secondary">{count} actions</Badge>
                  </div>
                ))}
                {auditLogs.length === 0 && <p className="text-sm text-muted-foreground">No activity yet</p>}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle className="text-base">Recent Activity Timeline</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-4">
                {auditLogs.slice(0, 15).map((log) => {
                  const Icon = ACTION_ICONS[log.action] || FileText;
                  return (
                    <div key={log.id} className="flex gap-3">
                      <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0"><Icon className="h-4 w-4 text-muted-foreground" /></div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm"><span className="font-medium">{getActorName(log.actor_id)}</span> <span className="text-muted-foreground capitalize">{log.action.replace(/_/g, " ")}</span> {log.details?.user_name || log.details?.name || ""}</p>
                        <p className="text-xs text-muted-foreground">{new Date(log.created_at).toLocaleString()}</p>
                      </div>
                    </div>
                  );
                })}
                {auditLogs.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No activity yet</p>}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ===== EDIT USER DIALOG ===== */}
      <Dialog open={!!editUser} onOpenChange={(open) => !open && setEditUser(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Edit User Profile</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>First Name</Label><Input value={editForm.first_name} onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })} /></div>
              <div className="space-y-2"><Label>Last Name</Label><Input value={editForm.last_name} onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })} /></div>
            </div>
            <div className="space-y-2"><Label>Email</Label><Input value={editForm.email} disabled className="bg-muted" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Phone</Label><Input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} /></div>
              <div className="space-y-2"><Label>Job Title</Label><Input value={editForm.job_title} onChange={(e) => setEditForm({ ...editForm, job_title: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Department</Label>
                <Select value={editForm.department_id} onValueChange={(v) => setEditForm({ ...editForm, department_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>{departments.map((d) => (<SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>))}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Status</Label>
                <Select value={editForm.status} onValueChange={(v) => setEditForm({ ...editForm, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Inactive</SelectItem><SelectItem value="terminated">Terminated</SelectItem></SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Pay Rate</Label><Input type="number" value={editForm.pay_rate} onChange={(e) => setEditForm({ ...editForm, pay_rate: e.target.value })} /></div>
              <div className="space-y-2"><Label>Pay Type</Label>
                <Select value={editForm.pay_type} onValueChange={(v) => setEditForm({ ...editForm, pay_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="hourly">Hourly</SelectItem><SelectItem value="salary">Salary</SelectItem></SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setEditUser(null)} disabled={saving}>Cancel</Button><Button onClick={saveUser} disabled={saving}>{saving ? "Saving..." : "Save Changes"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== ROLE DIALOG ===== */}
      <Dialog open={!!roleDialog} onOpenChange={(open) => !open && setRoleDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Manage Roles — {roleDialog?.userName}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-sm text-muted-foreground mb-2 block">Current Roles</Label>
              <div className="flex gap-2 flex-wrap">
                {roleDialog && getUserRoles(roleDialog.userId).map((r) => {
                  const p = profiles.find((pr) => pr.user_id === roleDialog.userId);
                  return (
                    <Badge key={r.id} variant={ROLE_COLORS[r.role] as any} className="capitalize gap-1">
                      {r.role.replace("_", " ")}
                      <button onClick={() => removeRole(r.id, r.role, p ? `${p.first_name} ${p.last_name}` : undefined)} className="ml-1 hover:text-destructive">×</button>
                    </Badge>
                  );
                })}
                {roleDialog && getUserRoles(roleDialog.userId).length === 0 && <p className="text-sm text-muted-foreground">No roles assigned</p>}
              </div>
            </div>
            <div className="flex items-end gap-2">
              <div className="flex-1 space-y-2"><Label>Add Role</Label>
                <Select value={newRole} onValueChange={setNewRole}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="admin">Admin</SelectItem><SelectItem value="hr_manager">HR Manager</SelectItem><SelectItem value="employee">Employee</SelectItem></SelectContent></Select>
              </div>
              <Button onClick={addRole} disabled={saving}><Plus className="h-4 w-4 mr-1" /> {saving ? "Adding..." : "Add"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ===== DEPARTMENT DIALOG ===== */}
      <Dialog open={deptDialog} onOpenChange={(open) => { if (!open) { setDeptDialog(false); setEditDept(null); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editDept ? "Edit" : "Add"} Department</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2"><Label>Name</Label><Input value={deptForm.name} onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })} /></div>
            <div className="space-y-2"><Label>Description</Label><Textarea value={deptForm.description} onChange={(e) => setDeptForm({ ...deptForm, description: e.target.value })} rows={3} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => { setDeptDialog(false); setEditDept(null); }} disabled={saving}>Cancel</Button><Button onClick={saveDept} disabled={saving}>{saving ? "Saving..." : (editDept ? "Update" : "Create")}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== BULK ACTION DIALOG ===== */}
      <Dialog open={bulkDialog} onOpenChange={(open) => !open && setBulkDialog(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bulk Action — {selectedUsers.size} User{selectedUsers.size !== 1 ? "s" : ""}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {bulkAction === "status" && (
              <div className="space-y-2"><Label>New Status</Label>
                <Select value={bulkValue} onValueChange={setBulkValue}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Inactive</SelectItem><SelectItem value="terminated">Terminated</SelectItem></SelectContent></Select>
              </div>
            )}
            {bulkAction === "department" && (
              <div className="space-y-2"><Label>Move to Department</Label>
                <Select value={bulkValue} onValueChange={setBulkValue}><SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger><SelectContent>{departments.map((d) => (<SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>))}</SelectContent></Select>
              </div>
            )}
            {bulkAction === "role" && (
              <div className="space-y-2"><Label>Add Role</Label>
                <Select value={bulkValue} onValueChange={setBulkValue}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="admin">Admin</SelectItem><SelectItem value="hr_manager">HR Manager</SelectItem><SelectItem value="employee">Employee</SelectItem></SelectContent></Select>
              </div>
            )}
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setBulkDialog(false)} disabled={saving}>Cancel</Button><Button onClick={executeBulk} disabled={saving}>{saving ? "Applying..." : `Apply to ${selectedUsers.size} Users`}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
