import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BookOpen } from "lucide-react";

interface TrainingAssignment {
  id: string;
  training: {
    id: string;
    title: string;
    description: string | null;
    category: string;
    frequency: string;
  };
}

export default function TrainingList() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [assignments, setAssignments] = useState<TrainingAssignment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetchAssignments = async () => {
      const { data } = await supabase.
      from("user_training_assignments").
      select("id, training:trainings(id, title, description, category, frequency)").
      eq("user_id", user.id);
      setAssignments(data as any || []);
      setLoading(false);
    };
    fetchAssignments();
  }, [user]);

  const categoryOrder = ["onboarding", "on_the_job", "sop", "other"];
  const categoryLabel = (cat: string) => {
    switch (cat) {
      case "onboarding":return "On-boarding";
      case "on_the_job":return "On-the-Job";
      case "sop":return "SOPs";
      default:return cat;
    }
  };

  const grouped = assignments.reduce<Record<string, TrainingAssignment[]>>((acc, a) => {
    const cat = a.training?.category || "other";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(a);
    return acc;
  }, {});

  // Sort trainings alphabetically within each category
  Object.values(grouped).forEach((items) =>
  items.sort((a, b) => (a.training?.title || "").localeCompare(b.training?.title || ""))
  );

  const sortedCategories = Object.keys(grouped).sort(
    (a, b) => categoryOrder.indexOf(a) - categoryOrder.indexOf(b)
  );

  if (loading) return <div className="text-muted-foreground">Loading trainings...</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-foreground sm:text-4xl">Training List</h1>
      {Object.keys(grouped).length === 0 ?
      <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <BookOpen className="mx-auto h-12 w-12 mb-4 text-muted-foreground/50" />
            <p>No trainings assigned yet.</p>
          </CardContent>
        </Card> :

      sortedCategories.map((cat) => {
        const items = grouped[cat];
        return (
          <div key={cat} className="space-y-3">
              <h2 className="text-lg font-semibold text-foreground">{categoryLabel(cat)}</h2>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {items.map((a) =>
              <Card key={a.id} className="border border-border bg-card rounded-lg shadow-md hover:shadow-xl hover:-translate-y-1 transition-all duration-200 cursor-pointer" onClick={() => navigate(`/dashboard/training/${a.training?.id}`)}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">{a.training?.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground line-clamp-2">{a.training?.description || "No description"}</p>
                      <Badge variant="secondary" className="mt-2 text-xs">{a.training?.frequency?.replace("_", " ")}</Badge>
                    </CardContent>
                  </Card>
              )}
              </div>
            </div>);

      })
      }
    </div>);

}
