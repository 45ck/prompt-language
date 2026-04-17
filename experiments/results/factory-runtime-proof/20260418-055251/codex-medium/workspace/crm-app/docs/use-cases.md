# Use Cases: Bounded CRM MVP

Assumptions:
- The system supports one workspace with authenticated users.
- Actors are `Team member` and `Admin`.
- Terminology is fixed for MVP: company, contact, opportunity, task, note.

## UC-01 Sign in to the workspace
- Actor: Team member, Admin
- Trigger: User submits valid credentials.
- Precondition: User account exists.
- Main flow:
  1. User enters email and password.
  2. System validates credentials.
  3. System creates an authenticated session.
  4. System shows the dashboard.
- Alternate flows:
  - Invalid credentials are rejected with an error message.
- Outcome:
  - Authenticated user can access permitted pages.

## UC-02 Create or update a company
- Actor: Team member, Admin
- Trigger: User needs to record or correct a company.
- Main flow:
  1. User searches for an existing company.
  2. If not found, user creates a company.
  3. User saves the company record.
  4. System displays the company detail page.
- Outcome:
  - A usable company record exists in the CRM.

## UC-03 Create or update a contact
- Actor: Team member, Admin
- Trigger: User needs to record or correct a contact.
- Main flow:
  1. User searches for an existing contact.
  2. If not found, user creates a contact.
  3. User optionally links the contact to a company.
  4. System saves and displays the contact.
- Alternate flows:
  - User leaves the contact unlinked if no company is known yet.
- Outcome:
  - A contact record exists and can be related to company work.

## UC-04 Create an opportunity
- Actor: Team member, Admin
- Trigger: A real sales or service opportunity needs to be tracked.
- Precondition: A company record exists.
- Main flow:
  1. User opens the target company.
  2. User creates an opportunity linked to that company.
  3. User selects an initial stage from the controlled stage list.
  4. User saves the opportunity.
  5. User adds a note or creates a task if needed.
- Exception flows:
  - System blocks creation if no company is selected.
- Outcome:
  - The opportunity appears in the pipeline and company context.

## UC-05 Update an opportunity stage
- Actor: Team member, Admin
- Trigger: Opportunity status changes.
- Main flow:
  1. User opens an opportunity.
  2. User changes the current stage.
  3. System saves the updated stage.
  4. User optionally adds a note or task to reflect the change.
- Outcome:
  - The pipeline reflects the latest state of work.

## UC-06 Create and complete a task
- Actor: Team member, Admin
- Trigger: Follow-up work needs an owner and due date.
- Main flow:
  1. User creates a task linked to a company, opportunity, or both.
  2. User assigns an owner.
  3. User sets a due date.
  4. System saves the task as open.
  5. User later marks the task done.
- Exception flows:
  - System blocks save if owner or due date is missing.
- Outcome:
  - Next-step work is trackable and has a visible state.

## UC-07 Add a note
- Actor: Team member, Admin
- Trigger: User needs to capture context.
- Main flow:
  1. User opens a company or opportunity.
  2. User enters note text.
  3. System saves the note and displays it in reverse chronological order.
- Outcome:
  - Record history is easier to resume and hand off.

## UC-08 Review the dashboard
- Actor: Team member, Admin
- Trigger: User opens the CRM home view.
- Main flow:
  1. System shows overdue tasks.
  2. System shows tasks due today.
  3. System shows recent opportunity activity.
  4. System shows pipeline counts by stage.
  5. User navigates to an underlying record from a dashboard item.
- Outcome:
  - User can decide what needs attention now.

## Explicitly rejected use cases
These are not valid MVP use cases and must not be added implicitly:

- Sync inbox or calendar events
- Send bulk email or sequences
- Generate quotes or invoices
- Run support tickets or cases
- Build custom workflow automation
