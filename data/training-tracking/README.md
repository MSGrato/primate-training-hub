# Training Tracking for Job-Title Categorization

Source catalog snapshot:
- `data/training-tracking/training_catalog_2026-02-16.csv`

Source of truth moving forward:
- `data/training-tracking/training_job_title_tracker.csv`

Generated SQL seeds:
- `supabase/seeds/training_catalog_job_title_seed.sql`
- `supabase/seeds/remove_non_catalog_trainings.sql`

Rule:
- Any new training added to the app must be added to `training_job_title_tracker.csv` first (or immediately after creation) and triaged through this workflow before publishing assignments.

Use these tracker columns:
- `job_title_category`: Suggested tag group (`all_staff`, `husbandry`, `clinical`, `BMS`, or semicolon combinations).
- `job_titles`: Semicolon-separated job titles assigned to a training.
- `assignment_status`: `pending-triage` | `categorized` | `reviewed`.
- `last_reviewed`: Date reviewed (YYYY-MM-DD).
- `notes`: Rationale or exceptions.

Current job titles in this project:
- Animal Facility Program Supervisor
- Animal Technician 1
- Animal Technician 2
- Animal Technician 3
- Animal Technician Supervisor
- Vet Technician 1
- Vet Technician 2
- Veterinarian
- Training Specialist
- Behavior Specialist

Add a new training to tracking:
- `node scripts/add-training-to-tracker.mjs --training-id T041 --training-name "Example Training" --category "EH&S" --governing-body "UW EH&S" --delivery-method "Online" --frequency "Annual" --high-risk-if-expired "Yes" --training-tags "lab_safety;example"`

Regenerate seeds from tracker:
- `node scripts/generate-training-tracker-and-seed.mjs`

Apply in Supabase:
1. Run `supabase/seeds/training_catalog_job_title_seed.sql`.
2. Run `supabase/seeds/remove_non_catalog_trainings.sql` to remove any training not in tracker.

Suggested workflow:
1. Add new training to tracker with `assignment_status = pending-triage`.
2. Complete `job_title_category` and `job_titles`.
3. Mark as `categorized` or `reviewed`.
4. Regenerate seeds and apply SQL.
