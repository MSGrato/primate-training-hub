import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
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
import { Plus, Pencil, Trash2, UserPlus, Search, X, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";

type TrainingCategory = "onboarding" | "on_the_job" | "sop";
type TrainingFrequency = "one_time" | "annual" | "semi_annual" | "as_needed";
type TrainingContentType = "link" | "file" | null;
type SortCol = "title" | "category" | "frequency" | "updated_at";
type SortDir = "asc" | "desc";

const ALLOWED_EXTENSIONS = [".pdf", ".doc", ".docx", ".ppt", ".pptx", ".xls", ".xlsx"];

const CATEGORY_LABELS: Record<string, string> = {
  onboarding: "On-boarding",
  on_the_job: "On-the-Job",
  sop: "SOPs",
};

const FREQUENCY_LABELS: Record<string, string> = {
  one_time: "One-time",
  annual: "Annual",
  semi_annual: "Semi-annual",
  as_needed: "As Needed",
};

interface ParsedBulkLink {
  title: string;
  url: string;
}

function formatTimestamp(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function ManageTrainings() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [trainings, setTrainings] = useState<any[]>([]);
  const [coordinatorNames, setCoordinatorNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [materialFile, setMaterialFile] = useState<File | null>(null);
  const [bulkFiles, setBulkFiles] = useState<File[]>([]);
  const [bulkLinksText, setBulkLinksText] = useState("");
  const [bulkForm, setBulkForm] = useState({
    description: "",
    category: "onboarding" as TrainingCategory,
    frequency: "one_time" as TrainingFrequency,
  });
  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "onboarding" as TrainingCategory,
    frequency: "one_time" as TrainingFrequency,
    content_url: "",
    content_type: null as TrainingContentType,
  });

  // Filter & sort state
  const [searchText, setSearchText] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterFrequency, setFilterFrequency] = useState("all");
  const [sortCol, setSortCol] = useState<SortCol>("updated_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // Assign dialog state
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignTraining, setAssignTraining] = useState<any>(null);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [existingAssignmentIds, setExistingAssignmentIds] = useState<Set<string>>(new Set());
  const [assignLoading, setAssignLoading] = useState(false);

  const fetchTrainings = async () => {
    const { data } = await supabase.from("trainings").select("*").order("updated_at", { ascending: false });
    const rows = data || [];
    setTrainings(rows);

    // Build coordinator name map from updated_by UUIDs
    const ids = [...new Set(rows.map((t: any) => t.updated_by).filter(Boolean))];
    if (ids.length > 0) {
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", ids);
      const map: Record<string, string> = {};
      (profilesData || []).forEach((p: any) => { map[p.user_id] = p.full_name; });
      setCoordinatorNames(map);
    }

    setLoading(false);
  };

  useEffect(() => { fetchTrainings(); }, []);

  // Derived: filtered + sorted trainings
  const displayedTrainings = useMemo(() => {
    let result = [...trainings];

    if (searchText.trim()) {
      const lower = searchText.toLowerCase();
      result = result.filter((t) => t.title.toLowerCase().includes(lower));
    }
    if (filterCategory !== "all") {
      result = result.filter((t) => t.category === filterCategory);
    }
    if (filterFrequency !== "all") {
      result = result.filter((t) => t.frequency === filterFrequency);
    }

    result.sort((a, b) => {
      let valA: any = a[sortCol] ?? "";
      let valB: any = b[sortCol] ?? "";
      if (sortCol === "updated_at") {
        valA = new Date(valA).getTime();
        valB = new Date(valB).getTime();
      } else {
        valA = String(valA).toLowerCase();
        valB = String(valB).toLowerCase();
      }
      if (valA < valB) return sortDir === "asc" ? -1 : 1;
      if (valA > valB) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

    return result;
  }, [trainings, searchText, filterCategory, filterFrequency, sortCol, sortDir]);

  const hasActiveFilters = searchText.trim() || filterCategory !== "all" || filterFrequency !== "all";

  const clearFilters = () => {
    setSearchText("");
    setFilterCategory("all");
    setFilterFrequency("all");
  };

  const toggleSort = (col: SortCol) => {
    if (sortCol === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortCol(col);
      setSortDir("asc");
    }
  };

  const SortIcon = ({ col }: { col: SortCol }) => {
    if (sortCol !== col) return <ArrowUpDown className="ml-1 h-3 w-3 text-muted-foreground" />;
    return sortDir === "asc"
      ? <ArrowUp className="ml-1 h-3 w-3" />
      : <ArrowDown className="ml-1 h-3 w-3" />;
  };

  const resetForm = () => {
    setForm({ title: "", description: "", category: "onboarding", frequency: "one_time", content_url: "", content_type: null });
    setMaterialFile(null);
    setEditing(null);
  };

  const getFileExtension = (fileName: string) => {
    const lowerName = fileName.toLowerCase();
    return ALLOWED_EXTENSIONS.find((ext) => lowerName.endsWith(ext)) ?? null;
  };

  const toTrainingTitle = (rawName: string) => {
    const ext = getFileExtension(rawName);
    const withoutExt = ext ? rawName.slice(0, -ext.length) : rawName;
    return withoutExt.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  };

  const uploadTrainingMaterial = async (file: File, titleForPath?: string) => {
    const ext = getFileExtension(file.name);
    if (!ext) {
      toast({
        variant: "destructive",
        title: "Unsupported file type",
        description: "Allowed files: PowerPoint, Excel, PDF, and Word documents.",
      });
      return null;
    }

    const sanitizedName = (titleForPath || form.title || "training").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
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

  const parseBulkLinks = (value: string) => {
    const lines = value
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    const parsed: ParsedBulkLink[] = [];
    const errors: string[] = [];

    for (const line of lines) {
      const separator = line.includes("|") ? "|" : line.includes(",") ? "," : null;
      if (!separator) {
        errors.push(`"${line}" (missing separator)`);
        continue;
      }

      const idx = line.indexOf(separator);
      const title = line.slice(0, idx).trim();
      const url = line.slice(idx + 1).trim();

      if (!title || !url) {
        errors.push(`"${line}" (title or URL missing)`);
        continue;
      }

      try {
        const parsedUrl = new URL(url);
        if (!parsedUrl.protocol.startsWith("http")) {
          errors.push(`"${line}" (URL must start with http/https)`);
          continue;
        }
      } catch {
        errors.push(`"${line}" (invalid URL)`);
        continue;
      }

      parsed.push({ title, url });
    }

    return { parsed, errors };
  };

  const resetBulkForm = () => {
    setBulkFiles([]);
    setBulkLinksText("");
    setBulkForm({ description: "", category: "onboarding", frequency: "one_time" });
  };

  const handleBulkSave = async () => {
    const hasFiles = bulkFiles.length > 0;
    const hasLinks = bulkLinksText.trim().length > 0;

    if (!hasFiles && !hasLinks) {
      toast({
        variant: "destructive",
        title: "Nothing to upload",
        description: "Add files or URL lines before uploading.",
      });
      return;
    }

    setBulkSaving(true);
    const errors: string[] = [];
    const trainingPayloads: Array<{
      title: string;
      description: string | null;
      category: TrainingCategory;
      frequency: TrainingFrequency;
      content_url: string;
      content_type: "file" | "link";
      updated_by: string | null;
    }> = [];

    if (hasFiles) {
      for (const file of bulkFiles) {
        const ext = getFileExtension(file.name);
        if (!ext) {
          errors.push(`${file.name} (unsupported extension)`);
          continue;
        }

        const trainingTitle = toTrainingTitle(file.name);
        const uploadedUrl = await uploadTrainingMaterial(file, trainingTitle);
        if (!uploadedUrl) {
          errors.push(`${file.name} (upload failed)`);
          continue;
        }

        trainingPayloads.push({
          title: trainingTitle || file.name,
          description: bulkForm.description || null,
          category: bulkForm.category,
          frequency: bulkForm.frequency,
          content_url: uploadedUrl,
          content_type: "file",
          updated_by: user?.id ?? null,
        });
      }
    }

    if (hasLinks) {
      const { parsed, errors: parseErrors } = parseBulkLinks(bulkLinksText);
      errors.push(...parseErrors);

      for (const item of parsed) {
        trainingPayloads.push({
          title: item.title,
          description: bulkForm.description || null,
          category: bulkForm.category,
          frequency: bulkForm.frequency,
          content_url: item.url,
          content_type: "link",
          updated_by: user?.id ?? null,
        });
      }
    }

    if (trainingPayloads.length === 0) {
      toast({
        variant: "destructive",
        title: "No trainings created",
        description: errors.length > 0 ? `Issues: ${errors.slice(0, 3).join("; ")}` : "No valid inputs were provided.",
      });
      setBulkSaving(false);
      return;
    }

    const { error } = await supabase.from("trainings").insert(trainingPayloads);
    if (error) {
      toast({ variant: "destructive", title: "Bulk upload failed", description: error.message });
      setBulkSaving(false);
      return;
    }

    toast({
      title: `Created ${trainingPayloads.length} training${trainingPayloads.length === 1 ? "" : "s"}`,
      description: errors.length > 0 ? `${errors.length} item${errors.length === 1 ? "" : "s"} skipped.` : undefined,
    });
    setBulkOpen(false);
    resetBulkForm();
    await fetchTrainings();
    setBulkSaving(false);
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
      updated_by: user?.id ?? null,
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
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <h1 className="text-2xl font-bold text-foreground">Manage Trainings</h1>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <Dialog open={bulkOpen} onOpenChange={(o) => { setBulkOpen(o); if (!o) resetBulkForm(); }}>
            <DialogTrigger asChild>
              <Button variant="outline">Bulk Upload</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Bulk Upload Trainings</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div><Label>Category</Label>
                    <Select value={bulkForm.category} onValueChange={(v: TrainingCategory) => setBulkForm({ ...bulkForm, category: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="onboarding">On-boarding</SelectItem>
                        <SelectItem value="on_the_job">On-the-Job</SelectItem>
                        <SelectItem value="sop">SOPs</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label>Frequency</Label>
                    <Select value={bulkForm.frequency} onValueChange={(v: TrainingFrequency) => setBulkForm({ ...bulkForm, frequency: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="one_time">One-time</SelectItem>
                        <SelectItem value="annual">Annual</SelectItem>
                        <SelectItem value="semi_annual">Semi-annual</SelectItem>
                        <SelectItem value="as_needed">As Needed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div><Label>Description (optional, applied to all)</Label><Textarea value={bulkForm.description} onChange={(e) => setBulkForm({ ...bulkForm, description: e.target.value })} /></div>

                <div className="space-y-2">
                  <Label>Bulk File Upload</Label>
                  <Input
                    type="file"
                    multiple
                    accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx"
                    onChange={(e) => {
                      const files = Array.from(e.target.files || []);
                      setBulkFiles(files);
                    }}
                  />
                  <p className="text-xs text-muted-foreground">
                    Upload multiple PowerPoint, Excel, PDF, or Word files. Each file becomes one training.
                  </p>
                  {bulkFiles.length > 0 && <p className="text-xs text-muted-foreground">{bulkFiles.length} file(s) selected.</p>}
                </div>

                <div className="space-y-2">
                  <Label>Bulk URL Links</Label>
                  <Textarea
                    value={bulkLinksText}
                    onChange={(e) => setBulkLinksText(e.target.value)}
                    placeholder={"One training per line:\nBloodborne Pathogens | https://example.com/bbp\nPPE Refresher, https://example.com/ppe"}
                    className="min-h-32"
                  />
                  <p className="text-xs text-muted-foreground">
                    Format each line as <code>Title | URL</code> or <code>Title, URL</code>.
                  </p>
                </div>

                <Button onClick={handleBulkSave} className="w-full" disabled={bulkSaving}>
                  {bulkSaving ? "Uploading..." : "Create Trainings in Bulk"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

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
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative basis-full sm:flex-1 sm:min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search trainings..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            <SelectItem value="onboarding">On-boarding</SelectItem>
            <SelectItem value="on_the_job">On-the-Job</SelectItem>
            <SelectItem value="sop">SOPs</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterFrequency} onValueChange={setFilterFrequency}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="All frequencies" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All frequencies</SelectItem>
            <SelectItem value="one_time">One-time</SelectItem>
            <SelectItem value="annual">Annual</SelectItem>
            <SelectItem value="semi_annual">Semi-annual</SelectItem>
            <SelectItem value="as_needed">As Needed</SelectItem>
          </SelectContent>
        </Select>
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground">
            <X className="mr-1 h-3 w-3" />Clear
          </Button>
        )}
        <span className="ml-auto text-sm text-muted-foreground">
          {displayedTrainings.length} of {trainings.length} training{trainings.length !== 1 ? "s" : ""}
        </span>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <button
                    className="flex items-center font-medium hover:text-foreground transition-colors"
                    onClick={() => toggleSort("title")}
                  >
                    Title <SortIcon col="title" />
                  </button>
                </TableHead>
                <TableHead>
                  <button
                    className="flex items-center font-medium hover:text-foreground transition-colors"
                    onClick={() => toggleSort("category")}
                  >
                    Category <SortIcon col="category" />
                  </button>
                </TableHead>
                <TableHead>
                  <button
                    className="flex items-center font-medium hover:text-foreground transition-colors"
                    onClick={() => toggleSort("frequency")}
                  >
                    Frequency <SortIcon col="frequency" />
                  </button>
                </TableHead>
                <TableHead>
                  <button
                    className="flex items-center font-medium hover:text-foreground transition-colors"
                    onClick={() => toggleSort("updated_at")}
                  >
                    Last Updated <SortIcon col="updated_at" />
                  </button>
                </TableHead>
                <TableHead className="w-28">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayedTrainings.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    {hasActiveFilters ? "No trainings match the current filters." : "No trainings yet."}
                  </TableCell>
                </TableRow>
              ) : (
                displayedTrainings.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.title}</TableCell>
                    <TableCell>{CATEGORY_LABELS[t.category] ?? t.category}</TableCell>
                    <TableCell>{FREQUENCY_LABELS[t.frequency] ?? t.frequency}</TableCell>
                    <TableCell>
                      <div className="text-sm">{formatTimestamp(t.updated_at)}</div>
                      {t.updated_by && coordinatorNames[t.updated_by] && (
                        <div className="text-xs text-muted-foreground">by {coordinatorNames[t.updated_by]}</div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" onClick={() => handleOpenAssign(t)} title="Assign users"><UserPlus className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => handleEdit(t)}><Pencil className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => handleDelete(t.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
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
