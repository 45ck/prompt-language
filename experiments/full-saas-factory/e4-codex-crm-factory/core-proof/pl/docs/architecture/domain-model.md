# CRM Core Domain Model

## Purpose
Define the bounded CRM core domain model for a pure TypeScript implementation with in-memory application services and no external dependencies in the domain layer.

## Architectural Posture
- `packages/domain` contains entities, value objects, domain services, and invariant enforcement.
- `packages/api` contains presentation-facing request handlers or controllers that translate input/output only.
- Application services coordinate repositories and clocks in memory and call pure domain functions for validation and state changes.
- Persistence for this proof is process-local in-memory storage. No database behavior is assumed in domain logic.

## Bounded Context
- The bounded context is `CRM Core`.
- It owns contacts, companies, opportunities, tasks, notes, and dashboard summaries.
- It does not own authentication, authorization, user identity, integrations, notifications, imports, exports, or billing.

## Ubiquitous Language
- `Contact`: a person known by the sales team.
- `Company`: an organization linked to contacts and opportunities.
- `Opportunity`: a potential revenue deal moving through a fixed pipeline.
- `Stage`: the lifecycle step of an opportunity.
- `Task`: a follow-up action linked to exactly one CRM record.
- `Note`: append-only plain-text commentary linked to exactly one CRM record.
- `Dashboard Summary`: a read model that reports counts and pipeline totals.

## Core Types

### Identity Types
- `ContactId`
- `CompanyId`
- `OpportunityId`
- `TaskId`
- `NoteId`

These should be modeled as branded string types or narrow aliases in TypeScript so application code cannot accidentally mix entity identifiers.

### Shared Enums
- `OpportunityStage = 'Lead' | 'Qualified' | 'Proposal' | 'Won' | 'Lost'`
- `TaskStatus = 'Open' | 'Completed'`
- `LinkedEntityType = 'Contact' | 'Company' | 'Opportunity'`

## Entities

### Contact
Fields:
- `id`
- `firstName`
- `lastName`
- `email?`
- `phone?`
- `companyId?`
- `createdAt`
- `updatedAt`

Responsibilities:
- Hold person-level CRM identity data.
- Optionally reference one company.
- Preserve optional email uniqueness when email is present.

Rules:
- `firstName` and `lastName` are required.
- `email`, when present, must be unique across contacts after normalization.
- `companyId`, when present, must reference an existing company.

### Company
Fields:
- `id`
- `name`
- `website?`
- `industry?`
- `createdAt`
- `updatedAt`

Responsibilities:
- Represent the commercial organization around contacts and opportunities.
- Act as the required parent reference for every opportunity.

Rules:
- `name` is required.
- `name` must be unique after case-insensitive normalization.

### Opportunity
Fields:
- `id`
- `name`
- `companyId`
- `primaryContactId?`
- `stage`
- `amount?`
- `targetCloseDate?`
- `createdAt`
- `updatedAt`
- `closedAt?`

Responsibilities:
- Represent a revenue opportunity inside a fixed pipeline.
- Enforce allowed stage transitions.
- Carry optional commercial value and expected close timing.

Rules:
- New opportunities start in `Lead`.
- `companyId` must reference an existing company.
- `primaryContactId`, when present, must reference an existing contact.
- `amount`, when present, must be greater than or equal to zero.
- `closedAt` is set when stage becomes `Won` or `Lost`.
- `Won` and `Lost` are terminal.

### Task
Fields:
- `id`
- `title`
- `status`
- `dueDate?`
- `linkedEntityType`
- `linkedEntityId`
- `createdAt`
- `updatedAt`
- `completedAt?`

Responsibilities:
- Represent the next actionable piece of work for the sales team.
- Track whether work is still open or already completed.

Rules:
- A task links to exactly one existing contact, company, or opportunity.
- New tasks start in `Open`.
- Only open tasks can be updated or completed.
- Completing a task sets `completedAt`.

### Note
Fields:
- `id`
- `body`
- `linkedEntityType`
- `linkedEntityId`
- `createdAt`

Responsibilities:
- Capture append-only plain-text context against a CRM record.

Rules:
- `body` must be non-empty plain text.
- A note links to exactly one existing contact, company, or opportunity.
- Notes are immutable after creation.

## Value Objects And Derived Concepts

### NormalizedCompanyName
- Derived from `Company.name` using trim plus case-insensitive normalization.
- Used for uniqueness checks only.

### NormalizedEmail
- Derived from `Contact.email` when present.
- Used for uniqueness checks only.

### OpportunityLifecycle
- `isClosed(stage)` is true for `Won` and `Lost`.
- `isActive(stage)` is true for `Lead`, `Qualified`, and `Proposal`.
- `allowedNextStages(stage)` returns the fixed transition set.

### TaskUrgency
- A task is overdue when `status === 'Open'` and `dueDate < currentDate`.
- Overdue state is derived, not stored.

## Aggregates And Boundaries
- `Contact`, `Company`, `Opportunity`, `Task`, and `Note` are separate aggregates.
- Cross-aggregate references are validated in application services before domain objects are committed to in-memory repositories.
- `Opportunity` owns its stage transition rules and closed-state behavior.
- `Note` owns immutability after creation.
- `Task` owns completion state transitions.

## Domain Services

### OpportunityStagePolicy
- Validates whether a stage transition is allowed.
- Sets or preserves `closedAt` consistently.

### DashboardSummaryProjector
- Builds a read model from repository snapshots.
- Calculates:
  - total contacts
  - total companies
  - open task count
  - overdue task count
  - opportunities by stage
  - open pipeline amount across `Lead`, `Qualified`, and `Proposal`

### SearchMatcher
- Implements simple case-insensitive substring matching for contact, company, and opportunity queries.

## Application Service Shape
- `ContactService`
- `CompanyService`
- `OpportunityService`
- `TaskService`
- `NoteService`
- `DashboardService`

Expected behavior:
- Accept plain TypeScript DTOs.
- Resolve current time through an injected clock abstraction.
- Read and write through in-memory repositories.
- Return DTOs or domain snapshots without leaking persistence concerns into the domain.

## In-Memory Repository Responsibilities
- Store aggregate snapshots keyed by ID.
- Support lookup by ID.
- Support list and search operations for small bounded data volumes.
- Support normalized uniqueness indexes for company names and contact emails.
- Avoid domain decisions; repositories enforce storage consistency, while domain services enforce business rules.

## Read Models

### DashboardSummary
Fields:
- `totalContacts`
- `totalCompanies`
- `openTaskCount`
- `overdueTaskCount`
- `opportunityCountByStage`
- `openPipelineAmount`

### NotesForEntity
- Returned newest first by `createdAt`.

## Domain Event Posture
- No event bus is required in this proof.
- If domain events are introduced later, they should be emitted from application services after successful state changes and remain inside the bounded context unless an explicit integration boundary is added.

## Mapping To Acceptance Scope
- Contacts cover creation, update, list, and search.
- Companies cover creation, update, list, and search.
- Opportunities cover creation, update, list, search, and stage transitions.
- Tasks cover create, update, complete, and overdue evaluation.
- Notes cover create and list only.
- Dashboard summary remains a derived read model with no write path.

## Open Questions
- None for this bounded proof.
