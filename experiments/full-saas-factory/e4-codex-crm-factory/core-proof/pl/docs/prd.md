# CRM Core PRD

## Document Purpose
Define a small, implementation-ready CRM core for internal sales use. The scope is limited to contacts, companies, opportunities, stage transitions, tasks, notes, and dashboard summaries.

## Problem Statement
Small sales teams need one place to track who they know, which companies they work with, active revenue opportunities, the next action to take, and a simple pipeline summary.

## Goals
- Store core CRM records with consistent links between contacts, companies, and opportunities.
- Track opportunity progress through a fixed sales pipeline.
- Capture follow-up work and plain-text notes against CRM records.
- Show a dashboard summary that answers "what is open, what is overdue, and where is pipeline value sitting?"

## Non-Goals
- Authentication, authorization, teams, or role management.
- Email sync, calendar sync, file attachments, imports, exports, or external integrations.
- Custom fields, workflow automation, notifications, or reporting beyond the dashboard summary.
- Multiple pipelines, forecast categories, quoting, invoicing, or product catalogs.

## Primary Actor
- Internal sales user managing a small pipeline.

## Assumptions
- The proof supports a single workspace with no user permissions.
- All currency amounts use one workspace currency.
- Record volumes are small enough that simple list and summary queries are acceptable.
- Search can be simple case-insensitive substring matching.

## In Scope
- Create, update, view, list, and search contacts.
- Create, update, view, list, and search companies.
- Create, update, view, list, and search opportunities.
- Move opportunities through a fixed stage model with explicit transition rules.
- Create, update, complete, and list tasks linked to CRM records.
- Create and list append-only notes linked to CRM records.
- Show dashboard summary totals for core records, open pipeline, overdue tasks, and opportunity counts by stage.

## Data Model

### Contact
- `id`
- `firstName`
- `lastName`
- `email` optional, unique when present
- `phone` optional
- `companyId` optional
- `createdAt`
- `updatedAt`

### Company
- `id`
- `name` unique
- `website` optional
- `industry` optional
- `createdAt`
- `updatedAt`

### Opportunity
- `id`
- `name`
- `companyId` required
- `primaryContactId` optional
- `stage` required
- `amount` optional, non-negative
- `targetCloseDate` optional
- `createdAt`
- `updatedAt`
- `closedAt` optional, set when stage becomes `Won` or `Lost`

### Task
- `id`
- `title`
- `status` enum: `Open`, `Completed`
- `dueDate` optional
- `linkedEntityType` enum: `Contact`, `Company`, `Opportunity`
- `linkedEntityId`
- `createdAt`
- `updatedAt`
- `completedAt` optional

### Note
- `id`
- `body`
- `linkedEntityType` enum: `Contact`, `Company`, `Opportunity`
- `linkedEntityId`
- `createdAt`

## Opportunity Stage Model
- `Lead`
- `Qualified`
- `Proposal`
- `Won`
- `Lost`

## Stage Transition Rules
- `Lead` can move to `Qualified` or `Lost`.
- `Qualified` can move to `Proposal` or `Lost`.
- `Proposal` can move to `Won` or `Lost`.
- `Won` and `Lost` are terminal stages.
- Terminal opportunities cannot move back to active stages.

## Functional Requirements

### Contacts
- Users can create a contact with first name and last name.
- Users can optionally add email, phone, and company.
- Users can update contact fields after creation.
- Users can list contacts and search by name or email.
- When a contact is linked to a company, the company must exist.

### Companies
- Users can create a company with a unique name.
- Users can optionally add website and industry.
- Users can update company fields after creation.
- Users can list companies and search by company name.

### Opportunities
- Users can create an opportunity with name, company, and initial stage.
- Initial stage must be `Lead`.
- Users can optionally add primary contact, amount, and target close date.
- Primary contact, when present, must exist.
- Users can update open opportunity fields.
- Users can list opportunities and filter by stage.
- Users can search opportunities by name.

### Stage Transitions
- Users can change an opportunity stage only through allowed transitions.
- Moving an opportunity to `Won` or `Lost` sets `closedAt`.
- Closed opportunities remain visible in lists and dashboard summaries.
- Closed opportunities cannot change stage again.

### Tasks
- Users can create a task linked to exactly one contact, company, or opportunity.
- Users can update task title and due date while the task is open.
- Users can mark an open task as completed.
- Completed tasks stay visible for historical context.
- A task is overdue when status is `Open` and due date is before the current date.

### Notes
- Users can add a plain-text note linked to exactly one contact, company, or opportunity.
- Notes are append-only after creation.
- Linked record notes are shown newest first.

### Dashboard Summary
- Dashboard returns total counts for contacts and companies.
- Dashboard returns count of open tasks and overdue tasks.
- Dashboard returns count of opportunities by stage.
- Dashboard returns sum of `amount` for non-terminal opportunities with an amount present.

## Business Rules
- Email uniqueness is enforced only when a contact email is present.
- Company names are unique after case-insensitive normalization.
- Opportunity `amount` cannot be negative.
- Notes cannot be empty.
- Tasks cannot be created without a valid linked entity reference.
- Opportunities in `Won` or `Lost` are considered closed.

## Constraints
- Keep the model intentionally small and relational.
- No soft-delete behavior is required in this proof.
- No audit trail beyond timestamps is required.
- No rich text, mentions, or attachments in notes.

## Open Questions
- None for this bounded proof. Assumptions above are treated as product decisions unless replaced by later direction.
