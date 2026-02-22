import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const callerId = claimsData.claims.sub;

    const { data: roleCheck } = await anonClient.rpc("has_role", {
      _user_id: callerId,
      _role: "coordinator",
    });

    if (!roleCheck) {
      return new Response(JSON.stringify({ error: "Forbidden: coordinator role required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    const { action } = body;

    if (action === "create") {
      const { email, password, full_name, net_id, role, job_title_id } = body;

      if (!email || !password || !full_name || !net_id) {
        return new Response(JSON.stringify({ error: "Missing required fields" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Server-side password validation
      if (typeof password !== "string" || password.length < 8) {
        return new Response(JSON.stringify({ error: "Password must be at least 8 characters" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!/[A-Z]/.test(password) || !/\d/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
        return new Response(JSON.stringify({ error: "Password must include an uppercase letter, a number, and a symbol" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: newUser, error: createErr } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name,
          net_id,
          force_password_reset: true,
        },
      });

      if (createErr) {
        return new Response(JSON.stringify({ error: createErr.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const userId = newUser.user.id;

      // Ensure profile exists and is populated before returning.
      const { data: existingProfile } = await adminClient
        .from("profiles")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();

      if (existingProfile) {
        const { error: profileErr } = await adminClient
          .from("profiles")
          .update({ full_name, net_id, job_title_id: job_title_id ?? null })
          .eq("user_id", userId);
        if (profileErr) {
          return new Response(JSON.stringify({ error: profileErr.message }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      } else {
        const { error: profileErr } = await adminClient
          .from("profiles")
          .insert({ user_id: userId, full_name, net_id, job_title_id: job_title_id ?? null });
        if (profileErr) {
          return new Response(JSON.stringify({ error: profileErr.message }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      // Update role explicitly when provided.
      const { data: existingRole } = await adminClient
        .from("user_roles")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();

      if (existingRole) {
        const { error: roleErr } = await adminClient
          .from("user_roles")
          .update({ role: role ?? "employee" })
          .eq("user_id", userId);
        if (roleErr) {
          return new Response(JSON.stringify({ error: roleErr.message }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      } else {
        const { error: roleErr } = await adminClient
          .from("user_roles")
          .insert({ user_id: userId, role: role ?? "employee" });
        if (roleErr) {
          return new Response(JSON.stringify({ error: roleErr.message }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      return new Response(JSON.stringify({ success: true, user_id: userId }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "update") {
      const { user_id, full_name, net_id, role, job_title_id, is_active } = body;

      if (!user_id) {
        return new Response(JSON.stringify({ error: "user_id required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Update profile fields
      const profileUpdates: Record<string, unknown> = {};
      if (full_name !== undefined) profileUpdates.full_name = full_name;
      if (net_id !== undefined) profileUpdates.net_id = net_id;
      if (job_title_id !== undefined) profileUpdates.job_title_id = job_title_id;
      if (is_active !== undefined) profileUpdates.is_active = is_active;

      if (Object.keys(profileUpdates).length > 0) {
        const { error: profErr } = await adminClient
          .from("profiles")
          .update(profileUpdates)
          .eq("user_id", user_id);
        if (profErr) {
          return new Response(JSON.stringify({ error: profErr.message }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      // Update role
      if (role) {
        const { data: existingRole } = await adminClient
          .from("user_roles")
          .select("id")
          .eq("user_id", user_id)
          .maybeSingle();

        if (existingRole) {
          const { error: roleErr } = await adminClient
            .from("user_roles")
            .update({ role })
            .eq("user_id", user_id);
          if (roleErr) {
            return new Response(JSON.stringify({ error: roleErr.message }), {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        } else {
          const { error: roleErr } = await adminClient
            .from("user_roles")
            .insert({ user_id, role });
          if (roleErr) {
            return new Response(JSON.stringify({ error: roleErr.message }), {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        }
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "delete") {
      const { user_id } = body;
      if (!user_id) {
        return new Response(JSON.stringify({ error: "user_id required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { error: deleteErr } = await adminClient.auth.admin.deleteUser(user_id);
      if (deleteErr) {
        return new Response(JSON.stringify({ error: deleteErr.message }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "bulk-import") {
      interface CsvUser {
        full_name: string;
        net_id: string;
        email: string;
        role: string;
        job_title_name: string;
        password: string;
        supervisor_net_id: string;
      }

      const csvUsers: CsvUser[] = body.users || [];
      const results: Array<{ net_id: string; status: string; error?: string }> = [];
      const mapping_warnings: string[] = [];

      // Step 1: Prefetch existing auth emails for duplicate detection
      const { data: existingAuthData } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
      const existingEmails = new Set((existingAuthData?.users || []).map((u: any) => u.email));

      // Step 2: Upsert job titles and build name → id map
      const uniqueJobTitleNames = [...new Set(csvUsers.map((u) => u.job_title_name).filter(Boolean))];
      if (uniqueJobTitleNames.length > 0) {
        await adminClient
          .from("job_titles")
          .upsert(
            uniqueJobTitleNames.map((name) => ({ name })),
            { onConflict: "name", ignoreDuplicates: true }
          );
      }
      const { data: allTitles } = await adminClient
        .from("job_titles")
        .select("id, name")
        .in("name", uniqueJobTitleNames.length > 0 ? uniqueJobTitleNames : [""]);
      const jobTitleMap = new Map<string, string>();
      (allTitles || []).forEach((jt: any) => jobTitleMap.set(jt.name, jt.id));

      // Step 3: Create users sequentially
      for (const csvUser of csvUsers) {
        if (existingEmails.has(csvUser.email)) {
          results.push({ net_id: csvUser.net_id, status: "skipped" });
          continue;
        }

        // Relaxed password validation: length >= 8 only
        if (!csvUser.password || csvUser.password.length < 8) {
          results.push({ net_id: csvUser.net_id, status: "error", error: "Password must be at least 8 characters" });
          continue;
        }

        const normalizedRole = csvUser.role.toLowerCase();
        const role = ["employee", "supervisor", "coordinator"].includes(normalizedRole) ? normalizedRole : "employee";

        const { data: newUser, error: createErr } = await adminClient.auth.admin.createUser({
          email: csvUser.email,
          password: csvUser.password,
          email_confirm: true,
          user_metadata: {
            full_name: csvUser.full_name,
            net_id: csvUser.net_id,
            force_password_reset: true,
          },
        });

        if (createErr) {
          results.push({ net_id: csvUser.net_id, status: "error", error: createErr.message });
          continue;
        }

        const userId = newUser.user.id;
        const jobTitleId = jobTitleMap.get(csvUser.job_title_name) || null;

        const { data: existingProfile } = await adminClient
          .from("profiles")
          .select("id")
          .eq("user_id", userId)
          .maybeSingle();

        if (existingProfile) {
          await adminClient
            .from("profiles")
            .update({ full_name: csvUser.full_name, net_id: csvUser.net_id, job_title_id: jobTitleId })
            .eq("user_id", userId);
        } else {
          await adminClient
            .from("profiles")
            .insert({ user_id: userId, full_name: csvUser.full_name, net_id: csvUser.net_id, job_title_id: jobTitleId });
        }

        const { data: existingRole } = await adminClient
          .from("user_roles")
          .select("id")
          .eq("user_id", userId)
          .maybeSingle();

        if (existingRole) {
          await adminClient
            .from("user_roles")
            .update({ role })
            .eq("user_id", userId);
        } else {
          await adminClient
            .from("user_roles")
            .insert({ user_id: userId, role });
        }

        results.push({ net_id: csvUser.net_id, status: "created" });
      }

      // Step 4: Supervisor mappings (second pass, after all users exist)
      const { data: profilesData } = await adminClient
        .from("profiles")
        .select("user_id, net_id");
      const netIdToUserId = new Map<string, string>();
      (profilesData || []).forEach((p: any) => netIdToUserId.set(p.net_id, p.user_id));

      const warnedSupervisors = new Set<string>();
      for (const csvUser of csvUsers) {
        if (!csvUser.supervisor_net_id || csvUser.supervisor_net_id === csvUser.net_id) continue;

        const employeeUserId = netIdToUserId.get(csvUser.net_id);
        if (!employeeUserId) continue;

        const supervisorUserId = netIdToUserId.get(csvUser.supervisor_net_id);
        if (!supervisorUserId) {
          if (!warnedSupervisors.has(csvUser.supervisor_net_id)) {
            mapping_warnings.push(`Supervisor NetID "${csvUser.supervisor_net_id}" not found`);
            warnedSupervisors.add(csvUser.supervisor_net_id);
          }
          continue;
        }

        await adminClient
          .from("supervisor_employee_mappings")
          .delete()
          .eq("employee_id", employeeUserId);
        await adminClient
          .from("supervisor_employee_mappings")
          .insert({ employee_id: employeeUserId, supervisor_id: supervisorUserId });
      }

      return new Response(JSON.stringify({ success: true, results, mapping_warnings }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
