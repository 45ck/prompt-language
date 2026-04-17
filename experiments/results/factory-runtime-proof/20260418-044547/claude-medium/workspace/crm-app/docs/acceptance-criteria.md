# Acceptance Criteria

All criteria use Given/When/Then format. Scope is strictly MVP: auth, contacts, companies, opportunities, pipeline stages, tasks, notes, dashboard.

---

## 0. Multi-Tenancy (Cross-Cutting)

**AC-0.1: Tenant isolation**
Given two teams (Tenant A and Tenant B) -- When a user from Tenant A queries contacts, companies, opportunities, tasks, or notes -- Then only records belonging to Tenant A are returned. Records from Tenant B are never visible.

**AC-0.2: Cross-tenant access denied**
Given a user from Tenant A -- When they attempt to access a record ID belonging to Tenant B via direct URL or API -- Then the system returns 404 (not 403, to avoid leaking existence).

---

## 1. Authentication

**AC-1.1: Registration**
Given an unregistered user -- When they submit valid name, email, and password -- Then an account is created with "Member" role and they are redirected to the dashboard.

**AC-1.2: Duplicate email**
Given an existing account with email X -- When a new user registers with email X -- Then the system displays "An account with this email already exists" and no account is created.

**AC-1.3: Password strength**
Given a user registering -- When password is < 8 chars or missing a letter or number -- Then a validation error is shown and the form is not submitted.

**AC-1.4: Login**
Given a registered user -- When they enter correct credentials -- Then a JWT session is issued and they are redirected to the dashboard.

**AC-1.5: Invalid login**
Given a user -- When they enter incorrect credentials -- Then "Invalid email or password" is displayed and no session is created.

**AC-1.6: Logout**
Given an authenticated user -- When they click "Logout" -- Then the session is invalidated and they are redirected to the login page.

**AC-1.7: Password reset**
Given a registered user -- When they request a password reset -- Then a link valid for 1 hour is emailed. After clicking and entering a valid new password, the password is updated.

---

## 2. Contacts

**AC-2.1: Create contact**
Given an authenticated user -- When they submit first name and last name (required) with optional email, phone, job title, company -- Then the contact is saved and the detail page is shown.

**AC-2.2: Required fields**
Given a user on the Add Contact form -- When they omit first name or last name -- Then validation errors appear and the contact is not created.

**AC-2.3: List and search**
Given contacts exist -- When a user views the Contacts page -- Then contacts are shown in a paginated table (25/page). Typing in search filters by name, email, or company (case-insensitive).

**AC-2.4: Update**
Given an authenticated user on a contact detail page -- When they edit and save -- Then the record is updated.

**AC-2.5: Delete**
Given an authenticated user -- When they delete a contact and confirm -- Then the contact, its notes, and its linked tasks are removed. Linked opportunities have their contact field set to null. The user is redirected to the list.

**AC-2.6: Link to company**
Given a user creating or editing a contact -- When they select a company -- Then the contact is linked and appears on the company detail page.

---

## 3. Companies

**AC-3.1: Create company**
Given an authenticated user -- When they submit a company name (required) with optional fields -- Then the company is saved and the detail page is shown.

**AC-3.2: Detail view**
Given a company exists -- When a user views its detail page -- Then company info, linked contacts, linked opportunities, and notes are displayed.

**AC-3.3: Update**
Given an authenticated user -- When they edit company fields and save -- Then the record is updated.

**AC-3.4: Delete**
Given a company with linked contacts and opportunities -- When an admin deletes it and confirms -- Then the company, its notes, and its linked tasks are deleted. Linked contacts and opportunities have their company field set to null.

**AC-3.5: Search**
Given companies exist -- When a user searches by name or industry -- Then only matching companies are shown (case-insensitive).

---

## 4. Opportunities

**AC-4.1: Create opportunity**
Given an authenticated user -- When they enter name, value (>= 0), close date, and stage -- Then the opportunity is saved with the current user as owner and appears on the Kanban board.

**AC-4.2: Value validation**
Given a user creating an opportunity -- When they enter a negative value -- Then "Value must be zero or greater" is displayed and the record is not created.

