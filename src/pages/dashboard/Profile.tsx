import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { User } from "lucide-react";

export default function Profile() {
  const { user, profile, role } = useAuth();
  const [jobTitle, setJobTitle] = useState<string | null>(null);
  const [tags, setTags] = useState<string[]>([]);

  useEffect(() => {
    if (!profile?.job_title_id) return;
    const fetchJobInfo = async () => {
      const { data: jt } = await supabase
        .from("job_titles")
        .select("name")
        .eq("id", profile.job_title_id!)
        .maybeSingle();
      setJobTitle(jt?.name ?? null);

      const { data: tagData } = await supabase
        .from("job_title_tags")
        .select("job_tag:job_tags(name)")
        .eq("job_title_id", profile.job_title_id!);
      setTags(tagData?.map((t: any) => t.job_tag?.name).filter(Boolean) || []);
    };
    fetchJobInfo();
  }, [profile]);

  const roleLabel = role === "coordinator" ? "Training Coordinator" : role === "supervisor" ? "Supervisor" : "Employee";

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">My Profile</h1>
      <Card className="w-full max-w-lg">
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-primary flex items-center justify-center">
              <User className="h-8 w-8 text-primary-foreground" />
            </div>
            <div>
              <CardTitle>{profile?.full_name || "—"}</CardTitle>
              <p className="text-sm text-muted-foreground">{profile?.net_id}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-sm text-muted-foreground">Role</span>
            <Badge className="bg-secondary text-secondary-foreground">{roleLabel}</Badge>
          </div>
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-sm text-muted-foreground">Job Title</span>
            <span className="text-sm font-medium">{jobTitle || "Not assigned"}</span>
          </div>
          {tags.length > 0 && (
            <div>
              <span className="text-sm text-muted-foreground block mb-2">Tags</span>
              <div className="flex flex-wrap gap-2">
                {tags.map((t) => (
                  <Badge key={t} variant="outline">{t}</Badge>
                ))}
              </div>
            </div>
          )}
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-sm text-muted-foreground">Email</span>
            <span className="text-sm break-all sm:text-right">{user?.email}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
