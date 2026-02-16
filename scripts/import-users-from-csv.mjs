#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

function loadDotEnvIfPresent() {
  const envPath = path.resolve(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) return;

  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
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

function parseArgs(argv) {
  const args = {
    file: "",
    coordinatorEmail: "",
    coordinatorPassword: "",
    dryRun: false,
    createOnly: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === "--file") {
      args.file = argv[i + 1] || "";
      i += 1;
      continue;
    }
    if (arg === "--coordinator-email") {
      args.coordinatorEmail = argv[i + 1] || "";
      i += 1;
      continue;
    }
    if (arg === "--coordinator-password") {
      args.coordinatorPassword = argv[i + 1] || "";
      i += 1;
      continue;
    }
    if (arg === "--dry-run") {
      args.dryRun = true;
      continue;
    }
    if (arg === "--create-only") {
      args.createOnly = true;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }
  }

  return args;
}

function printHelp() {
  console.log(`Usage:\n  npm run import:users -- --file \"/absolute/path/to/users.csv\" [options]\n\nOptions:\n  --coordinator-email <email>       Existing coordinator login email used to authorize import\n  --coordinator-password <password> Existing coordinator login password\n  --dry-run                         Validate/plan changes without writing\n  --create-only                     Create missing users only; do not update existing users\n  --help                            Show this help`);
}

function parseCsv(content) {
  const lines = content.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) {
    throw new Error("CSV must include a header row and at least one data row.");
  }

  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const get = (row, name) => {
    const index = headers.findIndex((h) => h === name.toLowerCase());
    return index >= 0 ? (row[index] || "").trim() : "";
  };

  const requiredHeaders = [
    "full name",
    "netid",
    "email",
    "role",
    "job title",
    "temporary password",
    "active status",
    "supervisor netid",
  ];

  for (const header of requiredHeaders) {
    if (!headers.some((h) => h === header)) {
      throw new Error(`Missing required header: ${header}`);
    }
  }

  return lines.slice(1).map((line, idx) => {
    const cols = line.split(",").map((c) => c.trim());
    const fullName = get(cols, "full name");
    const netId = get(cols, "netid");
    const email = get(cols, "email");
    const role = get(cols, "role").toLowerCase();
    const jobTitle = get(cols, "job title");
    const temporaryPassword = get(cols, "temporary password");
    const activeStatus = get(cols, "active status").toLowerCase();
    const supervisorNetId = get(cols, "supervisor netid");

    if (!fullName || !netId || !email || !role || !jobTitle || !temporaryPassword || !activeStatus) {
      throw new Error(`Row ${idx + 2} has missing required values.`);
    }

    if (!["employee", "supervisor", "coordinator"].includes(role)) {
      throw new Error(`Row ${idx + 2} has invalid role: ${role}`);
    }

    if (!["active", "inactive"].includes(activeStatus)) {
      throw new Error(`Row ${idx + 2} has invalid active status: ${activeStatus}`);
    }

    return {
      fullName,
      netId,
      email,
      role,
      jobTitle,
      temporaryPassword,
      isActive: activeStatus === "active",
      supervisorNetId,
    };
  });
}

const REQUEST_TIMEOUT_MS = 30000;

async function fetchJson(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response;
  try {
    response = await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
  const text = await response.text();

  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!response.ok) {
    let msg = "";
    if (typeof data === "object" && data !== null) {
      msg = data.message || data.error_description || data.error || JSON.stringify(data);
    } else if (data !== null && data !== undefined) {
      msg = String(data);
    }
    throw new Error(`${response.status} ${response.statusText}: ${msg || "Request failed"}`);
  }

  return data;
}

function makeHeaders(anonKey, accessToken, extra = {}) {
  const headers = {
    apikey: anonKey,
    ...extra,
  };
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }
  return headers;
}

