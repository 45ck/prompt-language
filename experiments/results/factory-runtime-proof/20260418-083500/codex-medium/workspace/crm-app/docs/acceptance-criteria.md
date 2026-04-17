# Acceptance Criteria: Bounded CRM MVP

Acceptance criteria are written to be testable and deliberately narrow. Any behavior not listed here should be treated as outside MVP unless explicitly added through re-scoping.

## Authentication and workspace boundary
- AC-AUTH-1: Unauthenticated users are redirected to sign-in when attempting to access any CRM page.
- AC-AUTH-2: Authenticated users can sign out and lose access to protected CRM pages until they sign in again.
- AC-AUTH-3: A user cannot read, create, update, or delete records outside their organization/workspace.

## Companies
- AC-COMP-1: A user can create a company with a required name.
- AC-COMP-2: A user can edit an existing company and the updated values persist on refresh.
- AC-COMP-3: A company detail page shows the company plus linked contacts, opportunities, tasks, and notes.
- AC-COMP-4: Company list search returns case-insensitive substring matches by company name within the current workspace.
- AC-COMP-5: A user can delete a company only after explicit confirmation and only when the company has no linked contacts, opportunities, tasks, or notes.
- AC-COMP-6: After deletion, the company no longer appears in default company list results.
- AC-COMP-7: If a company has any linked contacts, opportunities, tasks, or notes, the system prevents deletion and explains that the record must be unlinked or cleaned up first.

## Contacts
- AC-CONT-1: A user can create a contact when at least one of `name` or `email` is provided.
- AC-CONT-2: A contact can be created without a company and linked later.
- AC-CONT-3: A user can update a contact’s associated company.
- AC-CONT-4: A contact detail page shows the contact plus linked tasks and notes.
- AC-CONT-5: Contact list search returns case-insensitive substring matches by contact name or email within the current workspace.
- AC-CONT-6: A user can delete a contact only after explicit confirmation and only when the contact has no linked tasks or notes and is not set as the primary contact on any opportunity.
- AC-CONT-7: If a contact has linked tasks/notes or is set as a primary contact on an opportunity, the system prevents deletion and explains what must be changed first.

## Opportunities and pipeline stages
- AC-OPP-1: A user can create an opportunity only when `name`, `company`, and `stage` are provided.
- AC-OPP-2: Opportunity stage must be one of the fixed MVP pipeline stages: `New`, `Qualified`, `Proposal`, `Negotiation`, `Closed Won`, `Closed Lost`.
- AC-OPP-3: A user can optionally set amount, expected close date, and primary contact on an opportunity.
- AC-OPP-4: Opportunity list filtering by stage returns only opportunities in the selected stage.
- AC-OPP-5: When a user changes an opportunity stage, the new stage persists and is reflected in stage-filtered lists.
- AC-OPP-6: Opportunity detail shows linked company, optional primary contact, linked tasks, and linked notes.
- AC-OPP-7: A user can delete an opportunity only after explicit confirmation and only when the opportunity has no linked tasks or notes.
- AC-OPP-8: A deleted opportunity no longer contributes to default list results or dashboard stage counts.
- AC-OPP-9: If an opportunity has linked tasks or notes, the system prevents deletion and explains what must be changed first.

## Tasks
- AC-TASK-1: A user can create a task with a required title and optional due date.
- AC-TASK-2: A task can be linked to a company, contact, opportunity, or any valid combination of those records.
- AC-TASK-3: A task can be marked completed and later appears as completed in task views.
- AC-TASK-4: Open-task filters exclude completed tasks.
- AC-TASK-5: Overdue-task filters include only tasks where `dueDate` is before today and status is not completed.
- AC-TASK-6: Tasks without a due date never appear in overdue or upcoming groups.
- AC-TASK-7: Upcoming-task groups include only tasks where `dueDate` is today or within the next 7 days and status is not completed.

## Notes
- AC-NOTE-1: A user can add a note with required content to a company, contact, or opportunity.
- AC-NOTE-2: New notes appear on the associated record after save without requiring manual reconstruction of the page state.
- AC-NOTE-3: Notes are ordered newest first on the associated record.
- AC-NOTE-4: Notes are timestamped and attributable to the current workspace.

## Dashboard
- AC-DASH-1: Dashboard shows counts of active opportunities grouped by stage.
- AC-DASH-2: Dashboard shows overdue open tasks.
- AC-DASH-3: Dashboard shows upcoming open tasks.
- AC-DASH-4: Dashboard shows recent activity drawn from note creation, task creation/completion, and opportunity stage changes.
- AC-DASH-5: Each recent activity entry includes a timestamp and a reference or link to the related record.

## Scope protection
- AC-SCOPE-1: The MVP does not expose email sync, calendar sync, notifications, automations, attachments, import/export, custom objects, or external integrations.
- AC-SCOPE-2: The MVP does not require any configuration beyond the bounded workspace and fixed pipeline stages to begin core usage.
