# Use Cases

## UC-01: User Login

**Actor:** Any user (Rep, Manager, Admin, Service Agent)
**Precondition:** User has an active account.

**Main Flow:**

1. User navigates to the login page.
2. User enters email and password (or clicks "Sign in with Google").
3. System validates credentials.
4. System creates a session and issues a JWT.
5. System redirects to the dashboard.

**Alternate Flows:**

- **A1 -- Invalid credentials:** System displays "Invalid email or password." User remains on login page.
- **A2 -- Deactivated account:** System displays "Your account has been deactivated. Contact your administrator."
- **A3 -- OAuth first login:** System creates a new user record with default Rep role, then redirects to dashboard.

**Postcondition:** User is authenticated and viewing their dashboard.

---

## UC-02: Sign Up (Email/Password)

**Actor:** New user with an invitation link.
**Precondition:** Admin has sent an invitation email containing a signup token.

**Main Flow:**

1. User clicks the invitation link.
2. System validates the token and displays the registration form.
3. User enters first name, last name, password, and confirms password.
4. System creates the user account with the role specified in the invitation.
5. System logs the user in and redirects to the dashboard.

**Alternate Flows:**

- **A1 -- Expired/invalid token:** System displays "This invitation has expired. Ask your admin for a new one."
- **A2 -- Password too weak:** System displays password requirements. User corrects and resubmits.

**Postcondition:** User account exists and is active. User is logged in.

---

## UC-03: Create Contact

**Actor:** Rep, Manager, Service Agent
**Precondition:** User is logged in.

**Main Flow:**

1. User clicks "New Contact" from the contacts list or a company detail page.
2. System displays the contact form.
3. User fills in required fields (first name, last name) and optional fields (email, phone, job title, company).
4. User clicks "Save."
5. System validates input, creates the contact record, sets the logged-in user as owner.
6. System redirects to the new contact's detail page.

**Alternate Flows:**

- **A1 -- Validation failure:** System highlights invalid fields (e.g., malformed email). User corrects and resubmits.
- **A2 -- Duplicate email warning:** System displays a warning that a contact with this email already exists. User can proceed or cancel.

**Postcondition:** Contact record exists in the database with correct owner and optional company association.

---

## UC-04: Edit Contact

**Actor:** Rep (own contacts), Manager (team contacts), Admin (all contacts)
**Precondition:** Contact exists. User has permission to edit.

**Main Flow:**

1. User opens the contact detail page.
2. User clicks "Edit."
3. System displays the edit form pre-filled with current values.
4. User modifies fields and clicks "Save."
5. System validates and updates the record.

**Alternate Flows:**

- **A1 -- Permission denied:** User sees a read-only view with no edit button.
- **A2 -- Concurrent edit:** System uses optimistic locking (updatedAt check). If conflict, user is prompted to reload.

**Postcondition:** Contact record is updated. updatedAt timestamp is refreshed.

---

## UC-05: Search Contacts

**Actor:** Any logged-in user
**Precondition:** User is on the contacts list page.

**Main Flow:**

1. User types a query into the search bar.
2. System filters contacts by first name, last name, or email (case-insensitive, partial match).
3. Results update as the user types (debounced, 300ms).

**Alternate Flows:**

- **A1 -- No results:** System displays "No contacts found."

**Postcondition:** Contact list shows only matching records.

---

## UC-06: Create Company

**Actor:** Rep, Manager
**Precondition:** User is logged in.

**Main Flow:**

1. User clicks "New Company."
2. System displays the company form.
3. User fills in required fields (name) and optional fields (domain, industry, phone, address).
4. User clicks "Save."
5. System creates the company record with the logged-in user as owner.
6. System redirects to the company detail page.

**Alternate Flows:**

- **A1 -- Validation failure:** System highlights invalid fields. User corrects.

**Postcondition:** Company record exists. Company detail page shows empty contact and opportunity lists.

---

## UC-07: View Company Detail

**Actor:** Any logged-in user
**Precondition:** Company exists.

**Main Flow:**

1. User navigates to the company detail page (via list, search, or link from contact/opportunity).
2. System displays company info, linked contacts, linked opportunities, and notes.

**Postcondition:** User sees a consolidated view of all data associated with the company.

---

## UC-08: Create Opportunity

**Actor:** Rep, Manager
**Precondition:** User is logged in. At least one pipeline stage exists.

**Main Flow:**

1. User clicks "New Deal" from the pipeline board, contact page, or company page.
2. System displays the opportunity form.
3. User fills in: name, value, expected close date, stage (dropdown), contact (optional), company (optional).
4. User clicks "Save."
5. System creates the opportunity with the logged-in user as owner.
6. System redirects to the pipeline board with the new deal visible in the correct stage column.

**Alternate Flows:**

- **A1 -- No stages configured:** System displays "Ask your admin to configure pipeline stages." The form is not shown.

**Postcondition:** Opportunity record exists with correct stage, owner, and associations.

---

## UC-09: Move Opportunity Between Stages (Kanban)

