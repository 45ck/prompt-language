# Acceptance Criteria: Bounded CRM Core (Core Proof)

All criteria below must be achievable using deterministic TypeScript domain logic and in-memory application services. No persistence, HTTP, auth, or UI is required for acceptance.

## A. Companies

### A1. Create company (success)
- Given an in-memory CRM service with no companies
- When I create a company with `{ id, name, now }`
- Then the company is stored with `id` and `name`
- And `createdAt` equals the provided `now`

### A2. Create company (validation)
- Given an in-memory CRM service
- When I create a company with an empty `name`
- Then the operation fails with a validation error

### A3. Create company (duplicate id)
- Given a company already exists with `id = "c_1"`
- When I create another company with `id = "c_1"`
- Then the operation fails with a duplicate-id error

## B. Contacts

### B1. Create contact (success)
- Given a company exists with `id = "c_1"`
- When I create a contact with `{ id, firstName, lastName, email, companyId: "c_1", now }`
- Then the contact is stored with those values
- And `createdAt` equals the provided `now`

### B2. Create contact (required fields)
- When I create a contact with an empty `firstName`
- Then the operation fails with a validation error
- When I create a contact with an empty `lastName`
- Then the operation fails with a validation error

### B3. Create contact (email validation)
- When I create a contact with `email` present but not in a valid email format
- Then the operation fails with a validation error

### B4. Create contact (company reference)
- Given no company exists with `id = "missing_company"`
- When I create a contact with `companyId = "missing_company"`
- Then the operation fails with a reference-not-found error

### B5. Create contact (duplicate id)
- Given a contact already exists with `id = "p_1"`
- When I create another contact with `id = "p_1"`
- Then the operation fails with a duplicate-id error

## C. Opportunities

### C1. Create opportunity (success)
- Given a company exists with `id = "c_1"`
- When I create an opportunity with `{ id, companyId: "c_1", name, amountCents, primaryContactId?, now }`
- Then the opportunity is stored
- And `stage` equals `Prospecting`
- And `createdAt` equals the provided `now`
- And `stageHistory` is an empty list

### C2. Create opportunity (validation)
- When I create an opportunity with an empty `name`
- Then the operation fails with a validation error
- When I create an opportunity with `amountCents < 0`
- Then the operation fails with a validation error
- When I create an opportunity with a non-integer `amountCents`
- Then the operation fails with a validation error

### C3. Create opportunity (company reference)
- Given no company exists with `id = "missing_company"`
- When I create an opportunity with `companyId = "missing_company"`
- Then the operation fails with a reference-not-found error

### C4. Create opportunity (primary contact reference)
- Given no contact exists with `id = "missing_contact"`
- When I create an opportunity with `primaryContactId = "missing_contact"`
- Then the operation fails with a reference-not-found error

### C5. Move opportunity stage (valid transitions)
- Given an opportunity exists in `Prospecting`
- When I move the opportunity to `Qualified` at time `now_1`
- Then the opportunity stage becomes `Qualified`
- And a stage history entry is appended with `{ from: "Prospecting", to: "Qualified", at: now_1 }`
- Given the same opportunity is in `Negotiation`
- When I move the opportunity to `ClosedWon` at time `now_2`
- Then the opportunity stage becomes `ClosedWon`
- And a stage history entry is appended with `{ from: "Negotiation", to: "ClosedWon", at: now_2 }`

### C6. Move opportunity stage (loss from any open stage)
- Given an opportunity exists in `Proposal`
- When I move the opportunity to `ClosedLost` at time `now_1`
- Then the opportunity stage becomes `ClosedLost`
- And a stage history entry is appended with `{ from: "Proposal", to: "ClosedLost", at: now_1 }`

### C7. Move opportunity stage (invalid transitions)
- Given an opportunity exists in `Prospecting`
- When I move directly to `Proposal`
- Then the operation fails with an invalid-stage-transition error
- Given an opportunity exists in `ClosedWon`
- When I attempt to move to any other stage
- Then the operation fails with an invalid-stage-transition error

### C8. Move opportunity stage (unknown opportunity)
- Given no opportunity exists with `id = "opp_missing"`
- When I attempt to move stage for `id = "opp_missing"`
- Then the operation fails with a reference-not-found error

## D. Tasks

### D1. Add task to a subject (success)
- Given a contact exists with `id = "p_1"`
- When I add a task with `{ id, subject: { type: "contact", id: "p_1" }, title, dueOn, now }`
- Then the task is stored with `status = "open"`
- And `createdAt` equals the provided `now`

### D2. Add task (validation)
- When I add a task with an empty `title`
- Then the operation fails with a validation error
- When I add a task with `dueOn` not in `YYYY-MM-DD` format
- Then the operation fails with a validation error

### D3. Add task (subject reference)
- Given no company exists with `id = "missing_company"`
- When I add a task with `subject = { type: "company", id: "missing_company" }`
- Then the operation fails with a reference-not-found error

### D4. Mark task done (success)
- Given a task exists with `status = "open"`
- When I mark the task as done
- Then the task `status` becomes `"done"`

### D5. Mark task done (unknown task)
- Given no task exists with `id = "task_missing"`
- When I attempt to mark `id = "task_missing"` as done
- Then the operation fails with a reference-not-found error

## E. Notes

### E1. Add note to a subject (success)
- Given an opportunity exists with `id = "opp_1"`
- When I add a note with `{ id, subject: { type: "opportunity", id: "opp_1" }, body, now }`
- Then the note is stored
- And `createdAt` equals the provided `now`

### E2. Add note (validation)
- When I add a note with an empty `body`
- Then the operation fails with a validation error

### E3. Add note (subject reference)
- Given no opportunity exists with `id = "opp_missing"`
- When I add a note with `subject = { type: "opportunity", id: "opp_missing" }`
- Then the operation fails with a reference-not-found error

## F. Dashboard Summary

### F1. Compute summary (basic totals)
- Given the CRM has companies, contacts, opportunities, and tasks in memory
- When I compute the dashboard summary with `today = "2026-04-12"`
- Then the summary includes:
  - `companiesTotal` equal to the number of companies
  - `contactsTotal` equal to the number of contacts
  - `opportunitiesTotal` equal to the number of opportunities
  - `openOpportunitiesTotal` equal to the number of opportunities whose stage is not `ClosedWon` or `ClosedLost`

### F2. Compute summary (opportunity pipeline)
- Given multiple opportunities exist across stages
- When I compute the dashboard summary
- Then `opportunitiesByStage` counts match the current opportunity stages
- And `openOpportunityAmountCentsTotal` equals the sum of `amountCents` for opportunities in open stages

### F3. Compute summary (task due classification)
- Given open tasks exist with different `dueOn` values
- When I compute the dashboard summary with `today = "2026-04-12"`
- Then:
  - `openTasksOverdue` counts open tasks where `dueOn` is before `"2026-04-12"`
  - `openTasksDueToday` counts open tasks where `dueOn` equals `"2026-04-12"`
  - `openTasksTotal` counts open tasks regardless of due date

