# CRM End-to-End Journey Harness

## Purpose

These journeys replace unit/lint/typecheck as the signal for "the software
works." They are the behavioral oracle for families 1 and 2 of the E5
scorecard.

Each journey is a sequence of real user actions. A journey passes iff every
step produces the specified observable outcome. Partial credit is not
recorded — a journey either passes or fails.

Journeys are designed to be:

- **Lane-agnostic**: they describe goals and observable state, not routes,
  component names, or implementation details
- **Deterministic**: each journey carries its own seed data and reset hook
- **Fast enough to run on every pair**: the full suite must complete in
  under 5 minutes against a running app

## Runner contract

The external harness runner must provide:

- A clean database per journey run
- HTTP client with session cookie support
- Ability to impersonate a user via the lane's published auth entrypoint
  (form post, API token, etc. — the runner negotiates this from the app's
  own docs, not from lane-internal knowledge)
- A browser-automation fallback for journeys where no HTTP contract is
  documented

If a lane's output lacks enough documented entrypoints for the runner to
exercise the journey without reading source, that is itself a family-3
deliverability failure.

## Journey suite (v1)

### J1: First-run admin setup

1. Start the app from the lane's declared entrypoint
2. Complete first-run setup per the app's own README
3. Create an admin user with a documented default path
4. Log out, log back in as that admin
5. **Oracle**: admin lands on a dashboard page that renders without error

### J2: Create and list a contact

1. Authenticated as admin from J1
2. Create a contact with name, email, phone via the documented create path
3. List contacts
4. Open the created contact's detail view
5. **Oracle**: every field submitted appears on the detail view

### J3: Company with contacts

1. Create a company "Acme Corp"
2. Create two contacts, both associated with Acme Corp
3. Navigate to the company detail view
4. **Oracle**: both contacts appear in the company's contacts list

### J4: Opportunity through the pipeline

1. Using the contact from J2, create an opportunity with a monetary value
2. Advance it through each declared pipeline stage, one at a time
3. At each stage, open the opportunity detail
4. **Oracle**: the current stage is visibly correct at each step, and the
   opportunity appears under the correct stage on the pipeline view

### J5: Task with due date and completion

1. Create a task tied to the contact from J2, due tomorrow
2. Mark the task complete
3. Filter the task list to "completed"
4. **Oracle**: the task appears in the completed list with the correct
   completion timestamp

### J6: Note on a contact

1. Add a note to the contact from J2 with a multi-line body
2. Reload the contact detail view
3. **Oracle**: note body, author, and timestamp render identically to input

### J7: Dashboard reporting reflects activity

1. Load the dashboard after completing J1-J6
2. **Oracle**: dashboard shows at least one non-zero widget for each of:
   contacts count, active opportunities, completed tasks, recent activity

## Persistence probes (family 2 extension)

Run after J1-J7 complete:

- **P1 — Restart survives state**: restart the app; J2's contact still
  exists with all fields intact
- **P2 — Transaction rollback**: attempt a create that violates a declared
  constraint (e.g., duplicate email); database state matches pre-attempt
- **P3 — Concurrent write**: two simultaneous updates to the same
  opportunity stage; final state matches one of the two writes and no
  partial merge leaks through

## Declaration discipline

This journey list is frozen at v1 before any E5 batch run. Changes produce
a v2 file with a new version number and invalidate prior E5 results for
cross-version comparison.

Journey additions suspected mid-batch must be recorded as `proposed-v2`
and applied only to subsequent batches.
