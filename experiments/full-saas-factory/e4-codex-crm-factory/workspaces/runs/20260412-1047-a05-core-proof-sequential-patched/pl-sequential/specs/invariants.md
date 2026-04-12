# Bounded CRM Core — Invariants

These invariants are the source of truth for domain and application behavior. They should be covered by focused unit tests.

## Companies

- INV-COMP-01: `Company.name` is non-empty after trimming.

## Contacts

- INV-CON-01: `Contact.displayName` is non-empty after trimming.
- INV-CON-02: If `Contact.email` is provided, it contains `@`.
- INV-CON-03: If `Contact.companyId` is provided, it references an existing `Company`.

## Opportunities

- INV-OPP-01: `Opportunity.companyId` references an existing `Company`.
- INV-OPP-02: `Opportunity.title` is non-empty after trimming.
- INV-OPP-03: If `Opportunity.amount` is provided, it is `>= 0`.
- INV-OPP-04: If `Opportunity.primaryContactId` is provided, it references an existing `Contact`.
- INV-OPP-05: A newly created opportunity starts at stage `prospecting`.
- INV-OPP-06: `Opportunity.stage` is one of: `prospecting`, `qualified`, `proposal`, `negotiation`, `won`, `lost`.

## Opportunity stage transitions

- INV-STAGE-01: Pipeline order is `prospecting` → `qualified` → `proposal` → `negotiation`.
- INV-STAGE-02: Moving an opportunity forward in the pipeline is allowed.
- INV-STAGE-03: Moving an opportunity from any non-terminal stage to `won` is allowed.
- INV-STAGE-04: Moving an opportunity from any non-terminal stage to `lost` is allowed.
- INV-STAGE-05: Moving an opportunity backward is not allowed.
- INV-STAGE-06: Moving an opportunity once it is `won` or `lost` is not allowed.

## Tasks

- INV-TASK-01: `Task.title` is non-empty after trimming.
- INV-TASK-02: `Task.opportunityId` references an existing `Opportunity`.
- INV-TASK-03: A newly created task starts with `status: "open"`.
- INV-TASK-04: Completing a task sets `status` to `"done"`.

## Notes

- INV-NOTE-01: `Note.body` is non-empty after trimming.
- INV-NOTE-02: `Note.targetType` is one of: `contact`, `company`, `opportunity`.
- INV-NOTE-03: `Note.targetId` references an existing record of the given `targetType`.
- INV-NOTE-04: Listing notes for a target returns only that target’s notes in insertion order.

## Dashboard summary

- INV-DASH-01: `companiesTotal` equals the number of companies.
- INV-DASH-02: `contactsTotal` equals the number of contacts.
- INV-DASH-03: `opportunitiesTotal` equals the number of opportunities.
- INV-DASH-04: `opportunitiesByStage` counts match each opportunity’s `stage`.
- INV-DASH-05: `openOpportunitiesTotal` equals the count of opportunities not in `won` or `lost`.
- INV-DASH-06: `wonOpportunitiesTotal` equals the count of opportunities in stage `won`.
- INV-DASH-07: `lostOpportunitiesTotal` equals the count of opportunities in stage `lost`.
- INV-DASH-08: `tasksOpenTotal` equals the count of tasks with `status: "open"`.
- INV-DASH-09: `tasksDoneTotal` equals the count of tasks with `status: "done"`.
- INV-DASH-10: `notesTotal` equals the number of notes.
