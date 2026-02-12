

# Training Detail Page with Employee/Supervisor Sign-Off

## Overview
When an employee clicks a training card in their Training List, they'll navigate to a dedicated training detail page. For on-the-job (and SOP) trainings, the page shows the title, description, and a sign-off workflow: the employee marks it complete, which sends it to the supervisor's Approval Queue. The supervisor's approval date becomes the official completion date on the Training Report.

## What will change

### 1. New Training Detail Page
- Create `src/pages/dashboard/TrainingDetail.tsx`
- Displays training title, description, and category
- Shows the current completion status for this training
- For on-the-job and SOP categories:
  - **Employee Sign-Off section**: a "Mark Complete" button that inserts a row into `training_completions` with status `pending`
  - **Supervisor Sign-Off section**: shows the approval status (pending/approved/rejected) and who approved it, if applicable
  - Once the employee has signed off, the button changes to show "Awaiting Supervisor Approval"
  - If already approved, shows the completion date (from `approved_at`)
- For onboarding trainings: simpler flow -- employee marks complete and it auto-approves (or follows the same approval flow, depending on preference)

### 2. Route and Navigation
- Add a new route: `/dashboard/training/:trainingId` in `App.tsx`
- Make the training cards in `TrainingList.tsx` clickable, navigating to `/dashboard/training/{trainingId}`

### 3. Training List Updates (`TrainingList.tsx`)
- Wrap each training card with a `Link` or `useNavigate` click handler pointing to `/dashboard/training/{training.id}`

### 4. Training Report Update (`TrainingReport.tsx`)
- The report already uses `approved` completions and `completed_at` -- update it to use `approved_at` as the completion date instead, since the supervisor's approval date should be the official date

### 5. No database changes needed
- The `training_completions` table already has all required columns: `user_id`, `training_id`, `status` (pending/approved/rejected), `completed_at`, `approved_at`, `approved_by`
- The Approval Queue page already handles supervisor approve/reject actions
- RLS policies already support employees inserting their own completions and supervisors updating them

---

## Technical Details

### New file: `src/pages/dashboard/TrainingDetail.tsx`
- Uses `useParams()` to get `trainingId` from the URL
- Fetches the training from `trainings` table by ID
- Fetches the user's latest completion from `training_completions` for this training
- State tracks: training data, existing completion (if any), and loading
- "Mark Complete" button inserts into `training_completions`:
  ```
  { user_id, training_id, status: 'pending', completed_at: now() }
  ```
- After marking complete, the training appears in the supervisor's Approval Queue (already implemented)
- Displays sign-off status:
  - Not started: shows "Mark Complete" button
  - Pending: shows "Awaiting Supervisor Approval" with employee sign-off date
  - Approved: shows green checkmarks for both employee and supervisor with dates
  - Rejected: shows rejection status with option to re-submit

### Route addition in `App.tsx`
```
<Route path="training/:trainingId" element={<TrainingDetail />} />
```

### TrainingList.tsx changes
- Import `useNavigate` from react-router-dom
- Add `onClick` to each Card that navigates to `/dashboard/training/${a.training.id}`

### TrainingReport.tsx changes
- Use `approved_at` (when available) instead of `completed_at` for the "Last Completed" date column, since that represents the supervisor's sign-off date

### Files modified
- `src/pages/dashboard/TrainingDetail.tsx` (new)
- `src/App.tsx` -- add route
- `src/pages/dashboard/TrainingList.tsx` -- make cards clickable
- `src/pages/dashboard/TrainingReport.tsx` -- use `approved_at` as completion date
