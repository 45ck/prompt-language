# Product Requirements Document — SME CRM MVP

## Overview

A self-hostable, pipeline-first CRM for small and medium sales teams (5–50 users) who have outgrown spreadsheets but don't need enterprise tools.

## Target Market

SME sales teams in B2B services, consulting, agencies, and small SaaS companies. Teams currently using spreadsheets or free CRM tiers with frustration.

## Stack

- **Frontend**: Next.js 14+ (App Router, Server Components, Server Actions)
- **Language**: TypeScript (strict mode)
- **Database**: PostgreSQL via Prisma ORM
- **Auth**: NextAuth.js (credentials provider, email+password)
- **Deployment**: Vercel + managed Postgres (Neon or Supabase)

## MVP Scope (Fixed)

### Entities

| Entity | Key Fields |
|--------|-----------|
| User | id, name, email, passwordHash, role (admin/member), orgId |
| Organization | id, name, createdAt |
| Contact | id, firstName, lastName, email, phone, companyId, orgId, createdBy, createdAt, deletedAt |
| Company | id, name, website, industry, orgId, createdAt, deletedAt |
| Opportunity | id, name, value (decimal), expectedCloseDate, stageId, contactId, companyId, assigneeId, orgId, createdAt |
| PipelineStage | id, name, position (int), orgId |
| Task | id, title, description, dueDate, completed, assigneeId, contactId, opportunityId, orgId, createdAt |
| Note | id, content, authorId, contactId, opportunityId, orgId, createdAt |

### Features

1. **Auth**: Sign up (creates org), invite team members by email, login, logout.
2. **Contacts**: CRUD, search by name/email, link to company, soft delete. CSV import (up to 10k rows).
3. **Companies**: CRUD, list contacts per company, soft delete.
4. **Opportunities**: CRUD, assign to pipeline stage, assign to team member, link to contact and company. Value and expected close date fields.
5. **Pipeline Board**: Kanban view of opportunities grouped by stage. Drag-and-drop to change stage. Filter by assignee.
6. **Tasks**: CRUD, assign to team member, link to contact or opportunity. Due date. Mark complete.
7. **Notes**: Create and list on contact and opportunity detail pages. Author and timestamp.
8. **Dashboard**: Pipeline value by stage (bar chart). Tasks due today. Overdue tasks. Recent activity feed (last 20 items).

### Explicitly Excluded from MVP

- Email integration, sequences, campaigns
- Calendar sync
- Custom fields
- Reporting beyond dashboard
- Mobile app (responsive web only)
- SSO/SAML
- API for third-party integrations
- Multi-tenancy (DB-level isolation)
- Real-time collaboration / WebSockets
- Lead scoring, AI features
- Phone/VoIP integration

## Pages

| Route | Purpose |
|-------|---------|
| `/login` | Login form |
| `/signup` | Sign up + org creation |
| `/dashboard` | Pipeline summary, tasks, activity |
| `/contacts` | Contact list with search |
| `/contacts/[id]` | Contact detail (notes, tasks, opportunities) |
| `/contacts/import` | CSV import |
| `/companies` | Company list |
| `/companies/[id]` | Company detail (contacts, opportunities) |
| `/pipeline` | Kanban board |
| `/opportunities/[id]` | Opportunity detail |
| `/tasks` | Task list (filterable by assignee, due date) |
| `/settings` | Org settings, invite team members, manage pipeline stages |

## Non-Functional Requirements

See `docs/non-functional-requirements.md`.

## Acceptance Criteria

See `docs/acceptance-criteria.md`.
