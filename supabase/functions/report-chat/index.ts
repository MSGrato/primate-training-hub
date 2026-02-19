import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type AppRole = "employee" | "supervisor" | "coordinator";
type Intent = "summary" | "overdue" | "due_soon" | "completion_rate" | "by_job_title" | "training_search";

type ScopeProfile = {
  user_id: string;
  full_name: string;
  net_id: string;
  job_title_id: string | null;
  is_active: boolean;
};

type AssignmentRow = {
  user_id: string;
  training_id: string;
  training: {
    id: string;
    title: string;
    category: string;
    frequency: "one_time" | "annual" | "semi_annual" | "as_needed";
  } | null;
};

type CompletionRow = {
  user_id: string;
  training_id: string;
  completed_at: string;
  approved_at: string | null;
  status: "pending" | "approved" | "rejected";
};

function parseIntent(prompt: string): Intent {
  const p = prompt.toLowerCase();

  if (
    p.includes("find training") ||
    p.includes("find trainings") ||
    p.includes("search training") ||
    p.includes("search trainings") ||
    p.includes("look up training") ||
    p.startsWith("training:")
  ) {
    return "training_search";
  }
  if (p.includes("by job title") || p.includes("job title breakdown") || p.includes("title breakdown")) {
    return "by_job_title";
  }
  if (p.includes("completion rate") || p.includes("compliance rate")) {
    return "completion_rate";
  }
  if (p.includes("due soon")) {
    return "due_soon";
  }
  if (p.includes("overdue") || p.includes("not compliant")) {
    return "overdue";
  }

  return "summary";
}

function extractTrainingSearchQuery(prompt: string): string {
  const trimmed = prompt.trim();
  const lowered = trimmed.toLowerCase();

  if (lowered.startsWith("training:")) {
    return trimmed.slice("training:".length).trim();
  }

  const pattern = /(?:find|search|look up)\s+(?:for\s+)?(?:training|trainings)(?:\s+(?:about|for|with))?\s+(.+)/i;
  const match = trimmed.match(pattern);
  if (match?.[1]) return match[1].trim();

  return trimmed;
}

function parseDaysWindow(prompt: string): number {
  const p = prompt.toLowerCase();
  const explicitDays = p.match(/(\d{1,3})\s*day/);
  if (explicitDays) {
    const parsed = Number.parseInt(explicitDays[1], 10);
    if (Number.isFinite(parsed) && parsed > 0 && parsed <= 365) return parsed;
  }
  if (p.includes("this month")) return 30;
  if (p.includes("next month")) return 30;
  return 60;
}

function parseNetIdFilter(prompt: string): string | null {
  const match = prompt.toLowerCase().match(/netid[:\s]+([a-z0-9._-]+)/);
  return match?.[1] ?? null;
}

