# PRD: Bounded CRM HTTP Slice

## Document control
- Status: Draft for implementation handoff
- Scope: Headless HTTP service only
- Primary audience: Engineering, QA, and prompt-language delivery steps

## Product summary
Build a bounded CRM HTTP slice that supports dev sign-in, contacts, opportunities, stage moves, dashboard reporting, and JSON persistence. The slice exists to prove a realistic end-to-end workflow over HTTP without taking on full CRM scope or browser UI complexity.

## Problem statement
The repo needs a small but meaningful business slice that exercises authentication, relational data, state transitions, reporting, and durable persistence. A CRM pipeline is a good fit because it combines simple entities with rules that are easy to verify and hard to fake correctly without real domain behavior.

## Goals
- Provide a real HTTP boundary that can be exercised through integration tests and smoke flows.
- Keep business rules in a pure domain layer with no filesystem or HTTP dependencies.
- Persist state to a local JSON file so records survive process restarts.
- Model a small but credible CRM workflow from contact capture to pipeline reporting.
- Keep the slice narrow enough to implement quickly and verify thoroughly.

## Non-goals
- Browser UI, HTML rendering, or front-end assets
- Production authentication, password storage, OAuth, SSO, or user management
- Multi-user ownership, roles, permissions, or tenant separation
- Contact or opportunity delete flows
- Search, pagination, bulk import, notes, activities, attachments, or integrations
- Forecasting, quotas, win-rate analytics, or historical audit trails
- Database support beyond a single JSON persistence file

## Primary user
- Developer or tester running the service locally and calling the API directly

## Bounded scope

### In scope
- Dev-only sign-in that returns a bearer token
- Auth-protected HTTP endpoints for contacts, opportunities, stage moves, and dashboard reporting
- Contact creation and read/list behavior sufficient to support and verify opportunities
- Opportunity creation linked to an existing contact
- Explicit opportunity stage moves using a guarded transition model
- Dashboard summary reporting based on persisted data
- JSON file persistence under `data/` with restart recovery

### Out of scope
- Any capability not required to create, advance, and report on a small CRM pipeline

## Business value
- Gives the factory a concrete HTTP slice with realistic workflow semantics
- Provides a durable target for domain tests, HTTP tests, and smoke validation
- Creates a seed CRM model that later steps can extend without rethinking the core flow

## Domain model

### Contact
A contact represents a person or business relationship that can own zero or more opportunities.

Minimum fields:
- `id`
- `name`
- `email`

Optional fields:
- `company`

### Opportunity
An opportunity represents a deal tied to exactly one contact.

Required fields:
- `id`
- `contactId`
- `name`
- `amountCents`
- `stage`

### Stage model
Supported stage IDs:
- `prospecting`
- `qualified`
- `proposal`
- `negotiation`
- `closed_won`
- `closed_lost`

## Workflow overview
1. Developer signs in through a dev-only endpoint and receives a token.
2. Developer creates a contact.
3. Developer creates an opportunity linked to that contact.
4. Developer moves the opportunity through allowed stages.
5. Developer reads dashboard reporting derived from current persisted state.

## Functional requirements

### FR-1 Dev sign-in
- The system shall expose a dev-only sign-in endpoint.
- The endpoint shall return a bearer token that can be used on subsequent CRM requests.
- CRM business endpoints shall reject missing or invalid bearer tokens.

### FR-2 Contacts
- The system shall allow creation of a contact with the minimum required fields.
- The system shall return created contacts with a stable identifier.
- The system shall provide read/list access for contacts to support verification and downstream opportunity creation.

### FR-3 Opportunities
- The system shall allow creation of an opportunity for an existing contact.
- The system shall reject opportunity creation for an unknown `contactId`.
- The system shall store money as integer cents.
- The system shall default the stage to `prospecting` when no stage is supplied.

### FR-4 Stage moves
- The system shall expose an explicit stage move operation for existing opportunities.
- The system shall allow only valid transitions.
- The system shall reject invalid target stages.
- The system shall treat `closed_won` and `closed_lost` as terminal.

### FR-5 Dashboard reporting
- The system shall expose a dashboard reporting endpoint.
- The endpoint shall return total contacts, total opportunities, counts by stage, open pipeline value, and closed-won value.
- The dashboard output shall be derived from persisted state rather than cached fixtures.

### FR-6 Persistence
- The system shall persist contacts and opportunities to a JSON file.
- The system shall load existing persisted state on startup.
- The system shall use a write strategy that reduces the risk of file corruption during updates.

## Proposed HTTP surface
- `POST /auth/dev`
- `POST /contacts`
- `GET /contacts`
- `POST /opportunities`
- `GET /opportunities`
- `POST /opportunities/:id/stage-moves`
- `GET /dashboard/summary`

## Assumptions
- The service runs as a single local process.
- Data volume is small enough that whole-file JSON reads and writes are acceptable.
- A single dev identity is sufficient for this slice.
- JSON responses are the only supported representation.

## Dependencies
- Node runtime
- Local filesystem access for the JSON store
- Domain package for CRM rules
- API package for HTTP, auth gatekeeping, and persistence orchestration

## Open questions
- Should `GET /contacts` and `GET /opportunities` return all records or a bounded subset if the file grows?
- Should duplicate contact emails be allowed in this slice, or only validated as well-formed?
- Should dashboard reporting expose per-stage value totals now or remain count-focused for closed stages?

## Handoff notes
- Acceptance criteria should validate success and rejection paths for auth, contact creation, opportunity creation, stage moves, dashboard reporting, and persistence recovery.
- Implementation should preserve the architecture boundary `presentation -> infrastructure -> application -> domain`.
