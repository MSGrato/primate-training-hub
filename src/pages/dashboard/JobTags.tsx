import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2 } from "lucide-react";

export default function JobTags() {
  const { toast } = useToast();
  const [tags, setTags] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

  const fetchTags = async () => {
    const { data } = await supabase.from("job_tags").select("*").order("name");
    setTags(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchTags(); }, []);

  const handleCreate = async () => {
    if (!name.trim()) return;
    const { error } = await supabase.from("job_tags").insert({ name: name.trim() });
    if (error) { toast({ variant: "destructive", title: "Error", description: error.message }); return; }
    toast({ title: "Tag created" });
    setName("");
    setOpen(false);
    fetchTags();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("job_tags").delete().eq("id", id);
    fetchTags();
  };

  if (loading) return <div className="text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-foreground sm:text-3xl">Job Tags</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="w-full sm:w-auto"><Plus className="mr-2 h-4 w-4" />Add Tag</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New Job Tag</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Tag name" />
              <Button onClick={handleCreate} className="w-full">Create</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tag Name</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tags.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.name}</TableCell>
                  <TableCell>
                    <Button size="icon" variant="ghost" onClick={() => handleDelete(t.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
