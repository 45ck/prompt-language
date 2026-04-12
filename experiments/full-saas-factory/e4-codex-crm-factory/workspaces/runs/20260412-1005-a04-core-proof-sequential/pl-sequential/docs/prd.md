# PRD: Bounded CRM Core (Core Proof)

## 1. Summary

Build a small, implementation-ready CRM core slice with deterministic, dependency-free domain logic and in-memory application services. The slice supports:

- Companies and contacts (basic relationship)
- Opportunities with stage transitions (bounded stage machine)
- Tasks and notes attached to CRM records
- Dashboard summaries computed from in-memory state

This workspace is a “core proof” and intentionally excludes persistence, auth, UI, and integrations.

## 2. Goals

- Provide a minimal but coherent CRM domain model (TypeScript, pure logic).
- Enable key workflows end-to-end using in-memory services:
  - Create company
  - Create contact (optionally linked to a company)
  - Create opportunity for a company
  - Move opportunity stage with validation + history
  - Add tasks and notes to records
  - Compute dashboard summaries from current state
- Keep everything deterministic for tests:
  - No `Date.now()`, randomness, or I/O inside domain.
  - Time and IDs are provided by the caller.

## 3. Non-goals (out of scope)

- Authentication, authorization, multi-tenant concerns
- Persistence (DB), migrations, event buses, queues
- Search, filtering, sorting, pagination
- UI, API server, HTTP, routing
- Custom pipelines, custom fields, automations
- Assignments, notifications, reminders, calendars
- Email sync, integrations, imports/exports
- Deduplication, enrichment, lead scoring

## 4. Users / primary use cases

### Persona: Sales Rep

- Tracks companies and contacts.
- Works a pipeline of opportunities through stages.
- Adds tasks (follow-ups) and notes (call summaries).
- Checks a dashboard to see pipeline and follow-up load.

## 5. Functional scope (bounded)

### 5.1 Common patterns

- **Identifiers**: `id` is a caller-provided string. Services reject duplicates.
- **Time**: `now` is caller-provided (ISO-8601 string). Domain does not read the clock.
- **Dates**: Task due dates use `YYYY-MM-DD` strings to avoid timezone ambiguity.
- **Subject references**: Tasks/notes attach to a `SubjectRef`:
  - `{ type: "company" | "contact" | "opportunity"; id: string }`

### 5.2 Company

Fields:
- `id: string`
- `name: string` (required, non-empty)
- `createdAt: string` (ISO-8601)

Operations:
- Create company

### 5.3 Contact

Fields:
- `id: string`
- `firstName: string` (required, non-empty)
- `lastName: string` (required, non-empty)
- `email?: string` (optional; if present, must be valid format)
- `companyId?: string` (optional; if present, must refer to an existing company)
- `createdAt: string` (ISO-8601)

Operations:
- Create contact

### 5.4 Opportunity

Fields:
- `id: string`
- `companyId: string` (required; must exist)
- `name: string` (required, non-empty)
- `stage: OpportunityStage` (required; defaults to `Prospecting` on create)
- `amountCents: number` (required; integer, `>= 0`)
- `primaryContactId?: string` (optional; if present, must exist)
- `createdAt: string` (ISO-8601)
- `stageHistory: OpportunityStageChange[]` (append-only)

Stage enum (fixed for this slice):
- `Prospecting`
- `Qualified`
- `Proposal`
- `Negotiation`
- `ClosedWon`
- `ClosedLost`

Stage transition rules (bounded state machine):
- Linear progress: `Prospecting -> Qualified -> Proposal -> Negotiation -> ClosedWon`
- At any **open** stage (`Prospecting`, `Qualified`, `Proposal`, `Negotiation`), you may move to `ClosedLost`.
- No transitions out of `ClosedWon` or `ClosedLost`.
- No skipping forward stages (e.g. `Prospecting -> Proposal` is invalid).

Stage history:
- Each transition appends `{ from, to, at }` where `at` is caller-provided (ISO-8601).

Operations:
- Create opportunity
- Move opportunity stage

### 5.5 Task

Fields:
- `id: string`
- `subject: SubjectRef` (required; must exist)
- `title: string` (required, non-empty)
- `dueOn: string` (required; `YYYY-MM-DD`)
- `status: "open" | "done"` (defaults to `"open"`)
- `createdAt: string` (ISO-8601)

Operations:
- Add task to a subject
- Mark task as done

### 5.6 Note

Fields:
- `id: string`
- `subject: SubjectRef` (required; must exist)
- `body: string` (required, non-empty)
- `createdAt: string` (ISO-8601)

Operations:
- Add note to a subject

### 5.7 Dashboard summaries

Summary is computed from in-memory collections and must be deterministic.

Inputs:
- Current in-memory state (companies, contacts, opportunities, tasks, notes)
- `today: string` (`YYYY-MM-DD`) used for due-date classification

Outputs (bounded):
- Totals:
  - `companiesTotal`
  - `contactsTotal`
  - `opportunitiesTotal`
  - `openOpportunitiesTotal` (stage not closed)
- Opportunity pipeline:
  - `opportunitiesByStage: Record<OpportunityStage, number>`
  - `openOpportunityAmountCentsTotal` (sum of `amountCents` where stage is open)
- Tasks:
  - `openTasksTotal`
  - `openTasksOverdue` (dueOn < today)
  - `openTasksDueToday` (dueOn == today)

Notes:
- Notes are stored and retrievable by subject but do not affect the numeric dashboard summary beyond existence in state.

## 6. Data validation (must be enforced)

- Non-empty string fields: company name, contact names, opportunity name, task title, note body.
- Email format: if present on contact.
- Money: `amountCents` is an integer and `>= 0`.
- References:
  - `companyId` on contact/opportunity must exist.
  - `primaryContactId` on opportunity must exist (no strict requirement to belong to the company in this slice).
  - Task/note subject must exist.
- Stage machine rules must be enforced on every move.
- `dueOn` and `today` must be `YYYY-MM-DD`.
- Timestamp strings (`createdAt`, `at`) must be valid ISO-8601 strings.

## 7. Success metrics (for this proof)

- Domain and services are deterministic and dependency-free.
- Tests cover:
  - stage transitions (valid/invalid)
  - reference validation
  - dashboard summaries
- Lint, typecheck, and tests pass for the workspace.

