# Acceptance Criteria: Bounded CRM MVP

These criteria are intentionally strict about scope. Passing this document means the product supports the bounded CRM workflows only (auth, contacts, companies, opportunities, pipeline stages, tasks, notes, dashboard). It does not authorize adjacent CRM features.

## AC-01 Authentication
### Given
- A registered user account exists.

### When
- The user signs in with valid credentials.

### Then
- The system creates an authenticated session.
- The user reaches the dashboard.

### Negative criteria
- Invalid credentials are rejected with an error message.
- A signed-out user cannot access authenticated pages.
- The user can sign out and the session is cleared.

## AC-02 Company management
### Given
- An authenticated user is in the workspace.

### When
- The user creates a company.

### Then
- The company is saved with a non-empty name.
- The company can be opened later by navigating from search results.

### When
- The user edits a company.

### Then
- The updated company is persisted and visible on reload.

## AC-03 Contact management
### Given
- An authenticated user is in the workspace.

### When
- The user creates a contact.

### Then
- The contact is saved with a non-empty name.
- The contact can be linked to one company or left unlinked.

### And
- The contact can be found later through contact search by name (and by email when provided).

## AC-04 Opportunity creation
### Controlled stage list (MVP default)
- New
- Qualified
- Proposal
- Won
- Lost

### Given
- A company already exists.

### When
- The user creates an opportunity linked to that company.

### Then
- The opportunity is saved with a non-empty name.
- The opportunity is saved with exactly one current stage from the controlled stage list.
- The opportunity appears in company context and pipeline views.

### Negative criterion
- The system must reject an opportunity that is not linked to a company.

## AC-05 Opportunity stage updates
### Given
- An opportunity already exists.

### When
- The user changes the current stage to another value from the controlled stage list.

### Then
- The new stage is persisted.
- Pipeline views reflect the updated stage.

## AC-06 Task management
### Task status (MVP)
- `open`
- `done`

### Given
- An authenticated user is viewing a company or opportunity.

### When
- The user creates a task.

### Then
- The task must require: title, owner, due date, and status.
- The status defaults to `open` when not explicitly set.
- The task can link to a company, an opportunity, or both.
- The task can later be marked `done`.

### Negative criteria
- The system must reject a task without an owner.
- The system must reject a task without a due date.

## AC-07 Notes
### Given
- An authenticated user is viewing a company or opportunity.

### When
- The user adds a note.

### Then
- The note is saved with non-empty text against the selected parent record.
- Notes display in reverse chronological order.

## AC-08 Dashboard
### Given
- The user is authenticated.

### When
- A team member opens the dashboard.

### Then
- The dashboard shows overdue tasks assigned to that user.
- The dashboard shows tasks due today assigned to that user.
- The dashboard shows recent opportunity activity.
- The dashboard shows simple counts of opportunities by stage.
- Each dashboard item links to its underlying record when applicable.

### And when
- An admin opens the dashboard.

### Then
- The admin can view team-wide overdue tasks and tasks due today (at minimum as counts, and preferably as a list).

## AC-09 Scope guardrails
The following must not be required for MVP acceptance:

- Email or calendar integration
- Workflow automation or rule engines
- Calling, messaging, or sequence management
- Quotes, invoices, or payments
- Support ticketing
- Marketing features
- Custom fields or advanced permission models
- In-app user invitations or provisioning flows

## Ready-for-build checklist
- Every core entity in scope has at least one create and one read path.
- Opportunity tracking is limited to one current stage at a time from the controlled stage list.
- Tasks are the only required next-step mechanism.
- Dashboard content is operational, not analytical.
- No accepted criterion depends on an out-of-scope integration.
