# Product Requirements Document: SME CRM MVP

## Vision

A lightweight, self-hosted CRM for small and medium enterprise teams (5-50 people) that replaces spreadsheets and scattered notes with a structured system for managing contacts, companies, opportunities, and tasks. The product prioritizes simplicity and fast onboarding over feature depth.

## Target User

SME sales teams, business owners, and customer success staff who need a shared system of record for customer relationships but find enterprise CRMs (Salesforce, HubSpot) too complex or expensive for their needs.

## Tech Stack

| Layer        | Technology           |
|--------------|----------------------|
| Frontend     | Next.js (App Router) |
| Language     | TypeScript           |
| Database     | PostgreSQL           |
| ORM          | Prisma               |
| Auth         | NextAuth.js (JWT)    |
| Styling      | Tailwind CSS         |
| Deployment   | Docker / Vercel      |

## MVP Scope

### 1. Authentication
- User registration with email and password
- Login / logout
- Password reset via email link
- Role-based access: Admin, Member

### 2. Contacts
- Create, read, update, delete contacts
- Fields: first name, last name, email, phone, company (optional), job title
- Search and filter by name, email, company
- Link contacts to companies

### 3. Companies
- Create, read, update, delete companies
- Fields: name, industry, website, phone, address, employee count
- View associated contacts and opportunities
- Search and filter by name, industry

### 4. Opportunities
- Create, read, update, delete opportunities
- Fields: name, value (currency), expected close date, stage, associated company, associated contact, owner (team member)
- Move opportunities through pipeline stages
- Filter by stage, owner, close date range

### 5. Pipeline Stages
- Default stages: Lead, Qualified, Proposal, Negotiation, Closed Won, Closed Lost
- Admin can create, rename, reorder, and delete custom stages
- Kanban board view for drag-and-drop stage transitions

### 6. Tasks
- Create, read, update, delete tasks
- Fields: title, description, due date, priority (low/medium/high), status (open/completed), assigned to, linked entity (contact/company/opportunity)
- Filter by status, priority, assignee, due date
- Overdue task indicators

### 7. Notes
- Add timestamped notes to contacts, companies, or opportunities
- Fields: body text, author, created date
- Chronological display on entity detail pages
- Edit and delete own notes

### 8. Dashboard
- Total contacts, companies, open opportunities
- Pipeline value by stage (bar chart)
- Upcoming tasks (next 7 days)
- Recently added contacts
- Win/loss count for current month

## Out of Scope (MVP)

These features are explicitly excluded from the MVP release:

- Email integration (send/receive/track)
- Advanced reporting and analytics
- Mobile application (native iOS/Android)
- API marketplace or third-party integrations
- Workflow automation (triggers, sequences, drip campaigns)
- Document management and file attachments
- Calendar integration
- Lead scoring
- Multi-currency support
- Notification system (email, in-app, push)
- Audit logging

> **Note on CSV import:** CSV import is identified in the research docs as a key migration path for SME teams leaving spreadsheets. It is planned for v1.1 (immediately post-MVP) but is not in the MVP release to limit scope. The Prisma schema and API design should accommodate future bulk import without schema changes.

## Release Criteria

1. All MVP features implemented and functional
2. Unit test coverage above 80% for business logic
3. End-to-end tests pass for all core user flows
4. No critical or high-severity bugs open
5. Page load time under 2 seconds on standard broadband
6. API response time under 500ms at p95
7. WCAG 2.1 AA compliance verified for all pages
8. Security review completed (auth, input validation, SQL injection prevention)
9. Database migrations run cleanly from empty state
10. Deployment documentation complete
