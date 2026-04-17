# Use Cases

## UC-01: Register a New Account

**Actor**: Unregistered user

**Precondition**: The application is deployed and accessible. The user has no existing account.

**Main Flow**:
1. User navigates to the registration page.
2. User enters name, email, and password.
3. System validates that the email is not already registered and the password meets minimum requirements (8 characters).
4. System creates the user account with the default "Rep" role.
5. System logs the user in and redirects to the dashboard.

**Postcondition**: A new user account exists. The user is authenticated and viewing the dashboard.

**Alternate Flow**: If the email is already registered, the system displays an error message and the form retains the entered data (except password).

---

## UC-02: Log In

**Actor**: Registered user

**Precondition**: The user has an existing account.

**Main Flow**:
1. User navigates to the login page.
2. User enters email and password.
3. System authenticates credentials.
4. System creates a session and redirects to the dashboard.

**Postcondition**: The user is authenticated with an active session.

**Alternate Flow**: If credentials are invalid, the system displays a generic "Invalid email or password" message. No indication of which field is wrong.

---

## UC-03: Create and Edit a Contact

**Actor**: Sales Rep, Support Agent, Manager, Admin

**Precondition**: The user is authenticated.

**Main Flow**:
1. User navigates to the Contacts list and clicks "New Contact."
2. User enters required fields: first name, last name, email.
3. User optionally enters: phone, company (select from existing), status.
4. User clicks "Save."
5. System validates input and creates the contact record.
6. System redirects to the contact detail page.

**Edit Flow**:
1. User opens a contact detail page and clicks "Edit."
2. User modifies one or more fields.
3. User clicks "Save."
4. System validates and updates the record.

**Postcondition**: The contact record is created or updated with the provided data. Timestamps are set.

---

## UC-04: Manage Companies

**Actor**: Sales Rep, Manager, Admin

**Precondition**: The user is authenticated.

**Main Flow**:
1. User navigates to the Companies list and clicks "New Company."
2. User enters required field: company name.
3. User optionally enters: industry, website, phone, address.
4. User clicks "Save."
5. System creates the company record.

**View Detail**:
1. User clicks a company name from the list.
2. System displays company details, linked contacts, and linked opportunities.

**Postcondition**: The company record exists. Associated contacts and opportunities are visible on the detail page.

---

## UC-05: Create an Opportunity

**Actor**: Sales Rep, Manager

**Precondition**: The user is authenticated. At least one pipeline stage exists.

**Main Flow**:
1. User clicks "New Opportunity" from the pipeline board or opportunities list.
2. User enters required fields: title, value, expected close date.
3. User selects a pipeline stage (defaults to the first stage).
4. User optionally links a contact and/or company.
5. User clicks "Save."
6. System creates the opportunity and assigns the current user as owner.

**Postcondition**: The opportunity appears in the selected pipeline stage on the board view and in the list view.

---

## UC-06: Move Opportunity Through Pipeline

**Actor**: Sales Rep, Manager

**Precondition**: The user is authenticated. An opportunity exists.

**Main Flow (Drag-and-Drop)**:
1. User opens the pipeline board view.
2. User drags an opportunity card from one stage column to another.
3. System updates the opportunity's stage.
4. The board reflects the new position immediately.

**Main Flow (Detail Page)**:
1. User opens an opportunity detail page.
2. User selects a new stage from the stage dropdown.
3. User clicks "Save."
4. System updates the stage.

**Postcondition**: The opportunity's stage is updated. The updated timestamp is set.

---

## UC-07: Create and Complete a Task

**Actor**: Sales Rep, Support Agent, Manager

**Precondition**: The user is authenticated.

**Main Flow**:
1. User clicks "New Task" (from tasks list, contact detail, or opportunity detail).
2. User enters required fields: title, due date.
3. User optionally enters: description, priority, assigned user, linked contact or opportunity.
4. User clicks "Save."
5. System creates the task with status "open."

**Complete Flow**:
1. User views a task (from task list or entity detail page).
2. User clicks the "Complete" button or checkbox.
3. System sets the task status to "completed."

**Postcondition**: The task is created or marked completed. Dashboard widgets reflect the change.

---

## UC-08: Add a Note to an Entity

**Actor**: Sales Rep, Support Agent, Manager

**Precondition**: The user is authenticated. The target entity (contact, company, or opportunity) exists.

**Main Flow**:
1. User opens the detail page for a contact, company, or opportunity.
2. User scrolls to the Notes section and types in the note text field.
3. User clicks "Add Note."
4. System saves the note with the current timestamp and the authoring user.
5. The note appears at the top of the chronological notes list.

**Edit Flow**:
1. User clicks "Edit" on a note they authored.
2. User modifies the text and clicks "Save."

**Delete Flow**:
1. User clicks "Delete" on a note they authored.
2. System prompts for confirmation.
3. User confirms. System deletes the note.

**Postcondition**: The note is created, updated, or deleted. Only the author can edit or delete their own notes.

---

## UC-09: View Dashboard

**Actor**: Sales Rep, Manager

**Precondition**: The user is authenticated.

**Main Flow**:
1. User navigates to the Dashboard (default landing page after login).
2. System displays four widgets:
   - Pipeline summary: count and total value per stage.
   - Open tasks due today and overdue tasks.
   - Recently updated opportunities (last 7 days).
   - My open tasks (filtered to the current user).
3. User clicks on any item to navigate to its detail page.

**Postcondition**: The user sees current pipeline and task data. No data is modified.

---

## UC-10: Manage Pipeline Stages (Admin)

**Actor**: Admin

**Precondition**: The user is authenticated with the Admin role.

**Main Flow**:
1. Admin navigates to Settings > Pipeline Stages.
2. Admin sees the ordered list of current stages.
3. Admin can:
   - Add a new stage (enters name, system appends to the end).
   - Rename an existing stage.
   - Reorder stages via drag-and-drop or up/down controls.
   - Archive a stage (hides from board, existing opportunities remain).
4. Admin clicks "Save."
5. System updates the stage configuration.

**Postcondition**: Pipeline stages reflect the admin's changes. The board view uses the updated stage list.

---

## UC-11: Manage Users (Admin)

**Actor**: Admin

**Precondition**: The user is authenticated with the Admin role.

**Main Flow**:
1. Admin navigates to Settings > Users.
2. Admin sees the list of all users with their roles.
3. Admin can:
   - Change a user's role (Rep, Manager, Admin).
   - Deactivate a user account (prevents login, preserves data).
4. Admin clicks "Save."

**Postcondition**: The user's role or status is updated. Deactivated users cannot log in.

---

## UC-12: Search and Filter Contacts

**Actor**: Sales Rep, Support Agent, Manager, Admin

**Precondition**: The user is authenticated. Contacts exist in the system.

**Main Flow**:
1. User navigates to the Contacts list.
2. User types a search term in the search bar.
3. System filters contacts by name, email, or company name (case-insensitive partial match).
4. Results update as the user types (debounced, 300ms).
5. User can further filter by status (active/inactive) and company.

**Postcondition**: The contact list displays only matching records. Clearing the search restores the full list.
