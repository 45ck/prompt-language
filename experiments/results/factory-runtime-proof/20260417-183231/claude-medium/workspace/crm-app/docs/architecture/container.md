# C4 Container Diagram -- CRM MVP

## Containers

```
+------------------------------------------------------------------+
|                       CRM Application                            |
|                                                                  |
|  +---------------------------+  +----------------------------+   |
|  |  Next.js Frontend         |  |  Next.js API Routes        |   |
|  |  (App Router)             |  |  (Backend)                 |   |
|  |                           |  |                            |   |
|  |  - React 18+ (RSC + CC)  |  |  - Route Handlers          |   |
|  |  - Tailwind CSS           |  |  - NextAuth.js sessions    |   |
|  |  - Server Components      |  |  - Zod request validation  |   |
|  |  - Client Components      |  |  - RBAC middleware         |   |
|  |  - React Hook Form        |  |  - Business logic          |   |
|  |                           |  |                            |   |
|  +------------+--------------+  +-------------+--------------+   |
|               |                               |                  |
+------------------------------------------------------------------+
                |                               |
                | (in-process)                  | Prisma Client
                | Server Components call        | (TypeScript ORM)
                | API routes directly or        |
                | fetch from route handlers     |
                |                               |
                +---------------+---------------+
                                |
                                v
                  +-------------+--------------+
                  |  Prisma ORM Layer          |
                  |                            |
                  |  - Schema-driven types     |
                  |  - Migration management    |
                  |  - Connection pooling      |
                  |  - Query building          |
                  +-------------+--------------+
                                |
                                | SQL over TCP (port 5432)
                                |
                                v
                  +-------------+--------------+
                  |  PostgreSQL Database       |
                  |                            |
                  |  - All CRM entity tables   |
                  |  - Indexes for common      |
                  |    queries                 |
                  |  - Row-level constraints   |
                  +----------------------------+
```

## Container Descriptions

### Next.js Frontend (App Router)

| Attribute    | Value                                              |
| ------------ | -------------------------------------------------- |
| Technology   | React 18+, Next.js 14+ App Router, Tailwind CSS   |
| Responsibility | Renders UI, handles client-side interactions,    |
|              | form validation, optimistic updates, navigation    |
| Deployment   | Same Docker container as API (single Next.js app)  |

Key pages:
- `/` -- Dashboard (role-filtered metrics)
- `/contacts` -- Contact list and detail
- `/companies` -- Company list and detail
- `/opportunities` -- Pipeline board (Kanban) and list view
- `/tasks` -- Task list with filters
- `/admin/users` -- User management (Admin only)
- `/admin/pipeline` -- Pipeline stage configuration (Admin only)

### Next.js API Routes (Backend)

| Attribute    | Value                                              |
| ------------ | -------------------------------------------------- |
| Technology   | Next.js Route Handlers (`app/api/**/route.ts`)     |
| Responsibility | Authentication, authorization, input validation, |
|              | business rules, data access orchestration          |
| Deployment   | Same process as frontend                           |

Route groups:
- `/api/auth/*` -- NextAuth.js (Google OAuth + credentials)
- `/api/contacts` -- CRUD for contacts
- `/api/companies` -- CRUD for companies
- `/api/opportunities` -- CRUD, stage transitions
- `/api/pipeline-stages` -- CRUD (Admin only)
- `/api/tasks` -- CRUD with entity linking
- `/api/notes` -- CRUD with entity linking
- `/api/dashboard` -- Aggregated metrics

### Prisma ORM Layer

| Attribute    | Value                                              |
| ------------ | -------------------------------------------------- |
| Technology   | Prisma Client (TypeScript), Prisma Migrate         |
| Responsibility | Type-safe database access, schema migrations,    |
|              | connection pooling                                 |
| Deployment   | In-process library within the Next.js container    |

### PostgreSQL Database

| Attribute    | Value                                              |
| ------------ | -------------------------------------------------- |
| Technology   | PostgreSQL 15+                                     |
| Responsibility | Persistent storage of all CRM data               |
| Deployment   | Separate Docker container (docker-compose service) |

## Communication Paths

| From               | To                 | Protocol     | Purpose                        |
| ------------------ | ------------------ | ------------ | ------------------------------ |
| Browser            | Next.js Frontend   | HTTPS        | Page loads, static assets      |
| Browser            | Next.js API Routes | HTTPS (JSON) | Data mutations, queries        |
| Next.js Frontend   | Next.js API Routes | In-process   | Server Components data fetch   |
| Next.js API Routes | Prisma ORM Layer   | Function call| Type-safe query building       |
| Prisma ORM Layer   | PostgreSQL         | SQL/TCP      | Reads and writes               |
| Next.js API Routes | Google OAuth       | HTTPS        | OAuth 2.0 token exchange       |

## Deployment Topology (Docker Compose)

```yaml
services:
  app:        # Next.js (frontend + API + Prisma)  port 3000
  db:         # PostgreSQL 15                       port 5432
```

Single `docker compose up` starts both services. The app container runs `npx prisma migrate deploy` on startup to apply pending migrations.