async function signIn(baseUrl, anonKey, email, password) {
  const data = await fetchJson(`${baseUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: makeHeaders(anonKey, undefined, { "Content-Type": "application/json" }),
    body: JSON.stringify({ email, password }),
  });

  if (!data?.access_token) {
    throw new Error("No access token returned from Supabase auth.");
  }
  return data.access_token;
}

async function upsertJobTitle(baseUrl, anonKey, accessToken, name) {
  const data = await fetchJson(`${baseUrl}/rest/v1/job_titles?on_conflict=name&select=id,name`, {
    method: "POST",
    headers: makeHeaders(anonKey, accessToken, {
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=representation",
    }),
    body: JSON.stringify([{ name }]),
  });

  if (!Array.isArray(data) || data.length === 0) {
    throw new Error(`Job title upsert returned no rows for '${name}'.`);
  }
  return data[0];
}

async function getProfilesByNetIds(baseUrl, anonKey, accessToken, netIds) {
  const out = new Map();

  for (let i = 0; i < netIds.length; i += 100) {
    const chunk = netIds.slice(i, i + 100);
    const inExpr = `(${chunk.map((n) => `\"${n}\"`).join(",")})`;
    const query = new URLSearchParams({
      select: "user_id,net_id",
      net_id: `in.${inExpr}`,
    });

    const data = await fetchJson(`${baseUrl}/rest/v1/profiles?${query.toString()}`, {
      method: "GET",
      headers: makeHeaders(anonKey, accessToken),
    });

    for (const row of data || []) {
      out.set(row.net_id, row.user_id);
    }
  }

  return out;
}

async function invokeManageUsers(baseUrl, anonKey, accessToken, body) {
  return fetchJson(`${baseUrl}/functions/v1/manage-users`, {
    method: "POST",
    headers: makeHeaders(anonKey, accessToken, { "Content-Type": "application/json" }),
    body: JSON.stringify(body),
  });
}

async function upsertSupervisorMapping(baseUrl, anonKey, accessToken, supervisorId, employeeId) {
  await fetchJson(`${baseUrl}/rest/v1/supervisor_employee_mappings?on_conflict=supervisor_id,employee_id`, {
    method: "POST",
    headers: makeHeaders(anonKey, accessToken, {
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    }),
    body: JSON.stringify([{ supervisor_id: supervisorId, employee_id: employeeId }]),
  });
}

async function main() {
  loadDotEnvIfPresent();
  const args = parseArgs(process.argv.slice(2));

  if (!args.file) {
    printHelp();
    process.exit(1);
  }

  const csvPath = path.resolve(process.cwd(), args.file);
  if (!fs.existsSync(csvPath)) {
    throw new Error(`CSV file not found: ${csvPath}`);
  }

  const baseUrl = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  if (!baseUrl || !anonKey) {
    throw new Error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY in environment/.env.");
  }

  const rows = parseCsv(fs.readFileSync(csvPath, "utf8"));
  const coordinatorFromCsv = rows.find((r) => r.role === "coordinator");

  const coordinatorEmail = args.coordinatorEmail || coordinatorFromCsv?.email || "";
  const coordinatorPassword = args.coordinatorPassword || coordinatorFromCsv?.temporaryPassword || "";

  if (!coordinatorEmail || !coordinatorPassword) {
    throw new Error("Coordinator credentials are required. Provide --coordinator-email and --coordinator-password.");
  }

  console.log(`Loaded ${rows.length} user rows from ${csvPath}`);
  if (args.dryRun) {
    console.log("Dry run enabled: no database writes will be performed.");
  }

  const accessToken = args.dryRun ? "" : await signIn(baseUrl, anonKey, coordinatorEmail, coordinatorPassword);

  const titleIdByName = new Map();
  const uniqueTitles = [...new Set(rows.map((r) => r.jobTitle))];
  for (const title of uniqueTitles) {
    if (args.dryRun) {
      titleIdByName.set(title, `<dry-run:${title}>`);
      continue;
    }

    const data = await upsertJobTitle(baseUrl, anonKey, accessToken, title);
    titleIdByName.set(data.name, data.id);
  }

  const netIds = rows.map((r) => r.netId);
  const existingByNetId = args.dryRun
    ? new Map()
    : await getProfilesByNetIds(baseUrl, anonKey, accessToken, netIds);

  let created = 0;
  let updated = 0;
  let skipped = 0;
  let skippedExisting = 0;
  const userIdByNetId = new Map(existingByNetId);
  const createdNetIds = new Set();

  for (const row of rows) {
    const existingUserId = userIdByNetId.get(row.netId);
    const payload = {
      full_name: row.fullName,
      net_id: row.netId,
      role: row.role,
      job_title_id: titleIdByName.get(row.jobTitle) || null,
      is_active: row.isActive,
    };

    if (args.dryRun) {
      if (existingUserId) {
        if (args.createOnly) skippedExisting += 1;
        else updated += 1;
      }
      else created += 1;
      continue;
    }

    try {
      if (existingUserId) {
        if (args.createOnly) {
          skippedExisting += 1;
          if ((created + updated + skipped + skippedExisting) % 10 === 0) {
            console.log(`Processed users: ${created + updated + skipped + skippedExisting}/${rows.length}`);
          }
          continue;
        }
        await invokeManageUsers(baseUrl, anonKey, accessToken, {
          action: "update",
          user_id: existingUserId,
          ...payload,
        });
        updated += 1;
        if ((created + updated + skipped) % 10 === 0) {
          console.log(`Processed users: ${created + updated + skipped}/${rows.length}`);
        }
        continue;
      }

      const result = await invokeManageUsers(baseUrl, anonKey, accessToken, {
        action: "create",
        email: row.email,
        password: row.temporaryPassword,
        ...payload,
      });

      if (result?.user_id) {
        userIdByNetId.set(row.netId, result.user_id);
        createdNetIds.add(row.netId);
      }
      created += 1;
      if ((created + updated + skipped) % 10 === 0) {
        console.log(`Processed users: ${created + updated + skipped}/${rows.length}`);
      }
    } catch (error) {
      console.error(`User import failed for ${row.email}: ${error.message || error}`);
      skipped += 1;
      if ((created + updated + skipped) % 10 === 0) {
        console.log(`Processed users: ${created + updated + skipped}/${rows.length}`);
      }
    }
  }

  let mappingsUpserted = 0;
  let mappingsSkipped = 0;
  const knownNetIds = new Set(rows.map((r) => r.netId));

  for (const row of rows) {
    if (!row.supervisorNetId) continue;

    const employeeId = userIdByNetId.get(row.netId);
    const supervisorId = userIdByNetId.get(row.supervisorNetId);

    if (args.dryRun) {
      if (args.createOnly && !knownNetIds.has(row.netId)) {
        continue;
      }
      if (args.createOnly && !createdNetIds.has(row.netId)) {
        continue;
      }
      if (knownNetIds.has(row.supervisorNetId)) mappingsUpserted += 1;
      else mappingsSkipped += 1;
      continue;
    }

    if (args.createOnly && !createdNetIds.has(row.netId)) {
      continue;
    }

    if (!employeeId || !supervisorId) {
      mappingsSkipped += 1;
      continue;
    }

    try {
      await upsertSupervisorMapping(baseUrl, anonKey, accessToken, supervisorId, employeeId);
      mappingsUpserted += 1;
      if ((mappingsUpserted + mappingsSkipped) % 25 === 0) {
        console.log(`Processed mappings: ${mappingsUpserted + mappingsSkipped}/${rows.length - 1}`);
      }
    } catch (error) {
      console.error(`Mapping failed ${row.supervisorNetId} -> ${row.netId}: ${error.message || error}`);
      mappingsSkipped += 1;
      if ((mappingsUpserted + mappingsSkipped) % 25 === 0) {
        console.log(`Processed mappings: ${mappingsUpserted + mappingsSkipped}/${rows.length - 1}`);
      }
    }
  }

  console.log("Import complete.");
  console.log(`Created users: ${created}`);
  console.log(`Updated users: ${updated}`);
  console.log(`Skipped users: ${skipped}`);
  console.log(`Skipped existing users: ${skippedExisting}`);
  console.log(`Mappings upserted: ${mappingsUpserted}`);
  console.log(`Mappings skipped: ${mappingsSkipped}`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
