# Use Cases: Bounded CRM MVP

## UC-1: Access the CRM workspace
### Primary actor
Authenticated internal user

### Trigger
User opens the application

### Main flow
1. User signs in.
2. System verifies identity and workspace access.
3. System shows CRM pages scoped to the user’s organization/workspace.

### Outcome
User can access only their workspace data.

## UC-2: Create and maintain a company record
### Primary actor
Authenticated internal user

### Trigger
User needs a shared account/company record

### Main flow
1. User creates a company with a minimal required field set.
2. System stores the company in the current workspace.
3. User opens the company detail page.
4. User edits company fields as needed.
5. User reviews linked contacts, opportunities, tasks, and notes from the same page.

### Outcome
The company becomes the anchor record for related customer activity.

## UC-3: Create and maintain a contact record
### Primary actor
Authenticated internal user

### Trigger
User needs to store or update a person linked to customer work

### Main flow
1. User creates a contact with at least a name or email.
2. User optionally links the contact to a company.
3. System stores the contact in the current workspace.
4. User edits the contact later if details change.
5. User reviews linked tasks and notes from the contact page.

### Outcome
The team has a searchable person-level record tied to customer context.

## UC-4: Create an opportunity
### Primary actor
Authenticated internal user

### Trigger
User identifies a sales or renewal opportunity worth tracking

### Main flow
1. User creates an opportunity from a company or opportunity list view.
2. User enters opportunity name and selects a stage.
3. User optionally enters amount, expected close date, and primary contact.
4. System stores the opportunity and displays its detail page.

### Outcome
The opportunity appears in stage-based views and contributes to dashboard counts.

## UC-5: Move an opportunity through the pipeline
### Primary actor
Authenticated internal user

### Trigger
Opportunity status changes

### Main flow
1. User opens the opportunity or stage-filtered list.
2. User changes the opportunity stage.
3. System saves the new stage.
4. System updates the opportunity detail view, list filters, dashboard counts, and recent activity.

### Outcome
Pipeline state remains current and shared.

## UC-6: Capture a next-step task
### Primary actor
Authenticated internal user

### Trigger
User finishes a call, meeting, or review and needs to record a follow-up

### Main flow
1. User creates a task from a company, contact, opportunity, or task list.
2. User enters a title and optionally sets a due date.
3. User links the task to the relevant record or records.
4. System stores the task as open.
5. User later marks the task completed.

### Outcome
Follow-up work is visible in task views and on the dashboard.

## UC-7: Record context as a note
### Primary actor
Authenticated internal user

### Trigger
User needs to preserve customer context after an interaction

### Main flow
1. User opens a company, contact, or opportunity.
2. User adds a note.
3. System timestamps the note and stores it against the selected record.
4. System shows the note in reverse chronological order on the record page.

### Outcome
The latest context is preserved where the team expects to find it.

## UC-8: Run daily triage from the dashboard
### Primary actor
Owner-operator, sales rep, or generalist

### Trigger
User starts or ends a work session

### Main flow
1. User opens the dashboard.
2. System shows opportunity counts by stage.
3. System shows overdue tasks and upcoming tasks.
4. System shows recent activity from notes, tasks, and stage changes.
5. User decides which records need attention next.

### Outcome
The user gets a current operational picture without exporting or compiling reports.

## Excluded use cases
The following are intentionally not supported in MVP:

- syncing emails or calendars into CRM records
- sending reminders or automated follow-up messages
- importing large datasets from CSV or external systems
- generating advanced forecasts, financial reports, or custom dashboards
- attaching files or collaborating through comments and mentions
