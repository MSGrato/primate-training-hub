

# Add "Assign Training to User" on Manage Trainings Page

## Overview
Add an "Assign" action button to each training row in the Manage Trainings table. Clicking it opens a dialog where the coordinator can select one or more users to manually assign the training to, inserting rows into the existing `user_training_assignments` table.

## What will change

### Manage Trainings page (`src/pages/dashboard/ManageTrainings.tsx`)
- Add a new **Assign** icon button (UserPlus icon) in the Actions column for each training row
- Add a new **Assign Training** dialog that:
  - Shows the training title at the top
  - Fetches all active user profiles and displays them as a list with checkboxes
  - Pre-checks users who are already assigned to this training (fetched from `user_training_assignments`)
  - Has a "Save Assignments" button that inserts new assignments and removes unchecked ones
- Fetch profiles from `profiles` table (only active users) and existing assignments from `user_training_assignments`

### No database changes needed
The `user_training_assignments` table already exists with `user_id`, `training_id`, and `assigned_at` columns. RLS policies already allow coordinators full access.

## Technical Details

### New state in ManageTrainings
- `assignOpen` (boolean) -- controls assignment dialog visibility
- `assignTraining` (object) -- the training being assigned
- `profiles` (array) -- list of active users fetched from `profiles`
- `selectedUserIds` (Set) -- checked user IDs in the dialog
- `existingAssignmentIds` (Set) -- user IDs already assigned

### Assignment logic
- On dialog open: fetch `user_training_assignments` where `training_id = selected training` and fetch all active profiles
- On save:
  - **New assignments**: IDs in `selectedUserIds` but not in `existingAssignmentIds` -- insert into `user_training_assignments`
  - **Removed assignments**: IDs in `existingAssignmentIds` but not in `selectedUserIds` -- delete from `user_training_assignments`

### Files modified
- `src/pages/dashboard/ManageTrainings.tsx` -- add assign button, dialog, and assignment logic

