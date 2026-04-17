# Acceptance Criteria

## Authentication

### AC-AUTH-01: Registration

**Given** a user is on the registration page
**When** they submit a valid name, email, and password (8+ characters)
**Then** an account is created, the user is logged in, and redirected to the dashboard.

**Given** a user submits a registration with an already-registered email
**When** the form is submitted
**Then** the system displays an error message and does not create a duplicate account.

**Given** a user submits a password shorter than 8 characters
**When** the form is submitted
**Then** the system displays a validation error and does not create the account.

### AC-AUTH-02: Login

**Given** a registered user is on the login page
**When** they enter a valid email and password
**Then** they are authenticated and redirected to the dashboard.

**Given** a user enters an invalid email or password
**When** the form is submitted
**Then** the system displays "Invalid email or password" without indicating which field is wrong.

### AC-AUTH-03: Password Reset

**Given** a user requests a password reset with a registered email
**When** they click the link in the email and enter a new password
**Then** the password is updated and they can log in with the new password.

**Given** a user requests a password reset with an unregistered email
**When** the form is submitted
**Then** the system shows the same success message as for a registered email (no information leakage).

**Given** a password reset link that is older than 1 hour
**When** the user clicks it
**Then** the system rejects the token and asks the user to request a new reset.

### AC-AUTH-04: Logout

**Given** an authenticated user
**When** they click "Log out"
**Then** their session is destroyed and they are redirected to the login page.

**Given** a logged-out user tries to access a protected page
**When** the request is made
**Then** they are redirected to the login page.

### AC-AUTH-05: Role-Based Access

**Given** a user with "member" role
**When** they attempt to rename a pipeline stage
**Then** the system returns a 403 Forbidden response and the stage name is unchanged.

**Given** a user with "admin" role
**When** they rename a pipeline stage
**Then** the stage name is updated successfully.

### AC-AUTH-06: Assign User Role

**Given** an admin user views the user management page
**When** they change a member's role from "member" to "admin"
**Then** the target user's role is updated to "admin" and they can access admin-only features (e.g., rename pipeline stages).

**Given** a member (non-admin) user
**When** they attempt to access user management via the UI or API
**Then** the system returns 403 Forbidden and no role changes are made.

### AC-AUTH-07: Shared Data Access

**Given** user A created a contact named "Acme Corp Contact"
**When** user B (also a member) views, edits, or deletes that contact
**Then** the operation succeeds because CRM data is shared across the team.

---

## Contacts

### AC-CON-01: Create Contact

**Given** an authenticated user on the new contact form
**When** they enter a name and save
**Then** a contact record is created and the user is shown the contact detail page.

**Given** a user submits the contact form without a name
**When** the form is submitted
**Then** validation prevents submission and displays a "Name is required" error.

### AC-CON-02: Search Contacts

**Given** contacts named "Alice Johnson" and "Bob Smith" exist
**When** a user searches for "alice"
**Then** "Alice Johnson" appears in the results and "Bob Smith" does not.

**Given** a user searches for a term matching no contacts
**When** the search executes
**Then** the list is empty and a "No contacts found" message is displayed.

### AC-CON-03: Edit Contact

**Given** a contact with name "Alice"
**When** a user changes the name to "Alice Johnson" and saves
**Then** the contact record is updated and the detail page shows "Alice Johnson."

### AC-CON-04: Delete Contact

**Given** a contact exists
**When** a user deletes it and confirms
**Then** the contact no longer appears in the contact list.

**Given** a contact has been soft-deleted
**When** querying the database directly
**Then** the record still exists with a non-null deleted timestamp.

### AC-CON-05: Contact Detail Page

**Given** a contact linked to a company with 2 notes, 1 opportunity, and 1 task
**When** a user views the contact detail page
**Then** the company name, 2 notes, 1 opportunity, and 1 task are all visible.

---

## Companies

### AC-COM-01: Create Company

**Given** an authenticated user on the new company form
**When** they enter a name and save
**Then** a company record is created.

**Given** a user submits the company form without a name
**When** the form is submitted
**Then** validation prevents submission and displays a "Name is required" error.

### AC-COM-02: Company Detail Page

**Given** a company with 3 linked contacts and 2 opportunities
**When** a user views the company detail page
**Then** all 3 contacts and 2 opportunities are listed.

### AC-COM-03: Search Companies

**Given** companies named "Acme Corp" and "Globex Inc" exist
**When** a user searches for "acme"
**Then** "Acme Corp" appears in the results and "Globex Inc" does not.

**Given** a user searches for a term matching no companies
**When** the search executes
**Then** the list is empty and a "No companies found" message is displayed.

### AC-COM-04: Edit Company

**Given** a company with name "Acme"
**When** a user changes the name to "Acme Corp" and saves
**Then** the company record is updated and the detail page shows "Acme Corp."

### AC-COM-05: Delete Company

**Given** a company exists
**When** a user deletes it and confirms
**Then** the company no longer appears in the company list.

**Given** a company has been soft-deleted
**When** querying the database directly
**Then** the record still exists with a non-null deleted timestamp.

### AC-COM-06: Link Contact to Company

**Given** a contact and a company both exist
**When** a user edits the contact and selects the company
**Then** the contact appears on the company detail page under linked contacts.

---

## Opportunities

### AC-OPP-01: Create Opportunity

**Given** an authenticated user with pipeline stages available
**When** they create an opportunity with name "Big Deal", value 50000, stage "Qualified"
**Then** the opportunity appears in the "Qualified" column on the Kanban board with value displayed.

**Given** a user creates an opportunity without a name
**When** the form is submitted
**Then** validation prevents submission and displays a "Name is required" error.

