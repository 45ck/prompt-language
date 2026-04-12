# Bounded CRM Core Invariants

## Purpose
This specification lists the state and behavior invariants that must hold for every successful operation in the bounded CRM core. These invariants are the non-negotiable rules behind the acceptance criteria and should be enforced through pure domain logic plus in-memory application checks.

## Scope
Included:

- companies
- contacts
- opportunities
- tasks
- notes
- dashboard summaries
- stage transitions

Excluded:

- persistence guarantees
- auth and tenancy
- delete semantics
- timestamps and auditing

## Invariant format
Each invariant below has:

- an identifier
- the rule that must always hold
- the enforcement layer
- the expected failure mode when violated

## Identity invariants

| ID | Invariant | Enforcement layer | Failure mode |
| --- | --- | --- | --- |
| INV-001 | Every persisted company has a non-empty `companyId`. | application | operation must not succeed |
| INV-002 | Every persisted contact has a non-empty `contactId`. | application | operation must not succeed |
| INV-003 | Every persisted opportunity has a non-empty `opportunityId`. | application | operation must not succeed |
| INV-004 | Every persisted task has a non-empty `taskId`. | application | operation must not succeed |
| INV-005 | Every persisted note has a non-empty `noteId`. | application | operation must not succeed |
| INV-006 | IDs are unique within each entity collection. | application | operation must not succeed |

## Value validation invariants

| ID | Invariant | Enforcement layer | Failure mode |
| --- | --- | --- | --- |
| INV-010 | `Company.name` is non-empty after trimming. | domain | validation error |
| INV-011 | `Contact.fullName` is non-empty after trimming. | domain | validation error |
| INV-012 | `Opportunity.title` is non-empty after trimming. | domain | validation error |
| INV-013 | `Opportunity.amountCents` is an integer greater than or equal to zero. | domain | validation error |
| INV-014 | `Task.subject` is non-empty after trimming. | domain | validation error |
| INV-015 | `Note.body` is non-empty after trimming. | domain | validation error |
| INV-016 | `Task.status` is either `Open` or `Done`. | domain | validation error |
| INV-017 | `Opportunity.stage` is one of `Prospecting`, `Qualified`, `Proposal`, `Negotiation`, `ClosedWon`, or `ClosedLost`. | domain | validation error |

## Reference invariants

| ID | Invariant | Enforcement layer | Failure mode |
| --- | --- | --- | --- |
| INV-020 | When `Contact.companyId` is present, it references an existing company. | application | not-found error |
| INV-021 | When `Opportunity.companyId` is present, it references an existing company. | application | not-found error |
| INV-022 | When `Opportunity.primaryContactId` is present, it references an existing contact. | application | not-found error |
| INV-023 | A task targets exactly one parent record. | domain plus application | validation error |
| INV-024 | When `Task.contactId` is present, `Task.opportunityId` is absent. | domain | validation error |
| INV-025 | When `Task.opportunityId` is present, `Task.contactId` is absent. | domain | validation error |
| INV-026 | A task target must exist in the relevant collection. | application | not-found error |
| INV-027 | A note targets exactly one parent record. | domain plus application | validation error |
| INV-028 | When `Note.contactId` is present, `Note.opportunityId` is absent. | domain | validation error |
| INV-029 | When `Note.opportunityId` is present, `Note.contactId` is absent. | domain | validation error |
| INV-030 | A note target must exist in the relevant collection. | application | not-found error |

## Lifecycle invariants

| ID | Invariant | Enforcement layer | Failure mode |
| --- | --- | --- | --- |
| INV-040 | A newly created opportunity always starts in `Prospecting`. | application calling domain | operation must not succeed with any other initial stage |
| INV-041 | A newly created task always starts in `Open`. | application calling domain | operation must not succeed with any other initial status |
| INV-042 | `markTaskDone` results in `Task.status = Done`. | domain | operation must not succeed if another status would be produced |
| INV-043 | `markTaskDone` does not mutate unrelated task fields. | domain | operation must not succeed if unrelated fields change |

## Opportunity stage transition invariants

