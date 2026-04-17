# Data Model -- CRM MVP (Prisma Schema)

## Enums

```prisma
enum Role {
  ADMIN
  SALES_MANAGER
  SALES_REP
  SERVICE_AGENT
}

enum EntityType {
  CONTACT
  COMPANY
  OPPORTUNITY
}
```

## Models

```prisma
model Organization {
  id        String   @id @default(uuid()) @db.Uuid
  name      String   @db.VarChar(255)
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  users          User[]
  contacts       Contact[]
  companies      Company[]
  opportunities  Opportunity[]
  pipelineStages PipelineStage[]
  tasks          Task[]
  notes          Note[]

  @@map("organizations")
}

model User {
  id           String   @id @default(uuid()) @db.Uuid
  email        String   @db.VarChar(255)
  name         String   @db.VarChar(255)
  passwordHash String   @map("password_hash") @db.VarChar(255)
  role         Role     @default(SALES_REP)
  orgId        String   @map("org_id") @db.Uuid
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt @map("updated_at")

  org           Organization  @relation(fields: [orgId], references: [id])
  ownedContacts Contact[]     @relation("ContactOwner")
  ownedCompanies Company[]    @relation("CompanyOwner")
  ownedOpportunities Opportunity[] @relation("OpportunityOwner")
  assignedTasks Task[]        @relation("TaskAssignee")
  authoredNotes Note[]        @relation("NoteAuthor")

  @@unique([email, orgId])
  @@index([orgId])
  @@map("users")
}

model Contact {
  id        String   @id @default(uuid()) @db.Uuid
  firstName String   @map("first_name") @db.VarChar(255)
  lastName  String   @map("last_name") @db.VarChar(255)
  email     String?  @db.VarChar(255)
  phone     String?  @db.VarChar(50)
  companyId String?  @map("company_id") @db.Uuid
  ownerId   String   @map("owner_id") @db.Uuid
  orgId     String   @map("org_id") @db.Uuid
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  org           Organization  @relation(fields: [orgId], references: [id])
  company       Company?      @relation(fields: [companyId], references: [id])
  owner         User          @relation("ContactOwner", fields: [ownerId], references: [id])
  opportunities Opportunity[]
  tasks         Task[]        @relation("ContactTasks")
  notes         Note[]        @relation("ContactNotes")

  @@index([orgId])
  @@index([companyId])
  @@index([ownerId])
  @@index([orgId, email])
  @@index([orgId, lastName, firstName])
  @@map("contacts")
}

model Company {
  id        String   @id @default(uuid()) @db.Uuid
  name      String   @db.VarChar(255)
  industry  String?  @db.VarChar(255)
  website   String?  @db.VarChar(255)
  ownerId   String   @map("owner_id") @db.Uuid
  orgId     String   @map("org_id") @db.Uuid
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  org           Organization  @relation(fields: [orgId], references: [id])
  owner         User          @relation("CompanyOwner", fields: [ownerId], references: [id])
  contacts      Contact[]
  opportunities Opportunity[]
  tasks         Task[]        @relation("CompanyTasks")
  notes         Note[]        @relation("CompanyNotes")

  @@index([orgId])
  @@index([ownerId])
  @@index([orgId, name])
  @@map("companies")
}

model PipelineStage {
  id        String   @id @default(uuid()) @db.Uuid
  name      String   @db.VarChar(100)
  position  Int      @db.Integer
  orgId     String   @map("org_id") @db.Uuid
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  org           Organization  @relation(fields: [orgId], references: [id])
  opportunities Opportunity[]

  @@unique([orgId, position])
  @@unique([orgId, name])
  @@index([orgId])
  @@map("pipeline_stages")
}

model Opportunity {
  id                String    @id @default(uuid()) @db.Uuid
  title             String    @db.VarChar(255)
  value             Decimal?  @db.Decimal(12, 2)
  stageId           String    @map("stage_id") @db.Uuid
  contactId         String    @map("contact_id") @db.Uuid
  companyId         String?   @map("company_id") @db.Uuid
  ownerId           String    @map("owner_id") @db.Uuid
  expectedCloseDate DateTime? @map("expected_close_date") @db.Date
  closedAt          DateTime? @map("closed_at")
  orgId             String    @map("org_id") @db.Uuid
  createdAt         DateTime  @default(now()) @map("created_at")
  updatedAt         DateTime  @updatedAt @map("updated_at")

  org     Organization  @relation(fields: [orgId], references: [id])
  stage   PipelineStage @relation(fields: [stageId], references: [id])
  contact Contact       @relation(fields: [contactId], references: [id])
  company Company?      @relation(fields: [companyId], references: [id])
  owner   User          @relation("OpportunityOwner", fields: [ownerId], references: [id])
  tasks   Task[]        @relation("OpportunityTasks")
  notes   Note[]        @relation("OpportunityNotes")

  @@index([orgId])
  @@index([stageId])
  @@index([contactId])
  @@index([companyId])
  @@index([ownerId])
  @@index([orgId, stageId])
  @@index([orgId, expectedCloseDate])
  @@map("opportunities")
}

model Task {
  id          String    @id @default(uuid()) @db.Uuid
  title       String    @db.VarChar(255)
  description String?   @db.Text
  dueDate     DateTime? @map("due_date") @db.Date
  completed   Boolean   @default(false)
  assigneeId  String    @map("assignee_id") @db.Uuid
  entityType  EntityType @map("entity_type")
  entityId    String    @map("entity_id") @db.Uuid
  orgId       String    @map("org_id") @db.Uuid
  createdAt   DateTime  @default(now()) @map("created_at")
  updatedAt   DateTime  @updatedAt @map("updated_at")

  org         Organization @relation(fields: [orgId], references: [id])
  assignee    User         @relation("TaskAssignee", fields: [assigneeId], references: [id])
  contact     Contact?     @relation("ContactTasks", fields: [entityId], references: [id], map: "tasks_contact_fk")
  company     Company?     @relation("CompanyTasks", fields: [entityId], references: [id], map: "tasks_company_fk")
  opportunity Opportunity? @relation("OpportunityTasks", fields: [entityId], references: [id], map: "tasks_opportunity_fk")

  @@index([orgId])
  @@index([assigneeId])
  @@index([entityType, entityId])
  @@index([orgId, completed, dueDate])
  @@map("tasks")
}

model Note {
  id         String     @id @default(uuid()) @db.Uuid
  body       String     @db.Text
  authorId   String     @map("author_id") @db.Uuid
  entityType EntityType @map("entity_type")
  entityId   String     @map("entity_id") @db.Uuid
  orgId      String     @map("org_id") @db.Uuid
  createdAt  DateTime   @default(now()) @map("created_at")

  org         Organization @relation(fields: [orgId], references: [id])
  author      User         @relation("NoteAuthor", fields: [authorId], references: [id])
  contact     Contact?     @relation("ContactNotes", fields: [entityId], references: [id], map: "notes_contact_fk")
  company     Company?     @relation("CompanyNotes", fields: [entityId], references: [id], map: "notes_company_fk")
  opportunity Opportunity? @relation("OpportunityNotes", fields: [entityId], references: [id], map: "notes_opportunity_fk")

  @@index([orgId])
  @@index([authorId])
  @@index([entityType, entityId])
  @@map("notes")
}
```

