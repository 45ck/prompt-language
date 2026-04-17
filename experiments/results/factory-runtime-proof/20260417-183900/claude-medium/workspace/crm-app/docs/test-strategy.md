# Test Strategy

## Overview

Three-layer testing approach: unit tests for domain logic and validation, integration tests for API routes with a real test database, and end-to-end tests for critical user flows through the browser.

## Test Layers

### 1. Unit Tests (Vitest)

**Scope:** Pure functions, validation schemas, utility helpers, React component rendering.

**Coverage target:** 80% line coverage across `libraries/` and shared modules.

**What to test:**
- Zod validation schemas (valid/invalid inputs for every entity)
- Utility functions (date formatting, currency display, search string normalization)
- Permission check logic (role-based access rules)
- Pipeline stage ordering logic
- Component rendering (correct props produce correct output)

**What NOT to test at this layer:**
- Database queries (use integration tests)
- Full page interactions (use e2e tests)

### 2. Integration Tests (Vitest + Test Database)

**Scope:** API route handlers end-to-end against a real PostgreSQL test database.

**Coverage target:** Every API route has at least one success and one failure test.

**What to test:**
- CRUD operations for all entities (Contact, Company, Opportunity, Task, Note)
- Org-scoped data isolation (Org A cannot see Org B data)
- Role-based access enforcement (Admin-only routes reject non-admins)
- Search functionality (name, email, filters)
- Pipeline stage operations (create, reorder, delete-with-guard)
- Authentication flows (login success, failure, session expiry)
- Dashboard aggregations (pipeline summary values, overdue task counts)

**Database setup:**
- Dedicated test database (`crm_test`)
- Prisma migrations applied before test suite runs
- Each test file uses a transaction that rolls back after completion
- Seed data created per-test or per-suite, never shared across files

### 3. E2E Tests (Playwright)

**Scope:** Browser-based tests for the top 5 critical user flows.

**Coverage target:** 5 flows, each with happy path and one key error path.

**Critical flows:**
1. **Login and dashboard** - Log in, see dashboard with pipeline summary and tasks
2. **Contact lifecycle** - Create contact, edit, add note, link to company
3. **Opportunity pipeline** - Create opportunity, move through stages, verify board
4. **Task management** - Create task linked to contact, mark complete
5. **Admin user management** - Invite user, assign role, verify access

**Setup:**
- Runs against a local dev server with seeded test database
- Each test suite resets to a known seed state before running
- Uses Playwright's built-in test isolation (browser contexts)

## Test Naming Conventions

```typescript
// Unit tests
describe('validateContact', () => {
  it('should accept valid contact with first and last name', () => { ... });
  it('should reject contact without last name', () => { ... });
});

// Integration tests
describe('POST /api/contacts', () => {
  it('should create contact and return 201', () => { ... });
  it('should return 400 when first name is missing', () => { ... });
  it('should return 403 for cross-org access', () => { ... });
});

// E2E tests
test.describe('Contact lifecycle', () => {
  test('create a new contact and verify it appears in the list', async ({ page }) => { ... });
});
```

## Data Seeding

### Seed Script (`prisma/seed.ts`)

Creates a baseline dataset for development and testing:

- 2 organizations (Org A, Org B)
- 4 users per org (one per role: Admin, Sales Manager, Sales Rep, Service Agent)
- 5 contacts per org with varying data completeness
- 3 companies per org
- 4 pipeline stages per org (Prospect, Qualification, Proposal, Closed Won)
- 6 opportunities spread across stages
- 10 tasks (mix of open, completed, overdue)
- 8 notes across contacts and opportunities

### Test Fixtures

Integration and e2e tests use factory functions to create test-specific data:

```typescript
// Example factory
function createTestContact(overrides?: Partial<Contact>): ContactCreateInput {
  return {
    firstName: 'Test',
    lastName: 'Contact',
    email: `test-${randomId()}@example.com`,
    ...overrides,
  };
}
```

## CI Integration

Tests run in order: unit (fast feedback) then integration (requires DB) then e2e (slowest).

```bash
npm run test              # Unit tests only
npm run test:integration  # Integration tests (requires test DB)
npm run test:e2e          # Playwright e2e tests (requires dev server)
npm run test:coverage     # Unit tests with coverage report
```

All three must pass before a PR can merge.
