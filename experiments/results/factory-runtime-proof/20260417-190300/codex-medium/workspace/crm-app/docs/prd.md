# Product Requirements Document (Bounded CRM MVP)

## Product
CRM for small-to-medium sales and service teams.

## Stack constraint
Next.js + TypeScript + PostgreSQL + Prisma.

## Problem statement
SME teams lose momentum because customer context is scattered, follow-ups are inconsistent, and in-flight work status is hard to trust. The CRM must make it easy to keep shared context current and ensure the next action happens.

## Goals (MVP)
- Provide a shared, up-to-date record of customers (contacts + companies).
- Track in-flight work items (opportunities) with simple pipeline stages.
- Capture interaction history (notes) tied to the correct record.
- Drive consistent follow-up execution (tasks with due dates and completion).
- Provide a basic dashboard for “what needs attention” and “what’s in flight”.

## Non-goals (explicitly out of scope for MVP)
- Marketing automation, campaigns, sequences
- Email/calendar sync, calling/SMS, chat
- Quotes/invoicing/payments; accounting integrations
- Support ticketing, SLAs, field dispatch scheduling optimization
- Custom objects, automation rules, workflow builders
- Complex forecasting, territory/commissions

## Users (who this is for)
- Individual contributors who manage customer interactions and follow-ups.
- Managers/owners who need a reliable overview of pipeline and overdue work.

## MVP feature scope (must-have)
- Authentication and organization-scoped access
- Contacts CRUD
- Companies CRUD
- Opportunities CRUD
- Pipeline stages management (simple, editable)
- Tasks CRUD with due date + completion
- Notes CRUD tied to contact/company/opportunity
- Basic search on list pages (contacts/companies/opportunities/tasks)
- Dashboard with basic rollups and “overdue tasks” visibility

## MVP constraints and principles
- Minimize required data entry; value must appear quickly.
- Keep terminology neutral so both sales and service teams can map it to their work.
- Avoid configuration-heavy features; prioritize consistent, repeatable workflows.

## Release criteria (MVP)
The MVP is considered releasable when:
- Core flows meet the acceptance criteria in `docs/acceptance-criteria.md`
- Access control is verified (org scoping, role permissions)
- Key lists and dashboards load reliably with pagination