## SQL Column Type Summary

| Prisma Type | PostgreSQL Type | Usage |
|-------------|-----------------|-------|
| `@db.Uuid` | `uuid` | All primary keys and foreign keys |
| `@db.VarChar(255)` | `varchar(255)` | Names, emails, titles |
| `@db.VarChar(50)` | `varchar(50)` | Phone numbers |
| `@db.VarChar(100)` | `varchar(100)` | Pipeline stage names |
| `@db.Text` | `text` | Note bodies, task descriptions |
| `@db.Decimal(12,2)` | `decimal(12,2)` | Opportunity values (up to 9,999,999,999.99) |
| `@db.Integer` | `integer` | Pipeline stage position |
| `@db.Date` | `date` | Due dates, expected close dates |
| `DateTime` | `timestamp(3)` | Timestamps (created_at, updated_at, closed_at) |
| `Boolean` | `boolean` | Task completed flag |
| `Role` (enum) | PostgreSQL enum | User roles |
| `EntityType` (enum) | PostgreSQL enum | Polymorphic entity references |

## Index Strategy

| Table | Index | Purpose |
|-------|-------|---------|
| users | `(org_id)` | Filter users by organization |
| contacts | `(org_id)`, `(company_id)`, `(owner_id)` | List filtering |
| contacts | `(org_id, email)` | Search by email within org |
| contacts | `(org_id, last_name, first_name)` | Alphabetical listing |
| companies | `(org_id)`, `(owner_id)`, `(org_id, name)` | List and search |
| pipeline_stages | `(org_id)` | Load org stages |
| opportunities | `(org_id, stage_id)` | Pipeline board grouping |
| opportunities | `(org_id, expected_close_date)` | Forecast queries |
| tasks | `(org_id, completed, due_date)` | Overdue/upcoming task queries |
| tasks, notes | `(entity_type, entity_id)` | Load tasks/notes for a record |

## Seed Data

Each new organization is seeded with default pipeline stages:

| Position | Name |
|----------|------|
| 0 | New Lead |
| 1 | Qualification |
| 2 | Proposal |
| 3 | Negotiation |
| 4 | Closed Won |
| 5 | Closed Lost |

## Notes on Polymorphic Relations

Task and Note use `entityType` + `entityId` for polymorphic association. Prisma does not natively enforce polymorphic FK constraints at the database level. Application-level validation ensures `entityId` references a valid record of the specified `entityType`. The three optional relation fields (`contact`, `company`, `opportunity`) on Task and Note are mapped to separate FK constraint names but share the `entityId` column -- only one is active per row based on `entityType`.

In practice, the application layer should handle lookups rather than relying on Prisma's relation loading for polymorphic fields. A helper function resolves the correct entity based on `entityType`.
