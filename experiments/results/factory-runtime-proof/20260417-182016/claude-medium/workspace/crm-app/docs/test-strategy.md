# Test Strategy

Testing approach for the CRM MVP. All tests are bounded to the 40 acceptance criteria defined in `docs/acceptance-criteria.md`.

## Test Levels

### Unit Tests (Vitest)

**Scope:** Pure functions, validation logic, utility helpers, API route handlers with mocked dependencies.

**Tools:** Vitest, `@prisma/client` mocked via `vitest-mock-extended`.

**What to test:**
- Input validation schemas (Zod) for all API routes
- Authorization checks (role guards return 403 for unauthorized roles)
- Business logic: stage transition rules, task filtering, note ownership checks
- Utility functions: pagination helpers, search query builders, date comparisons

**What not to test:** Prisma query correctness (covered by integration tests), React component rendering (covered by E2E).

**Location:** Colocated with source files as `*.test.ts`.

**Coverage target:** >80% line coverage across `packages/api` and `apps/web/lib`.

### Integration Tests (Vitest + Test Database)

**Scope:** API route handlers executing against a real PostgreSQL test database.

**Tools:** Vitest, Prisma with a dedicated test database (`crm_test`), `supertest` or direct route invocation.

**Setup:**
- `DATABASE_URL` points to `crm_test` in the test environment.
- Each test suite runs `prisma migrate reset --force` in `beforeAll` to ensure a clean state.
- Seed data is inserted per-suite as needed (not shared across suites).

**What to test:**
- Full CRUD lifecycle for each entity (contacts, companies, opportunities, tasks, notes)
- Search and filter queries return correct results
- Cascade behavior (e.g., deleting a company does not orphan contacts)
- Authentication and session handling via NextAuth test helpers
- Dashboard aggregation queries return correct counts and sums

**Coverage target:** >60% of API routes exercised with real database queries.

### End-to-End Tests (Playwright)

**Scope:** Critical user workflows through the browser.

**Tools:** Playwright with Chromium.

**Scenarios (minimum 5):**

1. **Registration and login flow** (AC-01, AC-03): Register a new user, log out, log back in, verify dashboard.
2. **Contact CRUD** (AC-07, AC-08, AC-09): Create a contact, edit it, delete it, verify list updates.
3. **Pipeline drag-and-drop** (AC-15, AC-16): Create an opportunity, drag it between stages, refresh to confirm persistence.
4. **Task lifecycle** (AC-25, AC-26, AC-27): Create a task linked to a contact, complete it, verify dashboard widget updates.
5. **Dashboard widgets** (AC-33, AC-34, AC-35): Verify pipeline summary, overdue tasks, and my-tasks widgets show correct data.
6. **Admin role management** (AC-24, AC-38, AC-39): Admin changes a user role, verify access changes take effect.

**Configuration:**
- Base URL: `http://localhost:3000`
- Test database seeded before suite via global setup script.
- Each scenario uses a fresh authenticated session (login via API, inject session cookie).

## Test Naming Convention

```
describe('<Entity> <Operation>', () => {
  it('should <expected behavior> when <condition>', () => { ... });
});
```

Examples:
- `describe('Contacts API', () => { it('should return 400 when last name is empty', ...) })`
- `describe('Pipeline Board', () => { it('should persist stage change after drag-and-drop', ...) })`

## CI Integration

Tests run in the CI pipeline in this order:

1. `npm run typecheck` -- TypeScript compilation check
2. `npm run lint` -- ESLint
3. `npm run test` -- Unit + integration tests (Vitest)
4. `npm run build` -- Next.js production build
5. `npm run test:e2e` -- Playwright E2E tests (against built app)

**CI environment requirements:**
- PostgreSQL 15 service container for integration tests
- `DATABASE_URL` set to the CI test database
- `NEXTAUTH_SECRET` set to a fixed test value

**Failure policy:** Any test failure blocks the PR from merging. No skipped tests in CI without a linked issue.

## Coverage Reporting

- Vitest generates coverage reports via `v8` provider.
- Reports output to `coverage/` in lcov and text formats.
- CI posts a coverage summary comment on PRs.
- Minimum thresholds enforced in `vitest.config.ts`:
  - Lines: 80%
  - Branches: 75%
  - Functions: 80%
