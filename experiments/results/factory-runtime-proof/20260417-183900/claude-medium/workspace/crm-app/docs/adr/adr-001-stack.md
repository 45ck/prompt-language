# ADR-001: Technology Stack Selection

## Status

Accepted

## Date

2026-04-17

## Context

We are building an MVP CRM application for small-to-medium sales and service teams (5-50 users). The team needs to ship quickly with minimal operational complexity. Key constraints:

- Small development team with no dedicated DevOps or infrastructure engineers.
- Target users expect a responsive web application, not a native mobile app.
- The data model is relational (contacts, companies, opportunities, tasks, notes with foreign key relationships).
- Authentication is session-based with role-based access control (4 roles).
- The MVP must support up to 50 concurrent users without degradation.
- Budget for hosting and tooling is minimal.

## Decision

We will use the following stack:

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js | 14+ (App Router) |
| Language | TypeScript | 5.x |
| Database | PostgreSQL | 15+ |
| ORM | Prisma | 5.x |
| Auth | NextAuth.js | 5.x (Auth.js) |
| Styling | Tailwind CSS | 3.x |
| Deployment | Single Node.js process | Docker or platform (Vercel, Railway) |

The application is a **monolith**: Next.js serves both the React frontend and the API routes. There is no separate backend service.

## Alternatives Considered

### Separate frontend + backend (React + Express/Fastify)

- **Pros:** Clear separation of concerns. Backend can scale independently.
- **Cons:** Two deployables to manage. CORS configuration. More complex local development setup. Overkill for an MVP with 50 users.
- **Rejected because:** Operational overhead outweighs benefits at MVP scale.

### Ruby on Rails

- **Pros:** Mature, productive for CRUD apps. Strong conventions.
- **Cons:** Different language from frontend (if using React). Smaller talent pool for TypeScript-first teams. Server-rendered UI requires more work for interactive features (pipeline drag-and-drop).
- **Rejected because:** Team expertise is in TypeScript/React.

### Django + React

- **Pros:** Django admin for free. Strong ORM. Python ecosystem.
- **Cons:** Two separate services. Python/JS context switching. Django REST Framework adds boilerplate.
- **Rejected because:** Same two-deployable problem as Express, plus language mismatch.

### SQLite instead of PostgreSQL

- **Pros:** Zero configuration. Single file database. Simpler deployment.
- **Cons:** No concurrent writes (problematic with 50 users). Limited query capabilities. Harder to migrate to PostgreSQL later if needed.
- **Rejected because:** Multi-user concurrency is a core requirement.

### Drizzle ORM instead of Prisma

- **Pros:** Lighter weight. SQL-like query builder. Better TypeScript inference in some cases.
- **Cons:** Less mature ecosystem. Fewer examples and community resources. Migration tooling is newer.
- **Rejected because:** Prisma has a more established migration workflow and broader community support, which reduces risk for an MVP.

## Consequences

### Positive

- **Single deployable.** One `next build && next start` command. One Docker container. One hosting instance. Reduces operational complexity to near zero.
- **Full TypeScript.** Frontend and API share types. Prisma generates TypeScript types from the schema. No type mismatches between layers.
- **Fast iteration.** Next.js hot reload for frontend. API route changes take effect immediately in development. Prisma migrations handle schema changes.
- **Proven at scale.** Next.js, PostgreSQL, and Prisma are production-proven. Large community means issues are well-documented.
- **Low hosting cost.** A single Node.js process with a managed PostgreSQL instance (e.g., Supabase, Neon, Railway) costs under $20/month at MVP scale.

### Negative

- **Node.js ecosystem only.** If we need CPU-intensive background processing (e.g., report generation), Node.js is not ideal. Mitigation: unlikely at MVP scale; can add a worker service later.
- **Monolith coupling.** Frontend and API are deployed together. A frontend-only change requires redeploying the API. Mitigation: acceptable for MVP velocity; can split later if needed.
- **Prisma cold start.** Prisma Client has a measurable cold start time on serverless platforms. Mitigation: use a long-running process (not serverless functions) for the MVP.
- **NextAuth.js limitations.** Session-based auth with a credentials provider is simple but does not support OAuth/SSO out of the box. Mitigation: OAuth is out of scope for MVP; NextAuth supports adding providers later.

## References

- PRD: `docs/prd.md`
- Risk Register: `docs/research/risk-register.md` (T1: Stack complexity)
- Competitors Analysis: `docs/research/competitors.md`