**AC-4.3: Kanban drag-and-drop**
Given an opportunity on the Kanban board -- When a user drags it to another stage -- Then the stage is updated immediately without page reload.

**AC-4.4: Filter**
Given opportunities exist -- When a user filters by stage, owner, or close date range -- Then only matching opportunities are shown.

**AC-4.5: Update / Delete**
Given an authenticated user -- When they update opportunity fields, the record is saved (stage changes reflect on the board). When they delete and confirm, the opportunity and its notes are removed.

---

## 5. Pipeline Stages

**AC-5.1: Default stages**
Given a fresh deployment -- When an admin views pipeline settings -- Then these stages exist in order: Lead, Qualified, Proposal, Negotiation, Closed Won, Closed Lost.

**AC-5.2: Add / rename / reorder**
Given an admin -- When they add, rename, or reorder stages -- Then the Kanban board reflects the changes.

**AC-5.3: Delete empty stage**
Given a stage with zero opportunities -- When an admin deletes it -- Then it is removed from settings and the Kanban board.

**AC-5.4: Cannot delete stage with opportunities**
Given a stage with N > 0 opportunities -- When an admin tries to delete it -- Then the system shows an error with the count and the stage is not deleted.

**AC-5.5: Members cannot manage stages**
Given a user with "Member" role -- When they view settings -- Then pipeline stage management controls are not visible.

---

## 6. Tasks

**AC-6.1: Create task**
Given an authenticated user -- When they enter title, due date, and priority -- Then a task is saved with status "open". Optional: assignee, linked entity.

**AC-6.2: Create from entity page**
Given a user on a contact/company/opportunity detail page -- When they add a task -- Then it is linked to that entity and appears in its task section.

**AC-6.3: Complete task**
Given an open task -- When a user clicks "Mark Complete" -- Then status changes to "completed" with a timestamp.

**AC-6.4: Overdue indicator**
Given an open task with a past due date -- When displayed in the task list -- Then it is visually highlighted as overdue.

**AC-6.5: Filter**
Given tasks exist -- When a user filters by status, priority, assignee, or due date range -- Then only matching tasks are shown.

**AC-6.6: Update / Delete**
Given a task -- When a user edits and saves, the record is updated. When they delete and confirm, the task is removed.

---

## 7. Notes

**AC-7.1: Add note**
Given a user on a contact/company/opportunity detail page -- When they enter text and click "Add Note" -- Then the note is saved with author and timestamp and appears at the top of the feed.

**AC-7.2: Chronological order**
Given multiple notes on an entity -- When displayed -- Then they are in reverse chronological order showing author and timestamp.

**AC-7.3: Edit own note**
Given a user viewing their own note -- When they edit and save -- Then the note is updated with an "edited" indicator.

**AC-7.4: Delete own note**
Given a user viewing their own note -- When they delete and confirm -- Then the note is removed.

**AC-7.5: Cannot modify others' notes**
Given a Member viewing another user's note -- Then no Edit or Delete controls are visible.

**AC-7.6: Admin delete any note**
Given an Admin viewing any note -- When they delete and confirm -- Then the note is removed.

---

## 8. Dashboard

**AC-8.1: Summary counts**
Given an authenticated user on the dashboard -- When the page loads -- Then total contacts, companies, and open opportunities are displayed.

**AC-8.2: Pipeline chart**
Given opportunities in multiple stages -- When the dashboard loads -- Then a bar chart shows total value by stage.

**AC-8.3: Upcoming tasks**
Given open tasks assigned to the user due within 7 days -- When the dashboard loads -- Then those tasks are shown sorted by due date with title, date, and priority.

**AC-8.4: Recent contacts**
Given contacts exist -- When the dashboard loads -- Then the 5 most recently created contacts are shown with name and creation date.

**AC-8.5: Win/loss count**
Given the dashboard loads -- Then it shows the count of opportunities moved to "Closed Won" and "Closed Lost" in the current calendar month.

**AC-8.6: Empty state**
Given no data in the system -- When a user views the dashboard -- Then each section shows a zero-state message with a call-to-action (e.g., "No contacts yet. Add your first contact.").