| ID | Invariant | Enforcement layer | Failure mode |
| --- | --- | --- | --- |
| INV-050 | `Prospecting` may transition only to `Qualified` or `ClosedLost`. | domain policy | invalid-stage-transition error |
| INV-051 | `Qualified` may transition only to `Proposal` or `ClosedLost`. | domain policy | invalid-stage-transition error |
| INV-052 | `Proposal` may transition only to `Negotiation` or `ClosedLost`. | domain policy | invalid-stage-transition error |
| INV-053 | `Negotiation` may transition only to `ClosedWon` or `ClosedLost`. | domain policy | invalid-stage-transition error |
| INV-054 | `ClosedWon` is terminal. | domain policy | invalid-stage-transition error |
| INV-055 | `ClosedLost` is terminal. | domain policy | invalid-stage-transition error |
| INV-056 | Reopening a closed opportunity is forbidden. | domain policy | invalid-stage-transition error |
| INV-057 | A successful stage transition mutates only the `stage` field. | domain | operation must not succeed if unrelated fields change |

## Query and retrieval invariants

| ID | Invariant | Enforcement layer | Failure mode |
| --- | --- | --- | --- |
| INV-060 | `getCompany`, `getContact`, `getOpportunity`, and `markTaskDone` fail for unknown IDs. | application | not-found error |
| INV-061 | List operations return deterministic snapshots of current in-memory state. | application | operation must not succeed nondeterministically |
| INV-062 | `listTasks({ contactId })` returns only tasks linked to that contact. | application | incorrect result |
| INV-063 | `listTasks({ opportunityId })` returns only tasks linked to that opportunity. | application | incorrect result |
| INV-064 | `listNotes({ contactId })` returns only notes linked to that contact. | application | incorrect result |
| INV-065 | `listNotes({ opportunityId })` returns only notes linked to that opportunity. | application | incorrect result |

## Dashboard summary invariants

| ID | Invariant | Enforcement layer | Failure mode |
| --- | --- | --- | --- |
| INV-070 | Dashboard totals equal the current counts of stored contacts, companies, opportunities, tasks, and notes. | domain projection | incorrect result |
| INV-071 | `opportunitiesByStage` includes every defined stage key even when its count is zero. | domain projection | incorrect result |
| INV-072 | The sum of `opportunitiesByStage` counts equals `totals.opportunities`. | domain projection | incorrect result |
| INV-073 | `openPipelineAmountCents` includes only opportunities not in `ClosedWon` or `ClosedLost`. | domain projection | incorrect result |
| INV-074 | `openTasksDueCount` includes only tasks with `status = Open`, a defined `dueDate`, and `dueDate <= asOfDate`. | domain projection | incorrect result |
| INV-075 | Tasks without `dueDate` never contribute to `openTasksDueCount`. | domain projection | incorrect result |
| INV-076 | Dashboard summary calculation uses only provided state and explicit `asOfDate`. | domain projection | operation must not read hidden state |

## Determinism invariants

| ID | Invariant | Enforcement layer | Failure mode |
| --- | --- | --- | --- |
| INV-080 | Domain logic does not read the system clock. | domain | design violation |
| INV-081 | Domain logic has no database, network, filesystem, or framework dependency. | domain | design violation |
| INV-082 | IDs are generated outside domain entities. | application boundary | design violation |
| INV-083 | Dashboard date-sensitive logic accepts `asOfDate` as an input instead of deriving it internally. | domain projection | validation or design violation |

## Explicit non-invariants
The following are intentionally not required in this slice:

- company name uniqueness
- company domain uniqueness
- contact email uniqueness
- contact-company alignment with opportunity-company linkage
- task due date chronology rules beyond string comparison against `asOfDate`
- timestamps, authorship, or audit metadata

These absences are intentional scope limits, not omissions in enforcement.

## Test obligations derived from invariants
At minimum, the automated test suite should prove:

- each value-validation invariant rejects invalid input
- each reference invariant rejects unknown linked IDs
- each allowed opportunity transition succeeds
- each forbidden opportunity transition fails
- each task and note parent exclusivity rule is enforced
- dashboard summary rules hold on mixed open and closed state
- no date-sensitive behavior requires a real clock

## Review note
Any future change that adds deletion, reopening, persistence, timestamps, or multi-user behavior must update this file before the implementation is considered complete.
