# CRM Core Acceptance Criteria

## Summary
These criteria define done conditions for a bounded CRM core covering contacts, companies, opportunities, stage transitions, tasks, notes, and dashboard summaries.

## Findings
- Scope is intentionally limited to one internal workspace with no auth or integrations.
- The pipeline is fixed and uses terminal closed stages.
- Notes are append-only and tasks are the only action-tracking object.

## Structured Outputs

### Contacts
- `AC-CONTACT-001`
  Given no matching contact exists
  When a user creates a contact with `firstName` and `lastName`
  Then the contact is stored with a generated `id`, `createdAt`, and `updatedAt`

- `AC-CONTACT-002`
  Given a user provides an email address that is not already in use
  When the contact is created or updated
  Then the email is stored on the contact

- `AC-CONTACT-003`
  Given a user provides an email address already used by another contact
  When the create or update request is submitted
  Then the request is rejected with a validation error

- `AC-CONTACT-004`
  Given an existing company record
  When a user sets `companyId` on a contact
  Then the contact is linked to that company

- `AC-CONTACT-005`
  Given no company exists for the provided `companyId`
  When a user creates or updates a contact with that `companyId`
  Then the request is rejected with a validation error

- `AC-CONTACT-006`
  Given stored contacts exist
  When a user searches by contact name or email using a case-insensitive substring
  Then only matching contacts are returned

### Companies
- `AC-COMPANY-001`
  Given no matching company name exists
  When a user creates a company with `name`
  Then the company is stored with a generated `id`, `createdAt`, and `updatedAt`

- `AC-COMPANY-002`
  Given a company exists with the same normalized name
  When a user creates or renames another company to that name
  Then the request is rejected with a validation error

- `AC-COMPANY-003`
  Given stored companies exist
  When a user searches by company name using a case-insensitive substring
  Then only matching companies are returned

### Opportunities
- `AC-OPPORTUNITY-001`
  Given an existing company
  When a user creates an opportunity with `name` and `companyId`
  Then the opportunity is created in stage `Lead`

- `AC-OPPORTUNITY-002`
  Given a user supplies an initial stage other than `Lead`
  When the create request is submitted
  Then the request is rejected with a validation error

- `AC-OPPORTUNITY-003`
  Given an existing contact and company
  When a user creates or updates an opportunity with `primaryContactId`
  Then the contact is linked as the primary contact

- `AC-OPPORTUNITY-004`
  Given a user supplies a negative `amount`
  When the create or update request is submitted
  Then the request is rejected with a validation error

- `AC-OPPORTUNITY-005`
  Given stored opportunities exist
  When a user filters opportunities by stage
  Then only opportunities in that stage are returned

- `AC-OPPORTUNITY-006`
  Given stored opportunities exist
  When a user searches by opportunity name using a case-insensitive substring
  Then only matching opportunities are returned

### Stage Transitions
- `AC-STAGE-001`
  Given an opportunity in `Lead`
  When the user changes the stage to `Qualified`
  Then the stage update succeeds

- `AC-STAGE-002`
  Given an opportunity in `Lead`
  When the user changes the stage directly to `Proposal` or `Won`
  Then the request is rejected with a validation error

- `AC-STAGE-003`
  Given an opportunity in `Qualified`
  When the user changes the stage to `Proposal`
  Then the stage update succeeds

- `AC-STAGE-004`
  Given an opportunity in `Proposal`
  When the user changes the stage to `Won` or `Lost`
  Then the stage update succeeds and `closedAt` is set

- `AC-STAGE-005`
  Given an opportunity is in `Won` or `Lost`
  When the user attempts any further stage change
  Then the request is rejected with a validation error

### Tasks
- `AC-TASK-001`
  Given an existing contact, company, or opportunity
  When a user creates a task linked to exactly one valid record
  Then the task is stored with status `Open`

- `AC-TASK-002`
  Given no valid linked record exists
  When a user creates a task
  Then the request is rejected with a validation error

- `AC-TASK-003`
  Given an open task
  When a user updates its title or due date
  Then the task is updated and `updatedAt` changes

- `AC-TASK-004`
  Given an open task
  When a user marks it completed
  Then the status becomes `Completed` and `completedAt` is set

- `AC-TASK-005`
  Given an open task with a due date before the current date
  When the task is included in task lists or dashboard summaries
  Then it is counted as overdue

### Notes
- `AC-NOTE-001`
  Given an existing contact, company, or opportunity
  When a user creates a note with non-empty plain text linked to exactly one record
  Then the note is stored with `id` and `createdAt`

- `AC-NOTE-002`
  Given a user submits an empty note body
  When the create request is submitted
  Then the request is rejected with a validation error

- `AC-NOTE-003`
  Given multiple notes exist for one linked record
  When the notes are retrieved
  Then they are returned in descending `createdAt` order

- `AC-NOTE-004`
  Given an existing note
  When a user attempts to edit its body
  Then the request is rejected because notes are append-only

### Dashboard Summary
- `AC-DASHBOARD-001`
  Given stored CRM data exists
  When the dashboard summary is requested
  Then the response includes total contact count and total company count

- `AC-DASHBOARD-002`
  Given stored opportunities exist across multiple stages
  When the dashboard summary is requested
  Then the response includes counts for `Lead`, `Qualified`, `Proposal`, `Won`, and `Lost`

- `AC-DASHBOARD-003`
  Given open and completed tasks exist
  When the dashboard summary is requested
  Then the response includes open task count and overdue task count only for open overdue tasks

- `AC-DASHBOARD-004`
  Given open opportunities with amounts exist
  When the dashboard summary is requested
  Then the response includes the sum of `amount` across `Lead`, `Qualified`, and `Proposal` opportunities with amounts present

## Assumptions
- The system runs in a single workspace with one shared currency.
- Search behavior uses simple case-insensitive substring matching.
- Time-based overdue evaluation uses the system current date.

## Constraints
- No auth, integrations, attachments, or custom fields are included.
- The stage model is fixed and cannot be configured in this proof.
- Notes are plain text only.

## Open Questions
- None. The bounded proof treats the listed assumptions as current decisions.

## Recommended Next Skill
- `requirements-traceability-starter`

## Negative Criteria
- The system must not allow upward imports or architecture changes in domain logic for this documentation-only step.
- The system must not allow invalid foreign keys for linked records.
- The system must not allow reopening or backward progression from terminal opportunity stages.
- The system must not allow empty notes or duplicate contact emails when email is present.

## Ready-for-Test Checklist
- Opportunity stage transition tests cover every allowed and blocked transition.
- Validation tests cover required fields, uniqueness rules, and invalid linked entity references.
- Task overdue tests use a fixed current date.
- Dashboard summary tests verify counts and amount totals against seeded records.
- Notes tests verify append-only behavior and descending timestamp order.
