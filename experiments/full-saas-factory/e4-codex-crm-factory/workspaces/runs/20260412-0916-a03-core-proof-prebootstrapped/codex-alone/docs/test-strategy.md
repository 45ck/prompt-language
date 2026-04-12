# Test Strategy — CRM Core Slice

## Principles

- Prefer deterministic tests: inject clocks, avoid `Date.now()` in tests.
- Keep tests focused on observable behaviors and invariants.
- Separate pure domain testing from application orchestration testing.

## Test Layers

### Domain unit tests (`packages/domain/test/*`)

- Validate normalization and input constraints (trim, email normalization).
- Validate opportunity stage transitions (allowed vs. forbidden).
- Validate dashboard summary aggregation (counts and due/overdue logic).

### API in-memory tests (`packages/api/test/*`)

- Verify reference existence checks (`NOT_FOUND`).
- Verify domain errors are surfaced as `BAD_REQUEST`.
- Verify orchestration creates linked records and summary matches state.

## Commands

```sh
npm run test
```

