import { FormEvent, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { addYears, addMonths, isBefore, addDays } from "date-fns";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";

type ChatIntent = "summary" | "overdue" | "due_soon" | "completion_rate" | "by_job_title";

type ChatRow = Record<string, unknown>;

type ChatResponse = {
  intent: ChatIntent;
  summary: string;
  scope: {
    role: "employee" | "supervisor" | "coordinator";
    users: number;
    dueSoonDays: number;
    net_id_filter?: string | null;
  };
  highlights: {
    total_assignments: number;
    compliant: number;
    overdue: number;
    due_soon: number;
    not_started: number;
    completion_rate: number;
  };
  rows: ChatRow[];
  suggested_prompts: string[];
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  report?: ChatResponse;
};

const VISIBLE_CHAT_ROWS = 20;

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export default function TrainingReport() {
  const { user } = useAuth();
  const [report, setReport] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [prompt, setPrompt] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: crypto.randomUUID(),
      role: "assistant",
      text: "Ask for reports like: 'Show overdue trainings' or 'Show completion rate by job title'.",
    },
  ]);
  const { toast } = useToast();

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

  const quickPrompts = useMemo(
    () => [
      "Show overdue trainings",
      "Show due soon trainings in 30 days",
      "Show completion rate by job title",
    ],
    [],
  );

  const renderValue = (value: unknown): string => {
    if (value === null || value === undefined || value === "") return "—";
    if (typeof value === "number") return Number.isInteger(value) ? String(value) : value.toFixed(1);
    if (typeof value === "string") {
      const maybeDate = new Date(value);
      if (!Number.isNaN(maybeDate.getTime()) && value.includes("T")) return maybeDate.toLocaleDateString();
      return value;
    }
    return String(JSON.stringify(value) ?? "—");
  };

  const exportReportToPdf = (report: ChatResponse, mode: "all" | "visible") => {
    if (typeof window === "undefined") return;

    const popup = window.open("", "_blank", "width=1200,height=900");
    if (!popup) {
      toast({
        title: "Popup blocked",
        description: "Allow popups to export report PDF.",
        variant: "destructive",
      });
      return;
    }

    const now = new Date();
    const reportRows = mode === "visible" ? report.rows.slice(0, VISIBLE_CHAT_ROWS) : report.rows;
    const headers = reportRows.length > 0 ? Object.keys(reportRows[0]) : [];
    const rowsHtml = reportRows
      .map((row) => {
        const cells = headers
          .map((header) => `<td>${escapeHtml(renderValue(row[header]))}</td>`)
          .join("");
        return `<tr>${cells}</tr>`;
      })
      .join("");

    const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Training Report Export</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 24px; color: #111827; }
      h1 { margin: 0 0 8px; font-size: 20px; }
      p { margin: 4px 0; font-size: 12px; }
      .meta { margin-bottom: 16px; }
      .chips { display: flex; gap: 8px; flex-wrap: wrap; margin: 12px 0 16px; }
      .chip { border: 1px solid #d1d5db; border-radius: 999px; padding: 4px 10px; font-size: 12px; }
      table { width: 100%; border-collapse: collapse; font-size: 11px; }
      th, td { border: 1px solid #e5e7eb; text-align: left; padding: 6px; vertical-align: top; }
      th { background: #f3f4f6; }
    </style>
  </head>
  <body>
    <h1>Training Report</h1>
    <div class="meta">
      <p><strong>Generated:</strong> ${escapeHtml(now.toLocaleString())}</p>
      <p><strong>Intent:</strong> ${escapeHtml(report.intent.replaceAll("_", " "))}</p>
      <p><strong>Export Mode:</strong> ${escapeHtml(mode === "visible" ? "Visible Rows Only" : "All Rows")}</p>
      <p><strong>Summary:</strong> ${escapeHtml(report.summary)}</p>
    </div>
    <div class="chips">
      <span class="chip">Users: ${report.scope.users}</span>
      <span class="chip">Assignments: ${report.highlights.total_assignments}</span>
      <span class="chip">Overdue: ${report.highlights.overdue}</span>
      <span class="chip">Due Soon: ${report.highlights.due_soon}</span>
      <span class="chip">Compliance: ${report.highlights.completion_rate}%</span>
    </div>
    ${
      headers.length > 0
        ? `<table>
            <thead><tr>${headers.map((h) => `<th>${escapeHtml(h.replaceAll("_", " "))}</th>`).join("")}</tr></thead>
            <tbody>${rowsHtml}</tbody>
          </table>`
        : "<p>No rows returned for this report.</p>"
    }
    <script>
      window.onload = () => {
        window.print();
      };
    </script>
  </body>
</html>`;

    popup.document.open();
    popup.document.write(html);
    popup.document.close();
  };

  const submitPrompt = async (nextPrompt?: string) => {
    const text = (nextPrompt ?? prompt).trim();
    if (!text || !user) return;

    setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "user", text }]);
    setPrompt("");
    setChatLoading(true);

    const { data, error } = await supabase.functions.invoke("report-chat", {
      body: { prompt: text },
    });

    if (error) {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          text: `Failed to run report: ${error.message}`,
        },
      ]);
      toast({
        title: "Report chat failed",
        description: error.message,
        variant: "destructive",
      });
      setChatLoading(false);
      return;
    }

    if (!data || data.error) {
      const message = data?.error ?? "Report chat returned no data.";
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          text: `Failed to run report: ${message}`,
        },
      ]);
      toast({
        title: "Report chat failed",
        description: message,
        variant: "destructive",
      });
      setChatLoading(false);
      return;
    }

    const response = data as ChatResponse;
    setMessages((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        role: "assistant",
        text: response.summary,
        report: response,
      },
    ]);
    setChatLoading(false);
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    await submitPrompt();
  };

  if (loading) return <div className="text-muted-foreground">Loading report...</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Training Report</h1>
      <Card>
        <CardHeader>
          <CardTitle>Report Chat</CardTitle>
          <CardDescription>Generate live training reports using app data and your role-based access scope.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {quickPrompts.map((item) => (
              <Button
                key={item}
                type="button"
                variant="outline"
                size="sm"
                disabled={chatLoading}
                onClick={() => submitPrompt(item)}
              >
                {item}
              </Button>
            ))}
          </div>

          <div className="space-y-3 max-h-[480px] overflow-y-auto rounded-md border p-3">
            {messages.map((message) => (
              <div key={message.id} className="space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{message.role === "user" ? "You" : "Report Agent"}</span>
                  {message.report?.intent ? <Badge variant="outline">{message.report.intent.replace("_", " ")}</Badge> : null}
                </div>
                <p className="text-sm">{message.text}</p>

                {message.report ? (
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline">Users: {message.report.scope.users}</Badge>
                      <Badge variant="outline">Assignments: {message.report.highlights.total_assignments}</Badge>
                      <Badge className="bg-destructive text-destructive-foreground">Overdue: {message.report.highlights.overdue}</Badge>
                      <Badge className="bg-destructive/80 text-destructive-foreground">Due Soon: {message.report.highlights.due_soon}</Badge>
                      <Badge className="bg-success text-success-foreground">
                        Compliance: {message.report.highlights.completion_rate}%
                      </Badge>
                    </div>
                    {message.report.rows.length > 0 ? (
                      <div className="overflow-x-auto rounded-md border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              {Object.keys(message.report.rows[0]).map((column) => (
                                <TableHead key={column}>{column.replaceAll("_", " ")}</TableHead>
                              ))}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {message.report.rows.slice(0, VISIBLE_CHAT_ROWS).map((row, index) => (
                              <TableRow key={`${message.id}-${index}`}>
                                {Object.keys(message.report!.rows[0]).map((column) => (
                                  <TableCell key={`${message.id}-${index}-${column}`}>{renderValue(row[column])}</TableCell>
                                ))}
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No rows returned for this prompt.</p>
                    )}
                    {message.report.suggested_prompts.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => exportReportToPdf(message.report!, "all")}
                        >
                          Export All PDF
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => exportReportToPdf(message.report!, "visible")}
                        >
                          Export Visible PDF
                        </Button>
                        {message.report.suggested_prompts.map((item) => (
                          <Button
                            key={`${message.id}-${item}`}
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={chatLoading}
                            onClick={() => submitPrompt(item)}
                          >
                            {item}
                          </Button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}

                <Separator />
              </div>
            ))}
          </div>

          <form className="space-y-2" onSubmit={onSubmit}>
            <Textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="Ask for a report. Example: Show overdue trainings for netid employee."
              rows={3}
              disabled={chatLoading}
            />
            <div className="flex justify-end">
              <Button type="submit" disabled={chatLoading || !prompt.trim()}>
                {chatLoading ? "Generating..." : "Run Report"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

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
