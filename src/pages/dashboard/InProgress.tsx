import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ClipboardList } from "lucide-react";

export default function InProgress() {
  const { user } = useAuth();
  const [completions, setCompletions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      const { data } = await supabase
        .from("training_completions")
        .select("id, status, completed_at, training:trainings(id, title, category)")
        .eq("user_id", user.id)
        .eq("status", "pending");
      setCompletions(data || []);
      setLoading(false);
    };
    fetch();
  }, [user]);

  const statusColor = (s: string) => {
    switch (s) {
      case "pending": return "bg-secondary text-secondary-foreground";
      case "approved": return "bg-success text-success-foreground";
      case "rejected": return "bg-destructive text-destructive-foreground";
      default: return "";
    }
  };

  if (loading) return <div className="text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">In Progress</h1>
      {completions.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <ClipboardList className="mx-auto h-12 w-12 mb-4 text-muted-foreground/50" />
            <p>No trainings in progress.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {completions.map((c) => (
            <Card key={c.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{c.training?.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Completed: {new Date(c.completed_at).toLocaleDateString()}
                </p>
                <Badge className={`mt-2 text-xs ${statusColor(c.status)}`}>
                  {c.status.charAt(0).toUpperCase() + c.status.slice(1)}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
