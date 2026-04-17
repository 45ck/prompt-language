# PRD — Bounded CRM MVP

Target market: small-to-medium sales and service teams.  
Stack: Next.js + TypeScript + PostgreSQL + Prisma.

## Goal

Deliver a small, usable CRM MVP that replaces spreadsheets and scattered notes for a team by providing:

- Structured records for contacts and companies
- A simple opportunity pipeline with stages
- Tasks and notes tied to the same records
- A dashboard that helps the team focus on “what’s next”

## In scope (MVP)

### Core entities

- Users (authenticated)
- Contacts
- Companies
- Opportunities
- Pipeline stages
- Tasks
- Notes

### Core capabilities

- Authentication (login/logout) and session-based access.
- Create, view, edit, and search for contacts and companies.
- Create and manage opportunities and move them through pipeline stages.
- Create tasks with due dates and completion state.
- Add notes linked to contacts/companies/opportunities.
- Dashboard that surfaces:
  - Overdue tasks
  - Tasks due soon
  - Counts of opportunities by stage

## Out of scope (explicit non-goals)

- Email/calendar sync, call logging, SMS, chat integrations
- Marketing automation, lead scoring, sequences/cadences
- Quotes/invoices/payments/contracts
- Support ticketing workflows
- Advanced forecasting and analytics
- Custom objects/modules beyond the core entities

## Users and roles (bounded)

Minimum roles for MVP:

- **Member:** can access and manage records for the organization.
- **Admin:** can manage pipeline stage definitions for the organization.

## Primary user journeys (MVP)

1. **Capture a lead:** create or find a contact/company, add a note, create a follow-up task.
2. **Track a deal:** create an opportunity, move stages, add notes, create tasks.
3. **Run the week:** open dashboard, see overdue tasks, complete tasks, review pipeline counts.

## Data requirements (high-level)

- Contacts may have email/phone (optional), name (required).
- Companies have name (required).
- Opportunities have name (required), stage (required), owner (required), company (required).
- Tasks have title (required), due date (optional but recommended), completion status (required).
- Notes have body (required) and link to exactly one parent record (contact/company/opportunity).

## Constraints

- Keep required fields minimal.
- Prefer fast search and simple list views over heavy configuration.
- No external integrations in MVP.
