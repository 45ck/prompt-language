# Test Strategy

Testing approach for the CRM MVP. Covers test levels, tooling, coverage targets, database strategy, and CI pipeline.

## Test Levels

### Unit Tests (Vitest)

**Scope:** Pure logic, validation schemas, utility functions, domain calculations.

**Tooling:** Vitest with `@testing-library/react` for component unit tests.

**Location:** `__tests__/unit/`

**Coverage target:** 80% line coverage.

**What to test:**
- Zod validation schemas (valid input, invalid input, edge cases)
- Utility functions (date formatting, currency formatting, pagination math)
- Permission checking logic (role-based access helper functions)
- Pipeline value calculations, dashboard metric aggregations

**What NOT to test at this level:**
- Database queries, API routes, full page rendering

### Integration Tests (Vitest + Prisma)

**Scope:** Server actions, database queries, multi-model operations.

**Tooling:** Vitest with a real PostgreSQL test database via Docker Compose.

**Location:** `__tests__/integration/`

**Coverage target:** 60% of server actions and data access code.

**What to test:**
- Server actions (create, read, update, delete for each entity)
- Prisma query correctness (filters, pagination, includes, ordering)
- Role-based data access (Rep sees own records, Manager sees team, Admin sees all)
- Cascading operations (delete company and verify related contacts unlinked)
- Transaction integrity (multi-step operations roll back on failure)

**Setup:** Each test file resets the database using Prisma transactions that roll back after each test.

### API Tests (Supertest)

**Scope:** Next.js API routes, middleware, auth endpoints.

**Tooling:** Supertest against the Next.js server.

**Location:** `__tests__/api/`

**What to test:**
- Authentication flow (register, login, logout, session validation)
- Middleware enforcement (unauthenticated access returns 401, unauthorized returns 403)
- API response shapes (correct status codes, JSON structure, error formats)

### E2E Tests (Playwright)

**Scope:** Full user workflows through the browser.

**Tooling:** Playwright with Chromium.

**Location:** `__tests__/e2e/`

**What to test:**
- Login flow and session persistence
- Contact CRUD through the UI
- Pipeline drag-and-drop stage changes
- Dashboard rendering with real data
- Responsive layout at mobile breakpoints
- Delete confirmation dialogs

**Execution:** Runs against the full Docker Compose stack (app + DB).

## Test Database Strategy

### Docker Compose Services

```yaml
services:
  db:
    image: postgres:16-alpine
    ports: ["5432:5432"]
    environment:
      POSTGRES_DB: crm_dev
      POSTGRES_USER: crm
      POSTGRES_PASSWORD: crm_password

  db-test:
    image: postgres:16-alpine
    ports: ["5433:5432"]
    environment:
      POSTGRES_DB: crm_test
      POSTGRES_USER: crm
      POSTGRES_PASSWORD: crm_password
```

### Test Isolation

- **Unit tests:** No database; mock Prisma client where needed.
- **Integration tests:** Use `db-test` service on port 5433. Each test file runs inside a Prisma transaction that rolls back after each test case (`$transaction` with intentional rollback).
- **E2E tests:** Use `db-test` seeded with fixtures before each test suite. `globalSetup` runs migrations and seeds; `globalTeardown` drops the test database.

### Seed Data

`prisma/seed.ts` provides deterministic fixtures:
- 3 users (1 Admin, 1 Manager, 1 Rep)
- 10 companies
- 25 contacts linked to companies
- 15 opportunities across pipeline stages
- 20 tasks with varied statuses
- 10 notes attached to contacts and opportunities

## CI Pipeline

```
┌─────────────┐
│   Trigger    │  Push to main, PR opened/updated
└──────┬──────┘
       │
┌──────▼──────┐
│    Lint      │  npm run lint
└──────┬──────┘
       │
┌──────▼──────┐
│  Typecheck   │  npx tsc --noEmit
└──────┬──────┘
       │
┌──────▼──────┐
│ Unit Tests   │  npm run test (Vitest, no DB)
└──────┬──────┘
       │
┌──────▼──────────┐
│ Start test DB    │  docker compose up -d db-test
└──────┬──────────┘
       │
┌──────▼──────────┐
│ Integration Tests│  DATABASE_URL=...test npm run test:integration
└──────┬──────────┘
       │
┌──────▼──────┐
│    Build     │  npm run build
└──────┬──────┘
       │
┌──────▼──────┐
│  E2E Tests   │  npm run test:e2e (Playwright against built app)
└──────┬──────┘
       │
┌──────▼──────┐
│   Deploy     │  (staging only on main branch)
└─────────────┘
```

**Failure policy:** Any stage failure stops the pipeline. PRs require all checks to pass.

## Test Plan by Feature Area

| Feature Area | Unit | Integration | API | E2E | Priority |
|-------------|------|-------------|-----|-----|----------|
| Auth (register, login, logout) | Validation schemas | Session creation, role assignment | Auth endpoints, middleware | Login/logout flow | P0 |
| Contacts CRUD | Validation schemas | Create, read, update, delete actions | - | Create and search contacts | P0 |
| Companies CRUD | Validation schemas | Create, update, contact linking | - | Company list and detail | P1 |
| Opportunities CRUD | Validation, value calc | Stage transitions, win/loss | - | Pipeline board drag-drop | P0 |
| Pipeline Stages | - | Stage ordering, CRUD | - | Board rendering | P1 |
| Tasks CRUD | Validation, due date logic | Create, assign, complete, link | Permission checks | Task list and completion | P1 |
| Notes CRUD | Validation schemas | Create, edit, permission checks | Permission checks | Add note to contact | P2 |
| Dashboard | Metric calculations | Aggregation queries | - | Dashboard rendering | P1 |
| RBAC | Permission helpers | Role-filtered queries | Middleware enforcement | Role-restricted navigation | P0 |
| Pagination | Page math utilities | Paginated queries | - | Load more / page navigation | P2 |

**Priority key:** P0 = must have before launch, P1 = should have, P2 = nice to have.

## Conventions

- Test files mirror source structure: `lib/actions/contacts.ts` is tested by `__tests__/integration/contacts/create.test.ts`.
- Use `describe` blocks named after the function or feature under test.
- Use `it` statements that read as sentences: `it("returns validation error when email is invalid")`.
- Shared test helpers (auth mocking, DB reset) live in `__tests__/helpers/`.
- E2E page objects live in `__tests__/e2e/pages/`.
