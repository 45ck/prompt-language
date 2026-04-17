# Acceptance Criteria

All criteria use Given/When/Then format and must be independently testable.

---

## 1. Authentication

### AC-AUTH-01: Email/Password Login

**Given** a user with email "rep@example.com" and a valid password exists,
**When** the user submits correct credentials on the login page,
**Then** the user is redirected to the dashboard, a JWT is issued, and a refresh token cookie is set.

### AC-AUTH-02: Login Failure

**Given** a user submits an incorrect password,
**When** the login form is submitted,
**Then** the system displays "Invalid email or password" and no session is created.

### AC-AUTH-03: Rate Limiting

**Given** a client IP has submitted 10 failed login attempts in the last 5 minutes,
**When** the client submits another login attempt,
**Then** the system returns HTTP 429 with message "Too many login attempts. Try again later."

### AC-AUTH-04: Google OAuth Login

**Given** a user clicks "Sign in with Google" and completes the OAuth flow,
**When** the callback is received with a valid authorization code,
**Then** the user is logged in. If no account exists, one is created with the Rep role.

### AC-AUTH-05: User Invitation

**Given** an admin enters "newuser@example.com" with role "Rep" on the invite form,
**When** the admin clicks "Send Invite",
**Then** an invitation record is created with a unique token and the invite link is displayed to the admin (email delivery is out of MVP scope).

### AC-AUTH-06: Deactivated User Blocked

**Given** a user account is deactivated,
**When** the user attempts to log in with valid credentials,
**Then** the system displays "Your account has been deactivated. Contact your administrator." and no session is created.

### AC-AUTH-07: Role Assignment

**Given** an admin views the user management page,
**When** the admin changes a user's role from "Rep" to "Manager",
**Then** the user's role is updated and their next API request reflects the new permissions.

---

## 2. Contacts

### AC-CON-01: Create Contact

**Given** a logged-in user is on the "New Contact" form,
**When** the user enters first name "Jane", last name "Doe", email "jane@acme.com", and clicks "Save",
**Then** a contact record is created with the current user as owner, and the user is redirected to the contact detail page showing all entered fields.

### AC-CON-02: Required Fields Validation

**Given** a user submits the contact form with first name empty,
**When** the form is submitted,
**Then** the system displays a validation error "First name is required" and the record is not created.

### AC-CON-03: Email Format Validation

**Given** a user enters "not-an-email" in the email field,
**When** the form is submitted,
**Then** the system displays "Invalid email format" and the record is not created.

### AC-CON-04: Search by Name

**Given** contacts "Jane Doe" and "Janet Smith" exist,
**When** a user types "jan" in the search bar,
**Then** both "Jane Doe" and "Janet Smith" appear in results within 300ms.

### AC-CON-05: Search by Email

**Given** a contact with email "jane@acme.com" exists,
**When** a user types "acme.com" in the search bar,
**Then** the contact appears in results.

### AC-CON-06: Filter by Owner

**Given** 10 contacts exist, 3 owned by user "Sarah" and 7 by user "Mike",
**When** a manager selects owner filter "Sarah",
**Then** exactly 3 contacts are shown.

### AC-CON-07: Link Contact to Company

**Given** a contact exists and a company "Acme Corp" exists,
**When** the user edits the contact and selects "Acme Corp" as the company,
**Then** the contact's company field is updated, and the contact appears on the Acme Corp detail page.

### AC-CON-08: Edit Contact

**Given** a contact "Jane Doe" exists and is owned by the current user,
**When** the user changes the last name to "Smith" and clicks "Save",
**Then** the contact's last name is updated to "Smith" and the updatedAt timestamp is refreshed.

### AC-CON-09: Soft Delete (Admin)

**Given** an admin views contact "Jane Doe",
**When** the admin clicks "Delete" and confirms,
**Then** the contact's deletedAt is set, the contact no longer appears in search or list views, and linked opportunity FK is set to null.

---

## 3. Companies

### AC-COM-01: Create Company

**Given** a logged-in user is on the "New Company" form,
**When** the user enters name "Acme Corp" and domain "acme.com" and clicks "Save",
**Then** a company record is created with the current user as owner and the user is redirected to the company detail page.

### AC-COM-02: Required Name

**Given** a user submits the company form with name empty,
**When** the form is submitted,
**Then** the system displays "Company name is required."