function asDate(value: string | null): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function addMonths(date: Date, months: number): Date {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function buildStatus(
  frequency: "one_time" | "annual" | "semi_annual" | "as_needed",
  lastCompletionDate: Date | null,
  now: Date,
  dueSoonWindowDays: number,
) {
  if (frequency === "one_time") {
    return {
      status: lastCompletionDate ? "compliant" : "not_started",
      nextDue: null as Date | null,
    };
  }

  if (frequency === "as_needed") {
    return {
      status: lastCompletionDate ? "compliant" : "not_started",
      nextDue: null as Date | null,
    };
  }

  if (!lastCompletionDate) {
    return {
      status: "not_started",
      nextDue: null as Date | null,
    };
  }

  const nextDue = frequency === "annual" ? addMonths(lastCompletionDate, 12) : addMonths(lastCompletionDate, 6);
  if (nextDue < now) {
    return { status: "overdue", nextDue };
  }

  const soonCutoff = new Date(now);
  soonCutoff.setDate(soonCutoff.getDate() + dueSoonWindowDays);
  if (nextDue <= soonCutoff) {
    return { status: "due_soon", nextDue };
  }

  return { status: "compliant", nextDue };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const callerId = claimsData.claims.sub as string;
    const body = await req.json().catch(() => ({}));
    const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
    if (!prompt) {
      return new Response(JSON.stringify({ error: "Prompt is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: roleRow, error: roleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", callerId)
      .maybeSingle();
    if (roleError) {
      return new Response(JSON.stringify({ error: roleError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const callerRole = (roleRow?.role ?? "employee") as AppRole;

    const intent = parseIntent(prompt);
    const dueSoonDays = parseDaysWindow(prompt);
    const requestedNetId = parseNetIdFilter(prompt);
    const now = new Date();

    if (intent === "training_search") {
      const query = extractTrainingSearchQuery(prompt).toLowerCase();
      const queryTokens = query
        .split(/\s+/)
        .map((token) => token.trim())
        .filter((token) => token.length >= 2);

      const { data: trainings, error: trainingsError } = await supabase
        .from("trainings")
        .select("id,title,description,category,frequency")
        .order("title", { ascending: true });
      if (trainingsError) throw new Error(trainingsError.message);

      const matches = (trainings ?? [])
        .map((training) => {
          const haystack = [
            training.title ?? "",
            training.description ?? "",
            training.category ?? "",
            training.frequency ?? "",
          ]
            .join(" ")
            .toLowerCase();

          const score = queryTokens.length === 0
            ? 1
            : queryTokens.reduce((count, token) => count + (haystack.includes(token) ? 1 : 0), 0);

          return {
            id: training.id,
            title: training.title,
            description: training.description,
            category: training.category,
            frequency: training.frequency,
            match_score: score,
          };
        })
        .filter((row) => row.match_score > 0)
        .sort((a, b) => b.match_score - a.match_score || a.title.localeCompare(b.title))
        .slice(0, 200);

      return new Response(
        JSON.stringify({
          intent,
          summary: queryTokens.length === 0
            ? `Showing ${matches.length} trainings from the catalog.`
            : `Found ${matches.length} trainings matching "${query}".`,
          scope: {
            role: callerRole,
            users: 0,
            dueSoonDays,
            net_id_filter: null,
          },
          highlights: {
            total_assignments: matches.length,
            compliant: 0,
            overdue: 0,
            due_soon: 0,
            not_started: 0,
            completion_rate: 0,
          },
          rows: matches,
          suggested_prompts: [
            "Find trainings about biosafety",
            "Find trainings for anesthesia",
            "Show overdue trainings",
          ],
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let scopeProfiles: ScopeProfile[] = [];

    if (callerRole === "coordinator") {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id,full_name,net_id,job_title_id,is_active")
        .eq("is_active", true);
      if (error) throw new Error(error.message);
      scopeProfiles = (data ?? []) as ScopeProfile[];
    } else if (callerRole === "supervisor") {
      const { data: mappings, error: mappingError } = await supabase
        .from("supervisor_employee_mappings")
        .select("employee_id")
        .eq("supervisor_id", callerId);
      if (mappingError) throw new Error(mappingError.message);

      const scopedIds = Array.from(new Set([callerId, ...(mappings ?? []).map((m) => m.employee_id)]));
      const { data: profileRows, error: profileError } = await supabase
        .from("profiles")
        .select("user_id,full_name,net_id,job_title_id,is_active")
        .in("user_id", scopedIds)
        .eq("is_active", true);
      if (profileError) throw new Error(profileError.message);
      scopeProfiles = (profileRows ?? []) as ScopeProfile[];
    } else {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id,full_name,net_id,job_title_id,is_active")
        .eq("user_id", callerId)
        .eq("is_active", true);
      if (error) throw new Error(error.message);
      scopeProfiles = (data ?? []) as ScopeProfile[];
    }

    if (requestedNetId) {
      if (callerRole === "employee") {
        return new Response(
          JSON.stringify({ error: "Employees can only run reports for their own account." }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      scopeProfiles = scopeProfiles.filter((p) => p.net_id.toLowerCase() === requestedNetId);
    }

    if (scopeProfiles.length === 0) {
      return new Response(
        JSON.stringify({
          intent,
          summary: "No users found in your report scope.",
          scope: { role: callerRole, users: 0, dueSoonDays },
          highlights: { total_assignments: 0, compliant: 0, overdue: 0, due_soon: 0, not_started: 0, completion_rate: 0 },
          rows: [],
          suggested_prompts: [
            "Show overdue trainings",
            "Show due soon trainings in 30 days",
            "Show completion rate by job title",
          ],
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const userIds = scopeProfiles.map((p) => p.user_id);

    const { data: jobTitles, error: titleError } = await supabase.from("job_titles").select("id,name");
    if (titleError) throw new Error(titleError.message);
    const jobTitleNameById = new Map<string, string>((jobTitles ?? []).map((t) => [t.id, t.name]));

    const { data: assignmentsData, error: assignmentsError } = await supabase
      .from("user_training_assignments")
      .select("user_id,training_id,training:trainings(id,title,category,frequency)")
      .in("user_id", userIds);
    if (assignmentsError) throw new Error(assignmentsError.message);

    const { data: completionsData, error: completionsError } = await supabase
      .from("training_completions")
      .select("user_id,training_id,completed_at,approved_at,status")
      .in("user_id", userIds)
      .eq("status", "approved")
      .order("completed_at", { ascending: false });
    if (completionsError) throw new Error(completionsError.message);

    const assignments = (assignmentsData ?? []) as unknown as AssignmentRow[];
    const completions = (completionsData ?? []) as CompletionRow[];

    const profileByUserId = new Map(scopeProfiles.map((p) => [p.user_id, p]));
    const latestCompletionByUserTraining = new Map<string, CompletionRow>();
    for (const completion of completions) {
      const key = `${completion.user_id}:${completion.training_id}`;
      if (!latestCompletionByUserTraining.has(key)) {
        latestCompletionByUserTraining.set(key, completion);
      }
    }

    const detailedRows = assignments
      .filter((a) => a.training)
      .map((a) => {
        const profile = profileByUserId.get(a.user_id);
        const key = `${a.user_id}:${a.training_id}`;
        const latest = latestCompletionByUserTraining.get(key);
        const lastDate = asDate(latest?.approved_at ?? latest?.completed_at ?? null);
        const statusInfo = buildStatus(a.training!.frequency, lastDate, now, dueSoonDays);
        const jobTitleName = profile?.job_title_id ? jobTitleNameById.get(profile.job_title_id) ?? "Unassigned" : "Unassigned";

        return {
          user_id: a.user_id,
          net_id: profile?.net_id ?? "unknown",
          full_name: profile?.full_name ?? "Unknown User",
          job_title: jobTitleName,
          training_id: a.training!.id,
          training_title: a.training!.title,
          category: a.training!.category,
          frequency: a.training!.frequency,
          status: statusInfo.status,
          last_completed_at: lastDate ? lastDate.toISOString() : null,
          next_due_at: statusInfo.nextDue ? statusInfo.nextDue.toISOString() : null,
        };
      });

    const totals = {
      total_assignments: detailedRows.length,
      compliant: detailedRows.filter((r) => r.status === "compliant").length,
      overdue: detailedRows.filter((r) => r.status === "overdue").length,
      due_soon: detailedRows.filter((r) => r.status === "due_soon").length,
      not_started: detailedRows.filter((r) => r.status === "not_started").length,
    };
    const completionRate = totals.total_assignments === 0
      ? 0
      : Number(((totals.compliant / totals.total_assignments) * 100).toFixed(1));

    const byJobTitle = new Map<string, { total: number; compliant: number; overdue: number; due_soon: number; not_started: number }>();
    for (const row of detailedRows) {
      const current = byJobTitle.get(row.job_title) ?? { total: 0, compliant: 0, overdue: 0, due_soon: 0, not_started: 0 };
      current.total += 1;
      if (row.status === "compliant") current.compliant += 1;
      if (row.status === "overdue") current.overdue += 1;
      if (row.status === "due_soon") current.due_soon += 1;
      if (row.status === "not_started") current.not_started += 1;
      byJobTitle.set(row.job_title, current);
    }

    const jobTitleBreakdown = Array.from(byJobTitle.entries())
      .map(([job_title, value]) => ({
        job_title,
        ...value,
        completion_rate: value.total === 0 ? 0 : Number(((value.compliant / value.total) * 100).toFixed(1)),
      }))
      .sort((a, b) => b.overdue - a.overdue || a.job_title.localeCompare(b.job_title));

    let rows: unknown[] = [];
    if (intent === "overdue") {
      rows = detailedRows
        .filter((r) => r.status === "overdue")
        .sort((a, b) => (a.next_due_at ?? "").localeCompare(b.next_due_at ?? ""))
        .slice(0, 200);
    } else if (intent === "due_soon") {
      rows = detailedRows
        .filter((r) => r.status === "due_soon")
        .sort((a, b) => (a.next_due_at ?? "").localeCompare(b.next_due_at ?? ""))
        .slice(0, 200);
    } else if (intent === "completion_rate" || intent === "by_job_title") {
      rows = jobTitleBreakdown;
    } else {
      rows = detailedRows
        .sort((a, b) => {
          const rank = (status: string) => {
            if (status === "overdue") return 0;
            if (status === "due_soon") return 1;
            if (status === "not_started") return 2;
            return 3;
          };
          return rank(a.status) - rank(b.status);
        })
        .slice(0, 200);
    }

    const summaryByIntent: Record<Intent, string> = {
      summary:
        `Scope includes ${scopeProfiles.length} active users with ${totals.total_assignments} training assignments. ` +
        `${totals.overdue} overdue, ${totals.due_soon} due soon, ${totals.not_started} not started; overall compliance ${completionRate}%.`,
      overdue: `Found ${totals.overdue} overdue assignments across ${scopeProfiles.length} active users.`,
      due_soon: `Found ${totals.due_soon} assignments due within ${dueSoonDays} days.`,
      completion_rate: `Overall compliance is ${completionRate}% across ${totals.total_assignments} assignments.`,
      by_job_title: `Generated job-title completion breakdown for ${jobTitleBreakdown.length} titles in scope.`,
      training_search: "Training search complete.",
    };

    return new Response(
      JSON.stringify({
        intent,
        summary: summaryByIntent[intent],
        scope: {
          role: callerRole,
          users: scopeProfiles.length,
          dueSoonDays,
          net_id_filter: requestedNetId,
        },
        highlights: {
          ...totals,
          completion_rate: completionRate,
        },
        rows,
        suggested_prompts: [
          "Show overdue trainings",
          "Show due soon trainings in 30 days",
          "Show completion rate by job title",
        ],
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
