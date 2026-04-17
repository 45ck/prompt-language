# Acceptance Criteria

## Authentication

### AC-01: User Registration
- **Given** an unregistered user on the registration page,
- **When** they submit a valid name, email, and password (8+ characters),
- **Then** the system creates an account with the "Rep" role, logs the user in, and redirects to the dashboard.

### AC-02: Duplicate Email Registration
- **Given** a user attempts to register with an email that already exists,
- **When** they submit the registration form,
- **Then** the system displays an error "An account with this email already exists" and does not create a duplicate account.

### AC-03: User Login
- **Given** a registered user on the login page,
- **When** they submit valid email and password,
- **Then** the system authenticates them and redirects to the dashboard.

### AC-04: Invalid Login
- **Given** a user on the login page,
- **When** they submit an incorrect email or password,
- **Then** the system displays "Invalid email or password" without revealing which field is wrong.

### AC-05: Session Expiry
- **Given** an authenticated user whose session has been inactive for 24 hours,
- **When** they attempt to access any page,
- **Then** the system redirects them to the login page.

### AC-06: Unauthenticated Access
- **Given** an unauthenticated visitor,
- **When** they attempt to access any page other than login or register,
- **Then** the system redirects them to the login page.

---

## Contacts

### AC-07: Create Contact
- **Given** an authenticated user on the "New Contact" form,
- **When** they enter a first name, last name, and email, then click "Save",
- **Then** the system creates the contact and redirects to the contact detail page showing the entered data.

### AC-08: Edit Contact
- **Given** an authenticated user viewing a contact detail page,
- **When** they click "Edit", change the phone number, and click "Save",
- **Then** the contact record is updated and the detail page shows the new phone number.

### AC-09: Delete Contact
- **Given** an authenticated user viewing a contact detail page,
- **When** they click "Delete" and confirm the dialog,
- **Then** the contact is removed from the system and the user is redirected to the contacts list.

### AC-10: Search Contacts
- **Given** an authenticated user on the contacts list with 50 contacts,
- **When** they type "smith" in the search bar,
- **Then** the list filters to show only contacts whose name, email, or company name contains "smith" (case-insensitive).

### AC-11: Contact Validation
- **Given** an authenticated user on the "New Contact" form,
- **When** they submit the form with an empty last name,
- **Then** the system displays a validation error on the last name field and does not create the contact.

---

## Companies

### AC-12: Create Company
- **Given** an authenticated user on the "New Company" form,
- **When** they enter a company name and click "Save",
- **Then** the system creates the company and redirects to the company detail page.

### AC-13: Company Detail Shows Linked Entities
- **Given** a company with 3 linked contacts and 2 linked opportunities,
- **When** a user views the company detail page,
- **Then** the page displays the company information, a list of 3 contacts, and a list of 2 opportunities.

### AC-14: Edit Company
- **Given** an authenticated user viewing a company detail page,
- **When** they click "Edit", change the industry, and click "Save",
- **Then** the company record is updated and the detail page reflects the change.

---

## Opportunities

### AC-15: Create Opportunity
- **Given** an authenticated user on the "New Opportunity" form,
- **When** they enter a title, value, expected close date, and select a stage, then click "Save",
- **Then** the system creates the opportunity with the current user as owner and it appears on the pipeline board in the selected stage.

### AC-16: Drag-and-Drop Stage Change
- **Given** an authenticated user viewing the pipeline board with an opportunity in "Lead" stage,
- **When** they drag the opportunity card to the "Qualified" column and drop it,
- **Then** the opportunity's stage updates to "Qualified" and the card remains in the new column after page refresh.

### AC-17: Edit Opportunity via Detail Page
- **Given** an authenticated user viewing an opportunity detail page,
- **When** they change the stage via the dropdown and click "Save",
- **Then** the opportunity's stage is updated and the change is reflected on the pipeline board.

### AC-18: Opportunity List View
- **Given** an authenticated user on the opportunities list,
- **When** they sort by value descending,
- **Then** the list displays opportunities ordered from highest to lowest value.

### AC-19: Delete Opportunity
- **Given** an authenticated user viewing an opportunity detail page,
- **When** they click "Delete" and confirm,
- **Then** the opportunity is removed from the board and the list.

---

## Pipeline Stages

### AC-20: Default Stages
- **Given** a fresh installation,
- **When** an admin views the pipeline board,
- **Then** the board displays six columns: Lead, Qualified, Proposal, Negotiation, Closed Won, Closed Lost.

