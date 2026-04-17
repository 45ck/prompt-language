# Use Cases

## Authentication

### UC-AUTH-01: Register a New Account

**Actor:** Unregistered user
**Precondition:** User has no existing account.
**Main Flow:**
1. User navigates to the registration page.
2. User enters name, email, and password.
3. System validates that email is not already registered and password meets minimum length (8 characters).
4. System creates the user account with "member" role.
5. System logs the user in and redirects to the dashboard.

**Postcondition:** User account exists. User is authenticated and on the dashboard.
**Alternate:** If email is already registered, system displays an error and does not create a duplicate.

### UC-AUTH-02: Log In

**Actor:** Registered user
**Precondition:** User has an existing account.
**Main Flow:**
1. User navigates to the login page.
2. User enters email and password.
3. System verifies credentials.
4. System creates a session and redirects to the dashboard.

**Postcondition:** User is authenticated.
**Alternate:** Invalid credentials display a generic error ("Invalid email or password").

### UC-AUTH-03: Reset Password

**Actor:** Registered user who forgot their password
**Precondition:** User has an existing account with a valid email.
**Main Flow:**
1. User clicks "Forgot password" on the login page.
2. User enters their email address.
3. System sends a password reset link to the email.
4. User clicks the link and enters a new password.
5. System updates the password.

**Postcondition:** User can log in with the new password.
**Alternate:** If the email is not registered, system shows a generic success message (does not reveal whether the account exists).

### UC-AUTH-04: Log Out

**Actor:** Authenticated user
**Precondition:** User is logged in.
**Main Flow:**
1. User clicks "Log out."
2. System destroys the session and redirects to the login page.

**Postcondition:** Session is invalidated.

### UC-AUTH-05: Assign User Role

**Actor:** Admin user
**Precondition:** Admin is logged in. Target user account exists.
**Main Flow:**
1. Admin navigates to user management.
2. Admin selects a user and changes their role (admin or member).
3. System updates the user's role.

**Postcondition:** Target user's role is updated. Permission changes take effect on their next request.
**Alternate:** If a non-admin attempts this action, the system returns 403 Forbidden.

---

## Contacts

### UC-CON-01: Create a Contact

**Actor:** Authenticated user
**Precondition:** User is logged in.
**Main Flow:**
1. User navigates to Contacts and clicks "New Contact."
2. User enters name (required), and optionally email, phone, and company.
3. User saves the contact.
4. System creates the contact and displays the contact detail page.

**Postcondition:** Contact record exists in the database.

### UC-CON-02: Search and Browse Contacts

**Actor:** Authenticated user
**Precondition:** At least one contact exists.
**Main Flow:**
1. User navigates to the Contacts list.
2. User types a search term into the search field.
3. System filters contacts by name or email containing the search term.
4. User optionally sorts by name or created date.

**Postcondition:** Filtered list is displayed.

### UC-CON-03: View Contact Details

**Actor:** Authenticated user
**Precondition:** Contact exists.
**Main Flow:**
1. User clicks a contact in the list.
2. System displays the contact detail page with fields, linked company, notes, opportunities, and tasks.

**Postcondition:** User sees full contact context.

### UC-CON-04: Edit a Contact

**Actor:** Authenticated user
**Precondition:** Contact exists.
**Main Flow:**
1. User opens a contact detail page and clicks "Edit."
2. User modifies fields and saves.
3. System updates the record.

**Postcondition:** Contact record is updated.

### UC-CON-05: Delete a Contact

**Actor:** Authenticated user
**Precondition:** Contact exists.
**Main Flow:**
1. User clicks "Delete" on a contact.
2. System prompts for confirmation.
3. User confirms.
4. System soft-deletes the contact (sets a deleted flag; record is excluded from queries).

**Postcondition:** Contact is no longer visible in the UI but exists in the database.

---

## Companies

### UC-COM-01: Create a Company

**Actor:** Authenticated user
**Precondition:** User is logged in.
**Main Flow:**
1. User navigates to Companies and clicks "New Company."
2. User enters name (required), and optionally domain, industry, size, address.
3. User saves.
4. System creates the company record.

**Postcondition:** Company record exists.

### UC-COM-02: View Company Details

**Actor:** Authenticated user
**Precondition:** Company exists.
**Main Flow:**
1. User clicks a company in the list.
2. System displays company detail page with linked contacts, opportunities, and notes.

**Postcondition:** User sees full company context.

### UC-COM-03: Search and Browse Companies

**Actor:** Authenticated user
**Precondition:** At least one company exists.
**Main Flow:**
1. User navigates to the Companies list.
2. User types a search term into the search field.
3. System filters companies by name containing the search term.
4. User optionally sorts by name or created date.

**Postcondition:** Filtered list is displayed.

### UC-COM-04: Edit a Company

**Actor:** Authenticated user
**Precondition:** Company exists.
**Main Flow:**
1. User opens a company detail page and clicks "Edit."
2. User modifies fields and saves.
3. System updates the record.

**Postcondition:** Company record is updated.

### UC-COM-05: Delete a Company

**Actor:** Authenticated user
**Precondition:** Company exists.
**Main Flow:**
1. User clicks "Delete" on a company.
2. System prompts for confirmation.
3. User confirms.
4. System soft-deletes the company (sets a deleted flag; record is excluded from queries).

**Postcondition:** Company is no longer visible in the UI but exists in the database.

### UC-COM-06: Link a Contact to a Company

**Actor:** Authenticated user
**Precondition:** Both contact and company exist.
**Main Flow:**
1. User edits a contact and selects a company from a dropdown.
2. User saves.

**Postcondition:** Contact is linked to the company. Contact appears on the company detail page.

---

## Opportunities

### UC-OPP-01: Create an Opportunity

