# CRM MVP

A lightweight CRM application for small-to-medium sales and service teams. Built with Next.js 14+, TypeScript, PostgreSQL, and Prisma.

## Overview

**What:** A customer relationship management system covering contacts, companies, opportunities, pipeline management, tasks, notes, and a reporting dashboard.

**Who:** Sales representatives, managers, and administrators on teams of 5-50 people.

**Why:** Provide a simple, self-hosted CRM that covers core sales workflows without the complexity and cost of enterprise platforms.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14+ (App Router) |
| Language | TypeScript 5.x |
| Database | PostgreSQL 16 |
| ORM | Prisma 5.x |
| Auth | NextAuth.js v5 |
| Styling | Tailwind CSS 3.x |
| Testing | Vitest, Playwright, Supertest |
| Containerization | Docker Compose |

## Quick Start (Docker Compose)

```bash
# Clone and start all services
git clone <repo-url> && cd crm-app
cp .env.example .env
docker compose up -d

# Run migrations inside the app container
docker compose exec app npx prisma migrate deploy

# App is available at http://localhost:3000
```

## Development Setup

```bash
# Install dependencies
npm install

# Start PostgreSQL (if not using Docker)
docker compose up -d db

# Run database migrations
npx prisma migrate dev

# Seed the database with sample data
npx prisma db seed

# Start the dev server
npm run dev
```

The app runs at `http://localhost:3000`.

## Project Structure

```
crm-app/
├── app/                    # Next.js App Router pages and layouts
│   ├── (auth)/             # Auth route group (login, register)
│   ├── (dashboard)/        # Authenticated route group
│   │   ├── contacts/
│   │   ├── companies/
│   │   ├── opportunities/
│   │   ├── tasks/
│   │   ├── notes/
│   │   ├── pipeline/
│   │   └── settings/
│   ├── api/                # API routes (NextAuth, REST endpoints)
│   └── layout.tsx          # Root layout
├── lib/                    # Shared library code
│   ├── actions/            # Server actions for mutations
│   ├── db/                 # Prisma client and helpers
│   ├── auth/               # NextAuth configuration
│   ├── validations/        # Zod schemas
│   └── utils/              # Utility functions
├── components/             # Reusable React components
│   ├── ui/                 # Base UI components
│   └── features/           # Feature-specific components
├── prisma/                 # Prisma schema and migrations
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
├── docs/                   # Project documentation
├── __tests__/              # Test files
│   ├── unit/
│   ├── integration/
│   ├── api/
│   └── e2e/
├── docker-compose.yml
├── .env.example
└── package.json
```

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run format` | Run Prettier |
| `npm run test` | Run unit and integration tests (Vitest) |
| `npm run test:coverage` | Run tests with coverage report |
| `npm run test:e2e` | Run Playwright E2E tests |
| `npm run db:migrate` | Run Prisma migrations |
| `npm run db:seed` | Seed the database |
| `npm run db:studio` | Open Prisma Studio |

## Environment Variables

Create a `.env` file from the example:

```bash
cp .env.example .env
```

```env
# .env.example

# Database
DATABASE_URL="postgresql://crm:crm_password@localhost:5432/crm_dev?schema=public"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="generate-a-random-secret-here"

# App
NODE_ENV="development"
```

## Contributing

1. Create a feature branch from `main`.
2. Follow the naming conventions in `AGENTS.md`.
3. Write tests for new functionality (see `docs/test-strategy.md`).
4. Ensure `npm run lint` and `npm run test` pass before opening a PR.
5. Reference the relevant user story ID (e.g., CO-3) in your commit message.
6. Keep PRs focused on a single feature or fix.
