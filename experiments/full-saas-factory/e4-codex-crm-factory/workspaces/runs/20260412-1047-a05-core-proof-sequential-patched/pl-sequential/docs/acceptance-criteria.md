# Bounded CRM Core — Acceptance Criteria

## Companies

- AC-COMP-01: Creating a company with a non-empty `name` returns a company with an `id` and the same `name`.
- AC-COMP-02: Creating a company with an empty or whitespace-only `name` fails with a validation error and does not create a record.
- AC-COMP-03: Reading a company by `id` returns the company if it exists; otherwise returns a not-found error.

## Contacts

- AC-CON-01: Creating a contact with a non-empty `displayName` returns a contact with an `id` and the provided fields.
- AC-CON-02: Creating a contact with an empty or whitespace-only `displayName` fails with a validation error and does not create a record.
- AC-CON-03: If `email` is provided, it must contain `@`; otherwise creation fails with a validation error.
- AC-CON-04: If `companyId` is provided, it must reference an existing company; otherwise creation fails with a not-found error.
- AC-CON-05: Reading a contact by `id` returns the contact if it exists; otherwise returns a not-found error.

## Opportunities

- AC-OPP-01: Creating an opportunity requires an existing `companyId`; otherwise creation fails with a not-found error.
- AC-OPP-02: Creating an opportunity requires a non-empty `title`; otherwise creation fails with a validation error.
- AC-OPP-03: If `amount` is provided, it must be `>= 0`; otherwise creation fails with a validation error.
- AC-OPP-04: If `primaryContactId` is provided, it must reference an existing contact; otherwise creation fails with a not-found error.
- AC-OPP-05: A newly created opportunity starts in stage `prospecting`.
- AC-OPP-06: Reading an opportunity by `id` returns the opportunity if it exists; otherwise returns a not-found error.

## Opportunity stage transitions

- AC-STAGE-01: Moving an opportunity from `prospecting` to `qualified` succeeds.
- AC-STAGE-02: Moving an opportunity forward in the pipeline succeeds (`prospecting` → `qualified` → `proposal` → `negotiation`).
- AC-STAGE-03: Moving an opportunity from any non-terminal stage to `won` succeeds.
- AC-STAGE-04: Moving an opportunity from any non-terminal stage to `lost` succeeds.
- AC-STAGE-05: Moving an opportunity backward fails with an invalid-transition error and leaves the stage unchanged.
- AC-STAGE-06: Moving an opportunity once it is `won` or `lost` fails with an invalid-transition error and leaves the stage unchanged.
- AC-STAGE-07: Moving the stage of a non-existent opportunity fails with a not-found error.

## Tasks

- AC-TASK-01: Adding a task to an existing opportunity succeeds and returns a task with `status: "open"`.
- AC-TASK-02: Adding a task with an empty or whitespace-only `title` fails with a validation error and does not create a record.
- AC-TASK-03: Adding a task to a non-existent opportunity fails with a not-found error.
- AC-TASK-04: Marking an existing task as complete changes its `status` to `"done"`.
- AC-TASK-05: Marking a non-existent task as complete fails with a not-found error and does not change any existing records.
- AC-TASK-06: Listing tasks for an opportunity returns only tasks associated with that opportunity.

## Notes

- AC-NOTE-01: Adding a note requires a non-empty `body`; otherwise it fails with a validation error.
- AC-NOTE-02: Adding a note to an existing contact succeeds.
- AC-NOTE-03: Adding a note to an existing company succeeds.
- AC-NOTE-04: Adding a note to an existing opportunity succeeds.
- AC-NOTE-05: Adding a note to a non-existent target fails with a not-found error and does not create a record.
- AC-NOTE-06: Listing notes for a target returns only notes for that target in insertion order.

## Dashboard summaries

- AC-DASH-01: Dashboard summary returns correct totals for companies, contacts, opportunities, tasks, and notes.
- AC-DASH-02: `opportunitiesByStage` counts match the current opportunities’ `stage` values.
- AC-DASH-03: `openOpportunitiesTotal` equals the count of opportunities not in `won` or `lost`.
- AC-DASH-04: `wonOpportunitiesTotal` equals the count of opportunities in `won`.
- AC-DASH-05: `lostOpportunitiesTotal` equals the count of opportunities in `lost`.
- AC-DASH-06: `tasksOpenTotal` equals the count of tasks with `status: "open"`.
- AC-DASH-07: `tasksDoneTotal` equals the count of tasks with `status: "done"`.

