import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const users = [
    { email: "employee@uw.edu", password: "demo1234", full_name: "Emily Employee", net_id: "employee", role: "employee" },
    { email: "supervisor@uw.edu", password: "demo1234", full_name: "Sam Supervisor", net_id: "supervisor", role: "supervisor" },
    { email: "coordinator@uw.edu", password: "demo1234", full_name: "Chris Coordinator", net_id: "coordinator", role: "coordinator" },
  ];

  const results = [];

  for (const u of users) {
    // Check if user already exists
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existing = existingUsers?.users?.find((eu: any) => eu.email === u.email);
    if (existing) {
      results.push({ email: u.email, status: "already exists" });
      continue;
    }

    // Create auth user
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: u.email,
      password: u.password,
      email_confirm: true,
      user_metadata: { full_name: u.full_name, net_id: u.net_id },
    });

    if (authError) {
      results.push({ email: u.email, status: "error", error: authError.message });
      continue;
    }

    const userId = authData.user.id;

    // Update role if not employee (trigger creates employee by default)
    if (u.role !== "employee") {
      await supabaseAdmin.from("user_roles").update({ role: u.role }).eq("user_id", userId);
    }

    results.push({ email: u.email, status: "created", userId });
  }

  // Create supervisor->employee mapping
  const { data: supProfile } = await supabaseAdmin.from("profiles").select("user_id").eq("net_id", "supervisor").maybeSingle();
  const { data: empProfile } = await supabaseAdmin.from("profiles").select("user_id").eq("net_id", "employee").maybeSingle();
  if (supProfile && empProfile) {
    await supabaseAdmin.from("supervisor_employee_mappings").upsert({
      supervisor_id: supProfile.user_id,
      employee_id: empProfile.user_id,
    }, { onConflict: "supervisor_id,employee_id" });
  }

  // Seed sample data
  // Job tags
  const { data: husbandryTag } = await supabaseAdmin.from("job_tags").upsert({ name: "Husbandry" }, { onConflict: "name" }).select().single();
  
  // Job titles
  const { data: techTitle } = await supabaseAdmin.from("job_titles").upsert({ name: "Animal Technician" }, { onConflict: "name" }).select().single();

  // Link tag to title
  if (husbandryTag && techTitle) {
    await supabaseAdmin.from("job_title_tags").upsert({
      job_title_id: techTitle.id,
      job_tag_id: husbandryTag.id,
    }, { onConflict: "job_title_id,job_tag_id" });
  }

  // Sample trainings
  const trainings = [
    { title: "New Employee Orientation", description: "General orientation for all new employees", category: "onboarding", frequency: "one_time" },
    { title: "Safety & Emergency Procedures", description: "Annual safety training and emergency protocols", category: "onboarding", frequency: "annual" },
    { title: "Animal Handling Basics", description: "Proper techniques for handling primates", category: "on_the_job", frequency: "one_time" },
    { title: "Husbandry Daily Procedures", description: "Daily care routines for animal husbandry", category: "on_the_job", frequency: "semi_annual" },
    { title: "SOP: Cage Cleaning Protocol", description: "Standard operating procedure for cage sanitation", category: "sop", frequency: "annual" },
    { title: "SOP: Feeding Schedule", description: "Standard operating procedure for animal feeding", category: "sop", frequency: "annual" },
  ];

  for (const t of trainings) {
    await supabaseAdmin.from("trainings").upsert(t, { onConflict: "title" }).select().single();
  }

  // Assign trainings to employee
  if (empProfile) {
    const { data: allTrainings } = await supabaseAdmin.from("trainings").select("id");
    for (const t of allTrainings || []) {
      await supabaseAdmin.from("user_training_assignments").upsert({
        user_id: empProfile.user_id,
        training_id: t.id,
      }, { onConflict: "user_id,training_id" });
    }
  }

  return new Response(JSON.stringify({ results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
