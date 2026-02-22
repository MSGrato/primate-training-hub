import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { CheckSquare } from "lucide-react";

export default function ApprovalQueue() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [completions, setCompletions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCompletions = async () => {
    if (!user) return;

    // Step 1: fetch pending completions from employees (exclude own — own pending items
    // belong in the supervisor's own supervisor's queue, not theirs)
    const { data: completionData } = await supabase
      .from("training_completions")
      .select("id, user_id, completed_at, status, training:trainings(title)")
      .eq("status", "pending")
      .neq("user_id", user.id);

    const completions = completionData || [];

    // Step 2: fetch profiles separately (training_completions has no direct FK to profiles)
    const userIds = [...new Set(completions.map((c: any) => c.user_id))];
    const { data: profileData } = userIds.length
      ? await supabase.from("profiles").select("user_id, full_name").in("user_id", userIds)
      : { data: [] };

    const profileMap = new Map<string, string>();
    (profileData || []).forEach((p: any) => profileMap.set(p.user_id, p.full_name));

    setCompletions(
      completions.map((c: any) => ({
        ...c,
        profile: { full_name: profileMap.get(c.user_id) || "Unknown" },
      }))
    );
    setLoading(false);
  };

  useEffect(() => { fetchCompletions(); }, [user]);

  const handleAction = async (id: string, action: "approved" | "rejected") => {
    const { error } = await supabase
      .from("training_completions")
      .update({ status: action, approved_by: user?.id, approved_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } else {
      toast({ title: action === "approved" ? "Approved" : "Rejected" });
      fetchCompletions();
    }
  };

  if (loading) return <div className="text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground sm:text-3xl">Approval Queue</h1>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Training</TableHead>
                <TableHead>Completed</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {completions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    <CheckSquare className="mx-auto h-8 w-8 mb-2 text-muted-foreground/50" />
                    No pending approvals.
                  </TableCell>
                </TableRow>
              ) : (
                completions.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>{(c as any).profile?.full_name || "Unknown"}</TableCell>
                    <TableCell>{c.training?.title}</TableCell>
                    <TableCell>{new Date(c.completed_at).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <Button size="sm" onClick={() => handleAction(c.id, "approved")}>Approve</Button>
                        <Button size="sm" variant="destructive" onClick={() => handleAction(c.id, "rejected")}>Reject</Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
