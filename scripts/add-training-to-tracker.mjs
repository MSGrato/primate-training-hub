#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const trackerCsv = path.join(root, "data", "training-tracking", "training_job_title_tracker.csv");

const HEADERS = [
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

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const val = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : "";
    args[key] = val;
    if (val) i += 1;
  }
  return args;
}

function parseCsv(text) {
  const lines = text.replace(/\r\n/g, "\n").split("\n").filter((l) => l.length > 0);
  if (lines.length === 0) return [];
  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const cols = parseCsvLine(line);
    const row = {};
    headers.forEach((h, i) => {
      row[h] = cols[i] ?? "";
    });
    return row;
  });
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

function requireArg(args, key) {
  const value = String(args[key] || "").trim();
  if (!value) {
    throw new Error(`Missing required argument --${key}`);
  }
  return value;
}

function main() {
  if (!fs.existsSync(trackerCsv)) {
    throw new Error(`Tracker not found: ${trackerCsv}`);
  }

  const args = parseArgs(process.argv);
  const trainingId = requireArg(args, "training-id");
  const trainingName = requireArg(args, "training-name");
  const category = requireArg(args, "category");
  const governingBody = requireArg(args, "governing-body");
  const deliveryMethod = requireArg(args, "delivery-method");
  const frequency = requireArg(args, "frequency");
  const highRisk = requireArg(args, "high-risk-if-expired");
  const trainingTags = requireArg(args, "training-tags");

  const rows = parseCsv(fs.readFileSync(trackerCsv, "utf8"));

  const existsById = rows.some((r) => String(r.training_id).trim() === trainingId);
  const existsByName = rows.some((r) => String(r.training_name).trim().toLowerCase() === trainingName.toLowerCase());
  if (existsById || existsByName) {
    throw new Error(`Training already exists in tracker (id or title): ${trainingId} / ${trainingName}`);
  }

  const newRow = {
    training_id: trainingId,
    training_name: trainingName,
    category,
    governing_body: governingBody,
    delivery_method: deliveryMethod,
    frequency,
    high_risk_if_expired: highRisk,
    training_tags: trainingTags,
    job_title_category: "",
    job_titles: "",
    assignment_status: "pending-triage",
    last_reviewed: "",
    notes: "New training added; complete categorization before publishing.",
  };

  const updated = [...rows, newRow];
  const lines = [
    HEADERS.join(","),
    ...updated.map((row) => HEADERS.map((h) => csvEscape(row[h])).join(",")),
  ];
  fs.writeFileSync(trackerCsv, `${lines.join("\n")}\n`);

  console.log(`Added to tracker: ${trainingId} - ${trainingName}`);
  console.log("Next: run node scripts/generate-training-tracker-and-seed.mjs");
}

main();
