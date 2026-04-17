# Domain Model -- CRM MVP

## Entities and Relationships

```
Organization (1) ----< (N) User
Organization (1) ----< (N) PipelineStage
Organization (1) ----< (N) Contact
Organization (1) ----< (N) Company

Company      (1) ----< (N) Contact
Contact      (1) ----< (N) Opportunity
Company      (1) ----< (N) Opportunity

PipelineStage (1) ----< (N) Opportunity

User (as owner)    (1) ----< (N) Contact
User (as owner)    (1) ----< (N) Company
User (as owner)    (1) ----< (N) Opportunity
User (as assignee) (1) ----< (N) Task
User (as author)   (1) ----< (N) Note

-- Polymorphic associations (entityType + entityId) --
Contact     (1) ----< (N) Task
Company     (1) ----< (N) Task
Opportunity (1) ----< (N) Task

Contact     (1) ----< (N) Note
Company     (1) ----< (N) Note
Opportunity (1) ----< (N) Note
```

## Entity Details

### Organization

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| name | String | Organization name |
| createdAt | DateTime | Creation timestamp |
| updatedAt | DateTime | Last update timestamp |

Tenant boundary. Every data record belongs to an organization. All queries filter by orgId.

### User

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| email | String | Unique login identifier |
| name | String | Display name |
| passwordHash | String | Bcrypt-hashed password |
| role | Enum | ADMIN, SALES_MANAGER, SALES_REP, SERVICE_AGENT |
| orgId | UUID | FK to Organization |
| createdAt | DateTime | Creation timestamp |
| updatedAt | DateTime | Last update timestamp |

### Contact

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| firstName | String | First name |
| lastName | String | Last name |
| email | String? | Email address (optional) |
| phone | String? | Phone number (optional) |
| companyId | UUID? | FK to Company (optional) |
| ownerId | UUID | FK to User who owns this contact |
| orgId | UUID | FK to Organization |
| createdAt | DateTime | Creation timestamp |
| updatedAt | DateTime | Last update timestamp |

### Company

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| name | String | Company name |
| industry | String? | Industry sector (optional) |
| website | String? | Company website (optional) |
| ownerId | UUID | FK to User who owns this company |
| orgId | UUID | FK to Organization |
| createdAt | DateTime | Creation timestamp |
| updatedAt | DateTime | Last update timestamp |

### Opportunity

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| title | String | Deal name |
| value | Decimal? | Estimated deal value (optional) |
| stageId | UUID | FK to PipelineStage |
| contactId | UUID | FK to Contact (primary contact) |
| companyId | UUID? | FK to Company (optional) |
| ownerId | UUID | FK to User who owns this deal |
| expectedCloseDate | Date? | Target close date (optional) |
| closedAt | DateTime? | Actual close timestamp |
| orgId | UUID | FK to Organization |
| createdAt | DateTime | Creation timestamp |
| updatedAt | DateTime | Last update timestamp |

### PipelineStage

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| name | String | Stage label (e.g., "Qualification") |
| position | Int | Display order (0-based) |
| orgId | UUID | FK to Organization |
| createdAt | DateTime | Creation timestamp |
| updatedAt | DateTime | Last update timestamp |

Default stages seeded per organization: New Lead, Qualification, Proposal, Negotiation, Closed Won, Closed Lost.

### Task

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| title | String | Task description |
| description | String? | Additional details (optional) |
| dueDate | Date? | Due date (optional) |
| completed | Boolean | Completion status (default: false) |
| assigneeId | UUID | FK to User assigned to this task |
| entityType | Enum | CONTACT, COMPANY, OPPORTUNITY |
| entityId | UUID | FK to the linked entity |
| orgId | UUID | FK to Organization |
| createdAt | DateTime | Creation timestamp |
| updatedAt | DateTime | Last update timestamp |

### Note

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| body | String | Note content (free text) |
| authorId | UUID | FK to User who wrote the note |
| entityType | Enum | CONTACT, COMPANY, OPPORTUNITY |
| entityId | UUID | FK to the linked entity |
| orgId | UUID | FK to Organization |
| createdAt | DateTime | Creation timestamp |

Notes are append-only. No updatedAt -- once written, they are not edited.

## Cardinality Summary

| Relationship | Cardinality | Description |
|-------------|-------------|-------------|
| Organization : User | 1 : N | An org has many users |
| Organization : PipelineStage | 1 : N | An org has its own pipeline stages |
| Company : Contact | 1 : N | A company has many contacts |
| Contact : Opportunity | 1 : N | A contact can have many opportunities |
| Company : Opportunity | 1 : N | A company can have many opportunities |
| PipelineStage : Opportunity | 1 : N | A stage contains many opportunities |
| User : Contact (owner) | 1 : N | A user owns many contacts |
| User : Opportunity (owner) | 1 : N | A user owns many opportunities |
| User : Task (assignee) | 1 : N | A user is assigned many tasks |
| User : Note (author) | 1 : N | A user authors many notes |
| Contact/Company/Opportunity : Task | 1 : N | An entity has many tasks (polymorphic) |
| Contact/Company/Opportunity : Note | 1 : N | An entity has many notes (polymorphic) |
