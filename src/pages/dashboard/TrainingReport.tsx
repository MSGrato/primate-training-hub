import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { addYears, addMonths, isBefore, addDays } from "date-fns";
import { Button } from "@/components/ui/button";

export default function TrainingReport() {
  const { user } = useAuth();
  const [report, setReport] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetchReport = async () => {
      const { data: assignments } = await supabase
        .from("user_training_assignments")
        .select("id, training:trainings(id, title, category, frequency)")
        .eq("user_id", user.id);

      const { data: completions } = await supabase
        .from("training_completions")
        .select("training_id, completed_at, approved_at, status")
        .eq("user_id", user.id)
        .eq("status", "approved")
        .order("completed_at", { ascending: false });

      const completionMap = new Map<string, any>();
      completions?.forEach((c) => {
        if (!completionMap.has(c.training_id)) completionMap.set(c.training_id, c);
      });

      const rows = (assignments || []).map((a: any) => {
        const t = a.training;
        const lastCompletion = completionMap.get(t.id);
        const lastDate = lastCompletion ? new Date(lastCompletion.approved_at || lastCompletion.completed_at) : null;
        let nextDue: Date | null = null;
        if (lastDate && t.frequency !== "one_time" && t.frequency !== "as_needed") {
          if (t.frequency === "annual") nextDue = addYears(lastDate, 1);
          else if (t.frequency === "semi_annual") nextDue = addMonths(lastDate, 6);
        }
        const now = new Date();
        const isOverdue = nextDue && isBefore(nextDue, now);
        const isDueSoon = nextDue && !isOverdue && isBefore(nextDue, addDays(now, 60));
        const isCompliant = t.frequency === "one_time" && lastDate;

        return { ...t, lastDate, nextDue, isOverdue, isDueSoon, isCompliant };
      });

      setReport(rows);
      setLoading(false);
    };
    fetchReport();
  }, [user]);

  if (loading) return <div className="text-muted-foreground">Loading report...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Training Report</h1>
        <Button asChild>
          <Link to="/dashboard/report-agent">Agent Train</Link>
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Training</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Last Completed</TableHead>
                <TableHead>Next Due</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    No trainings assigned.
                  </TableCell>
                </TableRow>
              ) : (
                report.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.title}</TableCell>
                    <TableCell>{r.category?.replace("_", " ")}</TableCell>
                    <TableCell>{r.lastDate ? r.lastDate.toLocaleDateString() : "Never"}</TableCell>
                    <TableCell>{r.nextDue ? r.nextDue.toLocaleDateString() : r.frequency === "one_time" ? "N/A" : "—"}</TableCell>
                    <TableCell>
                      {r.isOverdue ? (
                        <Badge className="bg-destructive text-destructive-foreground">Not Compliant</Badge>
                      ) : r.isDueSoon ? (
                        <Badge className="bg-destructive/80 text-destructive-foreground">Due Soon</Badge>
                      ) : r.isCompliant ? (
                        <Badge className="bg-success text-success-foreground">Compliant</Badge>
                      ) : r.lastDate ? (
                        <Badge className="bg-success text-success-foreground">Compliant</Badge>
                      ) : (
                        <Badge variant="outline">Not Started</Badge>
                      )}
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
