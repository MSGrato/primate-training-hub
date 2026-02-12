import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, UserPlus } from "lucide-react";

export default function ManageTrainings() {
  const { toast } = useToast();
  const [trainings, setTrainings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ title: "", description: "", category: "onboarding" as "onboarding" | "on_the_job" | "sop", frequency: "one_time" as "one_time" | "annual" | "semi_annual" | "as_needed", content_url: "" });

  // Assign dialog state
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignTraining, setAssignTraining] = useState<any>(null);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [existingAssignmentIds, setExistingAssignmentIds] = useState<Set<string>>(new Set());
  const [assignLoading, setAssignLoading] = useState(false);

  const fetchTrainings = async () => {
    const { data } = await supabase.from("trainings").select("*").order("created_at", { ascending: false });
    setTrainings(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchTrainings(); }, []);

  const resetForm = () => {
    setForm({ title: "", description: "", category: "onboarding", frequency: "one_time", content_url: "" });
    setEditing(null);
  };

  const handleSave = async () => {
    if (!form.title.trim()) { toast({ variant: "destructive", title: "Title is required" }); return; }
    if (editing) {
      const { error } = await supabase.from("trainings").update(form).eq("id", editing.id);
      if (error) { toast({ variant: "destructive", title: "Error", description: error.message }); return; }
      toast({ title: "Training updated" });
    } else {
      const { error } = await supabase.from("trainings").insert([form]);
      if (error) { toast({ variant: "destructive", title: "Error", description: error.message }); return; }
      toast({ title: "Training created" });
    }
    setOpen(false);
    resetForm();
    fetchTrainings();
  };

  const handleEdit = (t: any) => {
    setForm({ title: t.title, description: t.description || "", category: t.category, frequency: t.frequency, content_url: t.content_url || "" });
    setEditing(t);
    setOpen(true);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("trainings").delete().eq("id", id);
    if (error) { toast({ variant: "destructive", title: "Error", description: error.message }); return; }
    toast({ title: "Training deleted" });
    fetchTrainings();
  };

  const handleOpenAssign = async (training: any) => {
    setAssignTraining(training);
    setAssignOpen(true);
    setAssignLoading(true);
    const [{ data: profilesData }, { data: assignmentsData }] = await Promise.all([
      supabase.from("profiles").select("user_id, full_name").eq("is_active", true).order("full_name"),
      supabase.from("user_training_assignments").select("user_id").eq("training_id", training.id),
    ]);
    setProfiles(profilesData || []);
    const existingIds = new Set((assignmentsData || []).map((a: any) => a.user_id));
    setExistingAssignmentIds(existingIds);
    setSelectedUserIds(new Set(existingIds));
    setAssignLoading(false);
  };

  const handleSaveAssignments = async () => {
    if (!assignTraining) return;
    const toInsert = [...selectedUserIds].filter((id) => !existingAssignmentIds.has(id));
    const toDelete = [...existingAssignmentIds].filter((id) => !selectedUserIds.has(id));

    if (toInsert.length > 0) {
      const { error } = await supabase.from("user_training_assignments").insert(toInsert.map((user_id) => ({ user_id, training_id: assignTraining.id })));
      if (error) { toast({ variant: "destructive", title: "Error", description: error.message }); return; }
    }
    if (toDelete.length > 0) {
      const { error } = await supabase.from("user_training_assignments").delete().eq("training_id", assignTraining.id).in("user_id", toDelete);
      if (error) { toast({ variant: "destructive", title: "Error", description: error.message }); return; }
    }
    toast({ title: "Assignments updated" });
    setAssignOpen(false);
  };

  const toggleUser = (userId: string) => {
    setSelectedUserIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId); else next.add(userId);
      return next;
    });
  };

  if (loading) return <div className="text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Manage Trainings</h1>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm(); }}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" />Add Training</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "Edit Training" : "Add Training"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
              <div><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
              <div><Label>Category</Label>
                <Select value={form.category} onValueChange={(v: "onboarding" | "on_the_job" | "sop") => setForm({ ...form, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="onboarding">On-boarding</SelectItem>
                    <SelectItem value="on_the_job">On-the-Job</SelectItem>
                    <SelectItem value="sop">SOPs</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Frequency</Label>
                <Select value={form.frequency} onValueChange={(v: "one_time" | "annual" | "semi_annual" | "as_needed") => setForm({ ...form, frequency: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="one_time">One-time</SelectItem>
                    <SelectItem value="annual">Annual</SelectItem>
                    <SelectItem value="semi_annual">Semi-annual</SelectItem>
                    <SelectItem value="as_needed">As Needed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Content URL</Label><Input value={form.content_url} onChange={(e) => setForm({ ...form, content_url: e.target.value })} placeholder="https://..." /></div>
              <Button onClick={handleSave} className="w-full">{editing ? "Update" : "Create"}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Frequency</TableHead>
                <TableHead className="w-24">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {trainings.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.title}</TableCell>
                  <TableCell>{t.category?.replace("_", " ")}</TableCell>
                  <TableCell>{t.frequency?.replace("_", " ")}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => handleOpenAssign(t)} title="Assign users"><UserPlus className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => handleEdit(t)}><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => handleDelete(t.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign: {assignTraining?.title}</DialogTitle>
          </DialogHeader>
          {assignLoading ? (
            <div className="text-muted-foreground py-4">Loading users...</div>
          ) : (
            <ScrollArea className="max-h-72">
              <div className="space-y-2">
                {profiles.map((p) => (
                  <label key={p.user_id} className="flex items-center gap-2 cursor-pointer px-1 py-1 rounded hover:bg-muted">
                    <Checkbox checked={selectedUserIds.has(p.user_id)} onCheckedChange={() => toggleUser(p.user_id)} />
                    <span className="text-sm">{p.full_name}</span>
                  </label>
                ))}
                {profiles.length === 0 && <p className="text-sm text-muted-foreground">No active users found.</p>}
              </div>
            </ScrollArea>
          )}
          <Button onClick={handleSaveAssignments} disabled={assignLoading} className="w-full">Save Assignments</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
