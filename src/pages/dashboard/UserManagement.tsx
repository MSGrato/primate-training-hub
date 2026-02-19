import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { UserPlus, Pencil } from "lucide-react";

interface UserRow {
  user_id: string;
  full_name: string;
  net_id: string;
  role: string;
  is_active: boolean;
  deactivated_at: string | null;
  job_title_id: string | null;
}

interface JobTitle {
  id: string;
  name: string;
  tags: string[];
}

interface RetentionAlert {
  user_id: string;
  full_name: string;
  net_id: string;
  delete_on: Date;
  days_left: number;
}

const PAGE_SIZE = 500;

export default function UserManagement() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [jobTitles, setJobTitles] = useState<JobTitle[]>([]);
  const [filterJobTitleId, setFilterJobTitleId] = useState("all");
  const [filterTag, setFilterTag] = useState("all");
  const [sortBy, setSortBy] = useState("name_asc");
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [retentionAlerts, setRetentionAlerts] = useState<RetentionAlert[]>([]);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const { toast } = useToast();

  // Form state
  const [formName, setFormName] = useState("");
  const [formNetId, setFormNetId] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formRole, setFormRole] = useState("employee");
  const [formJobTitleId, setFormJobTitleId] = useState<string>("none");

  const fetchAllProfiles = async () => {
    const rows: any[] = [];
    let from = 0;

    while (true) {
      const to = from + PAGE_SIZE - 1;
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, full_name, net_id, is_active, deactivated_at, job_title_id")
        .order("full_name", { ascending: true })
        .range(from, to);

      if (error) throw error;
      if (!data || data.length === 0) break;

      rows.push(...data);
      if (data.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
    }

    return rows;
  };

  const fetchAllRoles = async () => {
    const rows: any[] = [];
    let from = 0;

    while (true) {
      const to = from + PAGE_SIZE - 1;
      const { data, error } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .order("user_id", { ascending: true })
        .range(from, to);

      if (error) throw error;
      if (!data || data.length === 0) break;

      rows.push(...data);
      if (data.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
    }

    return rows;
  };

  const fetchUsers = async () => {
    setLoading(true);
    setFetchError(null);
    try {
      let profiles: any[] = [];
      try {
        profiles = await fetchAllProfiles();
      } catch {
        const { data, error } = await supabase
          .from("profiles")
          .select("user_id, full_name, net_id, is_active, deactivated_at, job_title_id")
          .order("full_name", { ascending: true });
        if (error) throw error;
        profiles = data || [];
      }

      let roles: any[] = [];
      try {
        roles = await fetchAllRoles();
      } catch (roleError: any) {
        toast({
          title: "Warning loading roles",
          description: roleError.message || "Unable to load roles. Showing users with default role labels.",
          variant: "destructive",
        });
      }

      const roleMap = new Map<string, string>();
      roles.forEach((r) => roleMap.set(r.user_id, r.role));

      const combined: UserRow[] = profiles.map((p: any) => ({
        user_id: p.user_id,
        full_name: p.full_name,
        net_id: p.net_id,
        is_active: p.is_active ?? true,
        deactivated_at: p.deactivated_at ?? null,
        job_title_id: p.job_title_id,
        role: roleMap.get(p.user_id) || "employee",
      }));

      setUsers(combined);

      const alerts = combined
        .filter((user) => !user.is_active && !!user.deactivated_at)
        .map((user) => {
          const deactivatedAt = new Date(user.deactivated_at as string);
          const deleteOn = new Date(deactivatedAt);
          deleteOn.setFullYear(deleteOn.getFullYear() + 6);
          const msLeft = deleteOn.getTime() - Date.now();
          const daysLeft = Math.ceil(msLeft / (1000 * 60 * 60 * 24));
          return {
            user_id: user.user_id,
            full_name: user.full_name,
            net_id: user.net_id,
            delete_on: deleteOn,
            days_left: daysLeft,
          };
        })
        .filter((alert) => alert.days_left >= 0 && alert.days_left <= 60)
        .sort((a, b) => a.days_left - b.days_left);
      setRetentionAlerts(alerts);
    } catch (e: any) {
      setFetchError(e.message || "An unknown error occurred while loading users.");
      toast({ title: "Error loading users", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const fetchJobTitles = async () => {
    const { data, error } = await supabase
      .from("job_titles")
      .select("id, name, job_title_tags(job_tag:job_tags(name))")
      .order("name");
    if (error) {
      toast({ title: "Error loading job titles", description: error.message, variant: "destructive" });
      return;
    }

    const mapped: JobTitle[] = (data || []).map((jt: any) => ({
      id: jt.id,
      name: jt.name,
      tags: (jt.job_title_tags || [])
        .map((tagRow: any) => tagRow?.job_tag?.name)
        .filter((name: string | null | undefined): name is string => !!name),
    }));
    setJobTitles(mapped);
  };

  useEffect(() => {
    fetchUsers();
    fetchJobTitles();
  }, []);

  const roleLabel = (r: string) => {
    switch (r) {
      case "coordinator": return "Coordinator";
      case "supervisor": return "Supervisor";
      default: return "Employee";
    }
  };

  const resetForm = () => {
    setFormName("");
    setFormNetId("");
    setFormEmail("");
    setFormPassword("");
    setFormRole("employee");
    setFormJobTitleId("none");
  };

  const invokeManageUsers = async (body: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke("manage-users", { body });
    if (error) throw new Error(error.message);
    if (data?.error) throw new Error(data.error);
    return data;
  };

  const handleAdd = async () => {
    if (!formName.trim() || !formNetId.trim() || !formEmail.trim() || !formPassword.trim()) {
      toast({ title: "All fields are required", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      await invokeManageUsers({
        action: "create",
        email: formEmail.trim(),
        password: formPassword,
        full_name: formName.trim(),
        net_id: formNetId.trim(),
        role: formRole,
        job_title_id: formJobTitleId !== "none" ? formJobTitleId : null,
      });
      toast({ title: "User created successfully" });
      setAddOpen(false);
      resetForm();
      await fetchUsers();
    } catch (e: any) {
      toast({ title: "Error creating user", description: e.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async () => {
    if (!selectedUser) return;
    setSubmitting(true);
    try {
      await invokeManageUsers({
        action: "update",
        user_id: selectedUser.user_id,
        full_name: formName.trim(),
        net_id: formNetId.trim(),
        role: formRole,
        job_title_id: formJobTitleId !== "none" ? formJobTitleId : null,
      });
      toast({ title: "User updated successfully" });
      setEditOpen(false);
      resetForm();
      setSelectedUser(null);
      await fetchUsers();
    } catch (e: any) {
      toast({ title: "Error updating user", description: e.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (u: UserRow) => {
    try {
      await invokeManageUsers({
        action: "update",
        user_id: u.user_id,
        is_active: !u.is_active,
      });
      toast({ title: `User ${u.is_active ? "deactivated" : "activated"} successfully` });
      await fetchUsers();
    } catch (e: any) {
      toast({ title: "Error updating status", description: e.message, variant: "destructive" });
    }
  };

  const openEdit = (u: UserRow) => {
    setSelectedUser(u);
    setFormName(u.full_name);
    setFormNetId(u.net_id);
    setFormRole(u.role);
    setFormJobTitleId(u.job_title_id || "none");
    setEditOpen(true);
  };

  const jobTitleName = (id: string | null) => {
    if (!id) return "—";
    return jobTitleById.get(id)?.name || "—";
  };

  const jobTitleById = useMemo(
    () => new Map(jobTitles.map((jt) => [jt.id, jt])),
    [jobTitles]
  );

  const allTags = useMemo(
    () => Array.from(new Set(jobTitles.flatMap((jt) => jt.tags))).sort((a, b) => a.localeCompare(b)),
    [jobTitles]
  );

  const getUserTags = (user: UserRow) => {
    if (!user.job_title_id) return [];
    return jobTitleById.get(user.job_title_id)?.tags || [];
  };

  const getPrimaryTag = (user: UserRow) => {
    const tags = getUserTags(user);
    if (tags.length === 0) return "";
    return [...tags].sort((a, b) => a.localeCompare(b))[0];
  };

  const displayedUsers = useMemo(() => {
    const tagsForUser = (user: UserRow) => {
      if (!user.job_title_id) return [];
      return jobTitleById.get(user.job_title_id)?.tags || [];
    };
    const primaryTagForUser = (user: UserRow) => {
      const tags = tagsForUser(user);
      if (tags.length === 0) return "";
      return [...tags].sort((a, b) => a.localeCompare(b))[0];
    };
    const titleNameForUser = (user: UserRow) => {
      if (!user.job_title_id) return "—";
      return jobTitleById.get(user.job_title_id)?.name || "—";
    };

    const filtered = users.filter((user) => {
      if (filterJobTitleId !== "all" && user.job_title_id !== filterJobTitleId) return false;
      if (filterTag !== "all" && !tagsForUser(user).includes(filterTag)) return false;
      return true;
    });

    return filtered.sort((a, b) => {
      const nameCompare = a.full_name.localeCompare(b.full_name);
      const jobTitleCompare = titleNameForUser(a).localeCompare(titleNameForUser(b));
      const tagCompare = primaryTagForUser(a).localeCompare(primaryTagForUser(b));

      switch (sortBy) {
        case "name_desc":
          return -nameCompare;
        case "job_title_asc":
          return jobTitleCompare || nameCompare;
        case "job_title_desc":
          return -jobTitleCompare || nameCompare;
        case "tag_asc":
          return tagCompare || nameCompare;
        case "tag_desc":
          return -tagCompare || nameCompare;
        default:
          return nameCompare;
      }
    });
  }, [users, filterJobTitleId, filterTag, sortBy, jobTitleById]);

  if (loading) return <div className="text-muted-foreground">Loading...</div>;

  if (fetchError) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-foreground">User Management</h1>
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-3">
              <p className="font-medium text-destructive">Failed to load users</p>
              <p className="text-sm text-muted-foreground break-all">{fetchError}</p>
              <Button variant="outline" onClick={fetchUsers}>Retry</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">User Management</h1>
        <Button onClick={() => { resetForm(); setAddOpen(true); }}>
          <UserPlus className="mr-2 h-4 w-4" />Add User
        </Button>
      </div>

      {retentionAlerts.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-3">
              <h2 className="text-lg font-semibold text-foreground">Retention Alerts</h2>
              <p className="text-sm text-muted-foreground">
                Deactivated users within 60 days of six-year training report deletion.
              </p>
              <div className="space-y-2">
                {retentionAlerts.map((alert) => (
                  <div key={alert.user_id} className="rounded-md border border-border p-3 text-sm">
                    <span className="font-medium">{alert.full_name}</span>{" "}
                    (<span className="text-muted-foreground">{alert.net_id}</span>){" "}
                    will have training reports deleted in{" "}
                    <span className="font-medium">{alert.days_left} day{alert.days_left === 1 ? "" : "s"}</span>{" "}
                    on {alert.delete_on.toLocaleDateString()}.
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Filter by Job Title</Label>
              <Select value={filterJobTitleId} onValueChange={setFilterJobTitleId}>
                <SelectTrigger><SelectValue placeholder="All job titles" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All job titles</SelectItem>
                  {jobTitles.map((jt) => (
                    <SelectItem key={jt.id} value={jt.id}>{jt.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Filter by Tag</Label>
              <Select value={filterTag} onValueChange={setFilterTag}>
                <SelectTrigger><SelectValue placeholder="All tags" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All tags</SelectItem>
                  {allTags.map((tag) => (
                    <SelectItem key={tag} value={tag}>{tag}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Sort</Label>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="name_asc">Name (A-Z)</SelectItem>
                  <SelectItem value="name_desc">Name (Z-A)</SelectItem>
                  <SelectItem value="job_title_asc">Job Title (A-Z)</SelectItem>
                  <SelectItem value="job_title_desc">Job Title (Z-A)</SelectItem>
                  <SelectItem value="tag_asc">Tag (A-Z)</SelectItem>
                  <SelectItem value="tag_desc">Tag (Z-A)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="text-sm text-muted-foreground">
            Showing {displayedUsers.length} of {users.length} users
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>NetID</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Job Title</TableHead>
                <TableHead>Tags</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayedUsers.map((u) => (
                <TableRow key={u.user_id}>
                  <TableCell className="font-medium">{u.full_name}</TableCell>
                  <TableCell>{u.net_id}</TableCell>
                  <TableCell>
                    <Badge className="bg-secondary text-secondary-foreground">{roleLabel(u.role)}</Badge>
                  </TableCell>
                  <TableCell className="text-sm">{jobTitleName(u.job_title_id)}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {getUserTags(u).length === 0 && <span className="text-sm text-muted-foreground">—</span>}
                      {getUserTags(u).map((tag) => (
                        <Badge key={`${u.user_id}-${tag}`} variant="secondary">{tag}</Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={u.is_active}
                        onCheckedChange={() => handleToggleActive(u)}
                      />
                      <Badge variant={u.is_active ? "default" : "secondary"}>
                        {u.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => openEdit(u)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add User Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add User</DialogTitle>
            <DialogDescription>Create a new user account.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="add-name">Full Name</Label>
              <Input id="add-name" value={formName} onChange={(e) => setFormName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-netid">NetID</Label>
              <Input id="add-netid" value={formNetId} onChange={(e) => setFormNetId(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-email">Email</Label>
              <Input id="add-email" type="email" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-password">Password</Label>
              <Input id="add-password" type="password" value={formPassword} onChange={(e) => setFormPassword(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={formRole} onValueChange={setFormRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="employee">Employee</SelectItem>
                  <SelectItem value="supervisor">Supervisor</SelectItem>
                  <SelectItem value="coordinator">Coordinator</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Job Title</Label>
              <Select value={formJobTitleId} onValueChange={setFormJobTitleId}>
                <SelectTrigger><SelectValue placeholder="Select job title" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {jobTitles.map((jt) => (
                    <SelectItem key={jt.id} value={jt.id}>{jt.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={handleAdd} disabled={submitting}>
              {submitting ? "Creating..." : "Create User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>Update user details.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Full Name</Label>
              <Input id="edit-name" value={formName} onChange={(e) => setFormName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-netid">NetID</Label>
              <Input id="edit-netid" value={formNetId} onChange={(e) => setFormNetId(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={formRole} onValueChange={setFormRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="employee">Employee</SelectItem>
                  <SelectItem value="supervisor">Supervisor</SelectItem>
                  <SelectItem value="coordinator">Coordinator</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Job Title</Label>
              <Select value={formJobTitleId} onValueChange={setFormJobTitleId}>
                <SelectTrigger><SelectValue placeholder="Select job title" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {jobTitles.map((jt) => (
                    <SelectItem key={jt.id} value={jt.id}>{jt.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={handleEdit} disabled={submitting}>
              {submitting ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
