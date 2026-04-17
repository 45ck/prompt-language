# Discovery

## Target Market

Small-to-medium sales and service teams.

## Stack

Next.js + TypeScript + PostgreSQL + Prisma.

## Scope Boundaries

- In scope: core CRM entities and workflows (accounts/companies, contacts, leads, opportunities, activities, tickets/cases), basic reporting, and role-based access.
- Out of scope for this bounded proof: full application scaffolding, UI implementation, integrations, and production infrastructure.

## Core Entities (Initial)

- Organization (tenant)
- User
- Account (company)
- Contact
- Lead
- Opportunity (deal)
- Activity (task, call, meeting, email log)
- Ticket (support case)
- Note
- Attachment (metadata only for now)

## Key Workflows (Initial)

- Lead capture → qualification → conversion (Lead → Contact + Account + Opportunity)
- Opportunity pipeline management (stages, forecast amounts, close dates)
- Activity logging and reminders (next steps)
- Ticket intake → triage → resolution → closure

## Non-Functional Notes

- Multi-tenant data isolation (per-organization)
- Audit-friendly change tracking for key entities (created/updated by, timestamps)
- Search across Accounts/Contacts/Leads/Opportunities
