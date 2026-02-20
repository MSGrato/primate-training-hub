import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import SortableReportTable from "@/components/SortableReportTable";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import ReactMarkdown from "react-markdown";
import { ChevronDown, ChevronRight } from "lucide-react";

type ChatIntent = "summary" | "overdue" | "due_soon" | "completion_rate" | "by_job_title" | "training_search" | "employee_search";

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

type ReportChatAgentProps = {
  title?: string;
  description?: string;
  initialPrompt?: string;
};

const VISIBLE_CHAT_ROWS = 20;

function escapeHtml(value: string) {
  return value
    .split("&").join("&amp;")
    .split("<").join("&lt;")
    .split(">").join("&gt;")
    .split('"').join("&quot;")
    .split("'").join("&#39;");
}

export default function ReportChatAgent({
  title = "Report Chat",
  description = "Generate live training reports using app data and your role-based access scope.",
  initialPrompt,
}: ReportChatAgentProps) {
  const { user } = useAuth();
  const [prompt, setPrompt] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const { toast } = useToast();
  const hasInteraction = messages.length > 0 || chatLoading;
  const initialPromptFired = useRef(false);

  useEffect(() => {
    if (initialPrompt && !initialPromptFired.current && user) {
      initialPromptFired.current = true;
      submitPrompt(initialPrompt);
    }
  }, [initialPrompt, user]);

  const quickPrompts = useMemo(
    () => [
      "Show overdue trainings",
      "List all employees",
      "What trainings should my team prioritize?",
      "Show completion rate by job title",
    ],
    []
  );

  const renderValue = (value: unknown, header?: string): string => {
    if (value === null || value === undefined || value === "") return "—";
    if (typeof value === "number") return Number.isInteger(value) ? String(value) : value.toFixed(1);
    if (typeof value === "string") {
      const isDateColumn = header ? /(?:_at|_date|date)$/i.test(header) : false;
      const looksIsoDate = /^\d{4}-\d{2}-\d{2}(?:[T\s].*)?$/.test(value);
      if (isDateColumn && looksIsoDate) {
        const maybeDate = new Date(value);
        if (!Number.isNaN(maybeDate.getTime())) return maybeDate.toLocaleDateString();
      }
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
          .map((header) => `<td>${escapeHtml(renderValue(row[header], header))}</td>`)
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
      table { width: 100%; border-collapse: collapse; font-size: 11px; }
      th, td { border: 1px solid #e5e7eb; text-align: left; padding: 6px; vertical-align: top; }
      th { background: #f3f4f6; }
    </style>
  </head>
  <body>
    <h1>Training Report</h1>
    <div class="meta">
      <p><strong>Generated:</strong> ${escapeHtml(now.toLocaleString())}</p>
      <p><strong>Intent:</strong> ${escapeHtml(report.intent.split("_").join(" "))}</p>
      <p><strong>Export Mode:</strong> ${escapeHtml(mode === "visible" ? "Visible Rows Only" : "All Rows")}</p>
      <p><strong>Summary:</strong> ${escapeHtml(report.summary)}</p>
    </div>
    ${
      headers.length > 0
        ? `<table>
            <thead><tr>${headers.map((h) => `<th>${escapeHtml(h.split("_").join(" "))}</th>`).join("")}</tr></thead>
            <tbody>${rowsHtml}</tbody>
          </table>`
        : "<p>No rows returned for this report.</p>"
    }
    <script>
      window.onload = () => { window.print(); };
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
        { id: crypto.randomUUID(), role: "assistant", text: `Failed to run report: ${error.message}` },
      ]);
      toast({ title: "Report chat failed", description: error.message, variant: "destructive" });
      setChatLoading(false);
      return;
    }

    if (!data || data.error) {
      const message = data?.error ?? "Report chat returned no data.";
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "assistant", text: `Failed to run report: ${message}` },
      ]);
      toast({ title: "Report chat failed", description: message, variant: "destructive" });
      setChatLoading(false);
      return;
    }

    const response = data as ChatResponse;
    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role: "assistant", text: response.summary, report: response },
    ]);
    setChatLoading(false);
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    await submitPrompt();
  };

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
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

        <form className="space-y-2" onSubmit={onSubmit}>
          <Textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="Ask Agent Train for what you need"
            rows={3}
            disabled={chatLoading}
          />
          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={chatLoading || !prompt.trim()}
              className="px-6 py-2 text-base font-semibold shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-200"
            >
              {chatLoading ? "Generating..." : "Ask"}
            </Button>
          </div>
        </form>

        {hasInteraction && (
          <div className="h-[260px] sm:h-[420px] overflow-y-auto rounded-md border bg-muted/40 p-4">
            <div className="space-y-1">
              {messages.map((msg, idx) => (
                <div key={msg.id}>
                  {idx > 0 && messages[idx - 1].role !== msg.role && (
                    <Separator className="my-3" />
                  )}
                  <div className={msg.role === "user" ? "flex justify-end" : ""}>
                    <div
                      className={
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground rounded-lg px-4 py-2 max-w-[80%]"
                          : "space-y-3"
                      }
                    >
                      <div className="text-sm prose prose-sm max-w-none dark:prose-invert">
                        <ReactMarkdown>{msg.text}</ReactMarkdown>
                      </div>

                      {msg.report && msg.report.rows.length > 0 && (
                        <CollapsibleTable
                          report={msg.report}
                          chatLoading={chatLoading}
                          onExport={exportReportToPdf}
                          onSuggest={submitPrompt}
                        />
                      )}

                      {msg.report && msg.report.rows.length === 0 && msg.report.suggested_prompts.length > 0 && (
                        <SuggestedPrompts
                          prompts={msg.report.suggested_prompts}
                          disabled={chatLoading}
                          onSelect={submitPrompt}
                        />
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {chatLoading && (
                <p className="text-sm text-muted-foreground animate-pulse">Generating report…</p>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ── Collapsible table sub-component ── */

function CollapsibleTable({
  report,
  chatLoading,
  onExport,
  onSuggest,
}: {
  report: ChatResponse;
  chatLoading: boolean;
  onExport: (report: ChatResponse, mode: "all" | "visible") => void;
  onSuggest: (prompt: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const rowCount = report.rows.length;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="flex items-center justify-between">
        <CollapsibleTrigger asChild>
          <button className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
            {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            {rowCount} {rowCount === 1 ? "result" : "results"}
          </button>
        </CollapsibleTrigger>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="h-6 text-[10px] px-2" onClick={() => onExport(report, "visible")}>
            Export Visible
          </Button>
          <Button size="sm" variant="outline" className="h-6 text-[10px] px-2" onClick={() => onExport(report, "all")}>
            Export All
          </Button>
        </div>
      </div>
      <CollapsibleContent>
        <SortableReportTable rows={report.rows} maxRows={VISIBLE_CHAT_ROWS} />
      </CollapsibleContent>

      {report.suggested_prompts && report.suggested_prompts.length > 0 && (
        <SuggestedPrompts prompts={report.suggested_prompts} disabled={chatLoading} onSelect={onSuggest} />
      )}
    </Collapsible>
  );
}

/* ── Suggested prompts as pill buttons ── */

function SuggestedPrompts({
  prompts,
  disabled,
  onSelect,
}: {
  prompts: string[];
  disabled: boolean;
  onSelect: (prompt: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2 pt-2">
      {prompts.map((sp) => (
        <button
          key={sp}
          className="rounded-full border border-primary/30 bg-transparent px-3 py-1 text-xs text-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
          disabled={disabled}
          onClick={() => onSelect(sp)}
        >
          {sp}
        </button>
      ))}
    </div>
  );
}
