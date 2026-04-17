# ADR-001: Technology Stack Selection

## Status

Accepted

## Context

We are building a CRM MVP for small-to-medium sales and service teams (5-25 users). The system requires:

- A web-based interface with server-rendered pages and interactive components (drag-and-drop pipeline board)
- User authentication with role-based access control
- A relational database for structured CRM data with foreign key relationships
- CRUD operations across seven entity types with search, filtering, and pagination
- A single-server deployment suitable for self-hosting
- Fast development velocity to reach MVP within a bounded timeline

The team has TypeScript experience. The deployment target is a single server running Docker Compose.

## Decision

We will use the following technology stack:

| Layer | Technology | Version |
|---|---|---|
| Framework | Next.js (App Router) | 14+ |
| Language | TypeScript (strict mode) | 5.x |
| Database | PostgreSQL | 15+ |
| ORM | Prisma | 5.x |
| Authentication | NextAuth.js (credentials provider) | 4.x |
| Styling | Tailwind CSS | 3.x |
| Deployment | Docker Compose | Single server |

### Rationale

**Next.js 14+ (App Router):** Provides both the frontend (React server and client components) and backend (API routes) in a single deployable unit. The App Router enables server-side rendering for fast initial loads, React Server Components for reduced client JavaScript, and API route handlers for the REST API. This eliminates the need for a separate backend server, reducing deployment complexity.

**TypeScript (strict mode):** Catches type errors at compile time across both frontend and backend code. Strict mode prevents common JavaScript pitfalls (implicit any, null reference errors). Shared types between API routes and frontend components eliminate serialization mismatches.

**PostgreSQL:** A mature relational database well-suited for the structured entity relationships in a CRM (contacts, companies, opportunities with foreign keys). Supports ACID transactions for data integrity, robust indexing for search and filtering, and decimal types for currency values. Free, open-source, and widely supported in self-hosted environments.

**Prisma:** Provides type-safe database access that integrates with TypeScript. The declarative schema file serves as both documentation and migration source. Auto-generated client types match the schema exactly, preventing query/type mismatches. Migration tooling handles schema evolution.

**NextAuth.js:** Handles session management, cookie security, and CSRF protection out of the box. The credentials provider supports email/password login without requiring external OAuth services. The Prisma adapter stores sessions in the existing PostgreSQL database, avoiding additional infrastructure.

**Tailwind CSS:** Utility-first CSS enables rapid UI development without context-switching to separate stylesheets. Pairs well with component-based React architecture. PurgeCSS integration keeps production bundles small.

## Consequences

### Positive

- Single deployment artifact (Next.js app + PostgreSQL) simplifies operations.
- Full-stack TypeScript means one language across the entire codebase.
- Prisma migrations provide repeatable, version-controlled schema changes.
- Server Components reduce client-side JavaScript for faster page loads.
- All chosen technologies have large ecosystems, active maintenance, and extensive documentation.

### Negative

- Next.js App Router is relatively new; some patterns are less documented than the Pages Router.
- Prisma adds a build step (client generation) and has a learning curve for developers used to raw SQL.
- NextAuth.js credentials provider requires manual password hashing (bcrypt); OAuth providers would be simpler but require external services.
- Single-server Docker Compose does not provide horizontal scaling or high availability. This is acceptable for MVP (5-25 users) but will require re-architecture for growth beyond that.

### Risks Mitigated

- Drag-and-drop complexity is isolated to one component (pipeline board) and can fall back to a dropdown stage selector if the library integration proves difficult.
- PostgreSQL connection pooling (via Prisma) handles the expected concurrent load (10 simultaneous users).