**Actor:** Authenticated user
**Precondition:** User is logged in. At least one pipeline stage exists.
**Main Flow:**
1. User clicks "New Opportunity."
2. User enters name, value, stage, expected close date, and optionally links a contact, company, and owner.
3. User saves.

**Postcondition:** Opportunity record exists in the selected stage.

### UC-OPP-02: Move an Opportunity Through the Pipeline

**Actor:** Authenticated user (typically sales rep)
**Precondition:** Opportunity exists on the Kanban board.
**Main Flow:**
1. User opens the Pipeline view (Kanban board).
2. User drags an opportunity card from one stage column to another.
3. System updates the opportunity's stage.

**Postcondition:** Opportunity is in the new stage.
**Alternate:** User changes stage via a dropdown on the opportunity detail page (keyboard-accessible alternative).

### UC-OPP-03: Edit an Opportunity

**Actor:** Authenticated user
**Precondition:** Opportunity exists.
**Main Flow:**
1. User opens an opportunity detail page and clicks "Edit."
2. User modifies fields (name, value, close date, contact, company, owner) and saves.
3. System updates the record.

**Postcondition:** Opportunity record is updated.

### UC-OPP-04: Delete an Opportunity

**Actor:** Authenticated user
**Precondition:** Opportunity exists.
**Main Flow:**
1. User clicks "Delete" on an opportunity.
2. System prompts for confirmation.
3. User confirms.
4. System soft-deletes the opportunity.

**Postcondition:** Opportunity is no longer visible in the UI but exists in the database.

### UC-OPP-05: Filter Opportunities

**Actor:** Authenticated user
**Precondition:** Opportunities exist.
**Main Flow:**
1. User opens the opportunity list view.
2. User selects filters: stage, owner, or both.
3. System displays matching opportunities.

**Postcondition:** Filtered list is displayed.

---

## Pipeline Stages

### UC-PIP-01: View Pipeline Kanban Board

**Actor:** Authenticated user
**Precondition:** Pipeline stages and at least one opportunity exist.
**Main Flow:**
1. User navigates to Pipeline.
2. System renders a Kanban board with columns for each stage in sort order.
3. Opportunity cards appear in their respective columns.

**Postcondition:** User sees the pipeline visually.

### UC-PIP-02: Rename a Pipeline Stage

**Actor:** Admin user
**Precondition:** User has admin role.
**Main Flow:**
1. Admin navigates to pipeline settings.
2. Admin edits a stage name and saves.
3. System updates the stage name. All opportunities in that stage reflect the new name.

**Postcondition:** Stage name is updated everywhere.

---

## Tasks

### UC-TSK-01: Create a Task

**Actor:** Authenticated user
**Precondition:** User is logged in.
**Main Flow:**
1. User clicks "New Task" (from task list or from a contact/opportunity detail page).
2. User enters title (required), description, due date, assignee.
3. If created from a record detail page, the task is automatically linked to that record.
4. User saves.

**Postcondition:** Task record exists, linked to the appropriate record if applicable.

### UC-TSK-02: Complete a Task

**Actor:** Authenticated user
**Precondition:** Task exists and is open.
**Main Flow:**
1. User clicks the checkbox or "Mark Complete" on a task.
2. System sets task status to completed.

**Postcondition:** Task is marked complete.
**Alternate:** User reopens a completed task by toggling the checkbox.

### UC-TSK-03: View My Tasks

**Actor:** Authenticated user
**Precondition:** Tasks assigned to the user exist.
**Main Flow:**
1. User navigates to the task list.
2. System shows tasks filtered to the current user by default.
3. User can switch filter to show all tasks or filter by status.

**Postcondition:** User sees their relevant tasks.

---

## Notes

### UC-NOT-01: Add a Note to a Record

**Actor:** Authenticated user
**Precondition:** A contact, company, or opportunity exists.
**Main Flow:**
1. User opens a record detail page.
2. User types a note in the notes section and clicks "Add Note."
3. System saves the note with a timestamp and the author's name.

**Postcondition:** Note appears on the record, newest first.

### UC-NOT-02: Edit Own Note

**Actor:** Authenticated user
**Precondition:** User authored the note.
**Main Flow:**
1. User clicks "Edit" on their own note.
2. User modifies the text and saves.

**Postcondition:** Note text is updated.

### UC-NOT-03: Delete Own Note

**Actor:** Authenticated user
**Precondition:** User authored the note.
**Main Flow:**
1. User clicks "Delete" on their own note.
2. System prompts for confirmation.
3. User confirms.

**Postcondition:** Note is removed.

---

## Dashboard

### UC-DSH-01: View Pipeline Summary

**Actor:** Authenticated user
**Precondition:** User is logged in.
**Main Flow:**
1. User navigates to the dashboard.
2. System displays a summary showing the count and total value of opportunities in each pipeline stage.

**Postcondition:** User sees pipeline health at a glance.

### UC-DSH-02: View Upcoming Tasks

**Actor:** Authenticated user
**Precondition:** User is logged in.
**Main Flow:**
1. On the dashboard, system displays open tasks assigned to the current user that are due within 7 days.

**Postcondition:** User sees what needs attention soon.

### UC-DSH-03: View Recent Activity

**Actor:** Authenticated user
**Precondition:** User is logged in.
**Main Flow:**
1. On the dashboard, system displays the last 20 record changes (creates, edits, stage changes) across all record types.

**Postcondition:** User sees recent team activity.

### UC-DSH-04: View Win/Loss Summary

**Actor:** Authenticated user
**Precondition:** User is logged in.
**Main Flow:**
1. On the dashboard, system displays the count of opportunities marked "Closed Won" and "Closed Lost" in the current calendar month.

**Postcondition:** User sees monthly win/loss ratio.
