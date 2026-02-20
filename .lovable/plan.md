

## Simplify Training Search Results

**Goal**: When Agent Train returns training-only results (the `training_search` intent), show just `training_title` and `due_date` columns instead of the current columns (title, description, category, frequency, match_score).

### Current Behavior
The `training_search` intent returns rows with: `title`, `description`, `category`, `frequency`, `match_score`. These are catalog-level fields with no user-specific due date information.

### Changes

**File: `supabase/functions/report-chat/index.ts`**

1. After finding matching trainings in the training_search block, cross-reference them with the caller's training assignments and completions to compute a `next_due_at` date for each training.
2. Return rows with only two columns:
   - `training_title` (renamed from `title`)
   - `due_date` (computed from the user's assignment/completion data using the existing `buildStatus` logic)
3. If a training has no assignment for the caller, `due_date` will show as `null` (displayed as "—" in the table).

### Technical Details

- Reuse the existing `buildStatus` helper to compute due dates based on frequency and last completion.
- Query `user_training_assignments` and `training_completions` filtered to the caller's `user_id` and the matched training IDs.
- Map each matched training to `{ training_title, due_date }`.
- Sort by due date ascending (soonest due first), with nulls last.