### AC-OPP-02: Drag-and-Drop Stage Change

**Given** an opportunity in the "Lead" stage on the Kanban board
**When** a user drags it to the "Proposal" column
**Then** the opportunity's stage is updated to "Proposal" and it appears in the "Proposal" column.

### AC-OPP-03: Keyboard Stage Change

**Given** an opportunity in the "Lead" stage
**When** a user changes the stage via dropdown to "Proposal" (keyboard-accessible alternative)
**Then** the opportunity's stage is updated to "Proposal."

### AC-OPP-04: Edit Opportunity

**Given** an opportunity with name "Big Deal" and value 50000
**When** a user changes the value to 75000 and saves
**Then** the opportunity record is updated and displays the new value of $75,000.

### AC-OPP-05: Delete Opportunity

**Given** an opportunity exists
**When** a user deletes it and confirms
**Then** the opportunity no longer appears in the pipeline board or opportunity list.

**Given** an opportunity has been soft-deleted
**When** querying the database directly
**Then** the record still exists with a non-null deleted timestamp.

### AC-OPP-06: Filter Opportunities

**Given** opportunities owned by "Sarah" and "Marcus" in various stages
**When** a user filters by owner "Sarah" and stage "Qualified"
**Then** only Sarah's qualified opportunities are shown.

---

## Pipeline Stages

### AC-PIP-01: Default Stages

**Given** a fresh database after seeding
**When** a user views the pipeline
**Then** six stages are displayed in order: Lead, Qualified, Proposal, Negotiation, Closed Won, Closed Lost.

### AC-PIP-02: Rename Stage (Admin)

**Given** an admin user
**When** they rename "Lead" to "Prospect"
**Then** the Kanban board column header shows "Prospect" and all opportunities formerly in "Lead" appear under "Prospect."

**Given** a member (non-admin) user
**When** they attempt to access stage settings
**Then** the UI does not show stage settings, and direct API requests return 403.

### AC-PIP-03: Stage Order

**Given** stages with defined sort order
**When** the Kanban board renders
**Then** columns appear in ascending sort order, left to right.

---

## Tasks

### AC-TSK-01: Create Task

**Given** an authenticated user
**When** they create a task with title "Follow up with Alice", due date tomorrow, assigned to themselves
**Then** the task appears in their task list.

**Given** a user submits the task form without a title
**When** the form is submitted
**Then** validation prevents submission and displays a "Title is required" error.

### AC-TSK-02: Complete and Reopen Task

**Given** an open task
**When** a user marks it complete
**Then** the task status changes to "completed" and the task displays with a checked checkbox and strikethrough or muted styling.

**Given** a completed task
**When** a user reopens it
**Then** the task status changes back to "open."

### AC-TSK-03: Link Task to Record

**Given** a user creates a task from a contact detail page
**When** the task is saved
**Then** the task is linked to that contact and visible on the contact detail page.

**Given** a user creates a task from an opportunity detail page
**When** the task is saved
**Then** the task is linked to that opportunity and visible on the opportunity detail page.

### AC-TSK-04: Filter Tasks

**Given** 5 tasks exist: 2 open assigned to the current user, 1 completed assigned to the current user, 2 open assigned to another user
**When** the current user filters by status "open" and assignee set to themselves
**Then** exactly 2 tasks are shown, both open and assigned to the current user.

---

## Notes

### AC-NOT-01: Add Note

**Given** a user is viewing a contact detail page
**When** they type a note and click "Add Note"
**Then** the note appears at the top of the notes list with the current timestamp and author name.

**Given** a user submits an empty note
**When** the form is submitted
**Then** the system prevents submission and displays a "Note cannot be empty" error.

### AC-NOT-02: Edit Own Note

**Given** a user authored a note
**When** they click "Edit", change the text, and save
**Then** the note text is updated.

**Given** a user views a note authored by someone else
**When** they look at the note
**Then** no "Edit" or "Delete" controls are visible.

### AC-NOT-03: Delete Own Note

**Given** a user authored a note
**When** they click "Delete" and confirm
**Then** the note is removed from the record.

### AC-NOT-04: Notes on Multiple Record Types

**Given** notes exist on a contact, a company, and an opportunity
**When** a user views each record's detail page
**Then** only the notes belonging to that specific record are shown.

---

## Dashboard

### AC-DSH-01: Pipeline Summary

**Given** 3 opportunities in "Lead" (values: 10000, 20000, 30000) and 2 in "Proposal" (values: 50000, 75000)
**When** a user views the dashboard
**Then** the pipeline summary shows Lead: 3 deals / $60,000 and Proposal: 2 deals / $125,000.

**Given** a stage has zero opportunities
**When** the dashboard loads
**Then** that stage shows 0 deals / $0 (not omitted).

### AC-DSH-02: Upcoming Tasks

**Given** a user has 3 open tasks: one due tomorrow, one due in 5 days, one due in 10 days
**When** they view the dashboard
**Then** the first two tasks appear (within 7-day window); the third does not.

**Given** a user has no tasks due within 7 days
**When** they view the dashboard
**Then** the upcoming tasks section shows "No upcoming tasks."

### AC-DSH-03: Recent Activity

**Given** 25 record changes have occurred across all users
**When** a user views the dashboard
**Then** the 20 most recent changes are displayed in reverse chronological order.

### AC-DSH-04: Win/Loss Count

**Given** 5 opportunities were closed won and 3 closed lost in the current month
**When** a user views the dashboard
**Then** the win/loss section shows Won: 5, Lost: 3.

**Given** it is the first day of a new month with no closes yet
**When** a user views the dashboard
**Then** the win/loss section shows Won: 0, Lost: 0.
