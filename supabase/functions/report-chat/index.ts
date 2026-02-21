import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type AppRole = "employee" | "supervisor" | "coordinator";
type Intent = "summary" | "overdue" | "due_soon" | "completion_rate" | "by_job_title" | "training_search" | "recommendations" | "employee_search" | "general";

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

// ── AI helper ──────────────────────────────────────────────

async function callAI(systemPrompt: string, userPrompt: string, toolDefs?: unknown[], toolChoice?: unknown): Promise<unknown> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

  const body: Record<string, unknown> = {
    model: "google/gemini-2.0-flash",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  };
  if (toolDefs) body.tools = toolDefs;
  if (toolChoice) body.tool_choice = toolChoice;

  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (resp.status === 429) throw new Error("AI rate limit exceeded. Please try again in a moment.");
  if (resp.status === 402) throw new Error("AI credits exhausted. Please add funds in Settings → Workspace → Usage.");
  if (!resp.ok) {
    const t = await resp.text();
    console.error("AI gateway error:", resp.status, t);
    throw new Error("AI service unavailable");
  }

  return await resp.json();
}

async function classifyIntent(prompt: string): Promise<{ intent: Intent; searchQuery: string; daysWindow: number; netIdFilter: string | null; nameFilter: string | null }> {
  const tools = [
    {
      type: "function",
      function: {
        name: "classify",
        description: "Classify the user's training report prompt.",
        parameters: {
          type: "object",
          properties: {
            intent: {
              type: "string",
              enum: ["summary", "overdue", "due_soon", "completion_rate", "by_job_title", "training_search", "recommendations", "employee_search", "general"],
              description: "summary=general training status overview, overdue=show overdue trainings, due_soon=show trainings due soon, completion_rate=compliance rates, by_job_title=breakdown by job title, training_search=search for specific trainings by name/topic, recommendations=suggest which trainings to prioritize, employee_search=search/list employees by name/netid/job title/role/supervisor/tags or show employee details, general=general question or conversation",
            },
            search_query: { type: "string", description: "If training_search or employee_search, the search keywords. Otherwise empty string." },
            days_window: { type: "number", description: "Number of days for due_soon window. Default 60." },
            net_id_filter: { type: "string", description: "If the user asks about a specific person by NetID, the NetID. Otherwise null.", nullable: true },
            name_filter: { type: "string", description: "If the user asks about a specific person by name (e.g. 'pull Jane Smith\\'s report', 'training report for John Doe'), extract only their full name. Otherwise null.", nullable: true },
          },
          required: ["intent", "search_query", "days_window"],
          additionalProperties: false,
        },
      },
    },
  ];

  const result = await callAI(
    "You classify training management and employee information prompts. Classify the user's intent accurately. Use 'employee_search' when the user asks about employees, staff, people, roles, supervisors, job titles, or team composition. Use 'general' only for questions unrelated to specific training or employee data queries. When the user references a specific person by name (not NetID), extract that name into name_filter.",
    prompt,
    tools,
    { type: "function", function: { name: "classify" } },
  );

  try {
    const msg = (result as any).choices?.[0]?.message;
    const call = msg?.tool_calls?.[0]?.function;
    if (call) {
      const args = JSON.parse(call.arguments);
      return {
        intent: args.intent ?? "summary",
        searchQuery: args.search_query ?? "",
        daysWindow: args.days_window ?? 60,
        netIdFilter: args.net_id_filter ?? null,
        nameFilter: args.name_filter ?? null,
      };
    }
  } catch (e) {
    console.error("Intent classification parse error:", e);
  }
  return { intent: "summary", searchQuery: "", daysWindow: 60, netIdFilter: null, nameFilter: null };
}

async function generateAISummary(prompt: string, dataContext: string): Promise<string> {
  const result = await callAI(
    `You are Agent Train, a training compliance assistant for a primate research center.

Rules:
- **Be brief.** Use short bullet points. Bold key numbers. No preamble or pleasantries.
- Highlight only actionable insights: who is behind, what needs immediate attention.
- Do NOT repeat data already visible in the table below your summary.
- For recommendations, list overdue first, then due-soon, then not-started.
- Never fabricate data. Only reference what is provided in the data context.
- Keep responses under 150 words. Shorter is better.`,
    `User prompt: "${prompt}"\n\nData context:\n${dataContext}`,
  );

  try {
    const content = (result as any).choices?.[0]?.message?.content;
    if (content) return content;
  } catch (e) {
    console.error("AI summary parse error:", e);
  }
  return "Report generated successfully.";
}

