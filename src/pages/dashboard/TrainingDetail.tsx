import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, CheckCircle2, Clock, XCircle, Loader2, ExternalLink, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface Training {
  id: string;
  title: string;
  description: string | null;
  category: string;
  frequency: string;
  content_url: string | null;
  content_type: string | null;
}

interface Completion {
  id: string;
  status: string;
  completed_at: string;
  approved_at: string | null;
  approved_by: string | null;
}

export default function TrainingDetail() {
  const { trainingId } = useParams<{ trainingId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [training, setTraining] = useState<Training | null>(null);
  const [completion, setCompletion] = useState<Completion | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);

  const fetchData = async () => {
    if (!user || !trainingId) return;

    const [{ data: trainingData }, { data: completionData }] = await Promise.all([
      supabase.from("trainings").select("*").eq("id", trainingId).single(),
      supabase
        .from("training_completions")
        .select("id, status, completed_at, approved_at, approved_by")
        .eq("user_id", user.id)
        .eq("training_id", trainingId)
        .order("created_at", { ascending: false })
        .limit(1),
    ]);

    setTraining(trainingData as Training | null);
    setCompletion(completionData?.[0] as Completion | null ?? null);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [user, trainingId]);

  const handleMarkComplete = async () => {
    if (!user || !trainingId) return;
    setSubmitting(true);

    const { error } = await supabase.from("training_completions").insert({
      user_id: user.id,
      training_id: trainingId,
      status: "pending" as const,
    });

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Submitted", description: "Training sent for supervisor approval." });
      await fetchData();
    }
    setSubmitting(false);
  };

  const handleResubmit = async () => {
    if (!user || !trainingId || !completion) return;
    setSubmitting(true);

    const { error } = await supabase
      .from("training_completions")
      .delete()
      .eq("id", completion.id);

    if (!error) {
      await supabase.from("training_completions").insert({
        user_id: user.id,
        training_id: trainingId,
        status: "pending" as const,
      });
      toast({ title: "Resubmitted", description: "Training sent for supervisor approval." });
      await fetchData();
    } else {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
    setSubmitting(false);
  };

  if (loading) return <div className="text-muted-foreground">Loading training...</div>;
  if (!training) return <div className="text-muted-foreground">Training not found.</div>;

  const getFileExtension = (url: string) => {
    const cleanUrl = url.split("?")[0].toLowerCase();
    const parts = cleanUrl.split(".");
    return parts.length > 1 ? parts.pop() : null;
  };

  const getViewerUrl = (url: string) => {
    const ext = getFileExtension(url);
    if (ext === "pdf") return url;
    if (["doc", "docx", "ppt", "pptx", "xls", "xlsx"].includes(ext || "")) {
      return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`;
    }
    return null;
  };

  const viewerUrl = training.content_url ? getViewerUrl(training.content_url) : null;

  const categoryLabel = (cat: string) => {
    switch (cat) {
      case "onboarding": return "On-boarding";
      case "on_the_job": return "On-the-Job";
      case "sop": return "SOPs";
      default: return cat;
    }
  };

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard/training-list")} className="gap-2">
        <ArrowLeft className="h-4 w-4" /> Back to Training List
      </Button>

      <div>
        <h1 className="text-2xl font-bold text-foreground">{training.title}</h1>
        <div className="mt-2 flex flex-wrap gap-2">
          <Badge variant="secondary">{categoryLabel(training.category)}</Badge>
          <Badge variant="outline">{training.frequency?.replace("_", " ")}</Badge>
        </div>
      </div>

      {training.description && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Description</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{training.description}</p>
          </CardContent>
        </Card>
      )}

      {training.content_url && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Training Material</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 sm:flex-row">
            {training.content_type === "file" && viewerUrl && (
              <Button variant="default" className="gap-2" onClick={() => setViewerOpen(true)}>
                <FileText className="h-4 w-4" />
                View In App
              </Button>
            )}
            <Button asChild variant="outline" className="gap-2">
              <a href={training.content_url} target="_blank" rel="noreferrer">
                <ExternalLink className="h-4 w-4" />
                Open in New Tab
              </a>
            </Button>
          </CardContent>
        </Card>
      )}

      <Dialog open={viewerOpen} onOpenChange={setViewerOpen}>
        <DialogContent className="max-w-5xl h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Training Material Viewer</DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0">
            {viewerUrl ? (
              <iframe
                src={viewerUrl}
                title="Training material viewer"
                className="w-full h-full rounded-md border"
              />
            ) : (
              <div className="text-sm text-muted-foreground">
                This file type cannot be previewed in-app. Use "Open in New Tab".
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Sign-Off Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sign-Off Status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Employee Sign-Off */}
          <div className="flex items-start gap-3">
            {completion ? (
              <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
            ) : (
              <div className="h-5 w-5 rounded-full border-2 border-muted-foreground/30 mt-0.5 shrink-0" />
            )}
            <div className="flex-1">
              <p className="font-medium text-sm">Employee Sign-Off</p>
              {completion ? (
                <p className="text-xs text-muted-foreground">
                  Completed on {format(new Date(completion.completed_at), "MMM d, yyyy 'at' h:mm a")}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">Not yet completed</p>
              )}
            </div>
          </div>

          {/* Supervisor Sign-Off */}
          <div className="flex items-start gap-3">
            {completion?.status === "approved" ? (
              <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
            ) : completion?.status === "rejected" ? (
              <XCircle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
            ) : completion?.status === "pending" ? (
              <Clock className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
            ) : (
              <div className="h-5 w-5 rounded-full border-2 border-muted-foreground/30 mt-0.5 shrink-0" />
            )}
            <div className="flex-1">
              <p className="font-medium text-sm">Supervisor Sign-Off</p>
              {completion?.status === "approved" && completion.approved_at ? (
                <p className="text-xs text-muted-foreground">
                  Approved on {format(new Date(completion.approved_at), "MMM d, yyyy 'at' h:mm a")}
                </p>
              ) : completion?.status === "rejected" ? (
                <p className="text-xs text-destructive">Rejected — you may resubmit</p>
              ) : completion?.status === "pending" ? (
                <p className="text-xs text-muted-foreground">Awaiting supervisor approval</p>
              ) : (
                <p className="text-xs text-muted-foreground">Pending employee completion</p>
              )}
            </div>
          </div>

          {/* Actions */}
          {!completion && (
            <Button onClick={handleMarkComplete} disabled={submitting} className="mt-2">
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Mark Complete
            </Button>
          )}
          {completion?.status === "rejected" && (
            <Button onClick={handleResubmit} disabled={submitting} variant="outline" className="mt-2">
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Resubmit
            </Button>
          )}
          {completion?.status === "pending" && (
            <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 mt-2">
              Awaiting Supervisor Approval
            </Badge>
          )}
          {completion?.status === "approved" && (
            <Badge className="bg-green-500/10 text-green-600 border-green-500/20 mt-2">
              Completed
            </Badge>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
