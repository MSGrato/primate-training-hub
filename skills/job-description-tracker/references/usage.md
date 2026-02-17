# Usage

## Upsert Entry

```bash
node skills/job-description-tracker/scripts/upsert_job_entry.mjs \
  --id veterinarian \
  --title "Veterinarian" \
  --category-folder clinical-job-descriptions \
  --category-key clinical_job_descriptions \
  --training-tag clinical \
  --file job-descriptions/clinical-job-descriptions/veterinarian.md \
  --source "User provided (image)" \
  --date-added 2026-02-16
```

Behavior:
- Create or update category rule in `category_training_tag_rules`.
- Create category list in `categories` when missing.
- Upsert by `id` in the chosen category list.

## Validate Registry

```bash
node skills/job-description-tracker/scripts/validate_job_descriptions.mjs
```

Checks:
- Every indexed file exists.
- Every markdown file in `job-descriptions/**` is indexed.
- Every entry has required fields.
- Every entry `training_tag` matches category rule.
