# Domain Model

## Overview

The CRM MVP domain consists of seven core entities: User, Contact, Company, Opportunity, PipelineStage, Task, and Note. All entities use UUID primary keys and track creation/update timestamps.

## Entity-Relationship Diagram

```
+----------------+       +----------------+       +-------------------+
|     User       |       |    Company     |       |  PipelineStage    |
|----------------|       |----------------|       |-------------------|
| id: UUID (PK)  |       | id: UUID (PK)  |       | id: UUID (PK)     |
| email: String  |       | name: String   |       | name: String      |
| passwordHash   |       | industry: Str? |       | order: Int         |
| name: String   |       | website: Str?  |       | isArchived: Bool   |
| role: Role     |       | phone: Str?    |       | createdAt: DateTime|
| createdAt      |       | address: Str?  |       | updatedAt: DateTime|
| updatedAt      |       | createdAt      |       +-------------------+
+-------+--------+       | updatedAt      |              |
        |                 +-------+--------+              |
        |                         |                       |
        | 1:N owns                | 1:N has               | 1:N categorizes
        |                         |                       |
        |    +--------------------+----+                  |
        |    |                         |                  |
        v    v                         v                  v
+-------+----+-------+       +--------+---------+--------+--+
|    Contact         |       |    Opportunity                |
|--------------------|       |-------------------------------|
| id: UUID (PK)      |       | id: UUID (PK)                |
| name: String       |       | title: String                |
| email: String?     |       | value: Decimal               |
| phone: String?     |       | expectedCloseDate: DateTime? |
| status: ContactSta |       | createdAt: DateTime          |
| companyId: UUID?(FK|       | updatedAt: DateTime          |
| createdAt: DateTime|       | stageId: UUID (FK)           |
| updatedAt: DateTime|       | contactId: UUID? (FK)        |
+-------+------------+       | companyId: UUID? (FK)        |
        |                    | ownerId: UUID (FK)           |
        |                    +-------+----------+-----------+
        |                            |          |
        +----------------------------+          |
                                                |
+------------------+        +-------------------+----------+
|      Task        |        |       Note                   |
|------------------|        |------------------------------|
| id: UUID (PK)    |        | id: UUID (PK)                |
| title: String    |        | content: Text                |
| description: Txt?|        | authorId: UUID (FK)          |
| dueDate: DateTime|        | contactId: UUID? (FK)        |
| priority: Priority|       | companyId: UUID? (FK)        |
| status: TaskStat |        | opportunityId: UUID? (FK)    |
| assigneeId: UUID |        | createdAt: DateTime          |
| contactId: UUID? |        | updatedAt: DateTime          |
| opportunityId: U?|        +------------------------------+
| createdAt        |
| updatedAt        |
+------------------+
```

## Entities

### User

Represents an authenticated system user with a role.

| Field | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK, auto-generated | Unique identifier |
| email | String | Unique, required | Login email address |
| passwordHash | String | Required | bcrypt-hashed password |
| name | String | Required | Display name |
| role | Enum (Admin, Manager, Rep) | Required, default: Rep | Access control role |
| createdAt | DateTime | Auto-set | Account creation time |
| updatedAt | DateTime | Auto-updated | Last modification time |

### Contact

A person the sales team interacts with, optionally linked to a company.

| Field | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | Unique identifier |
| name | String | Required | Full name |
| email | String | Optional | Email address |
| phone | String | Optional | Phone number |
| status | Enum (Active, Inactive) | Default: Active | Contact status |
| companyId | UUID | FK -> Company, optional | Associated company |
| createdAt | DateTime | Auto-set | Creation timestamp |
| updatedAt | DateTime | Auto-updated | Last update timestamp |

### Company

An organization that contacts belong to and opportunities are associated with.

| Field | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | Unique identifier |
| name | String | Required, unique | Company name |
| industry | String | Optional | Industry sector |
| website | String | Optional | Company website URL |
| phone | String | Optional | Main phone number |
| address | String | Optional | Physical address |
| createdAt | DateTime | Auto-set | Creation timestamp |
| updatedAt | DateTime | Auto-updated | Last update timestamp |

### Opportunity

A sales deal progressing through the pipeline, owned by a user.

| Field | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | Unique identifier |
| title | String | Required | Deal title |
| value | Decimal | Required, >= 0 | Deal value in USD |
| expectedCloseDate | DateTime | Optional | Anticipated close date |
| stageId | UUID | FK -> PipelineStage, required | Current pipeline stage |
| contactId | UUID | FK -> Contact, optional | Primary contact |
| companyId | UUID | FK -> Company, optional | Associated company |
| ownerId | UUID | FK -> User, required | Assigned sales rep |
| createdAt | DateTime | Auto-set | Creation timestamp |
| updatedAt | DateTime | Auto-updated | Last update timestamp |

### PipelineStage

A stage in the sales pipeline. Ordered for display. Archivable but not deletable.

| Field | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | Unique identifier |
| name | String | Required, unique | Stage display name |
| order | Int | Required | Sort position (ascending) |
| isArchived | Boolean | Default: false | Soft-delete flag |
| createdAt | DateTime | Auto-set | Creation timestamp |
| updatedAt | DateTime | Auto-updated | Last update timestamp |

### Task

An actionable work item linked to a contact or opportunity, assigned to a user.

| Field | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | Unique identifier |
| title | String | Required | Task title |
| description | String | Optional | Detailed description |
| dueDate | DateTime | Optional | Due date |
| priority | Enum (Low, Medium, High) | Default: Medium | Priority level |
| status | Enum (Open, Completed) | Default: Open | Completion status |
| assigneeId | UUID | FK -> User, required | Assigned user |
| contactId | UUID | FK -> Contact, optional | Linked contact |
| opportunityId | UUID | FK -> Opportunity, optional | Linked opportunity |
| createdAt | DateTime | Auto-set | Creation timestamp |
| updatedAt | DateTime | Auto-updated | Last update timestamp |

### Note

A timestamped text entry attached to a contact, company, or opportunity.

| Field | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | Unique identifier |
| content | String | Required | Note text content |
| authorId | UUID | FK -> User, required | User who wrote the note |
| contactId | UUID | FK -> Contact, optional | Attached contact |
| companyId | UUID | FK -> Company, optional | Attached company |
| opportunityId | UUID | FK -> Opportunity, optional | Attached opportunity |
| createdAt | DateTime | Auto-set | Creation timestamp |
| updatedAt | DateTime | Auto-updated | Last update timestamp |

## Relationships Summary

| Relationship | Cardinality | Description |
|---|---|---|
| User -> Opportunity | 1:N | A user owns many opportunities |
| User -> Task | 1:N | A user is assigned many tasks |
| User -> Note | 1:N | A user authors many notes |
| Company -> Contact | 1:N | A company has many contacts |
| Company -> Opportunity | 1:N | A company has many opportunities |
| Contact -> Opportunity | 1:N | A contact has many opportunities |
| PipelineStage -> Opportunity | 1:N | A stage contains many opportunities |
| Contact -> Task | 1:N | A contact has many linked tasks |
| Opportunity -> Task | 1:N | An opportunity has many linked tasks |
| Contact -> Note | 1:N | A contact has many notes |
| Company -> Note | 1:N | A company has many notes |
| Opportunity -> Note | 1:N | An opportunity has many notes |

## Enumerations

| Enum | Values |
|---|---|
| Role | Admin, Manager, Rep |
| ContactStatus | Active, Inactive |
| Priority | Low, Medium, High |
| TaskStatus | Open, Completed |
