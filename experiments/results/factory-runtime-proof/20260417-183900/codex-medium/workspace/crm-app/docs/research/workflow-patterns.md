# Workflow Patterns (SME Sales + Service)

This document describes real-world patterns that the bounded CRM MVP must support without adding new scope areas.

## Pattern A: Lead / inbound request → Contact + Company

1. A lead arrives (referral, web form, call, email).
2. A rep identifies the person and the company.
3. The team records contact details and basic company info.
4. A first follow-up task is created (“Call back”, “Send info”, “Qualify”).

MVP support:

- Create/search contacts and companies.
- Attach initial note and a due-dated task.

## Pattern B: Qualification → Opportunity created

1. Rep confirms there is a potential deal or service engagement.
2. Opportunity is created with a value (optional), stage, and owner.
3. Notes capture requirements, timeline, and next steps.
4. Tasks represent next actions (demo, quote follow-up, onsite visit).

MVP support:

- Create an opportunity linked to a company (and optionally a primary contact).
- Move stage through a defined pipeline.
- Add notes and tasks linked to the opportunity.

## Pattern C: Stage progression with lightweight governance

1. Manager reviews pipeline weekly.
2. Reps update stage based on newest information.
3. Overdue tasks indicate stalled deals.

MVP support:

- Pipeline board/list and stage movement.
- Dashboard views for “overdue tasks” and “opportunities by stage”.

## Pattern D: Service follow-up that behaves like sales follow-up

1. A customer asks for an update / renewal / additional work.
2. Team logs a note and creates follow-up tasks.
3. An opportunity may be created for additional work.

MVP support:

- Notes and tasks tied to contacts/companies/opportunities.
- Optional opportunity creation from an existing company/contact context.

