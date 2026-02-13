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

type TrainingCategory = "onboarding" | "on_the_job" | "sop";
type TrainingFrequency = "one_time" | "annual" | "semi_annual" | "as_needed";
type TrainingContentType = "link" | "file" | null;

const ALLOWED_EXTENSIONS = [".pdf", ".doc", ".docx", ".ppt", ".pptx", ".xls", ".xlsx"];

export default function ManageTrainings() {
  const { toast } = useToast();
  const [trainings, setTrainings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [materialFile, setMaterialFile] = useState<File | null>(null);
  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "onboarding" as TrainingCategory,
    frequency: "one_time" as TrainingFrequency,
    content_url: "",
    content_type: null as TrainingContentType,
  });

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
    setForm({ title: "", description: "", category: "onboarding", frequency: "one_time", content_url: "", content_type: null });
    setMaterialFile(null);
    setEditing(null);
  };

  const getFileExtension = (fileName: string) => {
    const lowerName = fileName.toLowerCase();
    return ALLOWED_EXTENSIONS.find((ext) => lowerName.endsWith(ext)) ?? null;
  };

  const uploadTrainingMaterial = async (file: File) => {
    const ext = getFileExtension(file.name);
    if (!ext) {
      toast({
        variant: "destructive",
        title: "Unsupported file type",
        description: "Allowed files: PowerPoint, Excel, PDF, and Word documents.",
      });
      return null;
    }

    const sanitizedName = (form.title || "training").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    const objectPath = `materials/${Date.now()}-${sanitizedName || "training"}${ext}`;
    const { error } = await supabase.storage.from("training-materials").upload(objectPath, file, {
      contentType: file.type || undefined,
      upsert: false,
    });

    if (error) {
      toast({ variant: "destructive", title: "Upload failed", description: error.message });
      return null;
    }

    return supabase.storage.from("training-materials").getPublicUrl(objectPath).data.publicUrl;
  };

  const handleSave = async () => {
    if (!form.title.trim()) { toast({ variant: "destructive", title: "Title is required" }); return; }
    setSaving(true);

    let nextContentUrl = form.content_url.trim();
    let nextContentType = form.content_type;

    if (materialFile) {
      const uploadedUrl = await uploadTrainingMaterial(materialFile);
      if (!uploadedUrl) {
        setSaving(false);
        return;
      }
      nextContentUrl = uploadedUrl;
      nextContentType = "file";
    } else if (nextContentUrl && nextContentType !== "file") {
      nextContentType = "link";
    } else {
      nextContentType = null;
    }

    const payload = {
      title: form.title.trim(),
      description: form.description || null,
      category: form.category,
      frequency: form.frequency,
      content_url: nextContentUrl || null,
      content_type: nextContentType,
    };

    if (editing) {
      const { error } = await supabase.from("trainings").update(payload).eq("id", editing.id);
      if (error) { toast({ variant: "destructive", title: "Error", description: error.message }); setSaving(false); return; }
      toast({ title: "Training updated" });
    } else {
      const { error } = await supabase.from("trainings").insert([payload]);
      if (error) { toast({ variant: "destructive", title: "Error", description: error.message }); setSaving(false); return; }
      toast({ title: "Training created" });
    }
    setOpen(false);
    resetForm();
    fetchTrainings();
    setSaving(false);
  };

  const handleEdit = (t: any) => {
    setForm({
      title: t.title,
      description: t.description || "",
      category: t.category,
      frequency: t.frequency,
      content_url: t.content_url || "",
      content_type: t.content_type || (t.content_url ? "link" : null),
    });
    setMaterialFile(null);
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
                <Select value={form.category} onValueChange={(v: TrainingCategory) => setForm({ ...form, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="onboarding">On-boarding</SelectItem>
                    <SelectItem value="on_the_job">On-the-Job</SelectItem>
                    <SelectItem value="sop">SOPs</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Frequency</Label>
                <Select value={form.frequency} onValueChange={(v: TrainingFrequency) => setForm({ ...form, frequency: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="one_time">One-time</SelectItem>
                    <SelectItem value="annual">Annual</SelectItem>
                    <SelectItem value="semi_annual">Semi-annual</SelectItem>
                    <SelectItem value="as_needed">As Needed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Material URL (optional)</Label>
                <Input
                  value={form.content_url}
                  onChange={(e) => setForm({ ...form, content_url: e.target.value, content_type: e.target.value.trim() ? "link" : null })}
                  placeholder="https://..."
                />
              </div>
              <div className="space-y-2">
                <Label>Upload Material File (optional)</Label>
                <Input
                  type="file"
                  accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    if (!file) {
                      setMaterialFile(null);
                      return;
                    }

                    if (!getFileExtension(file.name)) {
                      toast({
                        variant: "destructive",
                        title: "Unsupported file type",
                        description: "Allowed files: .ppt, .pptx, .xls, .xlsx, .pdf, .doc, .docx",
                      });
                      e.currentTarget.value = "";
                      setMaterialFile(null);
                      return;
                    }

                    setMaterialFile(file);
                    setForm({ ...form, content_type: "file" });
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  Accepted: PowerPoint, Excel, PDF, and Word. Uploading a file will override the URL.
                </p>
                {materialFile && <p className="text-xs text-muted-foreground">Selected file: {materialFile.name}</p>}
              </div>
              <Button onClick={handleSave} className="w-full" disabled={saving}>{editing ? "Update" : "Create"}</Button>
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
