# H13: Performance Optimization — Fix N+1 Query Pattern

## Task

The contacts API has an N+1 query problem in `src/app.js`. The `getContactsWithCompanies()` function loads all contacts, then makes a separate query for each contact's company. Fix this to use a batch/join approach.

## Acceptance Criteria

1. The `getContactsWithCompanies()` function makes at most 2 database calls (one for contacts, one for companies), not N+1
2. Results are identical to the original implementation
3. The benchmark in `verify.js` shows fewer query calls than before
4. No existing functionality is broken