**Actor:** Rep (own deals), Manager (all deals)
**Precondition:** Opportunity exists. Pipeline board is displayed.

**Main Flow:**

1. User drags an opportunity card from one stage column to another.
2. System updates the opportunity's stage.
3. System confirms the move with a brief visual indicator.

**Alternate Flows:**

- **A1 -- Drop on same stage:** No change; system does nothing.
- **A2 -- Archived stage target:** Drop is rejected; card snaps back.

**Postcondition:** Opportunity stage is updated. updatedAt is refreshed.

---

## UC-10: Configure Pipeline Stages

**Actor:** Admin
**Precondition:** User is logged in with Admin role.

**Main Flow:**

1. Admin navigates to Settings > Pipeline Stages.
2. System displays the ordered list of stages.
3. Admin can:
   a. Add a new stage (enter name, it appears at the end).
   b. Rename a stage (inline edit).
   c. Reorder stages (drag-and-drop).
   d. Archive a stage (toggle; deals remain but stage is hidden from the board).
4. Changes save on each action (no separate "Save" button).

**Alternate Flows:**

- **A1 -- Archive stage with active deals:** System displays a count of affected deals and confirms.
- **A2 -- Non-admin access:** Settings page is not visible in navigation.

**Postcondition:** Pipeline stages are updated. The Kanban board reflects the new order.

---

## UC-11: Create Task

**Actor:** Rep, Manager, Service Agent
**Precondition:** User is logged in.

**Main Flow:**

1. User clicks "New Task" from the tasks page or from a contact/company/opportunity detail page.
2. System displays the task form.
3. User fills in: title, description (optional), due date, priority (low/medium/high), assignee (defaults to self).
4. If created from an entity page, the linked entity is pre-filled.
5. User clicks "Save."
6. System creates the task.

**Alternate Flows:**

- **A1 -- No due date:** System allows it but displays a warning: "Tasks without due dates won't appear in the dashboard."

**Postcondition:** Task exists with correct assignee and optional entity link.

---

## UC-12: Complete Task

**Actor:** Task assignee, Manager, Admin
**Precondition:** Task exists with status "open."

**Main Flow:**

1. User clicks the checkbox next to the task (from task list or entity detail page).
2. System sets status to "completed" and records the completion timestamp.

**Alternate Flows:**

- **A1 -- Reopen:** User unchecks the box. System sets status back to "open."

**Postcondition:** Task status is updated.

---

## UC-13: Add Note

**Actor:** Rep, Manager, Service Agent
**Precondition:** User is logged in. Entity (contact, company, or opportunity) exists.

**Main Flow:**

1. User navigates to the entity detail page.
2. User types in the "Add a note" text area.
3. User clicks "Save Note."
4. System creates the note with the current user as author and current timestamp.
5. Note appears at the top of the notes list.

**Alternate Flows:**

- **A1 -- Empty body:** Save button is disabled.

**Postcondition:** Note is persisted and visible on the entity detail page.

---

## UC-14: View Dashboard

**Actor:** Rep, Manager
**Precondition:** User is logged in.

**Main Flow:**

1. User navigates to the dashboard (default landing page after login).
2. System loads four widgets:
   a. **Pipeline summary:** Stage names, deal counts, and total values. Reps see own deals; Managers see all.
   b. **My open tasks:** Up to 10 tasks due soonest, with links to the task or linked entity.
   c. **Recently modified opportunities:** Last 10 deals updated, with stage and value.
   d. **Activity feed:** Last 20 notes the user authored or that were added to entities they own.

**Alternate Flows:**

- **A1 -- No data yet:** Each widget shows an appropriate empty state message (e.g., "No deals yet. Create your first deal.").

**Postcondition:** User sees an up-to-date summary of their (or their team's) CRM activity.

---

## UC-15: Manage Users (Admin)

**Actor:** Admin
**Precondition:** User is logged in with Admin role.

**Main Flow:**

1. Admin navigates to Settings > Users.
2. System displays a list of all users with name, email, role, and status.
3. Admin can:
   a. Invite a new user (enter email, select role).
   b. Change a user's role.
   c. Deactivate a user (data is preserved, login is blocked).
   d. Reactivate a previously deactivated user.

**Alternate Flows:**

- **A1 -- Invite existing email:** System displays "A user with this email already exists."
- **A2 -- Admin deactivates self:** System prevents this action.

**Postcondition:** User list reflects changes. Deactivated users cannot log in.

---

## UC-16: Delete Contact

**Actor:** Admin
**Precondition:** Contact exists. User has Admin role.

**Main Flow:**

1. Admin opens the contact detail page.
2. Admin clicks "Delete" and confirms in the dialog.
3. System soft-deletes the contact (sets a deletedAt timestamp).
4. Contact no longer appears in search or list views.

**Alternate Flows:**

- **A1 -- Contact has linked opportunities:** System warns "This contact is linked to N deals. They will be unlinked." Admin confirms or cancels.

**Postcondition:** Contact is soft-deleted. Linked entities are updated (FK set to null).
