# PRD: Bounded CRM MVP

## Product summary
Build a small-team CRM for a single workspace that answers three questions reliably:

1. Who are we working with?
2. What opportunity is active?
3. What is the next step, and who owns it?

The MVP is intentionally narrow. It covers contacts, companies, opportunities, tasks, notes, and a simple dashboard. It does not attempt to replace email, calendars, marketing systems, quoting tools, or helpdesk software.

## Problem statement
SME teams often manage customer work across spreadsheets, inboxes, and chat. This breaks down when multiple people need shared context, when follow-ups must happen on time, and when a manager needs a current view of pipeline and overdue work.

## Product goal
Provide one lightweight system of record for customer-facing work so a small team can capture core entities, keep opportunities current, assign follow-ups, and review current workload without relying on scattered tools.

## In-scope users
### Team member
- Creates and updates contacts, companies, opportunities, tasks, and notes.
- Owns follow-up work.

### Admin or manager
- Has all team member capabilities.
- Can view team-wide dashboard data.
- For MVP, user accounts and roles are provisioned out-of-band (no in-app invites or workspace administration flows).

## MVP scope
### Authentication and workspace access
- Email and password sign-in.
- Sign-out.
- Single workspace only.
- Basic roles only: team member and admin.
- User accounts and roles are provisioned out-of-band for MVP (no invite, provisioning, or membership-management UI).

### Companies
- Create, view, edit, and search companies.
- Store the minimum useful company details for CRM usage.

### Contacts
- Create, view, edit, and search contacts.
- Link a contact to one company or leave it unlinked.

### Opportunities
- Create, view, edit, and search opportunities.
- Require a linked company.
- Track exactly one current stage from a controlled stage list.

### Tasks
- Create tasks linked to a company, an opportunity, or both.
- Require owner, due date, and status.
- Mark tasks done.
- Surface overdue tasks clearly.

### Notes
- Add notes to a company, an opportunity, or both.
- Show notes in reverse chronological order.

### Dashboard
- Show overdue tasks.
- Show tasks due today.
- Show recent opportunity activity.
- Show simple pipeline counts by stage.

## Hard boundaries
The following are not part of this MVP and must not be treated as implied requirements:

- Email sync
- Calendar sync
- Calling, SMS, or chat integrations
- Marketing automation
- Lead capture, lead scoring, or enrichment
- Workflow automation or reminder engines
- Quoting, invoicing, or payments
- Ticketing or customer support flows
- Custom fields
- Advanced permissions, territories, or multi-workspace support
- In-app user provisioning, invitations, or workspace administration flows
- Mobile apps
- Forecasting, revenue modeling, or deep analytics
- CSV import/export unless explicitly added in a later phase

## Core product decisions
- The workspace is single-tenant from the user's perspective: one organization workspace, multiple users.
- The data model is intentionally small and stable for MVP: company, contact, opportunity, task, note, user.
- The dashboard is for operational visibility, not business intelligence.
- Tasks are the only MVP mechanism for "next step" tracking.
- Notes are freeform context capture, not structured activity logging.

## Success measures
- Teams can create and maintain a usable company and contact directory.
- Every active opportunity can have a visible current stage.
- Follow-up work is owned and due-dated through tasks.
- Managers can identify overdue work and current pipeline from one dashboard view.

## Open questions intentionally deferred
These are valid later-phase questions, but they are not blockers for MVP discovery:

- Whether imports are needed for initial onboarding
- Whether stage history is needed beyond current stage and timestamps
- Whether export is required for customer data portability
- Whether task reminders need notifications beyond on-screen visibility
