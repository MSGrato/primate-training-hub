
# Set Up Real Coordinator Account with User Management

## Overview
Create your real coordinator account (msgrato@uw.edu) and build out the User Management page so you can add, edit, and remove users from within the app.

## What will be done

### 1. Create your coordinator account
- Create an auth user via the `seed-demo-data` edge function pattern (or a new dedicated edge function) with:
  - Email: msgrato@uw.edu
  - Password: Mykittiesarecute2026@
  - Role: coordinator
  - Name/NetID derived from email (e.g., "msgrato")
- The existing `handle_new_user` trigger will auto-create a profile and an "employee" role entry; the role will then be upgraded to "coordinator"

### 2. Create a "manage-users" backend function
A new backend function that only coordinators can call, supporting three operations:
- **Create user** -- creates an auth account (with email + password + name + netID), profile auto-created by trigger, then sets the role
- **Update user** -- updates profile fields (name, netID, job title) and/or role
- **Delete user** -- removes the auth user (cascade deletes profile, role, assignments, etc.)

This function uses the service role key server-side so it can call admin auth APIs, while verifying the caller is a coordinator.

### 3. Build out the User Management UI
Update `UserManagement.tsx` to include:
- **Add User** button that opens a dialog with fields: Full Name, NetID, Email, Password, Role (dropdown: Employee/Supervisor/Coordinator)
- **Edit** button per row -- opens a dialog to change name, NetID, and role
- **Delete** button per row -- confirmation dialog, then removes the user
- All actions call the new backend function
- Refresh the user list after each operation

---

## Technical Details

### Backend function: `supabase/functions/manage-users/index.ts`
- Accepts POST with JSON body: `{ action: "create" | "update" | "delete", ...params }`
- Validates JWT and checks coordinator role (same pattern as seed-demo-data)
- Uses `SUPABASE_SERVICE_ROLE_KEY` to call `supabase.auth.admin.*` methods
- `verify_jwt = false` in config.toml (manual auth check in code)

### Frontend changes: `src/pages/dashboard/UserManagement.tsx`
- Add state for dialogs (add/edit/delete)
- Add User dialog with form fields and validation
- Edit dialog pre-filled with current user data
- Delete confirmation dialog
- Call edge function via `supabase.functions.invoke("manage-users", { body: {...} })`
- Toast notifications for success/error

### Account creation (one-time)
- Use the new manage-users function (or a direct admin call) to create the msgrato@uw.edu account with coordinator role
