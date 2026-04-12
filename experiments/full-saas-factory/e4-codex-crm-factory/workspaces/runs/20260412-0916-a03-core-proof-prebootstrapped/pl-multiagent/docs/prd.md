# Bounded CRM Core PRD

## Product summary
Build a small CRM core that can run as pure TypeScript domain logic with in-memory application services. The slice must support contacts, companies, opportunities, opportunity stage transitions, tasks, notes, and dashboard summaries. The output of this slice is a deterministic library that a future HTTP API or UI can wrap.

## Problem statement
The workspace needs a narrow CRM foundation that is small enough to implement quickly but complete enough to prove the core business model. The first cut should cover relationship tracking, deal progression, lightweight follow-up work, and a dashboard summary without introducing persistence, auth, or external integrations.

## Outcome
At the end of this slice, a developer can:

1. Create and list companies, contacts, and opportunities.
2. Attach contacts to companies.
3. Link opportunities to a company and an optional primary contact.
4. Move opportunities through a fixed stage model with enforced transition rules.
5. Attach tasks and notes to a contact or an opportunity.
6. Compute dashboard summaries from in-memory state using explicit inputs.

## Primary user
- Single internal operator managing a small pipeline.
- Developer integrating the CRM core into a later API or UI layer.

## Scope

### In scope
- Company creation and retrieval.
- Contact creation and retrieval.
- Opportunity creation, retrieval, and stage movement.
- Task creation, completion, and listing.
- Note creation and listing.
- Dashboard summary totals and pipeline rollups.

### Out of scope
- Authentication, authorization, tenancy, and roles.
- Persistence, migrations, import/export, and background jobs.
- Search, deduplication, merge flows, and delete flows.
- Notifications, reminders, emails, and calendar sync.
- Forecasting, advanced reporting, and custom fields.

## Implementation boundary
- Domain layer: dependency-free entities, value validation, invariants, and stage rules.
- Application layer: in-memory services that own collections, id generation, lookup orchestration, and summary computation.
- Presentation and infrastructure layers are out of scope for this step.

## Domain model

### Company
Represents an organization.

Required fields:
- `companyId`
- `name`

Optional fields:
- `domain`

Rules:
- `name` must be non-empty after trimming.
- `domain` is stored as provided; no DNS validation is required in this slice.

### Contact
Represents a person.

Required fields:
- `contactId`
- `fullName`

Optional fields:
- `email`
- `phone`
- `companyId`

Rules:
- `fullName` must be non-empty after trimming.
- If `companyId` is provided, it must reference an existing company.

### Opportunity
Represents a potential sale.

Required fields:
- `opportunityId`
- `title`
- `stage`
- `amountCents`

Optional fields:
- `companyId`
- `primaryContactId`

Rules:
- `title` must be non-empty after trimming.
- `amountCents` must be an integer greater than or equal to zero.
- Default stage is `Prospecting`.
- If `companyId` is provided, it must reference an existing company.
- If `primaryContactId` is provided, it must reference an existing contact.

### Task
Represents a follow-up action.

Required fields:
- `taskId`
- `subject`
- `status`

Optional fields:
- `dueDate`
- `contactId`
- `opportunityId`

Rules:
- `subject` must be non-empty after trimming.
- `status` is either `Open` or `Done`.
- A task must target exactly one parent: `contactId` or `opportunityId`.
- If a target id is provided, it must reference an existing record of the correct type.
- `dueDate` is a plain `YYYY-MM-DD` string in this slice.

### Note
Represents a plain text note.

Required fields:
- `noteId`
- `body`

Optional fields:
- `contactId`
- `opportunityId`

Rules:
- `body` must be non-empty after trimming.
- A note must target exactly one parent: `contactId` or `opportunityId`.
- If a target id is provided, it must reference an existing record of the correct type.

## Opportunity stage model
Supported stages:

1. `Prospecting`
2. `Qualified`
3. `Proposal`
4. `Negotiation`
5. `ClosedWon`
6. `ClosedLost`

Allowed transitions:

- `Prospecting -> Qualified`
- `Prospecting -> ClosedLost`
- `Qualified -> Proposal`
- `Qualified -> ClosedLost`
- `Proposal -> Negotiation`
- `Proposal -> ClosedLost`
- `Negotiation -> ClosedWon`
- `Negotiation -> ClosedLost`

Blocked transitions:

- Any transition not listed above.
- Any transition from `ClosedWon`.
- Any transition from `ClosedLost`.
- Reopening a closed opportunity.

## Core workflows

### Capture a new lead
1. Create a company when the lead belongs to an organization.
2. Create a contact, optionally linked to that company.
3. Create an opportunity in `Prospecting`, optionally linked to the company and primary contact.
4. Add at least one follow-up task or note as needed.

### Progress a deal
1. Read an existing opportunity.
2. Move it to the next allowed stage or mark it `ClosedLost`.
3. Add supporting tasks and notes during the process.

### Review the dashboard
1. Request a dashboard summary with an explicit `asOfDate`.
2. Return aggregate counts, stage counts, open pipeline value, and due task count.

## Application service capabilities
The in-memory application layer should expose operations equivalent to:

- `createCompany`
- `getCompany`
- `listCompanies`
- `createContact`
- `getContact`
- `listContacts`
- `createOpportunity`
- `getOpportunity`
- `listOpportunities`
- `moveOpportunityStage`
- `addTask`
- `markTaskDone`
- `listTasks`
- `addNote`
- `listNotes`
- `getDashboardSummary`

Exact function names may vary, but the service surface must support all of these behaviors.

## Dashboard summary contract
The dashboard summary must be computed from current in-memory state and explicit inputs.

Required outputs:
- `totals.contacts`
- `totals.companies`
- `totals.opportunities`
- `totals.tasks`
- `totals.notes`
- `opportunitiesByStage` for every defined stage
- `openPipelineAmountCents`
- `openTasksDueCount`

Rules:
- `openPipelineAmountCents` includes opportunities not in `ClosedWon` or `ClosedLost`.
- `openTasksDueCount` counts tasks where `status = Open`, `dueDate` is set, and `dueDate <= asOfDate`.
- Tasks without a `dueDate` are excluded from due counts.

## Validation and error handling
The module must fail fast with explicit, testable errors for:

- Empty required strings.
- Negative `amountCents`.
- Unknown linked ids.
- Invalid opportunity stage transitions.
- Invalid task or note targeting where neither or both parent ids are provided.
- Unknown ids when fetching or mutating existing records.

The exact error type shape is implementation-defined, but the failure mode must be unambiguous in tests.

## Non-functional constraints
- Deterministic behavior only; no system clock reads.
- Any date-sensitive logic must take `asOfDate` as an input.
- No external dependencies in the domain package.
- No persistence or network access in the in-memory services.
- IDs are generated by the application layer, not inside domain entities.

## Assumptions
- Single-currency support is sufficient for this slice.
- Contacts can exist without a company.
- Opportunities can exist without a company or primary contact.
- Notes do not require authorship or timestamps in this slice.

## Open questions
- None for the bounded scope of this step.
