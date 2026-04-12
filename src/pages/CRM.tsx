import { useEffect, useState, useCallback } from "react";
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
import { toast } from "sonner";
import {
  Shield, Users, Building2, Search, UserCog, Plus, Trash2,
  Activity, UserCheck, UserX, ChevronDown, Edit, BarChart3,
} from "lucide-react";

type Profile = {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  department_id: string | null;
  job_title: string | null;
  pay_rate: number;
  pay_type: "hourly" | "salary";
  hire_date: string | null;
  status: string;
  avatar_url: string | null;
  created_at: string;
  departments?: { name: string } | null;
};

type UserRole = { id: string; user_id: string; role: "admin" | "hr_manager" | "employee"; created_at: string };
type Department = { id: string; name: string; description: string | null; created_at: string };

const ROLE_COLORS: Record<string, string> = {
  admin: "destructive",
  hr_manager: "default",
  employee: "secondary",
};

export default function CRMPage() {
  const { isAdmin } = useAuth();
  const [tab, setTab] = useState("overview");

  // Data
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Dialogs
  const [editUser, setEditUser] = useState<Profile | null>(null);
  const [roleDialog, setRoleDialog] = useState<{ userId: string; userName: string } | null>(null);
  const [newRole, setNewRole] = useState<string>("employee");
  const [deptDialog, setDeptDialog] = useState(false);
  const [deptForm, setDeptForm] = useState({ name: "", description: "" });
  const [editDept, setEditDept] = useState<Department | null>(null);

  // Edit user form
  const [editForm, setEditForm] = useState({
    first_name: "", last_name: "", email: "", phone: "", job_title: "",
    department_id: "", pay_rate: "", pay_type: "hourly" as string, status: "active",
  });

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [p, r, d] = await Promise.all([
      supabase.from("profiles").select("*, departments(name)").order("created_at", { ascending: false }),
      supabase.from("user_roles").select("*"),
      supabase.from("departments").select("*").order("name"),
    ]);
    setProfiles((p.data as Profile[]) || []);
    setRoles((r.data as UserRole[]) || []);
    setDepartments((d.data as Department[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Helpers
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

  const saveUser = async () => {
    if (!editUser) return;
    const { error } = await supabase.from("profiles").update({
      first_name: editForm.first_name.trim(),
      last_name: editForm.last_name.trim(),
      phone: editForm.phone.trim() || null,
      job_title: editForm.job_title.trim() || null,
      department_id: editForm.department_id || null,
      pay_rate: Number(editForm.pay_rate) || 0,
      pay_type: editForm.pay_type as "hourly" | "salary",
      status: editForm.status,
    }).eq("id", editUser.id);
    if (error) { toast.error(error.message); return; }
    toast.success("User updated");
    setEditUser(null);
    fetchAll();
  };

  // --- Role Management ---
  const addRole = async () => {
    if (!roleDialog) return;
    const { error } = await supabase.from("user_roles").insert({
      user_id: roleDialog.userId,
      role: newRole as "admin" | "hr_manager" | "employee",
    });
    if (error) {
      if (error.code === "23505") toast.error("User already has this role");
      else toast.error(error.message);
      return;
    }
    toast.success("Role added");
    setRoleDialog(null);
    fetchAll();
  };

  const removeRole = async (roleId: string) => {
    const { error } = await supabase.from("user_roles").delete().eq("id", roleId);
    if (error) { toast.error(error.message); return; }
    toast.success("Role removed");
    fetchAll();
  };

  // --- Department Management ---
  const saveDept = async () => {
    if (!deptForm.name.trim()) { toast.error("Name required"); return; }
    if (editDept) {
      const { error } = await supabase.from("departments").update({
        name: deptForm.name.trim(), description: deptForm.description.trim() || null,
      }).eq("id", editDept.id);
      if (error) { toast.error(error.message); return; }
      toast.success("Department updated");
    } else {
      const { error } = await supabase.from("departments").insert({
        name: deptForm.name.trim(), description: deptForm.description.trim() || null,
      });
      if (error) { toast.error(error.message); return; }
      toast.success("Department created");
    }
    setDeptDialog(false);
    setEditDept(null);
    setDeptForm({ name: "", description: "" });
    fetchAll();
  };

  const deleteDept = async (id: string) => {
    const { error } = await supabase.from("departments").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Department deleted");
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
        <TabsList className="grid w-full grid-cols-4 max-w-xl">
          <TabsTrigger value="overview"><BarChart3 className="h-4 w-4 mr-1.5" />Overview</TabsTrigger>
          <TabsTrigger value="users"><Users className="h-4 w-4 mr-1.5" />Users</TabsTrigger>
          <TabsTrigger value="roles"><UserCog className="h-4 w-4 mr-1.5" />Roles</TabsTrigger>
          <TabsTrigger value="departments"><Building2 className="h-4 w-4 mr-1.5" />Departments</TabsTrigger>
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
                    <div className="flex items-center gap-2">
                      <div className={`h-3 w-3 rounded-full ${r.color}`} />
                      <span className="text-sm">{r.label}</span>
                    </div>
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
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                        {p.first_name[0]}{p.last_name[0]}
                      </div>
                      <div>
                        <p className="font-medium">{p.first_name} {p.last_name}</p>
                        <p className="text-xs text-muted-foreground">{p.email}</p>
                      </div>
                    </div>
                    <Badge variant={p.status === "active" ? "default" : "secondary"}>{p.status}</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ===== USERS ===== */}
        <TabsContent value="users" className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search users..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
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
                          <TableRow key={p.id}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                                  {p.first_name[0]}{p.last_name[0]}
                                </div>
                                <div>
                                  <p className="font-medium text-sm">{p.first_name} {p.last_name}</p>
                                  <p className="text-xs text-muted-foreground">{p.email}</p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1 flex-wrap">
                                {userRoles.map((r) => (
                                  <Badge key={r.id} variant={ROLE_COLORS[r.role] as any} className="text-xs capitalize">
                                    {r.role.replace("_", " ")}
                                  </Badge>
                                ))}
                              </div>
                            </TableCell>
                            <TableCell className="text-sm">{p.departments?.name || "—"}</TableCell>
                            <TableCell className="text-sm">{p.job_title || "—"}</TableCell>
                            <TableCell>
                              <Badge variant={p.status === "active" ? "default" : "secondary"}>{p.status}</Badge>
                            </TableCell>
                            <TableCell className="text-sm">
                              ${Number(p.pay_rate).toFixed(2)}/{p.pay_type === "hourly" ? "hr" : "yr"}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                <Button variant="ghost" size="icon" onClick={() => openEditUser(p)} title="Edit user">
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => { setRoleDialog({ userId: p.user_id, userName: `${p.first_name} ${p.last_name}` }); setNewRole("employee"); }} title="Manage roles">
                                  <UserCog className="h-4 w-4" />
                                </Button>
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
            <CardHeader>
              <CardTitle className="text-base">All Role Assignments</CardTitle>
              <CardDescription>View and manage role assignments across all users</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Assigned</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {roles.map((r) => {
                    const p = profiles.find((pr) => pr.user_id === r.user_id);
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium text-sm">{p ? `${p.first_name} ${p.last_name}` : r.user_id}</TableCell>
                        <TableCell>
                          <Badge variant={ROLE_COLORS[r.role] as any} className="capitalize">{r.role.replace("_", " ")}</Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => removeRole(r.id)} title="Remove role">
                            <Trash2 className="h-4 w-4" />
                          </Button>
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
            <Button onClick={() => { setDeptDialog(true); setEditDept(null); setDeptForm({ name: "", description: "" }); }}>
              <Plus className="h-4 w-4 mr-1.5" /> Add Department
            </Button>
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
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditDept(d); setDeptForm({ name: d.name, description: d.description || "" }); setDeptDialog(true); }}>
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteDept(d.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    {d.description && <CardDescription className="text-xs">{d.description}</CardDescription>}
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">{count} employee{count !== 1 ? "s" : ""}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>

      {/* ===== EDIT USER DIALOG ===== */}
      <Dialog open={!!editUser} onOpenChange={(open) => !open && setEditUser(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Edit User Profile</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>First Name</Label>
                <Input value={editForm.first_name} onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Last Name</Label>
                <Input value={editForm.last_name} onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={editForm.email} disabled className="bg-muted" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Job Title</Label>
                <Input value={editForm.job_title} onChange={(e) => setEditForm({ ...editForm, job_title: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Department</Label>
                <Select value={editForm.department_id} onValueChange={(v) => setEditForm({ ...editForm, department_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>
                    {departments.map((d) => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={editForm.status} onValueChange={(v) => setEditForm({ ...editForm, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="terminated">Terminated</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Pay Rate</Label>
                <Input type="number" value={editForm.pay_rate} onChange={(e) => setEditForm({ ...editForm, pay_rate: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Pay Type</Label>
                <Select value={editForm.pay_type} onValueChange={(v) => setEditForm({ ...editForm, pay_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hourly">Hourly</SelectItem>
                    <SelectItem value="salary">Salary</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUser(null)}>Cancel</Button>
            <Button onClick={saveUser}>Save Changes</Button>
          </DialogFooter>
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
                {roleDialog && getUserRoles(roleDialog.userId).map((r) => (
                  <Badge key={r.id} variant={ROLE_COLORS[r.role] as any} className="capitalize gap-1">
                    {r.role.replace("_", " ")}
                    <button onClick={() => removeRole(r.id)} className="ml-1 hover:text-destructive">×</button>
                  </Badge>
                ))}
                {roleDialog && getUserRoles(roleDialog.userId).length === 0 && (
                  <p className="text-sm text-muted-foreground">No roles assigned</p>
                )}
              </div>
            </div>
            <div className="flex items-end gap-2">
              <div className="flex-1 space-y-2">
                <Label>Add Role</Label>
                <Select value={newRole} onValueChange={setNewRole}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="hr_manager">HR Manager</SelectItem>
                    <SelectItem value="employee">Employee</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={addRole}><Plus className="h-4 w-4 mr-1" /> Add</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ===== DEPARTMENT DIALOG ===== */}
      <Dialog open={deptDialog} onOpenChange={(open) => { if (!open) { setDeptDialog(false); setEditDept(null); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editDept ? "Edit" : "Add"} Department</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={deptForm.name} onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={deptForm.description} onChange={(e) => setDeptForm({ ...deptForm, description: e.target.value })} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDeptDialog(false); setEditDept(null); }}>Cancel</Button>
            <Button onClick={saveDept}>{editDept ? "Update" : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
