# Non-Functional Requirements: Bounded CRM MVP

## Scope note
These requirements support the bounded CRM MVP only. They do not imply enterprise-grade scale, analytics, integration, or compliance features beyond the MVP's core responsibilities.

## NFR-01 Security
- All authenticated data access must be enforced server-side.
- Unauthenticated users must not access workspace data.
- Passwords must be stored using a standard secure password hashing approach.
- Session handling must use secure defaults and protect against common session abuse.

## NFR-02 Privacy
- Contact personal data must only be visible to authenticated users in the workspace.
- The system must store only the personal data needed for the MVP CRM workflows.
- The product must not depend on third-party enrichment or external data sharing for MVP operation.

## NFR-03 Data integrity
- Referential integrity must be enforced for company, contact, opportunity, task, and note relationships.
- An opportunity must not exist without a linked company.
- A task must not be saved without owner, due date, and status.
- Notes and tasks must not become silently orphaned from their parent records.

## NFR-04 Reliability
- Core screens must fail with user-visible error states instead of blank or broken pages.
- Create and update operations must provide a clear success or failure outcome.
- The dashboard must reflect persisted data, not unsaved client state.

## NFR-05 Performance
- Dashboard, company detail, opportunity detail, and pipeline views must remain responsive for typical SME usage.
- Lists must use search, filtering, or pagination instead of unbounded rendering.
- Dashboard calculations must use simple aggregates only.

## NFR-06 Usability
- Core flows must be usable without formal training.
- The number of required fields must stay minimal.
- Overdue tasks must be visually distinct from non-overdue tasks.
- Navigation from dashboard items to source records must be direct.

## NFR-07 Maintainability
- Architecture boundaries must remain `presentation -> infrastructure -> application -> domain`.
- Domain code must not depend on external frameworks or services.
- New logic must be covered by automated tests.
- Discovery and implementation must preserve the bounded scope rather than adding adjacent CRM features.

## NFR-08 Auditability lite
- Core records must store creation and last-update timestamps.
- The system only needs basic record recency for MVP; full audit trails are out of scope.

## NFR-09 Accessibility baseline
- Core workflows must be operable by keyboard.
- Forms must expose clear labels and validation feedback.
- Important status cues such as overdue state must not rely on color alone.
