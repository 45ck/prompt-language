# CRM MVP

A lightweight, self-hosted CRM application for small sales and service teams (5-25 users). Provides contact and company management, a visual sales pipeline with drag-and-drop, task tracking, notes, and a summary dashboard.

## Tech Stack

| Layer        | Technology                        |
|--------------|-----------------------------------|
| Framework    | Next.js 14+ (App Router)         |
| Language     | TypeScript (strict mode)         |
| Database     | PostgreSQL 15+                   |
| ORM          | Prisma                           |
| Auth         | NextAuth.js (credentials)        |
| Styling      | Tailwind CSS                     |
| Drag-and-Drop| dnd-kit                          |
| Testing      | Vitest, Playwright               |
| Deployment   | Docker Compose (single server)   |

## Prerequisites

- Node.js 18+
- PostgreSQL 15+
- npm 9+ or pnpm 8+

## Getting Started

```bash
# 1. Clone the repository
git clone <repo-url> && cd crm-app

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env
# Edit .env with your database URL and NextAuth secret:
#   DATABASE_URL="postgresql://user:password@localhost:5432/crm_dev"
#   NEXTAUTH_SECRET="<generate-with-openssl-rand-base64-32>"
#   NEXTAUTH_URL="http://localhost:3000"

# 4. Run database migrations
npx prisma migrate dev

# 5. Seed default data (pipeline stages, admin user)
npx prisma db seed

# 6. Start the dev server
npm run dev
```

The app is available at `http://localhost:3000`. The seed script creates a default admin account (see seed output for credentials) and the six default pipeline stages: Lead, Qualified, Proposal, Negotiation, Closed Won, Closed Lost.

## Project Structure

```
crm-app/
  apps/
    web/                  # Next.js application (App Router)
      app/                # Route handlers and pages
      components/         # React components
      lib/                # Shared utilities, auth config
  packages/
    api/                  # Shared API types and validation schemas
    db/                   # Prisma schema, migrations, seed
  docs/                   # PRD, acceptance criteria, ADRs, architecture
  specs/                  # API and data model specifications
  qa-flows/               # QA automation flows
  qa-reports/             # Test run reports
  demo/                   # Demo scripts and data
  artifacts/              # Build and deployment artifacts
```

## Available Scripts

| Script             | Description                                    |
|--------------------|------------------------------------------------|
| `npm run dev`      | Start Next.js dev server with hot reload       |
| `npm run build`    | Production build                               |
| `npm run start`    | Start production server                        |
| `npm run lint`     | Run ESLint across the codebase                 |
| `npm run typecheck`| Run TypeScript compiler in check mode          |
| `npm run test`     | Run unit and integration tests (Vitest)        |
| `npm run test:e2e` | Run end-to-end tests (Playwright)              |
| `npm run format`   | Format code with Prettier                      |
| `npm run db:migrate`| Run Prisma migrations                         |
| `npm run db:seed`  | Seed database with default data                |
| `npm run db:studio`| Open Prisma Studio for data inspection         |

## Contributing

1. Create a feature branch from `main`: `git checkout -b feat/<short-name>`.
2. Follow the existing code style. Run `npm run lint` and `npm run typecheck` before committing.
3. Write tests for new functionality. Unit tests are colocated with source files (`*.test.ts`).
4. Keep commits focused. Use conventional commit messages: `feat:`, `fix:`, `docs:`, `test:`, `chore:`.
5. Open a PR against `main`. The PR description should reference the relevant acceptance criteria (e.g., "Implements AC-07, AC-08").
6. All CI checks (lint, typecheck, test, build) must pass before merge.

## MVP Scope

This project is bounded to the features defined in `docs/prd.md`. See `docs/acceptance-criteria.md` for the 40 acceptance criteria that define "done" for the MVP. Out-of-scope items (email integration, file attachments, custom fields, notifications, import/export) are deferred to post-MVP.

## License

Private. All rights reserved.
