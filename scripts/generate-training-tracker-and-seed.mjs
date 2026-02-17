#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const trackingDir = path.join(root, "data", "training-tracking");
const sourceCsv = path.join(trackingDir, "training_catalog_2026-02-16.csv");
const trackerCsv = path.join(trackingDir, "training_job_title_tracker.csv");
const seedSql = path.join(root, "supabase", "seeds", "training_catalog_job_title_seed.sql");
const cleanupSql = path.join(root, "supabase", "seeds", "remove_non_catalog_trainings.sql");

const JOB_TITLES = {
  husbandry: [
    "Animal Facility Program Supervisor",
    "Animal Technician 1",
    "Animal Technician 2",
    "Animal Technician 3",
    "Animal Technician Supervisor",
  ],
  clinical: ["Vet Technician 1", "Vet Technician 2", "Veterinarian"],
  BMS: ["Training Specialist", "Behavior Specialist"],
};

const ALL_TITLES = [...JOB_TITLES.husbandry, ...JOB_TITLES.clinical, ...JOB_TITLES.BMS];
const ISO_DATE = "2026-02-17";
const MANUAL_REVIEW_DATE = "2026-02-17";

const TRACKER_HEADERS = [
  "training_id",
  "training_name",
  "category",
  "governing_body",
  "delivery_method",
  "frequency",
  "high_risk_if_expired",
  "training_tags",
  "job_title_category",
  "job_titles",
  "assignment_status",
  "last_reviewed",
  "notes",
];

const TRACKING_FIELDS = [
  "job_title_category",
  "job_titles",
  "assignment_status",
  "last_reviewed",
  "notes",
];

const MANUAL_OVERRIDES = {
  T032: {
    job_title_category: "clinical",
    job_titles: ["Vet Technician 2", "Veterinarian"],
    assignment_status: "reviewed",
    notes: "Manual review: anesthesia training scoped to surgical veterinary roles.",
  },
  T033: {
    job_title_category: "clinical",
    job_titles: ["Vet Technician 2", "Veterinarian"],
    assignment_status: "reviewed",
    notes: "Manual review: aseptic/surgical training scoped to surgical veterinary roles.",
  },
  T034: {
    job_title_category: "clinical",
    job_titles: ["Vet Technician 2", "Veterinarian"],
    assignment_status: "reviewed",
    notes: "Manual review: controlled substances limited to authorized clinical roles.",
  },
  T035: {
    job_title_category: "clinical",
    job_titles: ["Vet Technician 2", "Veterinarian"],
    assignment_status: "reviewed",
    notes: "Manual review: radiation training limited to applicable clinical roles.",
  },
  T037: {
    job_title_category: "husbandry;BMS",
    job_titles: [...JOB_TITLES.husbandry, ...JOB_TITLES.BMS],
    assignment_status: "reviewed",
    notes: "Manual review: enrichment/PRT safety aligned to husbandry and BMS scope.",
  },
};

function parseCsv(text) {
  const lines = text.replace(/\r\n/g, "\n").split("\n").filter((l) => l.length > 0);
  if (lines.length === 0) return [];
  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const cols = parseCsvLine(line);
    const out = {};
    headers.forEach((h, i) => {
      out[h] = cols[i] ?? "";
    });
    return out;
  });
}

function parseCsvFile(file) {
  if (!fs.existsSync(file)) return [];
  return parseCsv(fs.readFileSync(file, "utf8"));
}

function parseCsvLine(line) {
  const cols = [];
  let curr = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') {
        curr += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (c === "," && !inQuotes) {
      cols.push(curr);
      curr = "";
      continue;
    }
    curr += c;
  }
  cols.push(curr);
  return cols;
}

