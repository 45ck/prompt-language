# Agent Instructions

## Repository Structure

This is a monorepo for a CRM MVP application.

- `apps/web/` - Next.js frontend (pages, components, hooks, styles)
- `apps/api/` - API route handlers (Next.js API routes)
- `libraries/` - Shared types, validation schemas, utility functions
- `packages/` - Internal packages (Prisma client config, auth helpers)
- `docs/` - Product requirements, acceptance criteria, ADRs, architecture docs
- `specs/` - Test specifications and fixtures

## Coding Conventions

- **TypeScript strict mode** everywhere. No `any` types unless absolutely necessary.
- **Prisma** for all database access. Never write raw SQL.
- **Next.js API routes** for backend endpoints. Follow RESTful conventions.
- All API routes must enforce org-scoped data isolation via middleware.
- Use Zod for request/response validation at API boundaries.
- Prefer named exports. Use `type` imports for type-only symbols.
- No `eslint-disable` comments.
- Entity creation goes through service functions, not direct Prisma calls in routes.

## Database

- PostgreSQL with Prisma ORM.
- Migrations via `npx prisma migrate dev`.
- Every query must filter by `orgId` to enforce tenant isolation.
- Seed data lives in `prisma/seed.ts`.

## Testing

- **Unit tests:** Vitest. Colocated with source files as `*.test.ts`.
- **Integration tests:** Vitest with test database. Test API routes end-to-end against a real DB.
- **E2E tests:** Playwright. Cover the top 5 critical user flows.
- Test naming: `describe('ComponentOrFunction', () => { it('should do expected behavior', ...) })`

## Key Commands

```bash
npm run dev          # Start dev server
npm run lint         # ESLint
npm run typecheck    # tsc --noEmit
npm run test         # Vitest test suite
npx prisma studio   # Visual database browser
npx prisma migrate dev  # Run pending migrations
```

## Important Patterns

- All entities belong to an Organization. Always include `orgId` in queries.
- Role-based access is checked via middleware, not in individual route handlers.
- Pipeline stages are per-org and ordered by `position` field.
- Notes are polymorphic: linked via `entityType` + `entityId` to contacts, companies, or opportunities.
- Tasks follow the same polymorphic linking pattern.
