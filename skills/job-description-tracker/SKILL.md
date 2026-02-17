---
name: job-description-tracker
description: Maintain a structured job description registry with category-based training tags. Use when adding, updating, validating, or reorganizing job descriptions across categories such as husbandry, clinical, and BMS, and when ensuring each position entry maps to the correct training tag rule.
---

# Job Description Tracker

## Overview

Use this skill to keep `/Users/mirandagrato/Documents/New project/primate-training-hub/job-descriptions` consistent.

Keep position files in category folders and maintain `/Users/mirandagrato/Documents/New project/primate-training-hub/job-descriptions/index.json` as the source of truth for category rules and indexed entries.

## Workflow

1. Parse the incoming job description source (plain text, image OCR text, or `.docx` extraction).
2. Select the target category folder and verify its rule in `category_training_tag_rules`.
3. Create or update the position markdown file in the matching category folder.
4. Upsert the entry in `index.json` under the matching `categories` list.
5. Set `training_tag` to the category rule value.
6. Validate the registry with `scripts/validate_job_descriptions.mjs`.

## Category Mapping

Use category folder names (kebab-case) and category list keys (snake_case).

- Folder: `husbandry-job-descriptions` <-> key: `husbandry_job_descriptions` <-> tag: `husbandry`
- Folder: `clinical-job-descriptions` <-> key: `clinical_job_descriptions` <-> tag: `clinical`
- Folder: `bms-job-descriptions` <-> key: `bms_job_descriptions` <-> tag: `BMS`

When adding a new category, update both:
- `category_training_tag_rules["<folder-name>"]`
- `categories["<key-name>"]`

## Required Entry Fields

Every indexed entry must include:

- `id`
- `title`
- `source`
- `training_tag`
- `file`
- `date_added`

Use ISO date format for `date_added` and `last_updated` when present (YYYY-MM-DD).

## Scripts

Use helper scripts in `scripts/`.

- Upsert an entry: `node skills/job-description-tracker/scripts/upsert_job_entry.mjs ...`
- Validate registry: `node skills/job-description-tracker/scripts/validate_job_descriptions.mjs`

For command arguments and examples, read `references/usage.md`.

## Safety Rules

- Never overwrite unrelated categories.
- Never delete existing entries unless explicitly asked.
- If a category rule is missing, add it before inserting entries.
- Keep file paths relative to repository root, starting with `job-descriptions/`.
