# Acceptance criteria (Bounded CRM MVP)

Criteria are written to be testable and explicitly constrained to MVP scope: auth, contacts, companies, opportunities, pipeline stages, tasks, notes, dashboard.

## AC-AUTH: Authentication and access control
- **AC-AUTH-01:** A user can sign in and access only data within their organization.
- **AC-AUTH-02:** A user cannot read or modify another organization’s contacts/companies/opportunities/tasks/notes, even by guessing IDs.
- **AC-AUTH-03:** Signed-out users cannot access authenticated pages or APIs.

## AC-CORE: Contacts and companies
- **AC-CORE-01:** A user can create, view, edit, and delete a company.
- **AC-CORE-02:** A user can create, view, edit, and delete a contact.
- **AC-CORE-03:** A contact can be linked to a company.
- **AC-CORE-04:** Lists of contacts and companies are paginated and scoped to the organization.

## AC-OPP: Opportunities and pipeline stages
- **AC-OPP-01:** A user can create an opportunity linked to a contact and/or company.
- **AC-OPP-02:** An opportunity has exactly one pipeline stage at any time.
- **AC-OPP-03:** A user can move an opportunity to another pipeline stage.
- **AC-OPP-04:** Pipeline stages are configurable by organization (create/edit) without requiring code changes.
- **AC-OPP-05:** Opportunities list can be filtered by pipeline stage and owner.

## AC-TASK: Tasks (follow-ups)
- **AC-TASK-01:** A user can create a task with title, due date, and assignee.
- **AC-TASK-02:** A task can be marked complete and no longer appears in “overdue” lists.
- **AC-TASK-03:** Tasks list can be filtered by assignee and completion status.
- **AC-TASK-04:** Overdue tasks are identifiable via due date and completion state.

## AC-NOTE: Notes (interaction history)
- **AC-NOTE-01:** A user can add a note to a contact, company, or opportunity.
- **AC-NOTE-02:** Notes display in reverse chronological order on the parent record.
- **AC-NOTE-03:** Notes are scoped to the organization and respect permissions.

## AC-DASH: Dashboard
- **AC-DASH-01:** Dashboard shows overdue tasks for the signed-in user.
- **AC-DASH-02:** Dashboard shows a count of opportunities by pipeline stage.
- **AC-DASH-03:** From the dashboard, a user can navigate to the underlying lists/records.

## AC-SEARCH: Search
- **AC-SEARCH-01:** A user can search within the organization’s contacts, companies, and opportunities by a text query (e.g., name/email) and see paginated results.

## Explicit exclusions (to prevent feature creep)
- No email/calendar sync requirements.
- No marketing automation, quotes, invoices, payments.
- No custom workflow/automation engine.
- No advanced forecasting requirements.
