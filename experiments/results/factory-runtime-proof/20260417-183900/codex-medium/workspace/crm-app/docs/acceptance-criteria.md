# Acceptance Criteria (Bounded CRM MVP)

All criteria are intentionally MVP-scoped (auth, contacts, companies, opportunities, pipeline stages, tasks, notes, dashboard). Each criterion must be testable.

## Authentication

- **AC-001** User can log in with valid credentials and is routed to the dashboard.
- **AC-002** User cannot log in with invalid credentials and sees a clear error.
- **AC-003** Authenticated sessions persist across page refresh until logout/expiry.
- **AC-004** User can log out and is prevented from accessing protected pages afterward.

## Contacts

- **AC-010** User can create a contact with required fields and optional email/phone.
- **AC-011** User can view a contact details page.
- **AC-012** User can search contacts by name and (when present) email.
- **AC-013** User can edit a contact and changes are persisted.
- **AC-014** Contact validation errors are shown inline and prevent save.

## Companies

- **AC-020** User can create a company with required name.
- **AC-021** User can view a company details page.
- **AC-022** User can search companies by name.
- **AC-023** User can edit a company and changes are persisted.
- **AC-024** Company validation errors are shown inline and prevent save.

## Opportunities + Pipeline

- **AC-030** User can create an opportunity linked to a company.
- **AC-031** Opportunity has a required stage and required owner.
- **AC-032** User can move an opportunity to a different stage and the change persists.
- **AC-033** User can view opportunities grouped by stage.
- **AC-034** Stage list is defined per organization and is used consistently across the UI.

## Pipeline stages (Admin)

- **AC-035** Admin can rename stages within the organization.
- **AC-036** Admin can reorder stages within the organization.
- **AC-037** Non-admin users cannot change stage definitions.

## Tasks

- **AC-040** User can create a task linked to a contact, company, or opportunity.
- **AC-041** Task has a required title and a completion state.
- **AC-042** User can mark a task complete and incomplete.
- **AC-043** Overdue tasks are visible on the dashboard.
- **AC-044** Tasks due soon are visible on the dashboard.

## Notes

- **AC-050** User can add a note with required body text.
- **AC-051** Note is linked to exactly one parent record (contact/company/opportunity).
- **AC-052** Notes are displayed newest-first on the parent record page.

## Dashboard

- **AC-060** Dashboard shows overdue tasks for the signed-in user.
- **AC-061** Dashboard shows tasks due soon for the signed-in user.
- **AC-062** Dashboard shows counts of opportunities by stage for the organization.

## Cross-cutting

- **AC-070** All data is scoped to a single organization boundary; users cannot access other organizations’ data.
- **AC-071** List views paginate when data exceeds a reasonable page size.
- **AC-072** Validation and server errors are presented in human-readable UI messages.