### AC-21: Add Stage
- **Given** an admin on the Pipeline Stages settings page,
- **When** they add a new stage named "Discovery" and save,
- **Then** the stage appears on the pipeline board in the specified position.

### AC-22: Rename Stage
- **Given** an admin on the Pipeline Stages settings page,
- **When** they rename "Lead" to "New Lead" and save,
- **Then** the board column header reads "New Lead" and existing opportunities in that stage are preserved.

### AC-23: Archive Stage
- **Given** an admin archiving a stage that contains 2 opportunities,
- **When** they archive the stage and save,
- **Then** the stage column is hidden from the board, but the 2 opportunities retain their stage value and are accessible via list view.

### AC-24: Non-Admin Stage Access
- **Given** a user with the "Rep" role,
- **When** they attempt to access the Pipeline Stages settings page,
- **Then** the system returns a 403 Forbidden response or redirects to the dashboard.

---

## Tasks

### AC-25: Create Task
- **Given** an authenticated user,
- **When** they create a task with title "Follow up", due date tomorrow, and priority "high",
- **Then** the task is created with status "open" and appears in the task list.

### AC-26: Complete Task
- **Given** an authenticated user viewing an open task,
- **When** they click the "Complete" checkbox,
- **Then** the task status changes to "completed" and it no longer appears in the "open tasks" dashboard widget.

### AC-27: Task Linked to Contact
- **Given** a task linked to contact "Jane Doe",
- **When** a user views Jane Doe's contact detail page,
- **Then** the task appears in the Tasks section of that page.

### AC-28: Filter Tasks by Due Date
- **Given** an authenticated user on the tasks list with tasks due on various dates,
- **When** they filter by "overdue",
- **Then** the list shows only tasks with a due date before today and status "open".

---

## Notes

### AC-29: Add Note
- **Given** an authenticated user on a contact detail page,
- **When** they type "Discussed pricing" in the note field and click "Add Note",
- **Then** the note appears at the top of the notes list with the current timestamp and the user's name.

### AC-30: Edit Own Note
- **Given** a user viewing a note they authored,
- **When** they click "Edit", change the text, and click "Save",
- **Then** the note text is updated.

### AC-31: Cannot Edit Others' Notes
- **Given** a user viewing a note authored by a different user,
- **When** they view the note,
- **Then** no "Edit" or "Delete" controls are visible for that note.

### AC-32: Delete Note with Confirmation
- **Given** a user viewing a note they authored,
- **When** they click "Delete",
- **Then** a confirmation dialog appears. On confirmation, the note is removed.

---

## Dashboard

### AC-33: Pipeline Summary Widget
- **Given** an authenticated user with 5 opportunities across 3 stages,
- **When** they view the dashboard,
- **Then** the pipeline summary shows the count and total value for each stage that contains opportunities.

### AC-34: Overdue Tasks Widget
- **Given** an authenticated user with 2 tasks past their due date,
- **When** they view the dashboard,
- **Then** the overdue tasks widget lists those 2 tasks with their titles and due dates.

### AC-35: My Open Tasks Widget
- **Given** an authenticated user assigned to 3 open tasks,
- **When** they view the dashboard,
- **Then** the "My Open Tasks" widget shows exactly those 3 tasks.

### AC-36: Recently Updated Opportunities Widget
- **Given** 10 opportunities where 4 were updated in the last 7 days,
- **When** a user views the dashboard,
- **Then** the recent opportunities widget shows those 4 opportunities sorted by most recently updated.

### AC-37: Dashboard Item Navigation
- **Given** a user viewing the dashboard,
- **When** they click on an opportunity in the pipeline summary,
- **Then** the system navigates to that opportunity's detail page.

---

## Role-Based Access Control

### AC-38: Rep Cannot Access User Management
- **Given** a user with the "Rep" role,
- **When** they attempt to access the user management settings,
- **Then** the system denies access with a 403 response.

### AC-39: Admin Can Change User Role
- **Given** an admin on the user management page,
- **When** they change a user's role from "Rep" to "Manager" and save,
- **Then** the user's role is updated and takes effect on their next request.

### AC-40: Admin Can Deactivate User
- **Given** an admin deactivating a user account,
- **When** the deactivated user attempts to log in,
- **Then** the system rejects the login with "Invalid email or password".
