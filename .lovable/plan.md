

# WaNBRC Train — Training Management Dashboard

## Overview
A role-based training management dashboard for a primate biomedical research center. Training Coordinators manage users, trainings, and job tags. Supervisors oversee their assigned employees. Employees complete and track their trainings.

---

## 0. University of Washington Color Scheme
The app will use the official UW brand colors:
- **Primary Purple** (#4B2E83) — primary buttons, sidebar background, headers
- **Secondary Gold** (#B7A57A) — accents, active states, highlights, badges
- **White** (#FFFFFF) — backgrounds, cards
- **Light Grey** (#D9D9D9) — borders, muted backgrounds
- **Dark Grey** (#444444) — body text
- **Metallic Gold** (#85754D) — subtle accent for icons and hover states
- Compliance indicators: **Red** for overdue/not compliant, **Green** for compliant status

## 1. Authentication & Role-Based Access
- **Sign-in page** with NetID (username) and password, styled with UW purple branding and "WaNBRC Train" title
- Three roles stored in the database: **Employee** (Level 1), **Supervisor** (Level 2), **Training Coordinator** (Level 3)
- After login, users are routed to a role-specific dashboard
- Logout button and back navigation available on every page

## 2. Layout & Navigation
- **Corporate/institutional design** with a collapsible sidebar in UW Purple
- "WaNBRC Train" branding in the sidebar header and browser tab title
- Gold accent on active nav items and hover states
- Sidebar navigation adapts based on user role — employees see fewer options, coordinators see the full menu
- Consistent header with user info, role badge (gold), and logout

## 3. Employee Dashboard (Level 1)
- **Training List** — All assigned but incomplete trainings, organized by category (On-boarding, On-the-Job, SOPs). Shows trainings never done, due within 60 days, or overdue
- **In Progress** — Trainings opened but not yet completed, or completed but awaiting supervisor approval. Status indicator for approval state
- **Training Report** — All assigned trainings with name, last completion date, and next due date. Color-coded: red for due within 60 days, red + "Not Compliant" for overdue, "Compliant" for one-time completed trainings
- **Employee Profile** — View personal info, job title, and assigned tags

## 4. Training Modules & Completion Flow
- Each training has a title, description, category, frequency (one-time, annual, semi-annual, as-needed), and content (external link or uploaded file/document)
- Employee opens training → views content → marks as complete → sent to supervisor for approval
- Employee can see approval status (Pending, Approved, Rejected)
- On supervisor approval, completion date is recorded on the training report
- Due dates auto-calculated based on frequency (e.g., annual = 1 year from last completion)

## 5. Supervisor Dashboard (Level 2)
- All Employee features, plus:
- **Employee Training Reports** — View training reports for all assigned employees. See what's completed, what's due in the next 90 days, and compliance status
- **Approval Queue** — Review and approve/reject employee training completions

## 6. Training Coordinator Dashboard (Level 3)
- All Supervisor features (with access to ALL employees/supervisors), plus:
- **Input Trainings / Add-Edit-Remove Trainings** — Create new trainings with title, description, category, frequency, content (link or file upload), and tags. Edit or remove existing trainings
- **Job Tags** — Create and manage tags (e.g., "Husbandry"). Each tag has a list of trainings under it. Tags are used to auto-assign trainings
- **Job Titles** — List all job titles, assign tags to each title. When a user is added with a job title, trainings are auto-assigned based on their title's tags
- **User Management** — Add new users, set their role, job title, and (for supervisors) assign which employees they oversee. Remove or edit users

## 7. Backend (Lovable Cloud with Supabase)
- **Database tables**: users/profiles, user_roles, job_titles, job_tags, trainings, training_tag_assignments, user_training_assignments, training_completions, supervisor_employee_mappings
- **Storage**: Bucket for uploaded training materials (PDFs, videos)
- **Row-Level Security**: Users see only their own data; supervisors see their assigned employees; coordinators see everything
- **Edge Functions**: For complex operations like bulk training assignment when tags/titles change

## 8. Pre-loaded Sample Data
- Sample trainings from the spec (On-boarding, On-the-Job for Husbandry, SOPs)
- Sample job titles and tags (e.g., "Husbandry" tag)
- A few demo users across all three roles for testing

