# Data Model -- CRM MVP (Prisma Schema)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ─── Enums ───────────────────────────────────────────────

enum Role {
  ADMIN
  MANAGER
  REP
}

enum OpportunityStatus {
  OPEN
  WON
  LOST
}

enum TaskStatus {
  TODO
  IN_PROGRESS
  DONE
}

enum TaskPriority {
  LOW
  MEDIUM
  HIGH
}

// ─── User ────────────────────────────────────────────────

model User {
  id        String   @id @default(uuid()) @db.Uuid
  email     String   @unique
  name      String
  role      Role     @default(REP)
  avatarUrl String?
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // NextAuth.js managed relations
  accounts Account[]
  sessions Session[]

  // CRM relations
  ownedContacts     Contact[]     @relation("ContactOwner")
  ownedCompanies    Company[]     @relation("CompanyOwner")
  ownedOpportunities Opportunity[] @relation("OpportunityOwner")
  assignedTasks     Task[]        @relation("TaskAssignee")
  authoredNotes     Note[]        @relation("NoteAuthor")
  sentInvitations   Invitation[]  @relation("InvitationSender")

  @@index([email])
  @@index([role])
}

// ─── NextAuth.js Models ──────────────────────────────────

model Account {
  id                String  @id @default(uuid()) @db.Uuid
  userId            String  @db.Uuid
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text
  session_state     String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
  @@index([userId])
}

model Session {
  id           String   @id @default(uuid()) @db.Uuid
  sessionToken String   @unique
  userId       String   @db.Uuid
  expires      DateTime

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])
}

// ─── Contact ─────────────────────────────────────────────

model Contact {
  id        String    @id @default(uuid()) @db.Uuid
  firstName String
  lastName  String
  email     String?
  phone     String?
  jobTitle  String?
  companyId String?   @db.Uuid
  ownerId   String    @db.Uuid
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
  deletedAt DateTime?
  version   Int       @default(1)

  company       Company?      @relation(fields: [companyId], references: [id])
  owner         User          @relation("ContactOwner", fields: [ownerId], references: [id])
  opportunities Opportunity[] @relation("OpportunityContact")
  tasks         Task[]        @relation("TaskContact")
  notes         Note[]        @relation("NoteContact")

  @@index([ownerId])
  @@index([companyId])
  @@index([email])
  @@index([deletedAt])
  @@index([lastName, firstName])
}

// ─── Company ─────────────────────────────────────────────

model Company {
  id        String    @id @default(uuid()) @db.Uuid
  name      String
  domain    String?
  phone     String?
  address   String?
  industry  String?
  ownerId   String    @db.Uuid
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
  deletedAt DateTime?
  version   Int       @default(1)

  owner         User          @relation("CompanyOwner", fields: [ownerId], references: [id])
  contacts      Contact[]
  opportunities Opportunity[] @relation("OpportunityCompany")
  tasks         Task[]        @relation("TaskCompany")
  notes         Note[]        @relation("NoteCompany")

  @@index([ownerId])
  @@index([name])
  @@index([deletedAt])
}

// ─── Pipeline Stage ──────────────────────────────────────

model PipelineStage {
  id        String   @id @default(uuid()) @db.Uuid
  name      String
  position  Int
  color     String?
  isDefault Boolean  @default(false)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  opportunities Opportunity[]

  @@unique([position])
  @@index([isDefault])
}

// ─── Opportunity ─────────────────────────────────────────

model Opportunity {
  id                String             @id @default(uuid()) @db.Uuid
  title             String
  value             Decimal?           @db.Decimal(12, 2)
  currency          String             @default("USD")
  stageId           String             @db.Uuid
  ownerId           String             @db.Uuid
  contactId         String?            @db.Uuid
  companyId         String?            @db.Uuid
  expectedCloseDate DateTime?
  closedAt          DateTime?
  status            OpportunityStatus  @default(OPEN)
  createdAt         DateTime           @default(now())
  updatedAt         DateTime           @updatedAt
  deletedAt         DateTime?
  version           Int                @default(1)

  stage   PipelineStage @relation(fields: [stageId], references: [id])
  owner   User          @relation("OpportunityOwner", fields: [ownerId], references: [id])
  contact Contact?      @relation("OpportunityContact", fields: [contactId], references: [id])
  company Company?      @relation("OpportunityCompany", fields: [companyId], references: [id])
  tasks   Task[]        @relation("TaskOpportunity")
  notes   Note[]        @relation("NoteOpportunity")

  @@index([stageId])
  @@index([ownerId])
  @@index([status])
  @@index([contactId])
  @@index([companyId])
  @@index([deletedAt])
}

