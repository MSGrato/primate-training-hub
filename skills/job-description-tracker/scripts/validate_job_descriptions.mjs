#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const JOB_DIR = path.join(ROOT, "job-descriptions");
const INDEX_PATH = path.join(JOB_DIR, "index.json");

const issues = [];
const requiredFields = ["id", "title", "source", "training_tag", "file", "date_added"];

function walkMarkdownFiles(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkMarkdownFiles(full, out);
    if (entry.isFile() && full.endsWith(".md")) out.push(full);
  }
  return out;
}

const data = JSON.parse(fs.readFileSync(INDEX_PATH, "utf8"));
const indexed = new Set();

for (const [categoryKey, entries] of Object.entries(data.categories || {})) {
  const folderName = categoryKey.replaceAll("_", "-");
  const expectedTag = data.category_training_tag_rules?.[folderName];
  if (!expectedTag) issues.push(`Missing tag rule for category: ${categoryKey}`);

  for (const entry of entries) {
    for (const field of requiredFields) {
      if (!(field in entry)) issues.push(`Entry ${entry.id} missing field: ${field}`);
    }

    if (expectedTag && entry.training_tag !== expectedTag) {
      issues.push(
        `Tag mismatch for ${entry.id}: expected ${expectedTag}, got ${entry.training_tag}`,
      );
    }

    indexed.add(entry.file);
    const abs = path.join(ROOT, entry.file);
    if (!fs.existsSync(abs)) issues.push(`Indexed file missing on disk: ${entry.file}`);
  }
}

const mdFiles = walkMarkdownFiles(JOB_DIR)
  .map((file) => path.relative(ROOT, file))
  .filter((file) => file !== "job-descriptions/index.json");

for (const file of mdFiles) {
  if (!indexed.has(file)) issues.push(`Unindexed file on disk: ${file}`);
}

console.log(`positions_indexed=${[...indexed].length}`);
console.log(`markdown_files_on_disk=${mdFiles.length}`);

if (issues.length > 0) {
  console.log("status=FAIL");
  for (const issue of issues) console.log(`- ${issue}`);
  process.exit(1);
}

console.log("status=PASS");
