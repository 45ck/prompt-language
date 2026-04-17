# CRM App

MVP CRM for small-to-medium sales and service teams (5-50 users). Covers contact and company management, opportunity pipeline tracking, task management, notes, and a dashboard with pipeline summaries and overdue task visibility.

## Tech Stack

- **Frontend:** Next.js with TypeScript
- **Backend:** Next.js API routes
- **Database:** PostgreSQL with Prisma ORM
- **Testing:** Vitest (unit/integration), Playwright (e2e)

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL 15+
- npm 9+

### Setup

```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your DATABASE_URL and session secret

# Set up database
npx prisma migrate dev --name init
npx prisma db seed

# Start development server
npm run dev
```

The app runs at `http://localhost:3000` by default.

## Project Structure

```
crm-app/
  apps/
    web/             # Next.js frontend (pages, components, hooks)
    api/             # API route handlers
  libraries/         # Shared code (types, utilities, validation)
  packages/          # Internal packages (Prisma client, auth)
  docs/              # PRD, acceptance criteria, architecture decisions
    adr/             # Architecture Decision Records
    architecture/    # System design documents
    research/        # Background research
  specs/             # Test specifications
  phases/            # Implementation phase plans
  qa-flows/          # QA automation flows
  qa-reports/        # QA test results
```

## Key Commands

```bash
npm run dev          # Start development server
npm run lint         # Run linter
npm run typecheck    # TypeScript type checking
npm run test         # Run test suite
```

## Core Entities

- **User** - Authenticated team member with role-based access
- **Organization** - Tenant boundary for data isolation
- **Contact** - Individual person record
- **Company** - Business entity linked to contacts
- **Opportunity** - Deal tracked through pipeline stages
- **PipelineStage** - Configurable pipeline columns per organization
- **Task** - Action item with due date and assignee
- **Note** - Free-text annotation on contacts, companies, or opportunities

## Roles

| Role | Permissions |
|------|------------|
| Admin | Full access, user management, pipeline configuration |
| Sales Manager | Dashboard with team-wide views, owner filters |
| Sales Rep | CRUD on own contacts, opportunities, tasks, notes |
| Service Agent | Contact search, note logging, task creation |

## Documentation

See [docs/](./docs/) for the full PRD, acceptance criteria, architecture decisions, and use cases.