// ─── Task ────────────────────────────────────────────────

model Task {
  id            String       @id @default(uuid()) @db.Uuid
  title         String
  description   String?      @db.Text
  dueDate       DateTime?
  status        TaskStatus   @default(TODO)
  priority      TaskPriority @default(MEDIUM)
  assigneeId    String       @db.Uuid
  contactId     String?      @db.Uuid
  companyId     String?      @db.Uuid
  opportunityId String?      @db.Uuid
  createdAt     DateTime     @default(now())
  updatedAt     DateTime     @updatedAt
  deletedAt     DateTime?
  version       Int          @default(1)

  assignee    User         @relation("TaskAssignee", fields: [assigneeId], references: [id])
  contact     Contact?     @relation("TaskContact", fields: [contactId], references: [id])
  company     Company?     @relation("TaskCompany", fields: [companyId], references: [id])
  opportunity Opportunity? @relation("TaskOpportunity", fields: [opportunityId], references: [id])

  @@index([assigneeId])
  @@index([status])
  @@index([dueDate])
  @@index([contactId])
  @@index([companyId])
  @@index([opportunityId])
  @@index([deletedAt])
}

// ─── Note ────────────────────────────────────────────────

model Note {
  id            String   @id @default(uuid()) @db.Uuid
  content       String   @db.Text
  authorId      String   @db.Uuid
  contactId     String?  @db.Uuid
  companyId     String?  @db.Uuid
  opportunityId String?  @db.Uuid
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  author      User         @relation("NoteAuthor", fields: [authorId], references: [id])
  contact     Contact?     @relation("NoteContact", fields: [contactId], references: [id])
  company     Company?     @relation("NoteCompany", fields: [companyId], references: [id])
  opportunity Opportunity? @relation("NoteOpportunity", fields: [opportunityId], references: [id])

  @@index([authorId])
  @@index([contactId])
  @@index([companyId])
  @@index([opportunityId])
}

// ─── Invitation ──────────────────────────────────────────

model Invitation {
  id          String    @id @default(uuid()) @db.Uuid
  email       String
  role        Role      @default(REP)
  token       String    @unique
  invitedById String    @db.Uuid
  expiresAt   DateTime
  acceptedAt  DateTime?
  createdAt   DateTime  @default(now())

  invitedBy User @relation("InvitationSender", fields: [invitedById], references: [id])

  @@index([token])
  @@index([email])
}
```

## Design Decisions

### Polymorphic Entity Links (Task, Note)

Tasks and Notes can be linked to Contacts, Companies, and/or Opportunities simultaneously. Instead of a single `entityType`/`entityId` polymorphic pattern, each link is a **nullable foreign key** column:

```
contactId     String?  @db.Uuid
companyId     String?  @db.Uuid
opportunityId String?  @db.Uuid
```

Advantages:
- Referential integrity enforced by the database.
- Simple JOIN queries without type dispatching.
- A single task/note can reference multiple entities (e.g., a task linked to both a contact and an opportunity).

Trade-off: Adding a new linkable entity type requires a migration to add a new FK column.

### Soft Delete

Entities with `deletedAt DateTime?` use soft delete. Queries filter `WHERE deletedAt IS NULL` by default. The `deletedAt` column is indexed for efficient filtering.

Entities using soft delete: Contact, Company, Opportunity, Task.

Notes use hard delete (lightweight records without audit requirements in MVP).

### Optimistic Locking

Entities with `version Int @default(1)` support optimistic concurrency. On update:

```sql
UPDATE ... SET version = version + 1 WHERE id = $1 AND version = $2
```

If no rows are affected, the API returns 409 Conflict. This prevents lost updates when multiple users edit the same record.

### Indexes

Indexes are defined for:
- Foreign key columns (required for JOIN performance).
- Columns used in common filters (`status`, `dueDate`, `deletedAt`).
- Columns used in search (`email`, `name`, `lastName + firstName`).
- Unique constraints on pipeline stage `position` to prevent ordering gaps.

### UUID Primary Keys

All tables use UUIDs (`@db.Uuid`) as primary keys. This avoids sequential ID enumeration and simplifies distributed ID generation if needed later.
