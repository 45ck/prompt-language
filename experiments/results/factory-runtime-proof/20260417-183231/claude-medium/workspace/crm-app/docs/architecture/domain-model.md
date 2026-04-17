# Domain Model -- CRM MVP

## Entity-Relationship Diagram

```
+----------+       +----------+       +-----------------+
|  User    |       | Company  |       | PipelineStage   |
|----------|       |----------|       |-----------------|
| id       |       | id       |       | id              |
| email    |       | name     |       | name            |
| name     |       | domain   |       | position        |
| role     |       | phone    |       | color           |
| ...      |       | address  |       | isDefault       |
+----+-----+       +----+-----+       +--------+--------+
     |                  |                       |
     | 1:N              | 1:N                   | 1:N
     |                  |                       |
     |    +----------+  |          +------------+--------+
     |    | Contact  |  |          |  Opportunity        |
     |    |----------|  |          |---------------------|
     |    | id       +--+  N:1    | id                  |
     +--->| ownerId  |    company | title               |
  owner   | companyId+----------->| value               |
          | firstName|            | stageId             +---> PipelineStage
          | lastName |            | ownerId             +---> User (owner)
          | email    |            | contactId           +---> Contact
          | phone    |            | companyId           +---> Company
          | ...      |            | expectedCloseDate   |
          +----+-----+            | ...                 |
               |                  +----------+----------+
               |                             |
               |                             |
     +---------+---------+         +---------+---------+
     |                   |         |                   |
     v                   v         v                   v
+----+-----+       +-----+----+
|  Task    |       |  Note    |
|----------|       |----------|
| id       |       | id       |
| title    |       | content  |
| dueDate  |       | authorId +---> User
| status   |       | contactId|  (nullable FK)
| assigneeId+--->  | companyId|  (nullable FK)
| contactId| User  | opportunityId| (nullable FK)
| companyId|       | ...      |
| opportunityId|   +----------+
| ...      |
+----------+

+------------+
| Invitation |
|------------|
| id         |
| email      |
| role       |
| token      |
| invitedById+--> User
| expiresAt  |
| acceptedAt |
+------------+
```

## Entity Descriptions

### User

Represents an authenticated team member.

| Field       | Type     | Notes                              |
| ----------- | -------- | ---------------------------------- |
| id          | UUID     | Primary key                        |
| email       | String   | Unique, from OAuth or credentials  |
| name        | String   | Display name                       |
| role        | Enum     | ADMIN, MANAGER, REP                |
| avatarUrl   | String?  | From OAuth provider                |
| isActive    | Boolean  | Soft-disable without deletion      |
| createdAt   | DateTime | Auto-set                           |
| updatedAt   | DateTime | Auto-set                           |

### Contact

A person the team interacts with (lead, customer, etc.).

| Field       | Type     | Notes                              |
| ----------- | -------- | ---------------------------------- |
| id          | UUID     | Primary key                        |
| firstName   | String   | Required                           |
| lastName    | String   | Required                           |
| email       | String?  | Optional                           |
| phone       | String?  | Optional                           |
| jobTitle    | String?  | Optional                           |
| companyId   | UUID?    | FK to Company (N:1)                |
| ownerId     | UUID     | FK to User who owns the contact    |
| createdAt   | DateTime |                                    |
| updatedAt   | DateTime |                                    |
| deletedAt   | DateTime?| Soft delete                        |
| version     | Int      | Optimistic locking                 |

### Company

An organization that contacts belong to.

| Field       | Type     | Notes                              |
| ----------- | -------- | ---------------------------------- |
| id          | UUID     | Primary key                        |
| name        | String   | Required                           |
| domain      | String?  | Website domain                     |
| phone       | String?  |                                    |
| address     | String?  |                                    |
| industry    | String?  |                                    |
| ownerId     | UUID     | FK to User                         |
| createdAt   | DateTime |                                    |
| updatedAt   | DateTime |                                    |
| deletedAt   | DateTime?| Soft delete                        |
| version     | Int      | Optimistic locking                 |

### Opportunity

A potential deal being tracked through the pipeline.

| Field             | Type     | Notes                         |
| ----------------- | -------- | ----------------------------- |
| id                | UUID     | Primary key                   |
| title             | String   | Required                      |
| value             | Decimal? | Monetary value                |
| currency          | String   | Default: "USD"                |
| stageId           | UUID     | FK to PipelineStage           |
| ownerId           | UUID     | FK to User                    |
| contactId         | UUID?    | FK to Contact                 |
| companyId         | UUID?    | FK to Company                 |
| expectedCloseDate | DateTime?|                               |
| closedAt          | DateTime?| Set when won/lost             |
| status            | Enum     | OPEN, WON, LOST               |
| createdAt         | DateTime |                               |
| updatedAt         | DateTime |                               |
| deletedAt         | DateTime?| Soft delete                   |
| version           | Int      | Optimistic locking            |

### PipelineStage

An ordered stage in the sales pipeline. Configured by Admin.

