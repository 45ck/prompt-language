# ADR-001: Use Next.js + Prisma + PostgreSQL for CRM MVP

## Status

Accepted

## Date

2026-04-17

## Context

A small-to-medium sales/service team (5-50 users) needs a self-hosted CRM application. The requirements are:

- Web-based UI with responsive design for desktop use.
- Authentication with role-based access control (Admin, Manager, Rep).
- Core CRM entities: contacts, companies, opportunities, pipeline stages, tasks, notes.
- Dashboard with pipeline metrics.
- Low operational overhead -- the team does not have dedicated DevOps staff.
- Self-hosted deployment (no SaaS dependency for data sovereignty).
- Fast MVP delivery with a small development team.

The team evaluated several approaches:

1. **Separate frontend (React SPA) + backend (Express/Fastify) + PostgreSQL** -- Two deployment units, separate build pipelines, API contract duplication.
2. **Next.js full-stack + Prisma + PostgreSQL** -- Single deployment unit, shared TypeScript types, built-in API routes.
3. **Django/Rails monolith** -- Mature ecosystems but introduces a second language (Python/Ruby) alongside any frontend JavaScript.
4. **Low-code platform (Retool, Budibase)** -- Fast prototyping but limited customization, vendor lock-in, harder self-hosting.

## Decision

Use **Next.js 14+ (App Router)** as the full-stack framework with **Prisma ORM** for database access and **PostgreSQL** as the primary data store. Deploy via **Docker Compose** as a single stack.

### Component choices:

| Component       | Choice            | Rationale                                              |
| --------------- | ----------------- | ------------------------------------------------------ |
| Framework       | Next.js 14+       | App Router, React Server Components, API Routes        |
| Language        | TypeScript        | End-to-end type safety, shared types between layers    |
| Styling         | Tailwind CSS      | Utility-first, no CSS-in-JS runtime cost               |
| ORM             | Prisma            | Type-safe queries, declarative schema, migrations      |
| Database        | PostgreSQL 15+    | Mature, reliable, strong JSON/indexing support          |
| Authentication  | NextAuth.js       | Built-in Google OAuth, session management, RBAC hooks  |
| Validation      | Zod               | Runtime schema validation, TypeScript type inference    |
| Deployment      | Docker Compose    | Single `docker compose up`, no orchestrator needed     |

## Consequences

### Positive

- **Single deployment unit.** The Next.js app serves both the frontend and API from one Docker container. This reduces operational complexity for a team without DevOps.
- **TypeScript end-to-end.** Prisma generates TypeScript types from the database schema. These types flow through API routes to React components without manual mapping or code generation for API contracts.
- **Fast iteration.** Next.js App Router provides file-based routing, React Server Components for data fetching, and built-in API routes. No separate backend project to maintain.
- **Self-hosting via Docker Compose.** Two services (app + database) with a single compose file. The team runs `docker compose up` and has a working CRM. Migrations run on container startup.
- **Prisma migrations.** Schema changes are version-controlled, declarative, and reproducible. No raw SQL migration files to maintain manually.
- **NextAuth.js integration.** Google OAuth, session management, and CSRF protection come out of the box. Role-based authorization is implemented in middleware and API route guards.

### Negative

- **Next.js coupling.** The frontend and backend share a deployment. Scaling them independently requires extracting the API into a separate service later.
- **Prisma query limitations.** Complex analytical queries (e.g., dashboard aggregations) may require raw SQL via `prisma.$queryRaw`. Prisma does not support all PostgreSQL features natively.
- **Single-server deployment.** Docker Compose is not a production orchestrator. For high availability, the team would need to migrate to Kubernetes or a managed container service. This is acceptable for 5-50 users.
- **No offline support.** The MVP is a server-rendered web app. Mobile/offline access would require a separate client or PWA investment.

### Risks and Mitigations

| Risk                                    | Mitigation                                          |
| --------------------------------------- | --------------------------------------------------- |
| Next.js major version breaks            | Pin Next.js version, upgrade deliberately            |
| Prisma performance for complex queries  | Use `$queryRaw` for dashboard aggregations           |
| Single point of failure (one container) | PostgreSQL on a separate volume with backup schedule |
| Google OAuth outage blocks login        | Add credential-based fallback login for Admin        |

## Alternatives Considered

### Separate SPA + API Server

Rejected. Doubles the deployment surface and requires maintaining API contract synchronization. The team is small and benefits more from a single codebase.

### Django or Rails

Rejected. Introduces a second language. The team's primary expertise is TypeScript/JavaScript. Using a single language reduces context-switching cost.

### Low-code Platform

Rejected. Insufficient customization for pipeline management, RBAC, and future CRM-specific features. Vendor lock-in conflicts with the self-hosting requirement.