### AC-COM-03: Company Detail Shows Related Entities

**Given** company "Acme Corp" has 2 contacts and 1 opportunity,
**When** a user views the Acme Corp detail page,
**Then** 2 contacts and 1 opportunity are listed under their respective sections.

### AC-COM-04: Filter by Industry

**Given** 5 companies exist, 2 with industry "SaaS" and 3 with industry "Manufacturing",
**When** a user selects industry filter "SaaS",
**Then** exactly 2 companies are shown.

### AC-COM-05: Edit Company

**Given** company "Acme Corp" exists,
**When** the owner changes the industry to "Technology" and clicks "Save",
**Then** the industry field is updated and updatedAt is refreshed.

---

## 4. Opportunities & Pipeline

### AC-OPP-01: Create Opportunity

**Given** a logged-in user is on the "New Deal" form and pipeline stages exist,
**When** the user enters name "Enterprise License", value "50000", stage "Proposal", close date "2026-06-30", and clicks "Save",
**Then** an opportunity is created and appears in the "Proposal" column on the Kanban board.

### AC-OPP-02: Kanban Drag-and-Drop

**Given** an opportunity "Enterprise License" is in stage "Proposal",
**When** the user drags it to the "Negotiation" column,
**Then** the opportunity's stage is updated to "Negotiation", the card appears in the new column, and updatedAt is refreshed.

### AC-OPP-03: Kanban Reject Archived Stage

**Given** stage "Old Stage" is archived,
**When** a user attempts to drag a deal into that column,
**Then** the drag is rejected and the card returns to its original column.

### AC-OPP-04: List View Alternative

**Given** opportunities exist,
**When** a user clicks "List View" on the pipeline page,
**Then** all opportunities are displayed in a sortable table with columns: name, value, stage, close date, owner.

### AC-OPP-05: No Stages Warning

**Given** no pipeline stages are configured,
**When** a user navigates to "New Deal",
**Then** the system displays "Ask your admin to configure pipeline stages" and the form is not shown.

### AC-OPP-06: Pipeline Stage - Add

**Given** an admin is on Settings > Pipeline Stages,
**When** the admin enters "Demo Scheduled" and clicks "Add",
**Then** the stage appears at the end of the list and is available on the Kanban board.

### AC-OPP-07: Pipeline Stage - Reorder

**Given** stages are ordered Lead, Qualified, Proposal,
**When** the admin drags "Proposal" to position 2,
**Then** the order becomes Lead, Proposal, Qualified, and the Kanban board reflects this order.

### AC-OPP-08: Pipeline Stage - Archive

**Given** stage "Old Stage" has 3 deals,
**When** the admin archives the stage and confirms the warning,
**Then** the stage is hidden from the Kanban board, the 3 deals retain their stage_id, and the deals appear in a "Needs Attention" section.

---

## 5. Tasks

### AC-TASK-01: Create Task from Entity Page

**Given** a user is on the contact detail page for "Jane Doe",
**When** the user clicks "New Task", enters title "Follow up call", due date "2026-05-01", priority "high", and clicks "Save",
**Then** a task is created linked to "Jane Doe" with the current user as assignee.

### AC-TASK-02: Create Standalone Task

**Given** a user is on the tasks list page,
**When** the user clicks "New Task", enters a title and due date, and clicks "Save",
**Then** a task is created with no linked entity.

### AC-TASK-03: Complete Task

**Given** an open task "Follow up call" exists,
**When** the assignee clicks the checkbox,
**Then** the task status changes to "completed" and the checkbox shows as checked.

### AC-TASK-04: Reopen Task

**Given** a completed task exists,
**When** the assignee unchecks the checkbox,
**Then** the task status changes back to "open."

### AC-TASK-05: My Tasks Filter

**Given** 10 tasks exist, 4 assigned to the current user,
**When** the user views "My Tasks",
**Then** exactly 4 tasks are shown, sorted by due date ascending.

### AC-TASK-06: Filter by Priority

**Given** tasks with priorities low, medium, and high exist,
**When** a user selects priority filter "high",
**Then** only high-priority tasks are shown.

### AC-TASK-07: Filter by Status

**Given** 5 open and 3 completed tasks exist,
**When** a user selects status filter "open",
**Then** exactly 5 tasks are shown.

