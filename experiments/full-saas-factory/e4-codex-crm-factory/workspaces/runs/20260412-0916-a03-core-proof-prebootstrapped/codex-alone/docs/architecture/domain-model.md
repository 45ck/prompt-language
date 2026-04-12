# Domain Model — CRM Core Slice

## Packages and Boundaries

- `packages/domain`: pure TypeScript domain logic (no IO, no persistence, no clock reads).
- `packages/api`: in-memory application service that orchestrates domain logic and enforces reference existence.

Dependency direction is one-way: `api -> domain`.

## Entities

### Company

- Identified by `CompanyId` (`com_*`).
- Attributes: `name`, optional `domain`, timestamps.
- Relationships:
  - A company can have many contacts.
  - A company can have many opportunities.

### Contact

- Identified by `ContactId` (`con_*`).
- Attributes: `name`, optional `email`, optional `phone`, optional `companyId`, timestamps.
- Relationship to company is optional to support individuals and partial data.

### Opportunity

- Identified by `OpportunityId` (`opp_*`).
- Attributes: `title`, `valueCents`, `currency`, `stage`, `stageHistory`, timestamps.
- Relationships:
  - Belongs to exactly one company (`companyId`).
  - Optionally references a primary contact (`primaryContactId`).

### Task

- Identified by `TaskId` (`tsk_*`).
- Attributes: `subject`, optional `dueAt`, `status`, timestamps.
- Optional relationship: `relatedTo` can reference a company/contact/opportunity.

### Note

- Identified by `NoteId` (`note_*`).
- Attributes: `body`, timestamps.
- Required relationship: `relatedTo` references a company/contact/opportunity/task.

## Opportunity Stages

Stages:

- `Prospecting -> Qualified -> Proposal -> Negotiation -> ClosedWon/ClosedLost`

Rules:

- Closed stages cannot transition back to non-closed stages.
- A non-closed stage can transition to the next stage in sequence.
- A non-closed stage can transition directly to a closed stage.
- Transitions append to `stageHistory`.

## Invariants

See `specs/invariants.md` for the full list of enforced invariants and API-level guarantees.

