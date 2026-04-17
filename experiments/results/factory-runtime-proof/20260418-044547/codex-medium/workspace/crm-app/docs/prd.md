# PRD — CRM app (bounded MVP)

## Product summary
A lightweight CRM for SME teams to manage customer records, track opportunities through pipeline stages, coordinate follow-ups with tasks, capture context with notes, and review activity and pipeline on a dashboard.

## Target users
SME teams (2–25 people) where sales and/or service follow-ups require shared visibility and reliable handoffs.

## Problem statement
SME teams frequently lose context and follow-ups because customer information, deal status, and next steps are spread across spreadsheets, inboxes, and personal task lists. Managers lack a consistent pipeline view and teams struggle to keep opportunities current.

## Goals (MVP)
- Provide a shared system of record for contacts and companies.
- Provide a simple opportunity pipeline with configurable stages.
- Make follow-ups explicit and trackable via tasks linked to contacts/companies/opportunities.
- Capture lightweight interaction context via notes.
- Provide a dashboard that surfaces “what needs attention” and basic pipeline health.

## Non-goals (explicit)
The MVP does not attempt to replace:
- Email/calendar clients (no sync/inbox integration)
- Marketing automation or lead scoring
- Helpdesk ticketing and SLAs
- Quoting, invoicing, subscriptions, CPQ, inventory
- Advanced forecasting, territory management, multi-currency, or enterprise compliance tooling

## MVP scope (features)
### 1) Authentication
- Users can sign in/out.
- Users can access only their organization/account data.

### 2) Contacts
- Create, view, edit, and archive contacts.
- Basic fields (name, email/phone, role/title optional).
- Contacts can be associated with a company.

### 3) Companies
- Create, view, edit, and archive companies.
- Basic fields (name, domain/website optional).

### 4) Opportunities
- Create, view, edit, and archive opportunities.
- Opportunities link to a company and optionally a primary contact.
- Opportunities have a stage and an owner.

### 5) Pipeline stages
- Stages are configurable per account (create/edit/reorder).
- Opportunities can move between stages.

### 6) Tasks
- Create, assign, complete, and reschedule tasks.
- Tasks can link to a contact, company, and/or opportunity.
- Tasks have due dates and statuses (open/completed).

### 7) Notes
- Create notes linked to a contact, company, and/or opportunity.
- Notes are time-ordered and visible to the team for context and handoff.

### 8) Dashboard
- Surface overdue and due-today tasks.
- Summarize opportunities by stage.
- Show basic “recent activity” (e.g., recently updated opportunities or recent notes).

## Constraints
- Stack: Next.js + TypeScript + PostgreSQL + Prisma.
- Keep domain model minimal; avoid optional modules that create cascaded dependencies.

## Open questions (must remain bounded)
- Default pipeline stages for first-time setup (can ship a sensible default and allow edits).
- Minimum required fields for contacts/companies/opportunities to balance speed vs. data hygiene.

