# Discovery (Documentation-Only Proof)

## Context

- Target market: small-to-medium sales and service teams
- Stack: Next.js + TypeScript + PostgreSQL + Prisma
- Package manager: npm
- Workspace: D:/Visual Studio Projects/prompt-language/experiments/results/factory-runtime-proof/20260417-182016/codex-medium/workspace/crm-app

## Product Scope (MVP)

### Primary personas

- Sales rep: tracks leads/opportunities, manages pipeline, logs calls/emails/meetings, sets follow-ups.
- Sales manager: views pipeline health, forecasts, monitors activity and conversion rates.
- Service agent: manages inbound tickets, tracks SLA, communicates with customers, escalates issues.
- Admin: configures users/roles, pipelines, ticket categories, and basic settings.

### Core entities (domain model)

- Account (company/organization)
- Contact (person)
- Lead (pre-qualified contact/opportunity seed)
- Opportunity (pipeline deal)
- Activity (call/email/meeting/note) linked to Account/Contact/Lead/Opportunity
- Task (follow-up/reminder) linked to an entity and assigned user
- Ticket (support request/case)
- User (agent/rep/admin)

### Key workflows

- Lead capture → qualification → conversion to Contact/Account → opportunity creation
- Opportunity pipeline progression (stage changes) + close won/lost
- Log activity against an entity + schedule follow-up task
- Create ticket → triage → assign → work → resolve/close with customer updates
- Simple search and list views for Accounts/Contacts/Leads/Opportunities/Tickets

### Non-goals (for this proof)

- Email/calendar integrations
- Advanced reporting/BI
- Multi-tenant billing and provisioning
- Mobile app

## Constraints / Decisions

- Keep dependency flow aligned to: presentation -> infrastructure -> application -> domain
- No external dependencies in `domain`

