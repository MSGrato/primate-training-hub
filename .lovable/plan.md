

# Fix User Management Page: Remove Missing `deactivated_at` Column References

## Problem
The User Management page fails to load because the code queries a `deactivated_at` column from the `profiles` table, but this column does not exist in the database. The error is: `"column profiles.deactivated_at does not exist"`.

## Solution
Remove all references to `deactivated_at` from `UserManagement.tsx`. The `profiles` table only has `is_active` (boolean) for tracking active/inactive status -- there is no timestamp column for when deactivation occurred.

## Changes

### File: `src/pages/dashboard/UserManagement.tsx`

1. **Remove `deactivated_at` from the `UserRow` interface** (line 21)
2. **Remove `deactivated_at` from both profile SELECT queries** (lines 72 and 120) -- change to `"user_id, full_name, net_id, is_active, job_title_id"`
3. **Remove `deactivated_at` from the user mapping** (line 145)
4. **Update the retention alerts filter** (line 153) -- remove the `deactivated_at` check and any date calculations that depend on it; either remove the retention alerts feature entirely or base it solely on `is_active`
5. **Remove any UI rendering of `deactivated_at`** if present

No database changes are needed -- the fix is purely in the frontend code.
