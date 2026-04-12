# Invariants — CRM Core Slice

This document describes the invariants enforced by the pure domain layer (`packages/domain`).

## Common

- IDs are non-empty strings.
- `createdAt` and `updatedAt` are valid dates.
- Updates must be chronological: `updatedAt` cannot go backwards.

## Company

- `name` is required and trimmed.
- `domain` is optional; when present it is lowercased and must match a minimal `example.com`-like pattern.

## Contact

- `firstName`, `lastName` are required and trimmed.
- `email` is optional; when present it is trimmed, lowercased, and must match a minimal `local@domain` pattern.
- `companyId` is optional; when present it must be a non-empty string.

## Opportunity

- `companyId` is required.
- `title` is required and trimmed.
- `amountCents` is a non-negative integer.
- `currency` matches `/^[A-Z]{3}$/`.

### Stages

Stages:

- `Prospecting`
- `Qualified`
- `Proposal`
- `Negotiation`
- `ClosedWon`
- `ClosedLost`

Allowed transitions:

- `Prospecting -> Qualified` or `Prospecting -> ClosedLost`
- `Qualified -> Proposal` or `Qualified -> ClosedLost`
- `Proposal -> Negotiation` or `Proposal -> ClosedLost`
- `Negotiation -> ClosedWon` or `Negotiation -> ClosedLost`
- `ClosedWon` and `ClosedLost` have no outbound transitions

Notes:

- Closed opportunities cannot be reopened in this slice.
- When transitioning into a closed stage, `closedAt` is set.

## Task

- `title` is required and trimmed.
- Status transitions are limited:
  - `Open -> Completed`
  - `Open -> Canceled`
  - Any other transition is invalid.
- Completing sets `completedAt`; canceling sets `canceledAt`.

## Note

- `body` is required, trimmed, and limited to 5000 characters.
- Notes always reference exactly one entity via `related`.

## Dashboard summary

The dashboard is computed as a pure function over current state.

- Pipeline totals include only open opportunities.
- `tasksOverdue` counts open tasks with `dueAt < now`.
- Recent notes ordering is deterministic: newest `createdAt` first, then `id`.

