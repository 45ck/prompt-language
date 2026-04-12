# Handover — CRM Core Slice

## What’s implemented

- Pure domain model + invariants: `packages/domain/src/index.ts`
- In-memory application API: `packages/api/src/index.ts`
- Focused tests:
  - Domain: `packages/domain/test/domain.test.ts`
  - API: `packages/api/test/api.test.ts`

## How to run checks

```sh
npm run lint
npm run typecheck
npm run test
```

## How to use

The intended integration point is the API factory:

- Import `createInMemoryCrmApi` from `packages/api/src/index.ts`
- Optionally inject a deterministic clock via `{ now: () => number }`

## Extension points (safe changes)

- Add persistence by keeping `packages/domain` unchanged and creating a new package that stores entities (DB, files, etc.) and calls domain functions.
- Add an HTTP transport by mapping request DTOs to `CrmApi` calls (do not put HTTP concerns in the domain).
- Expand opportunity pipeline rules by editing `canTransitionOpportunityStage` and `transitionOpportunityStage` in the domain and updating tests.

## Known limitations

- No auth, permissions, or multi-tenancy.
- No UI; this is a core slice only.
- No optimistic concurrency/versioning.

