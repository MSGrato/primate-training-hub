#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const INDEX_PATH = path.join(ROOT, "job-descriptions", "index.json");

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const value = argv[i + 1];
    out[key] = value;
    i += 1;
  }
  return out;
}

const args = parseArgs(process.argv);
const required = [
  "id",
  "title",
  "category-folder",
  "category-key",
  "training-tag",
  "file",
  "source",
  "date-added",
];

for (const key of required) {
  if (!args[key]) {
    console.error(`Missing required arg: --${key}`);
    process.exit(1);
  }
}

const raw = fs.readFileSync(INDEX_PATH, "utf8");
const data = JSON.parse(raw);

data.category_training_tag_rules ||= {};
data.categories ||= {};

data.category_training_tag_rules[args["category-folder"]] = args["training-tag"];
data.categories[args["category-key"]] ||= [];

const entry = {
  id: args.id,
  title: args.title,
  source: args.source,
  training_tag: args["training-tag"],
  file: args.file,
  date_added: args["date-added"],
};

const list = data.categories[args["category-key"]];
const i = list.findIndex((item) => item.id === args.id);
if (i >= 0) {
  list[i] = { ...list[i], ...entry };
  console.log(`Updated entry: ${args.id}`);
} else {
  list.push(entry);
  console.log(`Added entry: ${args.id}`);
}

fs.writeFileSync(INDEX_PATH, `${JSON.stringify(data, null, 2)}\n`);
console.log(`Wrote: ${INDEX_PATH}`);