function csvEscape(value) {
  const s = String(value ?? "");
  if (s.includes('"') || s.includes(",") || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function deriveTagGroups(tagSet) {
  const groups = new Set();

  const allStaffTriggers = new Set([
    "uw_required", "new_hire", "ethics", "workplace_conduct", "data_security", "privacy", "phi",
    "controlled_access", "site_access", "visitor_policy", "emergency", "incident_reporting",
    "animal_welfare", "iacuc_required", "protocols", "regulatory", "nih_funded", "humane_endpoints",
    "rcr", "research_ethics",
  ]);

  const broadAnimalOpsTriggers = new Set([
    "animal_contact", "nhp_safety", "b_virus", "macaque_contact", "exposure_response", "tb_screening",
    "ppe", "bloodborne_pathogens", "sharps", "lab_safety", "hazcom", "chemicals", "spill_response",
    "biosafety", "bsl1", "bsl2", "biohazard_waste", "decontamination", "animal_movement",
    "ergonomics", "injury_prevention",
  ]);

  const clinicalTriggers = new Set([
    "clinical", "medical_waste", "anesthesia", "surgery", "aseptic", "controlled_substances", "radiation",
  ]);

  const bmsTriggers = new Set(["behavior_observation", "enrichment"]);

  if ([...allStaffTriggers].some((t) => tagSet.has(t))) groups.add("all_staff");
  if ([...broadAnimalOpsTriggers].some((t) => tagSet.has(t))) {
    groups.add("husbandry");
    groups.add("clinical");
    groups.add("BMS");
  }
  if ([...clinicalTriggers].some((t) => tagSet.has(t))) groups.add("clinical");
  if ([...bmsTriggers].some((t) => tagSet.has(t))) {
    groups.add("BMS");
    groups.add("husbandry");
  }

  if (groups.size === 0) groups.add("all_staff");
  return groups;
}

function deriveTitles(groups) {
  const titles = new Set();
  if (groups.has("all_staff")) ALL_TITLES.forEach((t) => titles.add(t));
  if (groups.has("husbandry")) JOB_TITLES.husbandry.forEach((t) => titles.add(t));
  if (groups.has("clinical")) JOB_TITLES.clinical.forEach((t) => titles.add(t));
  if (groups.has("BMS")) JOB_TITLES.BMS.forEach((t) => titles.add(t));
  return [...titles];
}

function toTrainingCategory(sourceCategory) {
  const onboarding = new Set([
    "UW Institutional",
    "Security & Facilities",
    "Emergency Preparedness",
    "Operations & Culture",
  ]);
  return onboarding.has(sourceCategory) ? "onboarding" : "on_the_job";
}

function toTrainingFrequency(sourceFrequency) {
  const key = String(sourceFrequency || "").toLowerCase();
  if (key === "one-time") return "one_time";
  if (key === "annual") return "annual";
  if (key === "semi-annual") return "semi_annual";
  return "as_needed";
}

function sqlText(value) {
  return `'${String(value ?? "").replace(/'/g, "''")}'`;
}

function keyById(row) {
  return String(row.training_id || "").trim();
}

function keyByName(row) {
  return String(row.training_name || "").trim().toLowerCase();
}

function buildSuggestedRow(row) {
  const tagSet = new Set(String(row.training_tags || "").split(";").map((t) => t.trim()).filter(Boolean));
  const groups = deriveTagGroups(tagSet);
  const titles = deriveTitles(groups);
  const categoryValue = groups.has("all_staff")
    ? "all_staff"
    : ["husbandry", "clinical", "BMS"].filter((g) => groups.has(g)).join(";");

  return {
    ...row,
    job_title_category: categoryValue,
    job_titles: titles.join(";"),
    assignment_status: "categorized",
    last_reviewed: ISO_DATE,
    notes: "Auto-suggested from training_tags; validate before production assignment.",
  };
}

function applyManualOverride(row) {
  const override = MANUAL_OVERRIDES[row.training_id];
  if (!override) return row;
  return {
    ...row,
    job_title_category: override.job_title_category,
    job_titles: override.job_titles.join(";"),
    assignment_status: override.assignment_status,
    last_reviewed: MANUAL_REVIEW_DATE,
    notes: override.notes,
  };
}

function sanitizeTrackedRow(row) {
  const out = {};
  TRACKER_HEADERS.forEach((h) => {
    out[h] = String(row[h] ?? "");
  });

  if (!out.assignment_status) out.assignment_status = "pending-triage";
  if ((out.assignment_status === "categorized" || out.assignment_status === "reviewed") && !out.last_reviewed) {
    out.last_reviewed = ISO_DATE;
  }
  if (!out.notes) out.notes = "Added to tracker; pending categorization.";
  return out;
}

function main() {
  const sourceRows = parseCsvFile(sourceCsv);
  const existingRows = parseCsvFile(trackerCsv);

  const existingById = new Map();
  const existingByName = new Map();
  existingRows.forEach((row) => {
    const id = keyById(row);
    const name = keyByName(row);
    if (id) existingById.set(id, row);
    if (name) existingByName.set(name, row);
  });

  const sourceRowsMerged = sourceRows.map((sourceRow) => {
    let row = buildSuggestedRow(sourceRow);
    const existing = existingById.get(keyById(sourceRow)) || existingByName.get(keyByName(sourceRow));

    if (existing) {
      TRACKING_FIELDS.forEach((field) => {
        if (String(existing[field] || "").trim()) {
          row[field] = existing[field];
        }
      });
    }

    row = applyManualOverride(row);
    return sanitizeTrackedRow(row);
  });

  const sourceIds = new Set(sourceRows.map((r) => keyById(r)).filter(Boolean));
  const sourceNames = new Set(sourceRows.map((r) => keyByName(r)).filter(Boolean));

  const extraTrackedRows = existingRows
    .filter((row) => {
      const id = keyById(row);
      const name = keyByName(row);
      const inSourceById = id ? sourceIds.has(id) : false;
      const inSourceByName = name ? sourceNames.has(name) : false;
      return !inSourceById && !inSourceByName;
    })
    .map((row) => sanitizeTrackedRow(row));

  const trackedRows = [...sourceRowsMerged, ...extraTrackedRows];

  const trackerLines = [
    TRACKER_HEADERS.join(","),
    ...trackedRows.map((r) => TRACKER_HEADERS.map((h) => csvEscape(r[h])).join(",")),
  ];
  fs.writeFileSync(trackerCsv, trackerLines.join("\n") + "\n");

  const sql = [];
  sql.push("-- Generated by scripts/generate-training-tracker-and-seed.mjs");
  sql.push("-- Source of truth: data/training-tracking/training_job_title_tracker.csv");
  sql.push("BEGIN;");
  sql.push("");

  sql.push("-- Ensure tags exist");
  ["all_staff", "husbandry", "clinical", "BMS"].forEach((tag) => {
    sql.push(`INSERT INTO public.job_tags (name) VALUES (${sqlText(tag)}) ON CONFLICT (name) DO NOTHING;`);
  });
  sql.push("");

  sql.push("-- Ensure job titles exist");
  ALL_TITLES.forEach((title) => {
    sql.push(`INSERT INTO public.job_titles (name) VALUES (${sqlText(title)}) ON CONFLICT (name) DO NOTHING;`);
  });
  sql.push("");

  sql.push("-- Map job titles to tags");
  ALL_TITLES.forEach((title) => {
    sql.push(
      `INSERT INTO public.job_title_tags (job_title_id, job_tag_id) ` +
      `SELECT jt.id, jg.id FROM public.job_titles jt JOIN public.job_tags jg ON jg.name = 'all_staff' ` +
      `WHERE jt.name = ${sqlText(title)} ON CONFLICT (job_title_id, job_tag_id) DO NOTHING;`
    );
  });

  Object.entries(JOB_TITLES).forEach(([group, titles]) => {
    titles.forEach((title) => {
      sql.push(
        `INSERT INTO public.job_title_tags (job_title_id, job_tag_id) ` +
        `SELECT jt.id, jg.id FROM public.job_titles jt JOIN public.job_tags jg ON jg.name = ${sqlText(group)} ` +
        `WHERE jt.name = ${sqlText(title)} ON CONFLICT (job_title_id, job_tag_id) DO NOTHING;`
      );
    });
  });
  sql.push("");

  sql.push("-- Insert trainings if title not already present");
  trackedRows.forEach((row) => {
    const description = [
      `Legacy ID: ${row.training_id}`,
      `Source category: ${row.category}`,
      `Governing body: ${row.governing_body}`,
      `Delivery method: ${row.delivery_method}`,
      `Source frequency: ${row.frequency}`,
      `High risk if expired: ${row.high_risk_if_expired}`,
      `Tags: ${row.training_tags}`,
    ].join(" | ");

    sql.push(
      `INSERT INTO public.trainings (title, description, category, frequency, content_url, content_type) ` +
      `SELECT ${sqlText(row.training_name)}, ${sqlText(description)}, ${sqlText(toTrainingCategory(row.category))}::public.training_category, ` +
      `${sqlText(toTrainingFrequency(row.frequency))}::public.training_frequency, NULL, NULL ` +
      `WHERE NOT EXISTS (SELECT 1 FROM public.trainings WHERE title = ${sqlText(row.training_name)});`
    );
  });
  sql.push("");

  sql.push("-- Map trainings to tags (skip rows still pending triage)");
  trackedRows.forEach((row) => {
    const status = String(row.assignment_status || "").toLowerCase();
    if (status === "pending-triage") return;

    const groups = new Set(String(row.job_title_category).split(";").filter(Boolean));
    const tags = groups.has("all_staff") ? ["all_staff"] : [...groups];
    tags.forEach((tag) => {
      sql.push(
        `INSERT INTO public.training_tag_assignments (training_id, job_tag_id) ` +
        `SELECT t.id, j.id FROM public.trainings t JOIN public.job_tags j ON j.name = ${sqlText(tag)} ` +
        `WHERE t.title = ${sqlText(row.training_name)} ON CONFLICT (training_id, job_tag_id) DO NOTHING;`
      );
    });
  });

  sql.push("");
  sql.push("COMMIT;");
  sql.push("");
  fs.writeFileSync(seedSql, sql.join("\n"));

  const cleanup = [];
  cleanup.push("-- Generated by scripts/generate-training-tracker-and-seed.mjs");
  cleanup.push("-- Deletes trainings that are not in the tracker source of truth.");
  cleanup.push("BEGIN;");
  cleanup.push("");
  cleanup.push("-- Preview rows to be removed");
  cleanup.push("SELECT id, title FROM public.trainings");
  cleanup.push("WHERE title NOT IN (");
  trackedRows.forEach((row, idx) => {
    const suffix = idx === trackedRows.length - 1 ? "" : ",";
    cleanup.push(`  ${sqlText(row.training_name)}${suffix}`);
  });
  cleanup.push(");");
  cleanup.push("");
  cleanup.push("-- Delete non-tracker trainings (cascades to assignments/completions via FK)");
  cleanup.push("DELETE FROM public.trainings");
  cleanup.push("WHERE title NOT IN (");
  trackedRows.forEach((row, idx) => {
    const suffix = idx === trackedRows.length - 1 ? "" : ",";
    cleanup.push(`  ${sqlText(row.training_name)}${suffix}`);
  });
  cleanup.push(")");
  cleanup.push("RETURNING id, title;");
  cleanup.push("");
  cleanup.push("COMMIT;");
  cleanup.push("");
  fs.writeFileSync(cleanupSql, cleanup.join("\n"));

  console.log(`Updated tracker: ${path.relative(root, trackerCsv)}`);
  console.log(`Generated seed: ${path.relative(root, seedSql)}`);
  console.log(`Generated cleanup: ${path.relative(root, cleanupSql)}`);
  console.log(`Rows processed: ${trackedRows.length}`);
}

main();
