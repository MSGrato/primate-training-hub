#!/usr/bin/env node
/**
 * Seed demo users into the Supabase project using the service role key.
 * Run this once to bootstrap the database with demo accounts for testing.
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY in .env (not the anon/publishable key).
 * Get it from: Supabase Dashboard → Project Settings → API → service_role key.
 *
 * Usage:
 *   npm run seed:demo
 *   # or with an explicit key:
 *   SUPABASE_SERVICE_ROLE_KEY=<key> npm run seed:demo
 *
 * Demo accounts created:
 *   employee@uw.edu    / demo1234  → Emily Employee   (employee role)
 *   supervisor@uw.edu  / demo1234  → Sam Supervisor   (supervisor role)
 *   coordinator@uw.edu / demo1234  → Chris Coordinator (coordinator role)
 */

import fs from "node:fs";
import path from "node:path";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function loadDotEnv() {
  const envPath = path.resolve(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) return;

  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex <= 0) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    if (process.env[key] !== undefined) continue;
    let value = trimmed.slice(eqIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

loadDotEnv();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    "Missing required environment variables.\n" +
      "  VITE_SUPABASE_URL         – already in .env\n" +
      "  SUPABASE_SERVICE_ROLE_KEY – add this to .env\n\n" +
      "Get the service_role key from:\n" +
      "  Supabase Dashboard → Project Settings → API → service_role"
  );
  process.exit(1);
}

// Minimal Supabase admin client built on fetch (no extra deps needed).
const adminHeaders = {
  apikey: SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
  "Content-Type": "application/json",
  Prefer: "return=representation",
};

async function adminFetch(path, options = {}) {
  const url = `${SUPABASE_URL}${path}`;
  const res = await fetch(url, { ...options, headers: { ...adminHeaders, ...(options.headers || {}) } });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  if (!res.ok) {
    throw new Error(`${res.status} ${url} – ${JSON.stringify(body)}`);
  }
  return body;
}

// auth.admin.*
async function listAuthUsers() {
  return adminFetch("/auth/v1/admin/users?per_page=1000");
}

async function createAuthUser({ email, password, full_name, net_id }) {
  return adminFetch("/auth/v1/admin/users", {
    method: "POST",
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name, net_id },
    }),
  });
}

// PostgREST (public schema)
async function dbSelect(table, params = "") {
  return adminFetch(`/rest/v1/${table}?${params}`);
}

async function dbUpsert(table, data, onConflict) {
  return adminFetch(`/rest/v1/${table}?on_conflict=${onConflict}`, {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify(Array.isArray(data) ? data : [data]),
  });
}

async function dbUpdate(table, match, data) {
  const params = Object.entries(match)
    .map(([k, v]) => `${k}=eq.${encodeURIComponent(v)}`)
    .join("&");
  return adminFetch(`/rest/v1/${table}?${params}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const DEMO_USERS = [
  { email: "employee@uw.edu",    password: "demo1234", full_name: "Emily Employee",    net_id: "employee",    role: "employee" },
  { email: "supervisor@uw.edu",  password: "demo1234", full_name: "Sam Supervisor",    net_id: "supervisor",  role: "supervisor" },
  { email: "coordinator@uw.edu", password: "demo1234", full_name: "Chris Coordinator", net_id: "coordinator", role: "coordinator" },
];

async function main() {
  console.log("Fetching existing auth users…");
  const { users: existingAuthUsers } = await listAuthUsers();
  const existingEmails = new Set(existingAuthUsers.map((u) => u.email));

  const createdIds = {};

  for (const u of DEMO_USERS) {
    if (existingEmails.has(u.email)) {
      const existing = existingAuthUsers.find((eu) => eu.email === u.email);
      createdIds[u.net_id] = existing.id;
      console.log(`  [skip] ${u.email} already exists`);
      continue;
    }

    console.log(`  [create] ${u.email} (${u.role})`);
    const created = await createAuthUser(u);
    createdIds[u.net_id] = created.id;

    // The handle_new_user trigger auto-creates the profile and assigns "employee"
    // role. For supervisor/coordinator we need to update that role.
    if (u.role !== "employee") {
      // Give the trigger a moment to fire before we update.
      await new Promise((r) => setTimeout(r, 1000));
      await dbUpdate("user_roles", { user_id: created.id }, { role: u.role });
      console.log(`    → role updated to ${u.role}`);
    }
  }

  // -------------------------------------------------------------------------
  // Supervisor → employee mapping
  // -------------------------------------------------------------------------
  console.log("Setting up supervisor → employee mapping…");
  const supProfiles = await dbSelect("profiles", `net_id=eq.supervisor&select=user_id`);
  const empProfiles = await dbSelect("profiles", `net_id=eq.employee&select=user_id`);

  if (supProfiles.length && empProfiles.length) {
    await dbUpsert(
      "supervisor_employee_mappings",
      { supervisor_id: supProfiles[0].user_id, employee_id: empProfiles[0].user_id },
      "supervisor_id,employee_id"
    );
    console.log("  [ok] mapping created");
  } else {
    console.warn("  [warn] could not find supervisor/employee profiles – mapping skipped");
  }

  // -------------------------------------------------------------------------
  // Seed job tags + job title
  // -------------------------------------------------------------------------
  console.log("Seeding job tags and titles…");
  const [husbandryTag] = await dbUpsert("job_tags", { name: "Husbandry" }, "name");
  const [techTitle] = await dbUpsert("job_titles", { name: "Animal Technician" }, "name");

  if (husbandryTag && techTitle) {
    await dbUpsert(
      "job_title_tags",
      { job_title_id: techTitle.id, job_tag_id: husbandryTag.id },
      "job_title_id,job_tag_id"
    );
    console.log("  [ok] Animal Technician ← Husbandry");
  }

  // -------------------------------------------------------------------------
  // Assign all existing trainings to the employee demo user
  // -------------------------------------------------------------------------
  if (empProfiles.length) {
    console.log("Assigning trainings to Emily Employee…");
    const trainings = await dbSelect("trainings", "select=id");
    const assignments = trainings.map((t) => ({
      user_id: empProfiles[0].user_id,
      training_id: t.id,
    }));
    if (assignments.length) {
      await dbUpsert("user_training_assignments", assignments, "user_id,training_id");
      console.log(`  [ok] ${assignments.length} trainings assigned`);
    } else {
      console.log("  [info] no trainings found in catalog yet");
    }
  }

  // -------------------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------------------
  console.log("\nDemo users ready:");
  console.log("  employee@uw.edu    / demo1234  → Employee view");
  console.log("  supervisor@uw.edu  / demo1234  → Supervisor view");
  console.log("  coordinator@uw.edu / demo1234  → Coordinator view");
}

main().catch((err) => {
  console.error("\nFailed:", err.message);
  process.exit(1);
});
