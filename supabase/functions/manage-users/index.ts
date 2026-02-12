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

    // Verify caller is a coordinator
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

    // Check coordinator role
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

    // Admin client for user management
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    const { action } = body;

    if (action === "create") {
      const { email, password, full_name, net_id, role } = body;

      if (!email || !password || !full_name || !net_id) {
        return new Response(JSON.stringify({ error: "Missing required fields" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Create auth user (trigger will create profile + default employee role)
      const { data: newUser, error: createErr } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name, net_id },
      });

      if (createErr) {
        return new Response(JSON.stringify({ error: createErr.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // If role is not employee, update the role
      if (role && role !== "employee") {
        await adminClient
          .from("user_roles")
          .update({ role })
          .eq("user_id", newUser.user.id);
      }

      return new Response(JSON.stringify({ success: true, user_id: newUser.user.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "update") {
      const { user_id, full_name, net_id, role } = body;

      if (!user_id) {
        return new Response(JSON.stringify({ error: "user_id required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Update profile
      const profileUpdates: Record<string, string> = {};
      if (full_name !== undefined) profileUpdates.full_name = full_name;
      if (net_id !== undefined) profileUpdates.net_id = net_id;

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
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "delete") {
      const { user_id } = body;

      if (!user_id) {
        return new Response(JSON.stringify({ error: "user_id required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Delete from profiles, user_roles, etc. first
      await adminClient.from("user_roles").delete().eq("user_id", user_id);
      await adminClient.from("profiles").delete().eq("user_id", user_id);
      await adminClient.from("supervisor_employee_mappings").delete().eq("employee_id", user_id);
      await adminClient.from("supervisor_employee_mappings").delete().eq("supervisor_id", user_id);
      await adminClient.from("training_completions").delete().eq("user_id", user_id);
      await adminClient.from("user_training_assignments").delete().eq("user_id", user_id);

      // Delete auth user
      const { error: delErr } = await adminClient.auth.admin.deleteUser(user_id);
      if (delErr) {
        return new Response(JSON.stringify({ error: delErr.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
