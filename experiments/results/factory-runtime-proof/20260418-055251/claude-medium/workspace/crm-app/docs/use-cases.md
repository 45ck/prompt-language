# Use Cases — SME CRM MVP

## UC-01: Sign Up / Sign In

### Actor
Unauthenticated user (any persona).

### Precondition
- The application is deployed and accessible.
- For sign-in: user has an existing account.

### Main Flow — Sign Up
1. User navigates to the sign-up page.
2. User enters name, email, and password.
3. System validates email format and password strength (min 8 chars, 1 uppercase, 1 number).
4. System creates the user account and associated tenant/organization.
5. System signs the user in and redirects to the dashboard.

### Main Flow — Sign In
1. User navigates to the sign-in page.
2. User enters email and password.
3. System validates credentials.
4. System creates a session and redirects to the dashboard.

### Main Flow — Sign Out
1. User clicks "Sign out" in the navigation.
2. System destroys the session.
3. System redirects to the sign-in page.

### Postcondition
- User account exists in the database.
- User has an active session (sign-in) or no session (sign-out).

### Exceptions
- **E1**: Email already registered — system displays "An account with this email already exists."
- **E2**: Invalid credentials — system displays "Invalid email or password." (no hint about which).
- **E3**: Session expired — system redirects to sign-in with message "Your session has expired."

---

## UC-02: Manage Contacts

### Actor
Authenticated user (Sales Rep, Manager, Founder, Admin).

### Precondition
- User is signed in.

### Main Flow — Create Contact
1. User clicks "New Contact."
2. User fills in: first name, last name, email, phone, job title.
3. User optionally links the contact to an existing company.
4. User clicks "Save."
5. System validates required fields (first name, last name).
6. System creates the contact and displays the contact detail page.

### Main Flow — View / Edit Contact
1. User navigates to the contacts list.
2. User clicks a contact row.
3. System displays contact details, linked company, notes, tasks, and opportunities.
4. User edits any field and clicks "Save."
5. System updates the contact.

### Main Flow — Delete Contact
1. User opens a contact and clicks "Delete."
2. System shows confirmation dialog.
3. User confirms.
4. System soft-deletes the contact and returns to the contacts list.

### Postcondition
- Contact record is created, updated, or soft-deleted.
- Activity timeline reflects the change.

### Exceptions
- **E1**: Duplicate email warning — system warns but allows creation (soft duplicate check).
- **E2**: Missing required fields — system highlights fields and prevents save.
- **E3**: Contact linked to open opportunities — deletion warning lists affected opportunities.

---

## UC-03: Manage Companies

### Actor
Authenticated user.

### Precondition
- User is signed in.

### Main Flow — Create Company
1. User clicks "New Company."
2. User fills in: name, domain, industry, employee count range.
3. User clicks "Save."
4. System validates required fields (name).
5. System creates the company and displays the company detail page.

### Main Flow — View / Edit Company
1. User navigates to the companies list.
2. User clicks a company row.
3. System displays company details, linked contacts, opportunities, notes, and tasks.
4. User edits fields and clicks "Save."
5. System updates the company.

### Main Flow — Delete Company
1. User opens a company and clicks "Delete."
2. System shows confirmation dialog listing linked contacts and opportunities.
3. User confirms.
4. System soft-deletes the company (linked contacts are unlinked, not deleted).

### Postcondition
- Company record is created, updated, or soft-deleted.

### Exceptions
- **E1**: Missing company name — system prevents save.
- **E2**: Company with same name exists — system warns but allows creation.

---

## UC-04: Manage Opportunities and Pipeline

### Actor
Authenticated user (primarily Sales Rep and Manager).

### Precondition
- User is signed in.
- At least one pipeline stage exists (system seeds defaults: Lead, Qualified, Proposal, Negotiation, Closed Won, Closed Lost).

### Main Flow — Create Opportunity
1. User clicks "New Opportunity."
2. User fills in: name, value (currency amount), pipeline stage, expected close date, owner.
3. User optionally links to a contact and/or company.
4. User clicks "Save."
5. System creates the opportunity in the specified stage.

