#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const REQUEST_TIMEOUT_MS = 30000;
const TITLE_ALIASES = {
  "Vet Technician 1": ["Vet Tech 1"],
  "Vet Technician 2": ["Vet Tech 2"],
};

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
    coordinatorEmail: "",
    coordinatorPassword: "",
    dryRun: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
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
    if (arg === "--help" || arg === "-h") {
      console.log("Usage: npm run sync:job-descriptions -- --coordinator-email <email> --coordinator-password <password> [--dry-run]");
      process.exit(0);
    }
  }

  return args;
}

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

function headers(anonKey, accessToken, extra = {}) {
  const h = { apikey: anonKey, ...extra };
  if (accessToken) h.Authorization = `Bearer ${accessToken}`;
  return h;
}

async function signIn(baseUrl, anonKey, email, password) {
  const data = await fetchJson(`${baseUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: headers(anonKey, undefined, { "Content-Type": "application/json" }),
    body: JSON.stringify({ email, password }),
  });

  if (!data?.access_token) throw new Error("No access token returned from Supabase auth.");
  return data.access_token;
}

function readDescriptionEntries() {
  const indexPath = path.resolve(process.cwd(), "job-descriptions", "index.json");
  if (!fs.existsSync(indexPath)) {
    throw new Error(`Missing file: ${indexPath}`);
  }

  const index = JSON.parse(fs.readFileSync(indexPath, "utf8"));
  const categories = index.categories || {};
  const entries = Object.values(categories).flat();

  return entries.map((entry) => {
    const filePath = path.resolve(process.cwd(), entry.file);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Missing job description file: ${filePath}`);
    }

    return {
      title: entry.title,
      content: fs.readFileSync(filePath, "utf8").trim(),
    };
  });
}

async function updateJobTitleDescription(baseUrl, anonKey, accessToken, title, description) {
  const query = new URLSearchParams({
    name: `eq.${title}`,
    select: "id,name",
  });
  return fetchJson(`${baseUrl}/rest/v1/job_titles?${query.toString()}`, {
    method: "PATCH",
    headers: headers(anonKey, accessToken, {
      "Content-Type": "application/json",
      Prefer: "return=representation",
    }),
    body: JSON.stringify({ description }),
  });
}

async function fetchProfilesAndTitles(baseUrl, anonKey, accessToken) {
  const [profiles, titles] = await Promise.all([
    fetchJson(`${baseUrl}/rest/v1/profiles?select=user_id,job_title_id`, {
      headers: headers(anonKey, accessToken),
    }),
    fetchJson(`${baseUrl}/rest/v1/job_titles?select=id,name,description`, {
      headers: headers(anonKey, accessToken),
    }),
  ]);

  return { profiles: profiles || [], titles: titles || [] };
}

async function main() {
  loadDotEnvIfPresent();
  const args = parseArgs(process.argv.slice(2));

  const baseUrl = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!baseUrl || !anonKey) {
    throw new Error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY in environment/.env.");
  }

  if (!args.coordinatorEmail || !args.coordinatorPassword) {
    throw new Error("Coordinator credentials are required (--coordinator-email and --coordinator-password).");
  }

  const entries = readDescriptionEntries();
  console.log(`Loaded ${entries.length} job description files.`);

  const token = await signIn(baseUrl, anonKey, args.coordinatorEmail, args.coordinatorPassword);

  const { profiles, titles } = await fetchProfilesAndTitles(baseUrl, anonKey, token);
  const titleByName = new Map(titles.map((t) => [t.name, t]));

  let updated = 0;
  let missingTargets = 0;
  for (const entry of entries) {
    const targetNames = [entry.title, ...(TITLE_ALIASES[entry.title] || [])]
      .filter((name, idx, arr) => arr.indexOf(name) === idx)
      .filter((name) => titleByName.has(name));

    if (targetNames.length === 0) {
      missingTargets += 1;
      console.log(`No matching job title found for source description: ${entry.title}`);
      continue;
    }

    for (const targetName of targetNames) {
      if (!args.dryRun) {
        await updateJobTitleDescription(baseUrl, anonKey, token, targetName, entry.content);
      }
      updated += 1;
      console.log(`Synced description: ${entry.title} -> ${targetName}`);
    }
  }

  const refreshed = await fetchProfilesAndTitles(baseUrl, anonKey, token);
  const titlesAfter = refreshed.titles;

  const userCountByTitleId = new Map();
  for (const profile of profiles) {
    if (!profile.job_title_id) continue;
    userCountByTitleId.set(profile.job_title_id, (userCountByTitleId.get(profile.job_title_id) || 0) + 1);
  }

  const titleByNameAfter = new Map(titlesAfter.map((t) => [t.name, t]));

  console.log("\nCoverage by synced title:");
  let coveredUsers = 0;
  for (const entry of entries) {
    const title = titleByNameAfter.get(entry.title) || titleByNameAfter.get((TITLE_ALIASES[entry.title] || [])[0]);
    const users = title ? (userCountByTitleId.get(title.id) || 0) : 0;
    const hasDescription = !!title?.description;
    if (hasDescription) coveredUsers += users;
    console.log(`- ${entry.title}: users=${users}, description_set=${hasDescription ? "yes" : "no"}`);
  }

  console.log("\nSync complete.");
  console.log(`Title descriptions updated: ${updated}`);
  console.log(`Description sources with no matching title: ${missingTargets}`);
  console.log(`Users covered by these titles: ${coveredUsers}`);

  const csvPath = "/Users/mirandagrato/Documents/Training Hub User Data with vet bms.csv";
  if (fs.existsSync(csvPath)) {
    const lines = fs.readFileSync(csvPath, "utf8").split(/\r?\n/).filter(Boolean);
    if (lines.length > 1) {
      const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
      const titleIdx = headers.indexOf("job title");
      if (titleIdx >= 0) {
        const csvTitles = [...new Set(lines.slice(1).map((line) => line.split(",")[titleIdx]?.trim()).filter(Boolean))];
        const missingCsvTitles = csvTitles.filter((name) => {
          const t = titleByNameAfter.get(name);
          return !t?.description;
        });
        console.log(`CSV job titles missing descriptions: ${missingCsvTitles.length}`);
        if (missingCsvTitles.length > 0) {
          for (const t of missingCsvTitles) console.log(`- Missing: ${t}`);
        }
      }
    }
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
