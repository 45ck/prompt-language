# CRM Core Slice — PRD

## Summary

This workspace implements a bounded, in-memory CRM “core slice” focused on the essential entities and workflows needed to support:

- Contacts
- Companies
- Opportunities (with stage transitions)
- Tasks
- Notes
- Dashboard summaries

It is intentionally small, deterministic, and implementation-ready.

## Goals

- Provide a clean domain model with explicit invariants and stage transition rules.
- Provide an in-memory application/API facade with referential integrity checks.
- Provide focused tests that exercise the core behaviors and error cases.

## Non-goals (out of scope)

- UI, HTTP endpoints, persistence, auth, multi-tenancy
- Custom pipelines, permissions/roles, forecasting, activity logging
- Search/indexing, attachments, comments, notifications

## Primary users

- Sales / Account executives: manage opportunities and pipeline stages.
- Sales ops: manage company/contact records and basic hygiene.

## Key workflows

1. Create a company.
2. Create contacts (optionally linked to a company).
3. Create an opportunity for a company (optionally linked to a primary contact).
4. Transition the opportunity through stages until closed-won or closed-lost.
5. Create tasks and notes related to a company/contact/opportunity.
6. View a dashboard summary of counts, pipeline totals, overdue tasks, and recent notes.

## Functional requirements

### Companies

- Create and list companies.
- Rename an existing company.

### Contacts

- Create and list contacts.
- Assign/unassign a contact to a company.

### Opportunities

- Create and list opportunities for a company.
- Enforce a minimal, explicit stage transition graph.
- Close opportunities as won or lost via stage transitions.

### Tasks

- Create and list tasks (optionally related to another entity).
- Mark tasks as completed or canceled.
- Identify overdue tasks via due date + “now”.

### Notes

- Create and list notes related to another entity.
- Provide note excerpts for dashboard summaries.

### Dashboard summary

- Provide counts for each entity type and key states (open/closed opportunities, open/overdue tasks).
- Provide pipeline totals for open opportunities by stage.
- Provide a recent notes list (stable, deterministic ordering).

## Constraints / quality attributes

- Pure TypeScript domain logic with explicit invariants (no I/O, no randomness, no clock usage inside domain).
- In-memory application/API services.
- Deterministic behavior preferred (injectable clock + id generator at API boundary).
- Focus on correctness and testability over scaffolding.

