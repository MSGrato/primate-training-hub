import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Pencil } from "lucide-react";

interface JobTag {
  id: string;
  name: string;
}

export default function JobTitles() {
  const { toast } = useToast();
  const [titles, setTitles] = useState<any[]>([]);
  const [tags, setTags] = useState<JobTag[]>([]);
  const [loading, setLoading] = useState(true);

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);

  // Edit dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editTagIds, setEditTagIds] = useState<string[]>([]);

  const fetchTitles = async () => {
    const { data } = await supabase
      .from("job_titles")
      .select("id, name, description, job_title_tags(job_tag_id, job_tag:job_tags(name))")
      .order("name");
    setTitles(data || []);
    setLoading(false);
  };

  const fetchTags = async () => {
    const { data } = await supabase.from("job_tags").select("id, name").order("name");
    setTags(data || []);
  };

  useEffect(() => {
    fetchTitles();
    fetchTags();
  }, []);

  const handleCreate = async () => {
    if (!name.trim()) return;
    const { data: inserted, error } = await supabase
      .from("job_titles")
      .insert({ name: name.trim(), description: description.trim() || null })
      .select("id")
      .single();
    if (error) {
      toast({ variant: "destructive", title: "Error", description: error.message });
      return;
    }
    if (selectedTagIds.length > 0) {
      await supabase.from("job_title_tags").insert(
        selectedTagIds.map((tagId) => ({ job_title_id: inserted.id, job_tag_id: tagId }))
      );
    }
    toast({ title: "Job title created" });
    setName("");
    setDescription("");
    setSelectedTagIds([]);
    setCreateOpen(false);
    fetchTitles();
  };

  const openEdit = (t: any) => {
    setEditId(t.id);
    setEditName(t.name);
    setEditDescription(t.description || "");
    setEditTagIds(t.job_title_tags?.map((tt: any) => tt.job_tag_id) || []);
    setEditOpen(true);
  };

  const handleEdit = async () => {
    if (!editId || !editName.trim()) return;
    const { error } = await supabase
      .from("job_titles")
      .update({ name: editName.trim(), description: editDescription.trim() || null })
      .eq("id", editId);
    if (error) {
      toast({ variant: "destructive", title: "Error", description: error.message });
      return;
    }
    // Replace tags: delete old, insert new
    await supabase.from("job_title_tags").delete().eq("job_title_id", editId);
    if (editTagIds.length > 0) {
      await supabase.from("job_title_tags").insert(
        editTagIds.map((tagId) => ({ job_title_id: editId, job_tag_id: tagId }))
      );
    }
    toast({ title: "Job title updated" });
    setEditOpen(false);
    fetchTitles();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("job_title_tags").delete().eq("job_title_id", id);
    await supabase.from("job_titles").delete().eq("id", id);
    fetchTitles();
  };

  const toggleTag = (tagId: string, list: string[], setter: (v: string[]) => void) => {
    setter(list.includes(tagId) ? list.filter((id) => id !== tagId) : [...list, tagId]);
  };

  if (loading) return <div className="text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Job Titles</h1>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" />Add Title</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New Job Title</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Title Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Job title name" />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Job description (optional)" />
              </div>
              {tags.length > 0 && (
                <div className="space-y-2">
                  <Label>Tags</Label>
                  <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto border rounded-md p-3">
                    {tags.map((tag) => (
                      <div key={tag.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`create-tag-${tag.id}`}
                          checked={selectedTagIds.includes(tag.id)}
                          onCheckedChange={() => toggleTag(tag.id, selectedTagIds, setSelectedTagIds)}
                        />
                        <label htmlFor={`create-tag-${tag.id}`} className="text-sm cursor-pointer">{tag.name}</label>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button onClick={handleCreate}>Create</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Tags</TableHead>
                <TableHead className="w-[100px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {titles.map((t: any) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.name}</TableCell>
                  <TableCell className="text-muted-foreground text-sm max-w-[200px] truncate">{t.description || "—"}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {t.job_title_tags?.map((tt: any) => (
                        <Badge key={tt.job_tag?.name} variant="outline" className="text-xs">{tt.job_tag?.name}</Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => openEdit(t)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => handleDelete(t.id)}>
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

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Job Title</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Title Name</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} placeholder="Job description (optional)" />
            </div>
            {tags.length > 0 && (
              <div className="space-y-2">
                <Label>Tags</Label>
                <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto border rounded-md p-3">
                  {tags.map((tag) => (
                    <div key={tag.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`edit-tag-${tag.id}`}
                        checked={editTagIds.includes(tag.id)}
                        onCheckedChange={() => toggleTag(tag.id, editTagIds, setEditTagIds)}
                      />
                      <label htmlFor={`edit-tag-${tag.id}`} className="text-sm cursor-pointer">{tag.name}</label>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={handleEdit}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
