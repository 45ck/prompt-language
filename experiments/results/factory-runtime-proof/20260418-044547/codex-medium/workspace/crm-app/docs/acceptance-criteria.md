# Acceptance criteria (bounded CRM MVP)

These acceptance criteria are designed to be testable and aligned to the MVP scope only.

## Authentication
AC-AUTH-01: A user can sign in and sign out successfully.  
AC-AUTH-02: An unauthenticated user cannot access protected pages or API endpoints (receives redirect or 401/403 as appropriate).  
AC-AUTH-03: A user cannot access another organization’s data by guessing IDs (requests return 404 or 403).

## Contacts
AC-CONTACT-01: A user can create a contact with required fields and see it in the contacts list.  
AC-CONTACT-02: A user can edit an existing contact and the changes persist.  
AC-CONTACT-03: A contact can be associated to a company, and this association is visible on both records.  
AC-CONTACT-04: A user can archive a contact; archived contacts are excluded from default lists but remain retrievable via an “archived” filter/view.

## Companies
AC-COMPANY-01: A user can create a company and see it in the companies list.  
AC-COMPANY-02: A user can edit an existing company and the changes persist.  
AC-COMPANY-03: A user can archive a company; archived companies are excluded from default lists but remain retrievable via an “archived” filter/view.

## Pipeline stages
AC-STAGE-01: A user can create a new pipeline stage, and it becomes selectable for opportunities.  
AC-STAGE-02: A user can reorder pipeline stages, and the new order is reflected in stage selection and pipeline summaries.  
AC-STAGE-03: A user can rename a stage, and existing opportunities display the updated stage name.

## Opportunities
AC-OPP-01: A user can create an opportunity linked to a company and set an initial stage.  
AC-OPP-02: A user can optionally link a primary contact to an opportunity.  
AC-OPP-03: A user can change an opportunity’s stage and the change persists and is visible in pipeline summaries.  
AC-OPP-04: A user can archive an opportunity; archived opportunities are excluded from default lists but remain retrievable via an “archived” filter/view.

## Tasks
AC-TASK-01: A user can create a task with a due date and status “open”.  
AC-TASK-02: A task can be linked to a contact, company, and/or opportunity, and those links are visible when viewing the task and the linked record(s).  
AC-TASK-03: A user can mark a task complete; completed tasks are excluded from the default “open tasks” view.  
AC-TASK-04: Overdue tasks are visibly distinguishable from due-today and future tasks.

## Notes
AC-NOTE-01: A user can add a note to a contact, company, and/or opportunity.  
AC-NOTE-02: Notes are displayed in reverse chronological order with an author and timestamp.  
AC-NOTE-03: Notes are visible to other users in the same organization.

## Dashboard
AC-DASH-01: Dashboard displays a list/count of overdue tasks and tasks due today for the current user.  
AC-DASH-02: Dashboard displays an opportunity summary grouped by pipeline stage.  
AC-DASH-03: Dashboard displays a basic “recent activity” feed (e.g., recently updated opportunities or recently created notes).

## Validation and error handling
AC-ERR-01: If required fields are missing on create/edit, the user sees a validation message and the record is not saved.  
AC-ERR-02: If a record is not found (invalid id), the user sees a not-found state and no sensitive information is leaked.
