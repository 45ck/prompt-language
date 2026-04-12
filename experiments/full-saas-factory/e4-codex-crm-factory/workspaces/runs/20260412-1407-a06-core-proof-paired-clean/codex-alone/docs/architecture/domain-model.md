# Domain Model — CRM Core Slice

## Overview

The model is intentionally minimal and optimized for a bounded “core slice” with explicit invariants.

## Entities

### Company

- `id`
- `name`
- `domain?`
- `createdAt`, `updatedAt`

### Contact

- `id`
- `firstName`, `lastName`
- `email?`
- `companyId?` (optional association to Company)
- `createdAt`, `updatedAt`

### Opportunity

- `id`
- `companyId` (required association to Company)
- `primaryContactId?` (optional association to Contact)
- `title`
- `amountCents`, `currency`
- `stage`
- `createdAt`, `updatedAt`, `closedAt?`

#### Stages

`Prospecting | Qualified | Proposal | Negotiation | ClosedWon | ClosedLost`

Allowed transitions are an explicit graph (see `specs/invariants.md`).

### Task

- `id`
- `title`
- `status`: `Open | Completed | Canceled`
- `dueAt?`
- `related?`: reference to `company | contact | opportunity`
- `createdAt`, `updatedAt`, `completedAt?`, `canceledAt?`

### Note

- `id`
- `body`
- `related`: reference to `company | contact | opportunity`
- `createdAt`

## Relationships (high level)

- A `Contact` may belong to a `Company` (`contact.companyId?`).
- An `Opportunity` belongs to a `Company` (`opportunity.companyId`).
- An `Opportunity` may have a primary `Contact` (`opportunity.primaryContactId?`).
- A `Task` may reference one entity (company/contact/opportunity) or stand alone.
- A `Note` references exactly one entity (company/contact/opportunity).

## Aggregation boundaries

This slice does not implement event sourcing or persisted aggregates. The in-memory API layer enforces referential integrity at write time:

- IDs referenced by `companyId`, `primaryContactId`, `related` must exist.
- A primary contact’s `companyId` must match the opportunity’s company when present.

