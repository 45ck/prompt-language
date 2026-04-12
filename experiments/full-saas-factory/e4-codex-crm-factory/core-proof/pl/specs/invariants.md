# CRM Core Invariants

## Purpose
Capture the invariants that must remain true across the bounded CRM core regardless of transport, storage mechanism, or presentation flow.

## Scope
- Contacts
- Companies
- Opportunities
- Tasks
- Notes
- Dashboard summaries

## Global Invariants

### INV-001: Domain Purity
- Domain rules are implemented in pure TypeScript with no database, network, filesystem, or framework dependency.

### INV-002: Inward Dependency Flow
- Dependency direction remains `presentation -> infrastructure -> application -> domain`.
- The domain layer must not import from application, infrastructure, or presentation.

### INV-003: Single Workspace Assumption
- All records exist in one bounded workspace with one shared currency and no user-level authorization model.

## Contact Invariants

### INV-010: Contact Name Required
- Every contact has a non-empty `firstName`.
- Every contact has a non-empty `lastName`.

### INV-011: Optional Email Uniqueness
- If a contact has an email, that email is unique across contacts after normalization.
- Contacts without email do not participate in the uniqueness constraint.

### INV-012: Company Reference Validity
- If a contact has `companyId`, that `companyId` references an existing company.

## Company Invariants

### INV-020: Company Name Required
- Every company has a non-empty `name`.

### INV-021: Company Name Uniqueness
- Company names are unique after case-insensitive normalization.

## Opportunity Invariants

### INV-030: Company Reference Required
- Every opportunity references one existing company through `companyId`.

### INV-031: Initial Opportunity Stage
- Every newly created opportunity starts in `Lead`.

### INV-032: Primary Contact Reference Validity
- If an opportunity has `primaryContactId`, that ID references an existing contact.

### INV-033: Non-Negative Amount
- If an opportunity has `amount`, the amount is greater than or equal to zero.

### INV-034: Fixed Stage Vocabulary
- Opportunity stage is always one of `Lead`, `Qualified`, `Proposal`, `Won`, or `Lost`.

### INV-035: Allowed Forward Transitions Only
- `Lead` may transition only to `Qualified` or `Lost`.
- `Qualified` may transition only to `Proposal` or `Lost`.
- `Proposal` may transition only to `Won` or `Lost`.

### INV-036: Terminal Stages Are Final
- `Won` and `Lost` are terminal stages.
- An opportunity in a terminal stage cannot transition again.

### INV-037: Closed Timestamp Consistency
- `closedAt` is set when and only when an opportunity reaches `Won` or `Lost`.

## Task Invariants

### INV-040: Exactly One Linked Record
- Every task references exactly one linked CRM record through `linkedEntityType` and `linkedEntityId`.
- The referenced record exists at creation time.

### INV-041: Initial Task Status
- Every newly created task starts in `Open`.

### INV-042: Completed Task Timestamp
- If a task status is `Completed`, `completedAt` is set.
- A task with `completedAt` must have status `Completed`.

### INV-043: Completed Tasks Are Immutable For Updates
- A completed task cannot be updated through the task edit path.

### INV-044: Overdue Is Derived
- A task is overdue if and only if status is `Open` and `dueDate` is before the current date.
- Overdue state is computed, not stored.

## Note Invariants

### INV-050: Exactly One Linked Record
- Every note references exactly one linked CRM record through `linkedEntityType` and `linkedEntityId`.
- The referenced record exists at creation time.

### INV-051: Non-Empty Body
- Every note has a non-empty plain-text `body`.

### INV-052: Append-Only Notes
- After creation, a note cannot be edited or overwritten.

### INV-053: Descending Retrieval Order
- Notes returned for one linked record are ordered by `createdAt` descending.

## Timestamp Invariants

### INV-060: Creation Timestamp Stability
- `createdAt` is set once at record creation and does not change afterward.

### INV-061: Update Timestamp Behavior
- `updatedAt` changes whenever a mutable entity is successfully updated.
- Notes do not have `updatedAt` because they are immutable.

## Dashboard Invariants

### INV-070: Stage Count Completeness
- Dashboard stage counts always include `Lead`, `Qualified`, `Proposal`, `Won`, and `Lost`.

### INV-071: Open Pipeline Amount Definition
- `openPipelineAmount` equals the sum of `amount` for opportunities in `Lead`, `Qualified`, and `Proposal`.
- Opportunities without `amount` contribute zero.
- `Won` and `Lost` opportunities do not contribute.

### INV-072: Overdue Task Count Definition
- `overdueTaskCount` counts only open tasks whose `dueDate` is before the current date.

## Service-Level Invariants

### INV-080: Application Services Validate Cross-Aggregate References
- In-memory application services must reject writes that reference missing companies, contacts, or linked entities.

### INV-081: Repository Neutrality
- Repositories may support uniqueness indexes and lookup performance but must not redefine business rules already owned by the domain.

### INV-082: Search Semantics
- Contact, company, and opportunity search uses case-insensitive substring matching only.

## Suggested Verification Matrix
- `INV-011`, `INV-021`: uniqueness tests
- `INV-031` to `INV-037`: opportunity creation and stage transition tests
- `INV-040` to `INV-044`: task creation, completion, and overdue tests
- `INV-050` to `INV-053`: note validation and ordering tests
- `INV-070` to `INV-072`: dashboard projection tests
