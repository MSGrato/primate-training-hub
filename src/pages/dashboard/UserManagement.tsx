import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { UserPlus, Pencil, Trash2 } from "lucide-react";

interface UserRow {
  user_id: string;
  full_name: string;
  net_id: string;
  role: string;
}

export default function UserManagement() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  // Form state
  const [formName, setFormName] = useState("");
  const [formNetId, setFormNetId] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formRole, setFormRole] = useState("employee");

  const fetchUsers = async () => {
    const { data: profiles } = await supabase.from("profiles").select("user_id, full_name, net_id");
    const { data: roles } = await supabase.from("user_roles").select("user_id, role");
    const roleMap = new Map<string, string>();
    roles?.forEach((r) => roleMap.set(r.user_id, r.role));
    const combined = (profiles || []).map((p) => ({
      ...p,
      role: roleMap.get(p.user_id) || "employee",
    }));
    setUsers(combined);
    setLoading(false);
  };

  useEffect(() => {
    fetchUsers();
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

  const handleDelete = async () => {
    if (!selectedUser) return;
    setSubmitting(true);
    try {
      await invokeManageUsers({
        action: "delete",
        user_id: selectedUser.user_id,
      });
      toast({ title: "User deleted successfully" });
      setDeleteOpen(false);
      setSelectedUser(null);
      await fetchUsers();
    } catch (e: any) {
      toast({ title: "Error deleting user", description: e.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const openEdit = (u: UserRow) => {
    setSelectedUser(u);
    setFormName(u.full_name);
    setFormNetId(u.net_id);
    setFormRole(u.role);
    setEditOpen(true);
  };

  const openDelete = (u: UserRow) => {
    setSelectedUser(u);
    setDeleteOpen(true);
  };

  if (loading) return <div className="text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">User Management</h1>
        <Button onClick={() => { resetForm(); setAddOpen(true); }}>
          <UserPlus className="mr-2 h-4 w-4" />Add User
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>NetID</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.user_id}>
                  <TableCell className="font-medium">{u.full_name}</TableCell>
                  <TableCell>{u.net_id}</TableCell>
                  <TableCell>
                    <Badge className="bg-secondary text-secondary-foreground">{roleLabel(u.role)}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(u)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => openDelete(u)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={handleEdit} disabled={submitting}>
              {submitting ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{selectedUser?.full_name}</strong>? This will remove their account and all associated data permanently.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={submitting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {submitting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
