# Product Requirements Document: CRM MVP

## 1. Vision

A lightweight, self-hosted CRM application for small-to-medium sales and service teams (5-25 users). The system provides contact and company management, a visual sales pipeline, task tracking, notes, and a summary dashboard. Built on Next.js, TypeScript, PostgreSQL, and Prisma.

## 2. Problem Statement

Small sales and service teams often rely on spreadsheets or overly complex enterprise CRMs. They need a focused tool that covers core workflows without configuration overhead, excessive licensing costs, or feature bloat.

## 3. Target Users

- Sales representatives managing contacts and pipeline opportunities
- Sales managers reviewing team performance and pipeline health
- Support agents tracking tasks and adding notes to customer records
- Administrators configuring users, roles, and pipeline stages

## 4. Scope

### 4.1 In-Scope (MVP)

**Authentication and Authorization**
- Email/password registration and login
- Session-based authentication with secure cookies
- Role-based access control: Admin, Manager, Rep

**Contacts**
- Create, read, update, delete contacts
- Fields: name, email, phone, company (optional), status (active/inactive), created/updated timestamps
- Search and filter by name, email, company
- Pagination (default 25 per page)

**Companies**
- Create, read, update, delete companies
- Fields: name, industry, website, phone, address, created/updated timestamps
- Associate contacts with a company
- View company detail with linked contacts and opportunities

**Opportunities (Deals)**
- Create, read, update, delete opportunities
- Fields: title, value (currency), stage, contact, company, expected close date, owner (user), created/updated timestamps
- Move opportunities through pipeline stages via drag-and-drop board view
- List view with sorting and filtering

**Pipeline Stages**
- Default stages: Lead, Qualified, Proposal, Negotiation, Closed Won, Closed Lost
- Admin can rename, reorder, add, or archive stages
- Stage transitions are unrestricted (any stage to any stage)

**Tasks**
- Create, read, update, delete tasks
- Fields: title, description, due date, priority (low/medium/high), status (open/completed), assigned user, linked contact or opportunity
- Filter by status, priority, assignee, due date

**Notes**
- Add timestamped text notes to contacts, companies, or opportunities
- Edit and delete own notes
- Chronological display on entity detail pages

**Dashboard**
- Pipeline summary: count and total value per stage
- Open tasks due today and overdue
- Recently created or updated opportunities
- My open tasks (current user)

### 4.2 Out of Scope

- Email integration or sending emails from the CRM
- Calendar sync or scheduling
- File attachments or document management
- Workflow automation or triggers
- Custom fields or custom objects
- Reporting beyond the dashboard widgets listed above
- Mobile-native application (responsive web only)
- Multi-tenancy or organization-level isolation
- Import/export (CSV, Excel)
- API access for third-party integrations
- Notifications (email, push, in-app)
- Activity logging or audit trail
- Lead scoring or AI features

## 5. MVP Definition

The MVP is complete when a team of up to 10 users can:

1. Register, log in, and have role-appropriate access
2. Create and manage contacts and companies with associations
3. Create opportunities and move them through pipeline stages on a board view
4. Create and complete tasks linked to contacts or opportunities
5. Add notes to any entity
6. View a dashboard summarizing pipeline health and pending tasks

## 6. Success Criteria

| Metric | Target |
|---|---|
| User can complete contact-to-opportunity workflow | Under 3 minutes |
| Page load time (p95) | Under 2 seconds |
| API response time (p95) | Under 500 milliseconds |
| Zero critical bugs on launch | 0 P0/P1 bugs |
| Core CRUD coverage by acceptance tests | 100% of listed features |

## 7. Technical Constraints

- **Framework**: Next.js 14+ (App Router)
- **Language**: TypeScript (strict mode)
- **Database**: PostgreSQL 15+
- **ORM**: Prisma
- **Auth**: NextAuth.js with credentials provider
- **Styling**: Tailwind CSS
- **Deployment**: Single-server Docker Compose for MVP

## 8. Assumptions

- Users have modern browsers (last 2 versions of Chrome, Firefox, Safari, Edge)
- Single-timezone deployment is acceptable for MVP
- Currency is USD only for MVP
- English-only interface for MVP

## 9. Risks

| Risk | Mitigation |
|---|---|
| Drag-and-drop complexity delays delivery | Use established library (dnd-kit); fall back to dropdown stage selector |
| Scope creep from stakeholder requests | Strict out-of-scope list; defer to post-MVP backlog |
| Performance under concurrent load | Load test with 10 concurrent users before launch |