### AC-TASK-08: Manager Assigns Task

**Given** a manager is creating a task,
**When** the manager selects assignee "Sarah Chen" from the dropdown,
**Then** the task is created with Sarah as assignee.

---

## 6. Notes

### AC-NOTE-01: Add Note to Contact

**Given** a user is on the contact detail page for "Jane Doe",
**When** the user types "Discussed pricing options" and clicks "Save Note",
**Then** a note is created with the current user as author and appears at the top of the notes list with a timestamp.

### AC-NOTE-02: Empty Note Blocked

**Given** a user is on an entity detail page,
**When** the note text area is empty,
**Then** the "Save Note" button is disabled.

### AC-NOTE-03: Reverse Chronological Order

**Given** 3 notes exist on a contact created at 9am, 10am, and 11am,
**When** a user views the contact's notes,
**Then** the 11am note appears first, followed by 10am, then 9am.

### AC-NOTE-04: Admin Delete Note

**Given** an admin views a note authored by another user,
**When** the admin clicks "Delete" on the note and confirms,
**Then** the note is removed from the display.

### AC-NOTE-05: Non-Admin Cannot Delete

**Given** a rep views a note they authored,
**When** viewing the note,
**Then** no "Delete" button is visible.

### AC-NOTE-06: Add Note to Opportunity

**Given** a user is on the opportunity detail page for "Enterprise License",
**When** the user types "Client wants 10% discount" and clicks "Save Note",
**Then** a note is created linked to the opportunity with correct author and timestamp.

---

## 7. Dashboard

### AC-DASH-01: Pipeline Summary (Rep)

**Given** the current user owns 2 deals in "Proposal" ($30k total) and 1 deal in "Negotiation" ($50k),
**When** the user views the dashboard,
**Then** the pipeline summary shows: Proposal - 2 deals - $30,000; Negotiation - 1 deal - $50,000.

### AC-DASH-02: Pipeline Summary (Manager)

**Given** the manager's team owns deals across multiple stages,
**When** the manager views the dashboard,
**Then** the pipeline summary includes all deals from all team members.

### AC-DASH-03: My Open Tasks Widget

**Given** the user has 12 open tasks,
**When** the user views the dashboard,
**Then** the widget shows the 10 tasks with the earliest due dates, each with title, due date, and linked entity name.

### AC-DASH-04: Recently Modified Opportunities

**Given** 15 deals have been updated in the last week,
**When** the user views the dashboard,
**Then** the widget shows the 10 most recently updated deals with name, stage, value, and last updated time.

### AC-DASH-05: Activity Feed

**Given** multiple notes have been added across the user's owned entities,
**When** the user views the dashboard,
**Then** the activity feed shows the last 20 notes with author name, entity name, and timestamp.

### AC-DASH-06: Empty State

**Given** a new user with no data,
**When** the user views the dashboard,
**Then** each widget shows a helpful empty state message (e.g., "No deals yet. Create your first deal.").

### AC-DASH-07: Load Time

**Given** the database contains 10,000 contacts, 5,000 deals, and 50,000 notes,
**When** a user loads the dashboard,
**Then** the page is fully rendered within 2 seconds.

---

## 8. Cross-Cutting

### AC-CROSS-01: Unauthorized API Access

**Given** a user sends an API request without a valid JWT,
**When** the server processes the request,
**Then** the server returns HTTP 401 with body `{"error": "Unauthorized"}`.

### AC-CROSS-02: Forbidden Action

**Given** a rep attempts to delete a contact (admin-only action),
**When** the API request is processed,
**Then** the server returns HTTP 403 with body `{"error": "Forbidden"}`.

### AC-CROSS-03: Pagination

**Given** 100 contacts exist,
**When** a user requests `/api/contacts?page=2&limit=25`,
**Then** the response contains contacts 26-50, total count 100, and pagination metadata.

### AC-CROSS-04: Optimistic Locking

**Given** two users load the same contact at the same time,
**When** user A saves first, then user B saves,
**Then** user B receives HTTP 409 with "This record was modified. Please reload and try again."

### AC-CROSS-05: Soft Delete Exclusion

**Given** a contact has been soft-deleted,
**When** any user searches or lists contacts,
**Then** the soft-deleted contact does not appear in results.
