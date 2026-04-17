# Product Requirements Document -- CRM MVP

## Vision

A lightweight CRM for small-to-medium sales and service teams (5-50 users) that replaces spreadsheets and sticky notes with a shared, structured system for tracking contacts, companies, opportunities, and tasks.

## Goals

1. Provide a single source of truth for customer and prospect data.
2. Give sales reps a clear, visual pipeline to manage opportunities from lead to close.
3. Enable managers to track team activity and pipeline health via a dashboard.
4. Keep the interface fast, simple, and learnable in under 30 minutes.
5. Ship a working MVP within a single development cycle -- no feature creep.

## Tech Stack

- **Frontend:** Next.js (App Router) with TypeScript
- **Backend:** Next.js API routes
- **Database:** PostgreSQL with Prisma ORM
- **Auth:** Email/password with bcrypt + secure session cookies

## Bounded Scope (MVP)

| Feature Area | Description |
|---|---|
| Auth | Email/password sign-up, login, logout, password reset. Roles: admin, member. |
| Contacts | CRUD, search, filter, link to company. Fields: name, email, phone, company. |
| Companies | CRUD, search, filter. Fields: name, domain, industry, size, address. View linked contacts. |
| Opportunities | CRUD, assign to contact/company, set value/close date/owner. Filter by stage and owner. |
| Pipeline Stages | Default stages (Lead, Qualified, Proposal, Negotiation, Closed Won, Closed Lost). Kanban board with drag-and-drop. Admin can rename stages. |
| Tasks | CRUD, assign to user, link to contact/opportunity, due date, status (open/completed). |
| Notes | Create, read, edit (own), delete (own) notes on contacts, companies, and opportunities. |
| Dashboard | Pipeline summary, upcoming tasks (7 days), recent activity feed, monthly win/loss count. |

## Out of Scope

- Email integration (send/receive from CRM)
- Calendar sync
- Bulk import/export (CSV, Excel)
- Custom fields or custom objects
- Workflow automation and triggers
- Reporting beyond the dashboard
- Mobile-native apps (responsive web only)
- Multi-tenant / multi-organization support
- Third-party integrations (Slack, Zapier, etc.)
- File attachments on records
- Lead scoring or AI features
- Notifications (in-app, push; transactional email for password reset is in scope)
- API access for external consumers
- Internationalization / localization
- Audit logging and compliance features

## User Stories

### Auth

- As a user, I can register with email and password so I can access the system.
- As a user, I can log in and log out so my session stays secure.
- As a user, I can reset my password via email so I can recover access.
- As an admin, I can assign roles (admin/member) so permissions are enforced.

### Contacts

- As a sales rep, I can create a contact with name, email, phone, and company so I can track who I am talking to.
- As a sales rep, I can search and filter contacts by name or email so I can find people quickly.
- As a sales rep, I can view a contact detail page showing linked company, opportunities, tasks, and notes.
- As a sales rep, I can edit or delete a contact.

### Companies

- As a sales rep, I can create a company with name, domain, industry, size, and address.
- As a sales rep, I can view all contacts and opportunities linked to a company.
- As a sales rep, I can edit or delete a company.

### Opportunities

- As a sales rep, I can create an opportunity with name, value, stage, expected close date, contact, company, and owner.
- As a sales rep, I can move an opportunity between pipeline stages via drag-and-drop or dropdown.
- As a manager, I can filter opportunities by stage and owner.

### Pipeline Stages

- As a user, I can view the pipeline as a Kanban board with drag-and-drop.
- As an admin, I can rename stages.
- As a user, I see stages in defined sort order.

### Tasks

- As a user, I can create a task with title, description, due date, and assignee.
- As a user, I can link a task to a contact or opportunity.
- As a user, I can mark a task complete or reopen it.
- As a user, I can filter tasks by status and assignee.

### Notes

- As a user, I can add a text note to a contact, company, or opportunity.
- As a user, I can edit or delete notes I authored.
- As a user, I can view notes in reverse-chronological order on any record.

### Dashboard

- As a manager, I can see a pipeline summary (count and total value per stage).
- As a user, I can see my open tasks due within 7 days.
- As a user, I can see a recent activity feed (last 20 changes).
- As a user, I can see monthly win/loss counts.

## MVP Release Criteria

1. All user stories above are implemented and manually verified.
2. Acceptance criteria (see `acceptance-criteria.md`) pass.
3. Non-functional requirements (see `non-functional-requirements.md`) are met.
4. Zero critical or high-severity bugs open.
5. Zero critical or high-severity vulnerabilities in `npm audit`.
6. Application deploys successfully to a staging environment.
7. A new user can register, log in, and create a contact within 2 minutes.