| Field       | Type     | Notes                              |
| ----------- | -------- | ---------------------------------- |
| id          | UUID     | Primary key                        |
| name        | String   | e.g., "Qualified", "Proposal"      |
| position    | Int      | Sort order (0-based)               |
| color       | String?  | Hex color for UI                   |
| isDefault   | Boolean  | New opportunities land here        |
| createdAt   | DateTime |                                    |
| updatedAt   | DateTime |                                    |

### Task

An action item linked to one or more CRM entities.

| Field         | Type     | Notes                            |
| ------------- | -------- | -------------------------------- |
| id            | UUID     | Primary key                      |
| title         | String   | Required                         |
| description   | String?  |                                  |
| dueDate       | DateTime?|                                  |
| status        | Enum     | TODO, IN_PROGRESS, DONE          |
| priority      | Enum     | LOW, MEDIUM, HIGH                |
| assigneeId    | UUID     | FK to User                       |
| contactId     | UUID?    | Nullable FK (polymorphic link)   |
| companyId     | UUID?    | Nullable FK (polymorphic link)   |
| opportunityId | UUID?    | Nullable FK (polymorphic link)   |
| createdAt     | DateTime |                                  |
| updatedAt     | DateTime |                                  |
| deletedAt     | DateTime?| Soft delete                      |
| version       | Int      | Optimistic locking               |

### Note

A free-text annotation linked to one or more CRM entities.

| Field         | Type     | Notes                            |
| ------------- | -------- | -------------------------------- |
| id            | UUID     | Primary key                      |
| content       | String   | Required (text body)             |
| authorId      | UUID     | FK to User                       |
| contactId     | UUID?    | Nullable FK (polymorphic link)   |
| companyId     | UUID?    | Nullable FK (polymorphic link)   |
| opportunityId | UUID?    | Nullable FK (polymorphic link)   |
| createdAt     | DateTime |                                  |
| updatedAt     | DateTime |                                  |

### Invitation

Allows Admin to invite new users with a pre-assigned role.

| Field       | Type     | Notes                              |
| ----------- | -------- | ---------------------------------- |
| id          | UUID     | Primary key                        |
| email       | String   | Invitee email                      |
| role        | Enum     | ADMIN, MANAGER, REP                |
| token       | String   | Unique, URL-safe                   |
| invitedById | UUID     | FK to User (Admin who sent it)     |
| expiresAt   | DateTime | Token expiry                       |
| acceptedAt  | DateTime?| Set on acceptance                  |
| createdAt   | DateTime |                                    |

## Relationships Summary

| From          | To             | Cardinality | FK Field       |
| ------------- | -------------- | ----------- | -------------- |
| Contact       | Company        | N:1         | companyId      |
| Contact       | User (owner)   | N:1         | ownerId        |
| Company       | User (owner)   | N:1         | ownerId        |
| Opportunity   | PipelineStage  | N:1         | stageId        |
| Opportunity   | User (owner)   | N:1         | ownerId        |
| Opportunity   | Contact        | N:1         | contactId      |
| Opportunity   | Company        | N:1         | companyId      |
| Task          | User (assignee)| N:1         | assigneeId     |
| Task          | Contact        | N:1         | contactId      |
| Task          | Company        | N:1         | companyId      |
| Task          | Opportunity    | N:1         | opportunityId  |
| Note          | User (author)  | N:1         | authorId       |
| Note          | Contact        | N:1         | contactId      |
| Note          | Company        | N:1         | companyId      |
| Note          | Opportunity    | N:1         | opportunityId  |
| Invitation    | User (inviter) | N:1         | invitedById    |

## Polymorphic Linking Strategy

Task and Note use **nullable foreign keys** rather than a generic polymorphic type/id pattern. Each entity link is an independent nullable FK column (`contactId`, `companyId`, `opportunityId`). This allows:

- A task/note to be linked to multiple entities simultaneously (e.g., a task linked to both a contact and an opportunity).
- Referential integrity enforced at the database level.
- Simple JOIN queries without type-dispatch logic.

The trade-off is that adding a new linkable entity requires a schema migration to add a new nullable FK column.

## RBAC Model

| Role    | Contacts       | Companies      | Opportunities  | Tasks          | Notes     | Pipeline Config | Users     |
| ------- | -------------- | -------------- | -------------- | -------------- | --------- | --------------- | --------- |
| Admin   | Full CRUD      | Full CRUD      | Full CRUD      | Full CRUD      | Full CRUD | Full CRUD       | Full CRUD |
| Manager | Full CRUD      | Full CRUD      | Full CRUD      | Full CRUD      | Full CRUD | Read            | Read      |
| Rep     | Own CRUD       | Own CRUD       | Own CRUD       | Assigned CRUD  | Own CRUD  | Read            | None      |

- **Own CRUD**: Can create, read own records, update own, soft-delete own. Cannot see other Reps' records.
- **Assigned CRUD**: Can read/update tasks assigned to them.
- **Full CRUD**: No ownership restrictions.
- **Read**: Can view but not modify.
- **None**: Endpoint returns 403.

Managers can see all records across their team. In the MVP there is a single team (all users); multi-team is out of scope.
