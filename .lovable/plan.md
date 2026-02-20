

## Show Assigned Employees on Supervisor Profile

When a supervisor or coordinator views their profile, they will see a list of employees assigned to them below the existing profile card.

### What Changes

**Profile Page (`src/pages/dashboard/Profile.tsx`)**
- Add a new `useEffect` that runs when the user has a "supervisor" or "coordinator" role
- Query `supervisor_employee_mappings` to get all `employee_id` values where `supervisor_id` matches the current user
- Join with `profiles` to get each employee's `full_name` and `net_id`
- Display the list in a new Card below the existing profile card, with a heading like "My Employees"
- Each employee shown as a row with their name and Net ID
- If no employees are assigned, show "No employees assigned"
- Only visible to users with the supervisor or coordinator role

### No Database Changes Needed

The existing RLS policy `"Supervisors can view own mappings"` already allows supervisors to query their own mappings. Supervisors can also view employee profiles via the `"Supervisors can view employee profiles"` policy. Coordinators have full access. No migration is required.

### Technical Details

```text
Profile Page Layout
+---------------------------+
| My Profile                |
| [existing profile card]   |
+---------------------------+
| My Employees (if sup/coord)|
| - Employee Name (net_id)  |
| - Employee Name (net_id)  |
| ...                       |
+---------------------------+
```

Data fetching approach:
1. Query `supervisor_employee_mappings` where `supervisor_id = user.id`
2. Collect all `employee_id` values
3. Query `profiles` where `user_id` is in that list
4. Display results in a simple table or list

