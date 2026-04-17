# C4 Level 2: Container Diagram

## Overview

The CRM MVP consists of three containers: a Next.js application serving both frontend and backend, a PostgreSQL database for persistent storage, and NextAuth.js for session-based authentication.

## Diagram

```
+------------------------------------------------------------------+
|                        User's Browser                            |
|  +------------------------------------------------------------+  |
|  |  Next.js Frontend (React, App Router)                      |  |
|  |                                                            |  |
|  |  Pages:                     Components:                    |  |
|  |  - /login, /register        - ContactList, ContactForm     |  |
|  |  - /dashboard               - CompanyList, CompanyForm     |  |
|  |  - /contacts/*              - PipelineBoard (drag-drop)    |  |
|  |  - /companies/*             - TaskList, TaskForm           |  |
|  |  - /opportunities/*         - NoteTimeline                 |  |
|  |  - /tasks/*                 - DashboardWidgets             |  |
|  |  - /admin/stages            - Navigation, Layout           |  |
|  +-----+----------------------------------------------+-------+  |
+--------|--------------------------------------------- |----------+
         | Server Actions / fetch()                     |
         v                                              v
+--------+----------------------------------------------+----------+
|                  Next.js App Server                              |
|                                                                  |
|  API Routes (/api/*)          Server Components                  |
|  +--------------------------+ +------------------------------+   |
|  | /api/auth/*   (NextAuth) | | Dashboard data fetching      |   |
|  | /api/contacts            | | Entity detail pages          |   |
|  | /api/companies           | | List pages with pagination   |   |
|  | /api/opportunities       | +------------------------------+   |
|  | /api/stages              |                                    |
|  | /api/tasks               | Middleware                         |
|  | /api/notes               | +------------------------------+   |
|  | /api/dashboard           | | Auth session validation      |   |
|  +--------------------------+ | Role-based route protection   |   |
|                               +------------------------------+   |
|  Prisma Client (ORM)          NextAuth.js                        |
|  +--------------------------+ +------------------------------+   |
|  | Type-safe DB queries     | | Credentials provider         |   |
|  | Schema migrations        | | Session management           |   |
|  | Connection pooling       | | JWT or DB session strategy   |   |
|  +--------------------------+ +------------------------------+   |
+--------+----------------------------------------------+----------+
         |                                              |
         | TCP/5432 (Prisma connection)                 | (internal)
         v                                              v
+--------+--------------+                  +------------+----------+
|                       |                  |                       |
|  PostgreSQL Database  |                  |  NextAuth Session     |
|                       |                  |  Store (in PostgreSQL)|
|  Tables:              |                  |                       |
|  - User               |                  |  Tables:              |
|  - Contact            |                  |  - Account            |
|  - Company            |                  |  - Session            |
|  - Opportunity        |                  |  - VerificationToken  |
|  - PipelineStage      |                  |                       |
|  - Task               |                  +-------------- --------+
|  - Note               |
|                       |
+-----------------------+
```

## Container Descriptions

| Container | Technology | Purpose |
|---|---|---|
| Next.js App | Next.js 14+ (App Router), TypeScript, React, Tailwind CSS | Serves the frontend UI via server and client components; hosts API routes for all CRUD operations; runs middleware for auth and role checks |
| PostgreSQL Database | PostgreSQL 15+ | Stores all CRM domain data and NextAuth session/account records; accessed exclusively through Prisma ORM |
| NextAuth Session Store | NextAuth.js (Prisma adapter) | Manages user authentication via email/password credentials provider; stores sessions in the PostgreSQL database |

## Relationships

| Source | Target | Protocol | Description |
|---|---|---|---|
| Browser | Next.js App | HTTPS | User interacts with React UI; requests go to API routes or server components |
| Next.js App | PostgreSQL | TCP/5432 | Prisma Client issues SQL queries for all domain data operations |
| Next.js App | NextAuth Session Store | Internal | NextAuth reads/writes session data to PostgreSQL via Prisma adapter |

## Deployment

All three containers run on a single server via Docker Compose:
- `app` service: Next.js application (Node.js runtime)
- `db` service: PostgreSQL 15+ instance with a persistent volume
