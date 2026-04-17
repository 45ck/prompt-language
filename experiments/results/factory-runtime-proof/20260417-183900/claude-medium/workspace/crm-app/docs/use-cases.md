# Use Cases

## UC-01: Manage Contacts

| Field | Detail |
|-------|--------|
| Actor | Sales Rep (P1), Service Agent (P3) |
| Precondition | User is authenticated and belongs to an organization. |
| Acceptance Criteria | AC-01, AC-02, AC-18 |

**Main Flow**
1. User navigates to the Contacts list.
2. User clicks "Add Contact" and fills in first name, last name, email, phone, and optionally selects a company.
3. System validates required fields (first name, last name) and saves the contact.
4. Contact appears in the list and is owned by the creating user.

**Postcondition** — Contact record exists in the database, linked to the user's organization.

---

## UC-02: View Contact Detail

| Field | Detail |
|-------|--------|
| Actor | Sales Rep (P1), Service Agent (P3) |
| Precondition | At least one contact exists in the user's organization. |
| Acceptance Criteria | AC-03 |

**Main Flow**
1. User clicks a contact from the list or searches by name/email.
2. System displays the contact detail page showing: basic info, linked company, recent notes, linked opportunities, and open tasks.
3. User can navigate to linked entities from this page.

**Postcondition** — No data change; read-only view rendered.

---

## UC-03: Manage Opportunities and Pipeline

| Field | Detail |
|-------|--------|
| Actor | Sales Rep (P1) |
| Precondition | At least one pipeline stage is configured. Contact or company exists. |
| Acceptance Criteria | AC-04, AC-05 |

**Main Flow**
1. User creates a new opportunity: title, value, expected close date, linked contact/company, initial stage.
2. System saves the opportunity in the selected stage.
3. User drags the opportunity to a new stage (or selects from a dropdown).
4. System updates the stage and records the transition timestamp.

**Postcondition** — Opportunity reflects the new stage; pipeline view updates.

---

## UC-04: Create and Complete Tasks

| Field | Detail |
|-------|--------|
| Actor | Sales Rep (P1), Service Agent (P3) |
| Precondition | User is authenticated. |
| Acceptance Criteria | AC-06, AC-07 |

**Main Flow**
1. User creates a task: title, optional description, due date, and optionally links it to a contact, company, or opportunity.
2. System saves the task assigned to the creating user.
3. User marks the task as completed.
4. System records the completion timestamp.

**Postcondition** — Task is marked complete and no longer appears in overdue lists.

---

## UC-05: Add Notes

| Field | Detail |
|-------|--------|
| Actor | Sales Rep (P1), Service Agent (P3) |
| Precondition | Target entity (contact, company, or opportunity) exists. |
| Acceptance Criteria | AC-08, AC-17 |

**Main Flow**
1. User opens a contact, company, or opportunity detail page.
2. User types a note in the notes section and submits.
3. System saves the note with author and timestamp.
4. Note appears in the entity's activity feed, most recent first.

**Postcondition** — Note is persisted and visible to all org members viewing that entity.

---

## UC-06: View Dashboard

| Field | Detail |
|-------|--------|
| Actor | Sales Manager (P2), Sales Rep (P1) |
| Precondition | User is authenticated. At least one opportunity exists. |
| Acceptance Criteria | AC-09, AC-10, AC-16 |

**Main Flow**
1. User navigates to the Dashboard.
2. System displays: pipeline summary (value per stage), count of open opportunities, overdue tasks (team-wide for managers, personal for reps), and recent activity.
3. User clicks a pipeline stage to filter opportunities in that stage.

**Postcondition** — No data change; summary view rendered.

---

## UC-07: Search Contacts

| Field | Detail |
|-------|--------|
| Actor | Service Agent (P3) |
| Precondition | Contacts exist in the organization. |
| Acceptance Criteria | AC-11 |

**Main Flow**
1. User types a query in the search bar (name, email, or company name).
2. System returns matching contacts within the user's organization, ranked by relevance.
3. User selects a result to open the contact detail page.

**Postcondition** — No data change; search results displayed.

---

## UC-08: Manage Users and Roles

| Field | Detail |
|-------|--------|
| Actor | Admin (P4) |
| Precondition | User has the Admin role. |
| Acceptance Criteria | AC-12, AC-13 |

**Main Flow**
1. Admin navigates to Settings > Team.
2. Admin clicks "Invite User", enters email and selects a role.
3. System sends an invitation (or creates the account directly for MVP).
4. Admin can change a user's role or deactivate their account.

**Postcondition** — New user can log in with the assigned role; deactivated users cannot.

---

## UC-09: Configure Pipeline Stages

| Field | Detail |
|-------|--------|
| Actor | Admin (P4) |
| Precondition | User has the Admin role. |
| Acceptance Criteria | AC-14 |

**Main Flow**
1. Admin navigates to Settings > Pipeline.
2. Admin adds a new stage with a name, reorders stages via drag or position input, or removes an unused stage.
3. System validates that no opportunities are in a stage being removed.
4. System saves the updated stage configuration.

**Postcondition** — Pipeline board reflects the new stage configuration for all users.

---

## UC-10: Authenticate

| Field | Detail |
|-------|--------|
| Actor | Any user |
| Precondition | User has been invited/registered. |
| Acceptance Criteria | AC-15 |

**Main Flow**
1. User navigates to the login page.
2. User enters email and password.
3. System validates credentials, creates a session.
4. User is redirected to the Dashboard.

**Alternative Flow — Invalid Credentials**
3a. System displays a generic error ("Invalid email or password") without revealing which field is wrong.
3b. User retries.

**Postcondition** — Authenticated session established; user sees only their organization's data.
