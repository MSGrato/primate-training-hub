

# Job Titles Enhancement + User Management Updates

## Overview
Three changes: (1) enhance Job Titles to support tags and descriptions, (2) add job title assignment and active/inactive status to User Management, (3) replace user deletion with deactivation.

## What will change

### 1. Database migrations
- Add `description` (text, nullable) column to `job_titles` table
- Add `is_active` (boolean, default true) column to `profiles` table

### 2. Job Titles page (`JobTitles.tsx`)
- Expand the "Add Title" dialog to include:
  - A **description** text area
  - A **tags** multi-select (checkboxes listing all existing job tags)
- On create, insert the job title, then insert rows into `job_title_tags` for selected tags
- Show description in the table (new column)
- Allow editing a job title (name, description, tags) via an edit dialog

### 3. User Management page (`UserManagement.tsx`)
- **Add User dialog**: add a Job Title dropdown (fetched from `job_titles` table)
- **Edit User dialog**: add a Job Title dropdown
- **Replace Delete with Active/Inactive toggle**:
  - Remove the delete button and delete confirmation dialog
  - Add a Status column showing Active/Inactive badge
  - Add a toggle button per row to activate/deactivate
  - Deactivation updates `profiles.is_active = false` (via the `manage-users` edge function)
  - Inactive users cannot log in (enforced by checking `is_active` in the auth flow)
- Pass `job_title_id` to the `manage-users` edge function on create/update

### 4. Backend function (`manage-users/index.ts`)
- **Create action**: accept optional `job_title_id`, set it on the profile after creation
- **Update action**: accept optional `job_title_id` and `is_active`, update the profile accordingly
- **Remove delete action** -- replace with deactivation (set `is_active = false`)
- Keep the old delete action available but rename to "deactivate" logic

### 5. Auth flow update (`AuthContext.tsx`)
- After fetching the profile, check `is_active`. If `false`, sign the user out and show an error indicating their account is inactive.

---

## Technical Details

### Migration SQL
```sql
ALTER TABLE public.job_titles ADD COLUMN description text;
ALTER TABLE public.profiles ADD COLUMN is_active boolean NOT NULL DEFAULT true;
```

### Files modified
- `supabase/functions/manage-users/index.ts` -- add `job_title_id`, `is_active` support; replace delete with deactivate
- `src/pages/dashboard/JobTitles.tsx` -- add description field, tag multi-select in create dialog; show description column
- `src/pages/dashboard/UserManagement.tsx` -- add job title dropdown, replace delete with active/inactive toggle, show status column
- `src/contexts/AuthContext.tsx` -- check `is_active` on profile fetch, sign out if inactive
