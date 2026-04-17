# Product Requirements Document -- CRM MVP

## 1. Vision

Deliver a lightweight, self-hosted CRM for small-to-medium sales and service teams (5-50 users) that replaces spreadsheets and sticky notes with a structured pipeline, contact database, and task tracker. The MVP ships the minimum surface area needed to manage deals from first contact through close.

## 2. Target Users

- Inside sales representatives tracking deals and follow-ups.
- Sales managers monitoring pipeline health and team activity.
- Service/support agents logging interactions against contacts and companies.
- A designated admin who manages users and pipeline configuration.

## 3. Tech Stack

| Layer       | Choice                        |
| ----------- | ----------------------------- |
| Frontend    | Next.js 14+ (App Router), TypeScript, Tailwind CSS |
| Backend     | Next.js API Routes / Server Actions |
| Database    | PostgreSQL 15+                |
| ORM         | Prisma                        |
| Auth        | NextAuth.js (credentials + OAuth providers) |
| Deployment  | Docker Compose (self-hosted)  |

## 4. MVP Scope

### 4.1 Authentication & Authorization

- Email/password sign-up and login.
- OAuth login (Google).
- Role-based access: Admin, Manager, Rep.
- Admin can invite users, deactivate accounts, assign roles.
- Session management with JWT.

### 4.2 Contacts

- Create, read, update, delete contacts.
- Fields: first name, last name, email, phone, job title, company (FK), owner (FK to user), created/updated timestamps.
- Search contacts by name or email.
- Filter by owner, company.
- Associate a contact with one company.

### 4.3 Companies

- CRUD for companies.
- Fields: name, domain, industry, phone, address, owner (FK), created/updated timestamps.
- List view with search and filter by industry/owner.
- View all contacts and opportunities linked to a company.

### 4.4 Opportunities (Deals)

- CRUD for opportunities.
- Fields: name, value (currency), stage (FK), expected close date, contact (FK), company (FK), owner (FK), created/updated timestamps.
- Drag-and-drop Kanban board grouped by pipeline stage.
- List/table view as an alternative.

### 4.5 Pipeline Stages

- Admin can create, rename, reorder, and archive stages.
- Default stages on first setup: Lead, Qualified, Proposal, Negotiation, Closed Won, Closed Lost.
- Each stage has a display order and an is-active flag.

### 4.6 Tasks

- CRUD for tasks.
- Fields: title, description, due date, priority (low/medium/high), status (open/completed), assignee (FK), linked entity (polymorphic: contact, company, or opportunity), created/updated timestamps.
- Filter by assignee, status, due date, linked entity.
- "My Tasks" view for the logged-in user.

### 4.7 Notes

- Add timestamped notes to contacts, companies, or opportunities.
- Fields: body (plain text), author (FK), linked entity (polymorphic), created timestamp.
- Notes are append-only in the MVP (no edit/delete by non-admins).
- Display in reverse-chronological order on entity detail pages.

### 4.8 Dashboard

- Personal dashboard shown after login.
- Widgets:
  - **Pipeline summary**: count and total value per stage.
  - **My open tasks**: list of upcoming tasks sorted by due date.
  - **Recently modified opportunities**: last 10 updated deals.
  - **Activity feed**: last 20 notes across all entities the user owns.

## 5. User Stories

### Authentication

| ID   | Story |
| ---- | ----- |
| AU-1 | As a new user, I can sign up with email and password so I can access the CRM. |
| AU-2 | As a user, I can log in with Google so I don't need another password. |
| AU-3 | As an admin, I can invite a user by email so they can join the team. |
| AU-4 | As an admin, I can deactivate a user so they lose access. |
| AU-5 | As an admin, I can change a user's role (Admin/Manager/Rep). |

### Contacts

| ID   | Story |
| ---- | ----- |
| CO-1 | As a rep, I can create a contact with name, email, and phone. |
| CO-2 | As a rep, I can search contacts by name or email. |
| CO-3 | As a rep, I can link a contact to a company. |
| CO-4 | As a rep, I can edit a contact's details. |
| CO-5 | As a manager, I can view all contacts owned by my team. |

### Companies

| ID   | Story |
| ---- | ----- |
| CM-1 | As a rep, I can create a company with name and domain. |
| CM-2 | As a rep, I can view all contacts and deals under a company. |
| CM-3 | As a rep, I can edit company details. |
| CM-4 | As a manager, I can filter companies by industry. |

### Opportunities

| ID   | Story |
| ---- | ----- |
| OP-1 | As a rep, I can create a deal with a name, value, and expected close date. |
| OP-2 | As a rep, I can drag a deal between pipeline stages on the Kanban board. |
| OP-3 | As a rep, I can assign a deal to a contact and company. |
| OP-4 | As a manager, I can view the full pipeline across all reps. |
| OP-5 | As a rep, I can switch between Kanban and list views. |

### Pipeline Stages

| ID   | Story |
| ---- | ----- |
| PS-1 | As an admin, I can add a new pipeline stage. |
| PS-2 | As an admin, I can reorder stages via drag-and-drop. |
| PS-3 | As an admin, I can archive a stage (hides it without deleting deals). |

### Tasks

| ID   | Story |
| ---- | ----- |
| TA-1 | As a rep, I can create a task linked to a contact, company, or deal. |
| TA-2 | As a rep, I can mark a task as completed. |
| TA-3 | As a rep, I can see "My Tasks" sorted by due date. |
| TA-4 | As a manager, I can assign a task to another user. |
| TA-5 | As a rep, I can filter tasks by priority and status. |

### Notes

| ID   | Story |
| ---- | ----- |
| NO-1 | As a rep, I can add a note to a contact, company, or deal. |
| NO-2 | As a rep, I can view all notes on an entity in reverse-chronological order. |
| NO-3 | As an admin, I can delete any note. |

### Dashboard

| ID   | Story |
| ---- | ----- |
| DA-1 | As a rep, I see my pipeline summary on login. |
| DA-2 | As a rep, I see my upcoming tasks on the dashboard. |
| DA-3 | As a manager, I see the team-wide pipeline summary. |
| DA-4 | As a rep, I see my recent activity feed. |

## 6. Out of Scope (MVP)

The following are explicitly excluded from the MVP. They may be considered for future releases but must not influence current design decisions.

- Email sending/receiving and email integration (SMTP, IMAP, Gmail API).
- Marketing automation, drip campaigns, email templates.
- Billing, invoicing, subscription management.
- Advanced reporting and analytics beyond the dashboard widgets.
- File/document attachments on entities.
- Workflow automation / trigger-based rules.
- Mobile native apps (responsive web only).
- Import/export (CSV, Excel) of contacts or deals.
- API for third-party integrations.
- Multi-tenant / multi-organization support.
- Calendar integration.
- Custom fields on entities.
- Notifications (email, push, in-app).

## 7. Success Metrics

| Metric                    | Target              |
| ------------------------- | ------------------- |
| Time to create a deal     | < 30 seconds        |
| Dashboard load time       | < 2 seconds         |
| User adoption (weekly active) | > 80% of invited users |
| Data entry errors         | < 5% of records need correction |

## 8. Assumptions and Constraints

- Teams are co-located or remote but within a single organization.
- A single shared pipeline is sufficient (no per-team pipelines in MVP).
- Currency is USD only in MVP.
- English-only UI.
- PostgreSQL is available (managed or self-hosted).