// ── Helpers ────────────────────────────────────────────────

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
  if (frequency === "one_time" || frequency === "as_needed") {
    return { status: lastCompletionDate ? "compliant" : "not_started", nextDue: null as Date | null };
  }
  if (!lastCompletionDate) return { status: "not_started", nextDue: null as Date | null };

  const nextDue = frequency === "annual" ? addMonths(lastCompletionDate, 12) : addMonths(lastCompletionDate, 6);
  if (nextDue < now) return { status: "overdue", nextDue };

  const soonCutoff = new Date(now);
  soonCutoff.setDate(soonCutoff.getDate() + dueSoonWindowDays);
  if (nextDue <= soonCutoff) return { status: "due_soon", nextDue };
  return { status: "compliant", nextDue };
}

function extractRequestedPersonName(prompt: string): string | null {
  const normalized = prompt.trim();
  if (!normalized) return null;

  const explicitReportMatch = normalized.match(/^(?:show|generate|get|run)?\s*(?:a\s+)?training report for\s+(.+)$/i);
  if (explicitReportMatch?.[1]) return explicitReportMatch[1].trim();

  const genericForMatch = normalized.match(/^(?:show|list|find|get)\s+.*\s+for\s+(.+)$/i);
  if (genericForMatch?.[1] && /training/i.test(normalized)) return genericForMatch[1].trim();

  return null;
}