### Main Flow — Move Opportunity (Pipeline View)
1. User opens the pipeline kanban view.
2. User drags an opportunity card from one stage column to another.
3. System updates the opportunity stage.
4. System records the stage change in the activity timeline.

### Main Flow — Edit Opportunity
1. User clicks an opportunity card or row.
2. System shows opportunity detail: value, stage, close date, owner, linked contact/company, notes, tasks.
3. User modifies fields and clicks "Save."

### Main Flow — Close Opportunity
1. User moves opportunity to "Closed Won" or "Closed Lost."
2. System prompts for close reason (optional text).
3. System records the close date and reason.

### Postcondition
- Opportunity is created, updated, moved, or closed.
- Pipeline view reflects current stages.
- Dashboard totals update accordingly.

### Exceptions
- **E1**: Missing required fields (name, stage) — system prevents save.
- **E2**: Negative or zero value — system warns but allows (some deals are $0).
- **E3**: Expected close date in the past — system warns but allows.

---

## UC-05: Manage Tasks

### Actor
Authenticated user.

### Precondition
- User is signed in.

### Main Flow — Create Task
1. User clicks "New Task" (from task list, or from a contact/company/opportunity detail page).
2. User fills in: title, description (optional), due date, assignee.
3. System links the task to the parent entity if created from a detail page.
4. User clicks "Save."
5. System creates the task.

### Main Flow — Complete Task
1. User clicks the checkbox next to a task.
2. System marks the task as completed with a timestamp.
3. Task moves to "Completed" section of the task list.

### Main Flow — Edit / Delete Task
1. User clicks a task to open it.
2. User edits fields or clicks "Delete."
3. System updates or soft-deletes the task.

### Postcondition
- Task is created, completed, updated, or deleted.
- Dashboard "tasks due" count reflects changes.

### Exceptions
- **E1**: Missing title — system prevents save.
- **E2**: Due date in the past — system warns but allows.
- **E3**: Assignee not a team member — system prevents assignment.

---

## UC-06: Add Notes

### Actor
Authenticated user.

### Precondition
- User is signed in.
- User is viewing a contact, company, or opportunity detail page.

### Main Flow
1. User clicks "Add Note" on a detail page.
2. User types note content (plain text, up to 5000 characters).
3. User clicks "Save."
4. System saves the note with timestamp and author.
5. Note appears in the entity's activity timeline, newest first.

### Main Flow — Edit Note
1. User clicks "Edit" on their own note.
2. User modifies text and clicks "Save."
3. System updates the note and records edit timestamp.

### Main Flow — Delete Note
1. User clicks "Delete" on their own note.
2. System shows confirmation.
3. User confirms. System removes the note.

### Postcondition
- Note is attached to the parent entity with author and timestamp.

### Exceptions
- **E1**: Empty note content — system prevents save.
- **E2**: Note exceeds 5000 characters — system truncates or prevents save.
- **E3**: User attempts to edit another user's note — system denies unless Admin role.

---

## UC-07: View Dashboard

### Actor
Authenticated user (primarily Sales Manager and Founder).

### Precondition
- User is signed in.

### Main Flow
1. User navigates to the dashboard (default landing page after sign-in).
2. System displays summary cards:
   - **Open opportunities**: count of non-closed opportunities.
   - **Total pipeline value**: sum of values for open opportunities.
   - **Tasks due today**: count of incomplete tasks due today for the current user.
   - **Overdue tasks**: count of incomplete tasks past due date.
   - **Recent activity**: last 10 activities (notes added, deals moved, tasks completed).
3. User clicks a summary card to navigate to the relevant list view.

### Postcondition
- Dashboard displays accurate, real-time data.

### Exceptions
- **E1**: No data yet (new account) — system shows empty state with "Get started" prompts.
- **E2**: Dashboard query timeout — system shows cached data with "Last updated" timestamp.
