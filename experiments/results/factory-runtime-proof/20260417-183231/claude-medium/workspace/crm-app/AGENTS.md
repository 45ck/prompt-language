# Agent Coordination Guide

Instructions for AI coding agents working on this codebase.

## Architecture

Next.js App Router with route groups, Prisma for DB, server actions for mutations, React Server Components for reads.

- **Route groups**: `(auth)` for public auth pages, `(dashboard)` for authenticated pages.
- **Data fetching**: React Server Components call Prisma directly for reads. No client-side fetching for initial page loads.
- **Mutations**: Server actions in `lib/actions/` handle all writes. Each action validates input with Zod, checks authorization, then calls Prisma.
- **Auth**: NextAuth.js v5 with credential provider. Three roles: Admin, Manager, Rep. Middleware enforces auth on `(dashboard)` routes.

## Directory Layout Conventions

```
app/(dashboard)/contacts/page.tsx      # Contact list page (RSC)
app/(dashboard)/contacts/[id]/page.tsx # Contact detail page (RSC)
app/(dashboard)/contacts/new/page.tsx  # New contact form
lib/actions/contacts.ts                # Server actions: createContact, updateContact, deleteContact
lib/validations/contacts.ts            # Zod schemas: contactCreateSchema, contactUpdateSchema
lib/db/prisma.ts                       # Singleton Prisma client
components/features/contacts/          # Contact-specific components
components/ui/                         # Shared UI primitives (Button, Input, Table, Modal)
prisma/schema.prisma                   # Single schema file for all models
__tests__/unit/                        # Unit tests (pure logic, validations)
__tests__/integration/                 # Integration tests (Prisma + test DB)
__tests__/api/                         # API route tests (supertest)
__tests__/e2e/                         # Playwright E2E tests
```

## Naming Conventions

| Item | Convention | Example |
|------|-----------|---------|
| Pages | `page.tsx` (Next.js convention) | `app/(dashboard)/contacts/page.tsx` |
| Layouts | `layout.tsx` | `app/(dashboard)/layout.tsx` |
| Server actions | camelCase verbs | `createContact`, `updateOpportunity` |
| Action files | plural noun | `lib/actions/contacts.ts` |
| Validation files | plural noun | `lib/validations/contacts.ts` |
| Components | PascalCase | `ContactForm.tsx`, `PipelineBoard.tsx` |
| Test files | `*.test.ts` or `*.spec.ts` | `contacts.test.ts` |
| DB models | PascalCase singular | `Contact`, `Company`, `Opportunity` |
| DB enums | PascalCase | `UserRole`, `TaskStatus`, `OpportunityStage` |

## Key Files and What They Control

| File | Purpose |
|------|---------|
| `prisma/schema.prisma` | All database models, relations, enums |
| `lib/auth/options.ts` | NextAuth configuration, session callbacks, role injection |
| `lib/db/prisma.ts` | Prisma client singleton (prevents connection exhaustion in dev) |
| `middleware.ts` | Route protection, role-based access control |
| `app/layout.tsx` | Root layout, providers (SessionProvider, theme) |
| `docker-compose.yml` | PostgreSQL, app, and test-db services |
| `.env.example` | Required environment variables |

## How to Run Tests

```bash
# Unit tests (fast, no DB required)
npm run test

# Integration tests (requires test DB running)
docker compose up -d db-test
DATABASE_URL="postgresql://crm:crm_password@localhost:5433/crm_test" npm run test -- --project integration

# E2E tests (requires full app + DB running)
npm run test:e2e

# Coverage report
npm run test:coverage
```

## How to Work on Features

1. Check `docs/traceability.md` for the acceptance criteria tied to the user story.
2. Start with the Prisma schema if new models are needed. Run `npx prisma migrate dev --name <description>`.
3. Add Zod validation schemas in `lib/validations/`.
4. Implement server actions in `lib/actions/`.
5. Build the UI with React Server Components for reads, client components only when interactivity is required.
6. Write tests at the appropriate level (see `docs/test-strategy.md`).

## PR Checklist

Before opening a PR, verify:

- [ ] `npm run lint` passes with zero warnings
- [ ] `npm run test` passes
- [ ] New Prisma migrations are included (if schema changed)
- [ ] Zod schemas validate all user input for new/changed endpoints
- [ ] Server actions check user role authorization
- [ ] User story ID referenced in commit messages (e.g., `feat(contacts): add search filter [CO-3]`)
- [ ] No secrets or credentials in committed files
- [ ] New environment variables added to `.env.example`

## Role-Based Access Rules

Agents must enforce these access rules in server actions and middleware:

| Resource | Admin | Manager | Rep |
|----------|-------|---------|-----|
| User management | Full CRUD | Read-only | No access |
| Contacts | Full CRUD | Full CRUD | Own contacts only |
| Companies | Full CRUD | Full CRUD | Read + link to own contacts |
| Opportunities | Full CRUD | Full CRUD (team) | Own opportunities |
| Pipeline stages | Full CRUD | Read-only | Read-only |
| Tasks | Full CRUD | Team tasks | Own tasks |
| Notes | Full CRUD | Team notes | Own notes |
| Dashboard | All metrics | Team metrics | Own metrics |
