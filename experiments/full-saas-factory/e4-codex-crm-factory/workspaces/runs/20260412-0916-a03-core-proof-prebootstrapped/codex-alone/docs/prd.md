# PRD — Bounded CRM Core Slice

## Summary

This workspace implements a small, implementation-ready CRM “core slice” focused on in-memory operations and pure TypeScript domain logic. It intentionally excludes UI, auth, and persistence.

## Goals

- Model core CRM records: companies, contacts, opportunities, tasks, notes.
- Enforce opportunity stage transitions with explicit rules.
- Produce a deterministic dashboard summary over the current in-memory state.
- Keep domain logic pure (no IO, no clocks, no randomness).

## Non-goals

- UI, routing, forms, or any browser code.
- Authentication/authorization, multi-tenant concerns, permissions.
- Persistence (DB), migrations, external integrations, email/calendar sync.
- Full CRM features (pipelines, custom fields, deduping, activity feeds).

## Primary Behaviors (In Scope)

- **Companies**: create, update, get, list.
- **Contacts**: create, update, get, list; optionally linked to a company.
- **Opportunities**: create, update, get, list; stage transitions and close outcomes.
- **Stage transitions**: deterministic validation of allowed stage moves.
- **Tasks**: create, complete, get, list; optionally related to a CRM record.
- **Notes**: create, update, get, list; always related to a CRM record.
- **Dashboard summaries**: totals, opportunity counts by stage, task health (open/completed/overdue/due soon).

## Success Criteria

- `npm run lint`, `npm run typecheck`, and `npm run test` pass.
- All core behaviors are covered by focused tests.
- Domain invariants are documented and enforced in code.

