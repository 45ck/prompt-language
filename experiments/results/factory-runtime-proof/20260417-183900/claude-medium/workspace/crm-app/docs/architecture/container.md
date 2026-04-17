# C4 Container Diagram -- CRM MVP

## Overview

The CRM MVP is a single deployable unit: a Next.js application that serves both the frontend UI and backend API routes, backed by a PostgreSQL database accessed through Prisma ORM.

## Diagram

```
+---------------------------------------------------------------------+
|                        Users (Browser)                               |
|  Sales Rep / Sales Manager / Service Agent / Admin                   |
+----------------------------------+----------------------------------+
                                   |
                          HTTPS (port 3000)
                                   |
+----------------------------------v----------------------------------+
|                                                                     |
|                     Next.js Web Application                         |
|                     (Single Deployable)                              |
|                                                                     |
|  +-----------------------------+  +------------------------------+  |
|  |       Frontend (React)      |  |     API Routes (/api/*)      |  |
|  |                             |  |                              |  |
|  |  - Pages (SSR + CSR)        |  |  - /api/auth/*               |  |
|  |  - Dashboard view           |  |  - /api/contacts/*           |  |
|  |  - Contact/Company lists    |  |  - /api/companies/*          |  |
|  |  - Pipeline board           |  |  - /api/opportunities/*      |  |
|  |  - Task list                |  |  - /api/pipeline-stages/*    |  |
|  |  - Forms and modals         |  |  - /api/tasks/*              |  |
|  |                             |  |  - /api/notes/*              |  |
|  |  Tech: React, TypeScript,   |  |  - /api/dashboard/*         |  |
|  |  Tailwind CSS               |  |                              |  |
|  +-----------------------------+  |  Tech: Next.js API routes,   |  |
|                                   |  TypeScript, Prisma Client   |  |
|                                   +---------------+--------------+  |
|                                                   |                 |
+---------------------------------------------------+-----------------+
                                                    |
                                           Prisma ORM (TCP)
                                                    |
                                   +----------------v-----------------+
                                   |                                  |
                                   |      PostgreSQL Database         |
                                   |                                  |
                                   |  - users, organizations         |
                                   |  - contacts, companies          |
                                   |  - opportunities                |
                                   |  - pipeline_stages              |
                                   |  - tasks, notes                 |
                                   |                                  |
                                   +----------------------------------+
```

## Containers

### Next.js Web Application

| Attribute | Value |
|-----------|-------|
| Technology | Next.js 14+, TypeScript, React |
| Styling | Tailwind CSS |
| Auth | NextAuth.js (session-based, email/password credentials provider) |
| ORM | Prisma Client |
| Deployment | Single Node.js process (e.g., Vercel, Railway, Docker) |
| Responsibility | Serves SSR pages, handles API requests, manages sessions |

The frontend and API live in the same Next.js project. API routes under `/api/` handle all data operations. Pages use server-side rendering where appropriate and client-side fetching for interactive views (pipeline board, dashboard).

### PostgreSQL Database

| Attribute | Value |
|-----------|-------|
| Technology | PostgreSQL 15+ |
| Access | Prisma Client via connection string |
| Schema management | Prisma Migrate |
| Responsibility | Persistent storage for all application data |

All tables include an `orgId` foreign key for organization-level data isolation. Indexes on foreign keys and common query patterns (contact search, pipeline stage lookups).

## Key Design Decisions

1. **Single deployable.** No separate backend service. Next.js API routes handle all server-side logic. This simplifies deployment, reduces operational overhead, and matches the team size (no dedicated DevOps).

2. **Prisma as ORM.** Type-safe database access with auto-generated client. Schema-first migrations. Avoids raw SQL for common operations while allowing raw queries for dashboard aggregations if needed.

3. **NextAuth.js for auth.** Session-based authentication with a credentials provider (email/password). Sessions stored in the database. No external identity provider in MVP.

4. **No separate API server.** All API endpoints live as Next.js route handlers. If the API needs to scale independently later, these can be extracted to a standalone service.

5. **No caching layer in MVP.** PostgreSQL handles all reads directly. Connection pooling via Prisma. A Redis cache can be added post-MVP if dashboard queries become slow under load.