// ── Main handler ───────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
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
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const callerId = claimsData.claims.sub as string;
    const body = await req.json().catch(() => ({}));
    const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
    if (!prompt) {
      return new Response(JSON.stringify({ error: "Prompt is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get caller role
    const { data: roleRow, error: roleError } = await supabase
      .from("user_roles").select("role").eq("user_id", callerId).maybeSingle();
    if (roleError) throw new Error(roleError.message);
    const callerRole = (roleRow?.role ?? "employee") as AppRole;

    // AI-powered intent classification
    const classification = await classifyIntent(prompt);
    const requestedPersonName = extractRequestedPersonName(prompt) ?? classification.nameFilter;
    let intent = classification.intent;
    // If the user explicitly asks for a training report for a person, run the training-report path.
    if (requestedPersonName && (intent === "employee_search" || intent === "general")) {
      intent = "summary";
    }
    const dueSoonDays = classification.daysWindow;
    const requestedNetId = classification.netIdFilter;
    const now = new Date();

    // ── Handle general questions without data lookup ──
    if (intent === "general") {
      const aiSummary = await generateAISummary(prompt, `The user is a ${callerRole}. No specific training data was queried.`);
      return new Response(JSON.stringify({
        intent,
        summary: aiSummary,
        scope: { role: callerRole, users: 0, dueSoonDays, net_id_filter: null },
        highlights: { total_assignments: 0, compliant: 0, overdue: 0, due_soon: 0, not_started: 0, completion_rate: 0 },
        rows: [],
        suggested_prompts: ["Show overdue trainings", "Show completion rate by job title", "What trainings should I prioritize?"],
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── Training search ──
    if (intent === "training_search") {
      const query = classification.searchQuery.toLowerCase();
      const queryTokens = query.split(/\s+/).map(t => t.trim()).filter(t => t.length >= 2);

      const { data: trainings, error: trainingsError } = await supabase
        .from("trainings").select("id,title,description,category,frequency").order("title", { ascending: true });
      if (trainingsError) throw new Error(trainingsError.message);

      const scored = (trainings ?? [])
        .map(t => {
          const haystack = [t.title ?? "", t.description ?? "", t.category ?? "", t.frequency ?? ""].join(" ").toLowerCase();
          const score = queryTokens.length === 0 ? 1 : queryTokens.reduce((c, tk) => c + (haystack.includes(tk) ? 1 : 0), 0);
          return { ...t, match_score: score };
        })
        .filter(r => r.match_score > 0)
        .sort((a, b) => b.match_score - a.match_score || a.title.localeCompare(b.title))
        .slice(0, 200);

      // Cross-reference with caller's assignments and completions to compute due dates
      const matchedIds = scored.map(t => t.id);

      const { data: userAssignments } = await supabase
        .from("user_training_assignments").select("training_id").eq("user_id", callerId).in("training_id", matchedIds);
      const assignedSet = new Set((userAssignments ?? []).map(a => a.training_id));

      const { data: userCompletions } = await supabase
        .from("training_completions").select("training_id,completed_at,approved_at,status")
        .eq("user_id", callerId).eq("status", "approved").in("training_id", matchedIds)
        .order("completed_at", { ascending: false });

      const latestByTraining = new Map<string, { approved_at: string | null; completed_at: string }>();
      for (const c of (userCompletions ?? [])) {
        if (!latestByTraining.has(c.training_id)) latestByTraining.set(c.training_id, c);
      }

      const matches = scored.map(t => {
        let due_date: string | null = null;
        if (assignedSet.has(t.id)) {
          const latest = latestByTraining.get(t.id);
          const lastDate = asDate(latest?.approved_at ?? latest?.completed_at ?? null);
          const freq = t.frequency as "one_time" | "annual" | "semi_annual" | "as_needed";
          const statusInfo = buildStatus(freq, lastDate, now, dueSoonDays);
          due_date = statusInfo.nextDue ? statusInfo.nextDue.toISOString() : null;
        }
        return { training_title: t.title, due_date };
      }).sort((a, b) => {
        if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
        if (a.due_date) return -1;
        if (b.due_date) return 1;
        return 0;
      });

      const dataCtx = `Found ${matches.length} trainings matching "${query}". Top results: ${matches.slice(0, 10).map(m => `${m.training_title} (due: ${m.due_date ?? "N/A"})`).join(", ")}`;
      const aiSummary = await generateAISummary(prompt, dataCtx);

      return new Response(JSON.stringify({
        intent, summary: aiSummary,
        scope: { role: callerRole, users: 1, dueSoonDays, net_id_filter: null },
        highlights: { total_assignments: matches.length, compliant: 0, overdue: 0, due_soon: 0, not_started: 0, completion_rate: 0 },
        rows: matches,
        suggested_prompts: ["Find trainings about biosafety", "Show overdue trainings", "What trainings should I prioritize?"],
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── Employee search ──
    if (intent === "employee_search") {
      if (callerRole === "employee") {
        return new Response(JSON.stringify({ error: "Employees cannot search other employee records." }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Build scoped employee list
      let empProfiles: ScopeProfile[] = [];
      if (callerRole === "coordinator") {
        const { data, error } = await supabase.from("profiles").select("user_id,full_name,net_id,job_title_id,is_active");
        if (error) throw new Error(error.message);
        empProfiles = (data ?? []) as ScopeProfile[];
      } else {
        // supervisor – own reports + self
        const { data: mappings } = await supabase.from("supervisor_employee_mappings").select("employee_id").eq("supervisor_id", callerId);
        const scopedIds = Array.from(new Set([callerId, ...(mappings ?? []).map(m => m.employee_id)]));
        const { data, error } = await supabase.from("profiles").select("user_id,full_name,net_id,job_title_id,is_active").in("user_id", scopedIds);
        if (error) throw new Error(error.message);
        empProfiles = (data ?? []) as ScopeProfile[];
      }

      // Fetch supporting data in parallel
      const [jobTitlesRes, rolesRes, supervisorMappingsRes, jobTitleTagsRes, jobTagsRes] = await Promise.all([
        supabase.from("job_titles").select("id,name"),
        supabase.from("user_roles").select("user_id,role").in("user_id", empProfiles.map(p => p.user_id)),
        supabase.from("supervisor_employee_mappings").select("employee_id,supervisor_id").in("employee_id", empProfiles.map(p => p.user_id)),
        supabase.from("job_title_tags").select("job_title_id,job_tag_id"),
        supabase.from("job_tags").select("id,name"),
      ]);

      const jobTitleMap = new Map<string, string>((jobTitlesRes.data ?? []).map(t => [t.id, t.name]));
      const roleMap = new Map<string, string>((rolesRes.data ?? []).map(r => [r.user_id, r.role]));
      const supervisorMap = new Map<string, string>();
      for (const m of (supervisorMappingsRes.data ?? [])) {
        const supProfile = empProfiles.find(p => p.user_id === m.supervisor_id);
        if (supProfile) supervisorMap.set(m.employee_id, supProfile.full_name);
        else {
          // supervisor might not be in empProfiles scope, look them up
          const { data: sp } = await supabase.from("profiles").select("full_name").eq("user_id", m.supervisor_id).maybeSingle();
          if (sp) supervisorMap.set(m.employee_id, sp.full_name);
        }
      }
      const tagNameMap = new Map<string, string>((jobTagsRes.data ?? []).map(t => [t.id, t.name]));
      const titleTagsMap = new Map<string, string[]>();
      for (const jtt of (jobTitleTagsRes.data ?? [])) {
        const tagName = tagNameMap.get(jtt.job_tag_id);
        if (tagName) {
          const existing = titleTagsMap.get(jtt.job_title_id) ?? [];
          existing.push(tagName);
          titleTagsMap.set(jtt.job_title_id, existing);
        }
      }

      // Build employee rows
      const query = classification.searchQuery.toLowerCase();
      const queryTokens = query.split(/\s+/).map(t => t.trim()).filter(t => t.length >= 2);

      const empRows = empProfiles.map(p => {
        const jobTitle = p.job_title_id ? jobTitleMap.get(p.job_title_id) ?? "Unassigned" : "Unassigned";
        const role = roleMap.get(p.user_id) ?? "employee";
        const supervisor = supervisorMap.get(p.user_id) ?? "None";
        const tags = p.job_title_id ? (titleTagsMap.get(p.job_title_id) ?? []).join(", ") : "";
        return {
          net_id: p.net_id,
          full_name: p.full_name,
          job_title: jobTitle,
          role,
          supervisor,
          tags,
          is_active: p.is_active ? "Active" : "Inactive",
        };
      });

      // Filter by search query if provided
      const filtered = queryTokens.length === 0 ? empRows : empRows.filter(r => {
        const haystack = [r.net_id, r.full_name, r.job_title, r.role, r.supervisor, r.tags, r.is_active].join(" ").toLowerCase();
        return queryTokens.some(tk => haystack.includes(tk));
      });

      filtered.sort((a, b) => a.full_name.localeCompare(b.full_name));
      const resultRows = filtered.slice(0, 200);

      const dataCtx = `Found ${resultRows.length} employees${queryTokens.length > 0 ? ` matching "${query}"` : ""}. Employee details: ${resultRows.slice(0, 15).map(r => `${r.full_name} (${r.net_id}), ${r.job_title}, ${r.role}, supervisor: ${r.supervisor}, tags: ${r.tags || "none"}, ${r.is_active}`).join("; ")}`;
      const aiSummary = await generateAISummary(prompt, dataCtx);

      return new Response(JSON.stringify({
        intent, summary: aiSummary,
        scope: { role: callerRole, users: resultRows.length, dueSoonDays: dueSoonDays, net_id_filter: requestedNetId },
        highlights: { total_assignments: resultRows.length, compliant: 0, overdue: 0, due_soon: 0, not_started: 0, completion_rate: 0 },
        rows: resultRows,
        suggested_prompts: ["Show all supervisors", "Who has the most overdue trainings?", "List employees by job title"],
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── Gather scoped profiles ──
    let scopeProfiles: ScopeProfile[] = [];

    if (callerRole === "coordinator") {
      const { data, error } = await supabase.from("profiles").select("user_id,full_name,net_id,job_title_id,is_active").eq("is_active", true);
      if (error) throw new Error(error.message);
      scopeProfiles = (data ?? []) as ScopeProfile[];
    } else if (callerRole === "supervisor") {
      const { data: mappings, error: mappingError } = await supabase.from("supervisor_employee_mappings").select("employee_id").eq("supervisor_id", callerId);
      if (mappingError) throw new Error(mappingError.message);
      const scopedIds = Array.from(new Set([callerId, ...(mappings ?? []).map(m => m.employee_id)]));
      const { data: profileRows, error: profileError } = await supabase.from("profiles").select("user_id,full_name,net_id,job_title_id,is_active").in("user_id", scopedIds).eq("is_active", true);
      if (profileError) throw new Error(profileError.message);
      scopeProfiles = (profileRows ?? []) as ScopeProfile[];
    } else {
      const { data, error } = await supabase.from("profiles").select("user_id,full_name,net_id,job_title_id,is_active").eq("user_id", callerId).eq("is_active", true);
      if (error) throw new Error(error.message);
      scopeProfiles = (data ?? []) as ScopeProfile[];
    }

    if (requestedNetId) {
      if (callerRole === "employee") {
        return new Response(JSON.stringify({ error: "Employees can only run reports for their own account." }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      scopeProfiles = scopeProfiles.filter(p => p.net_id.toLowerCase() === requestedNetId.toLowerCase());
    }
    if (requestedPersonName) {
      if (callerRole === "employee") {
        return new Response(JSON.stringify({ error: "Employees can only run reports for their own account." }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const normalizedFilter = requestedPersonName.toLowerCase().trim();
      scopeProfiles = scopeProfiles.filter((p) => p.full_name.toLowerCase().trim() === normalizedFilter);
    }

    if (scopeProfiles.length === 0) {
      const aiSummary = await generateAISummary(prompt, "No users found in the caller's report scope.");
      return new Response(JSON.stringify({
        intent, summary: aiSummary,
        scope: { role: callerRole, users: 0, dueSoonDays },
        highlights: { total_assignments: 0, compliant: 0, overdue: 0, due_soon: 0, not_started: 0, completion_rate: 0 },
        rows: [],
        suggested_prompts: ["Show overdue trainings", "Show completion rate by job title"],
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const userIds = scopeProfiles.map(p => p.user_id);

    const { data: jobTitles, error: titleError } = await supabase.from("job_titles").select("id,name");
    if (titleError) throw new Error(titleError.message);
    const jobTitleNameById = new Map<string, string>((jobTitles ?? []).map(t => [t.id, t.name]));

    const { data: assignmentsData, error: assignmentsError } = await supabase
      .from("user_training_assignments").select("user_id,training_id,training:trainings(id,title,category,frequency)").in("user_id", userIds);
    if (assignmentsError) throw new Error(assignmentsError.message);

    const { data: completionsData, error: completionsError } = await supabase
      .from("training_completions").select("user_id,training_id,completed_at,approved_at,status").in("user_id", userIds).eq("status", "approved").order("completed_at", { ascending: false });
    if (completionsError) throw new Error(completionsError.message);

    const assignments = (assignmentsData ?? []) as unknown as AssignmentRow[];
    const completions = (completionsData ?? []) as CompletionRow[];

    const profileByUserId = new Map(scopeProfiles.map(p => [p.user_id, p]));
    const latestCompletionByUserTraining = new Map<string, CompletionRow>();
    for (const c of completions) {
      const key = `${c.user_id}:${c.training_id}`;
      if (!latestCompletionByUserTraining.has(key)) latestCompletionByUserTraining.set(key, c);
    }

    const detailedRows = assignments.filter(a => a.training).map(a => {
      const profile = profileByUserId.get(a.user_id);
      const key = `${a.user_id}:${a.training_id}`;
      const latest = latestCompletionByUserTraining.get(key);
      const lastDate = asDate(latest?.approved_at ?? latest?.completed_at ?? null);
      const statusInfo = buildStatus(a.training!.frequency, lastDate, now, dueSoonDays);
      const jobTitleName = profile?.job_title_id ? jobTitleNameById.get(profile.job_title_id) ?? "Unassigned" : "Unassigned";

      return {
        net_id: profile?.net_id ?? "unknown",
        full_name: profile?.full_name ?? "Unknown User",
        job_title: jobTitleName,
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
      compliant: detailedRows.filter(r => r.status === "compliant").length,
      overdue: detailedRows.filter(r => r.status === "overdue").length,
      due_soon: detailedRows.filter(r => r.status === "due_soon").length,
      not_started: detailedRows.filter(r => r.status === "not_started").length,
    };
    const completionRate = totals.total_assignments === 0 ? 0 : Number(((totals.compliant / totals.total_assignments) * 100).toFixed(1));

    // ── Build rows based on intent ──
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
      .map(([job_title, v]) => ({ job_title, ...v, completion_rate: v.total === 0 ? 0 : Number(((v.compliant / v.total) * 100).toFixed(1)) }))
      .sort((a, b) => b.overdue - a.overdue || a.job_title.localeCompare(b.job_title));

    let rows: unknown[] = [];
    if (intent === "overdue") {
      rows = detailedRows.filter(r => r.status === "overdue").sort((a, b) => (a.next_due_at ?? "").localeCompare(b.next_due_at ?? "")).slice(0, 200);
    } else if (intent === "due_soon") {
      rows = detailedRows.filter(r => r.status === "due_soon").sort((a, b) => (a.next_due_at ?? "").localeCompare(b.next_due_at ?? "")).slice(0, 200);
    } else if (intent === "completion_rate" || intent === "by_job_title") {
      rows = jobTitleBreakdown;
    } else if (intent === "recommendations") {
      // For recommendations, show overdue first, then due_soon, then not_started
      rows = detailedRows
        .filter(r => r.status !== "compliant")
        .sort((a, b) => {
          const rank = (s: string) => s === "overdue" ? 0 : s === "due_soon" ? 1 : 2;
          return rank(a.status) - rank(b.status);
        })
        .slice(0, 200);
    } else {
      rows = detailedRows.sort((a, b) => {
        const rank = (s: string) => s === "overdue" ? 0 : s === "due_soon" ? 1 : s === "not_started" ? 2 : 3;
        return rank(a.status) - rank(b.status);
      }).slice(0, 200);
    }

    // ── Build data context for AI summary ──
    const dataContext = [
      `Role: ${callerRole}, Users in scope: ${scopeProfiles.length}`,
      `Total assignments: ${totals.total_assignments}, Compliant: ${totals.compliant}, Overdue: ${totals.overdue}, Due soon: ${totals.due_soon}, Not started: ${totals.not_started}`,
      `Overall completion rate: ${completionRate}%`,
      `Due soon window: ${dueSoonDays} days`,
      jobTitleBreakdown.length > 0 ? `Job title breakdown: ${jobTitleBreakdown.map(j => `${j.job_title}: ${j.completion_rate}% compliant, ${j.overdue} overdue`).join("; ")}` : "",
      intent === "overdue" ? `Overdue trainings: ${(rows as any[]).slice(0, 15).map(r => `${r.full_name} - ${r.training_title}`).join("; ")}` : "",
      intent === "due_soon" ? `Due soon trainings: ${(rows as any[]).slice(0, 15).map(r => `${r.full_name} - ${r.training_title} (due ${r.next_due_at})`).join("; ")}` : "",
      intent === "recommendations" ? `Non-compliant items: ${(rows as any[]).slice(0, 20).map(r => `${r.full_name} - ${r.training_title} (${r.status})`).join("; ")}` : "",
      requestedNetId ? `Filtered to NetID: ${requestedNetId}` : "",
      requestedPersonName ? `Filtered to employee name: ${requestedPersonName}` : "",
    ].filter(Boolean).join("\n");

    const aiSummary = await generateAISummary(prompt, dataContext);

    const suggestedPrompts = intent === "recommendations"
      ? ["Show overdue trainings", "Show completion rate by job title", "Who has the most overdue trainings?"]
      : ["What trainings should my team prioritize?", "Show overdue trainings", "Show completion rate by job title"];

    return new Response(JSON.stringify({
      intent, summary: aiSummary,
      scope: { role: callerRole, users: scopeProfiles.length, dueSoonDays, net_id_filter: requestedNetId },
      highlights: { ...totals, completion_rate: completionRate },
      rows,
      suggested_prompts: suggestedPrompts,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

