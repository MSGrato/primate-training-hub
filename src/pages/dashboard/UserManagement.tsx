import { useEffect, useMemo, useRef, useState } from "react";
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
import { UserPlus, Pencil, Upload } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useIsMobile } from "@/hooks/use-mobile";

interface UserRow {
  user_id: string;
  full_name: string;
  net_id: string;
  role: string;
  is_active: boolean;
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
  const isMobile = useIsMobile();
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
  const [formSupervisorId, setFormSupervisorId] = useState<string>("none");

  // Supervisors list for assignment
  const supervisors = useMemo(
    () => users.filter((u) => u.role === "supervisor" || u.role === "coordinator"),
    [users]
  );

  // CSV import state
  const csvFileInputRef = useRef<HTMLInputElement>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importProgress, setImportProgress] = useState<string | null>(null);

  interface ParsedCsvUser {
    full_name: string; net_id: string; email: string; role: string;
    job_title_name: string; password: string; supervisor_net_id: string;
  }
  interface ImportPreview {
    toDelete: UserRow[];
    toImport: ParsedCsvUser[];
    unresolvedSupervisors: string[];
  }
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);

  // Supervisor mappings
  const [supervisorMappings, setSupervisorMappings] = useState<Map<string, string>>(new Map());

  const fetchSupervisorMappings = async () => {
    const { data, error } = await supabase
      .from("supervisor_employee_mappings")
      .select("employee_id, supervisor_id");
    if (error) return;
    const map = new Map<string, string>();
    (data || []).forEach((m: any) => map.set(m.employee_id, m.supervisor_id));
    setSupervisorMappings(map);
  };

  const fetchAllProfiles = async () => {
    const rows: any[] = [];
    let from = 0;

    while (true) {
      const to = from + PAGE_SIZE - 1;
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, full_name, net_id, is_active, job_title_id")
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
          .select("user_id, full_name, net_id, is_active, job_title_id")
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
        job_title_id: p.job_title_id,
        role: roleMap.get(p.user_id) || "employee",
      }));

      setUsers(combined);

      setRetentionAlerts([]);
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
    fetchSupervisorMappings();
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
    setFormSupervisorId("none");
  };

  const saveSupervisorMapping = async (employeeId: string, supervisorId: string | null) => {
    // Delete existing mapping
    await supabase
      .from("supervisor_employee_mappings")
      .delete()
      .eq("employee_id", employeeId);

    // Insert new mapping if supervisor selected
    if (supervisorId) {
      await supabase
        .from("supervisor_employee_mappings")
        .insert({ employee_id: employeeId, supervisor_id: supervisorId });
    }
  };

  const parseCSV = (text: string): ParsedCsvUser[] => {
    const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
    // Skip header row (index 0)
    return lines.slice(1).map((line) => {
      const cols = line.split(",");
      return {
        full_name: (cols[0] || "").trim(),
        net_id: (cols[1] || "").trim(),
        email: (cols[2] || "").trim(),
        role: (cols[3] || "").trim(),
        job_title_name: (cols[4] || "").trim(),
        password: (cols[5] || "").trim(),
        supervisor_net_id: (cols[7] || "").trim(),
      };
    }).filter((r) => r.net_id && r.email);
  };

  const handleCsvFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const parsed = parseCSV(text);

      const toDelete = users.filter((u) => u.role !== "coordinator");
      const toImport = parsed.filter((r) => r.role.toLowerCase() !== "coordinator");

      const csvNetIds = new Set(parsed.map((r) => r.net_id));
      csvNetIds.add("admin"); // coordinator is already in the DB
      const unresolvedSupervisors = [
        ...new Set(
          parsed
            .filter((r) => r.supervisor_net_id && r.supervisor_net_id !== r.net_id)
            .map((r) => r.supervisor_net_id)
            .filter((netId) => !csvNetIds.has(netId))
        ),
      ];

      setImportPreview({ toDelete, toImport, unresolvedSupervisors });
      setImportOpen(true);
    };
    reader.readAsText(file);
    // Reset file input so the same file can be re-selected
    e.target.value = "";
  };

  const handleConfirmImport = async () => {
    if (!importPreview) return;
    setSubmitting(true);
    try {
      // Step 1: Delete non-coordinator users one by one
      for (let i = 0; i < importPreview.toDelete.length; i++) {
        const u = importPreview.toDelete[i];
        setImportProgress(`Deleting ${i + 1} of ${importPreview.toDelete.length}: ${u.full_name}…`);
        try {
          await invokeManageUsers({ action: "delete", user_id: u.user_id });
        } catch {
          // Continue on individual delete failure
        }
      }

      // Step 2: Bulk import all CSV users in one request
      setImportProgress(`Importing ${importPreview.toImport.length} users…`);
      let importResult: any = null;
      try {
        importResult = await invokeManageUsers({ action: "bulk-import", users: importPreview.toImport });
      } catch (e: any) {
        toast({ title: "Import error", description: e.message, variant: "destructive" });
        return;
      }

      // Step 3: Refresh
      setImportProgress("Refreshing user list…");
      await fetchUsers();
      await fetchSupervisorMappings();

      // Step 4: Summary toast
      const results: any[] = importResult?.results || [];
      const created = results.filter((r) => r.status === "created").length;
      const skipped = results.filter((r) => r.status === "skipped").length;
      const errors = results.filter((r) => r.status === "error").length;
      const warnings = (importResult?.mapping_warnings || []).length;
      toast({
        title: "Import complete",
        description:
          `Deleted ${importPreview.toDelete.length} · Created ${created} · Skipped ${skipped}` +
          (errors > 0 ? ` · Errors ${errors}` : "") +
          (warnings > 0 ? ` · ${warnings} mapping warning(s)` : ""),
      });

      setImportOpen(false);
      setImportPreview(null);
      setImportProgress(null);
    } finally {
      setSubmitting(false);
    }
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
      const result = await invokeManageUsers({
        action: "create",
        email: formEmail.trim(),
        password: formPassword,
        full_name: formName.trim(),
        net_id: formNetId.trim(),
        role: formRole,
        job_title_id: formJobTitleId !== "none" ? formJobTitleId : null,
      });
      // Save supervisor mapping if selected
      if (formSupervisorId !== "none" && result?.user_id) {
        await saveSupervisorMapping(result.user_id, formSupervisorId);
      }
      toast({ title: "User created successfully" });
      setAddOpen(false);
      resetForm();
      await fetchUsers();
      await fetchSupervisorMappings();
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
      // Save supervisor mapping
      await saveSupervisorMapping(
        selectedUser.user_id,
        formSupervisorId !== "none" ? formSupervisorId : null
      );
      toast({ title: "User updated successfully" });
      setEditOpen(false);
      resetForm();
      setSelectedUser(null);
      await fetchUsers();
      await fetchSupervisorMappings();
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
    setFormSupervisorId(supervisorMappings.get(u.user_id) || "none");
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
        <h1 className="text-2xl font-bold text-foreground sm:text-3xl">User Management</h1>
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-foreground sm:text-3xl">User Management</h1>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button variant="outline" className="w-full sm:w-auto"
            onClick={() => csvFileInputRef.current?.click()}>
            <Upload className="mr-2 h-4 w-4" />Import CSV
          </Button>
          <Button className="w-full sm:w-auto"
            onClick={() => { resetForm(); setAddOpen(true); }}>
            <UserPlus className="mr-2 h-4 w-4" />Add User
          </Button>
        </div>
        <input
          ref={csvFileInputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={handleCsvFileSelected}
        />
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
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
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
          {isMobile ? (
            <div className="space-y-3">
              {displayedUsers.map((u) => (
                <Card key={u.user_id}>
                  <CardContent className="pt-4 pb-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-sm">{u.full_name}</p>
                        <p className="text-xs text-muted-foreground">{u.net_id}</p>
                      </div>
                      <Badge className="bg-secondary text-secondary-foreground shrink-0">{roleLabel(u.role)}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{jobTitleName(u.job_title_id)}</p>
                    {getUserTags(u).length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {getUserTags(u).map((tag) => (
                          <Badge key={`${u.user_id}-${tag}`} variant="secondary" className="text-xs">{tag}</Badge>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Switch checked={u.is_active} onCheckedChange={() => handleToggleActive(u)} />
                        <Badge variant={u.is_active ? "default" : "secondary"}>
                          {u.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => openEdit(u)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>NetID</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Job Title</TableHead>
                  <TableHead>Tags</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
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
          )}
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
            <div className="space-y-2">
              <Label>Supervisor</Label>
              <Select value={formSupervisorId} onValueChange={setFormSupervisorId}>
                <SelectTrigger><SelectValue placeholder="Select supervisor" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {supervisors.map((s) => (
                    <SelectItem key={s.user_id} value={s.user_id}>{s.full_name}</SelectItem>
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

      {/* Import CSV Confirmation Dialog */}
      <Dialog open={importOpen} onOpenChange={(open) => { if (!submitting) { setImportOpen(open); if (!open) setImportPreview(null); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Import CSV — Confirm Changes</DialogTitle>
            <DialogDescription>
              Review what will be deleted and imported before proceeding.
            </DialogDescription>
          </DialogHeader>
          {importPreview && (
            <div className="space-y-4 text-sm">
              {/* Users to delete */}
              <div className="space-y-1">
                <p className="font-semibold text-destructive">
                  Delete {importPreview.toDelete.length} non-coordinator user{importPreview.toDelete.length !== 1 ? "s" : ""}
                </p>
                <ScrollArea className="h-32 rounded border border-border p-2">
                  {importPreview.toDelete.map((u) => (
                    <p key={u.user_id} className="text-muted-foreground leading-5">
                      {u.full_name} <span className="text-xs">({u.net_id})</span>
                    </p>
                  ))}
                  {importPreview.toDelete.length === 0 && (
                    <p className="text-muted-foreground italic">No users to delete.</p>
                  )}
                </ScrollArea>
              </div>

              {/* Users to import */}
              <div className="space-y-1">
                <p className="font-semibold">
                  Import {importPreview.toImport.length} user{importPreview.toImport.length !== 1 ? "s" : ""}
                </p>
                <ScrollArea className="h-40 rounded border border-border p-2">
                  {importPreview.toImport.map((u) => (
                    <p key={u.net_id} className="text-muted-foreground leading-5">
                      {u.full_name} <span className="text-xs">({u.net_id} · {u.role})</span>
                    </p>
                  ))}
                </ScrollArea>
              </div>

              {/* Unresolved supervisor warnings */}
              {importPreview.unresolvedSupervisors.length > 0 && (
                <div className="rounded border border-yellow-400 bg-yellow-50 px-3 py-2 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300 dark:border-yellow-600">
                  <p className="font-semibold">Supervisor mapping warnings</p>
                  <p className="mt-0.5">
                    The following supervisor NetIDs are not in the CSV and will be skipped:{" "}
                    <span className="font-mono">{importPreview.unresolvedSupervisors.join(", ")}</span>
                  </p>
                </div>
              )}

              <p className="text-xs text-muted-foreground">
                The coordinator account is excluded from both deletion and import.
              </p>

              {/* Progress */}
              {importProgress && (
                <div className="space-y-1">
                  <p className="text-muted-foreground animate-pulse">{importProgress}</p>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div className="h-full animate-pulse rounded-full bg-primary" style={{ width: "100%" }} />
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setImportOpen(false); setImportPreview(null); }} disabled={submitting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleConfirmImport} disabled={submitting}>
              {submitting ? "Working…" : "Delete & Import"}
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
            <div className="space-y-2">
              <Label>Supervisor</Label>
              <Select value={formSupervisorId} onValueChange={setFormSupervisorId}>
                <SelectTrigger><SelectValue placeholder="Select supervisor" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {supervisors.map((s) => (
                    <SelectItem key={s.user_id} value={s.user_id}>{s.full_name}</SelectItem>
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
