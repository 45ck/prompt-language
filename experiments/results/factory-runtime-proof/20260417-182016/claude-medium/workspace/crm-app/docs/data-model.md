# Data Model (Prisma Schema)

## Overview

The CRM MVP uses PostgreSQL as its primary data store, accessed through Prisma ORM. The schema defines seven domain models plus NextAuth.js models for authentication. All domain models use UUID primary keys and automatic timestamps.

## Prisma Schema

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// --- NextAuth.js Models ---

model Account {
  id                String  @id @default(uuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String?
  access_token      String?
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String?
  session_state     String?
  user              User    @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
}

model Session {
  id           String   @id @default(uuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])
}

// --- Domain Models ---

enum Role {
  Admin
  Manager
  Rep
}

enum ContactStatus {
  Active
  Inactive
}

enum Priority {
  Low
  Medium
  High
}

enum TaskStatus {
  Open
  Completed
}

model User {
  id            String    @id @default(uuid())
  email         String    @unique
  passwordHash  String
  name          String
  role          Role      @default(Rep)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  // NextAuth relations
  accounts      Account[]
  sessions      Session[]

  // Domain relations
  opportunities Opportunity[]
  tasks         Task[]         @relation("TaskAssignee")
  notes         Note[]

  @@index([email])
}

model Company {
  id            String    @id @default(uuid())
  name          String    @unique
  industry      String?
  website       String?
  phone         String?
  address       String?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  contacts      Contact[]
  opportunities Opportunity[]
  notes         Note[]

  @@index([name])
}

model Contact {
  id            String        @id @default(uuid())
  name          String
  email         String?
  phone         String?
  status        ContactStatus @default(Active)
  companyId     String?
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt

  company       Company?      @relation(fields: [companyId], references: [id])
  opportunities Opportunity[]
  tasks         Task[]
  notes         Note[]

  @@index([name])
  @@index([email])
  @@index([companyId])
}

model PipelineStage {
  id            String    @id @default(uuid())
  name          String    @unique
  order         Int
  isArchived    Boolean   @default(false)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  opportunities Opportunity[]

  @@index([order])
}

model Opportunity {
  id                String    @id @default(uuid())
  title             String
  value             Decimal   @db.Decimal(12, 2)
  expectedCloseDate DateTime?
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  stageId           String
  stage             PipelineStage @relation(fields: [stageId], references: [id])

  contactId         String?
  contact           Contact?  @relation(fields: [contactId], references: [id])

  companyId         String?
  company           Company?  @relation(fields: [companyId], references: [id])

  ownerId           String
  owner             User      @relation(fields: [ownerId], references: [id])

  tasks             Task[]
  notes             Note[]

  @@index([stageId])
  @@index([ownerId])
  @@index([companyId])
  @@index([contactId])
}

model Task {
  id              String     @id @default(uuid())
  title           String
  description     String?
  dueDate         DateTime?
  priority        Priority   @default(Medium)
  status          TaskStatus @default(Open)
  createdAt       DateTime   @default(now())
  updatedAt       DateTime   @updatedAt

  assigneeId      String
  assignee        User       @relation("TaskAssignee", fields: [assigneeId], references: [id])

  contactId       String?
  contact         Contact?   @relation(fields: [contactId], references: [id])

  opportunityId   String?
  opportunity     Opportunity? @relation(fields: [opportunityId], references: [id])

  @@index([assigneeId])
  @@index([status])
  @@index([dueDate])
  @@index([contactId])
  @@index([opportunityId])
}

model Note {
  id              String    @id @default(uuid())
  content         String
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  authorId        String
  author          User      @relation(fields: [authorId], references: [id])

  contactId       String?
  contact         Contact?  @relation(fields: [contactId], references: [id])

  companyId       String?
  company         Company?  @relation(fields: [companyId], references: [id])

  opportunityId   String?
  opportunity     Opportunity? @relation(fields: [opportunityId], references: [id])

  @@index([authorId])
  @@index([contactId])
  @@index([companyId])
  @@index([opportunityId])
  @@index([createdAt])
}
```

## Model Summary

| Model | Fields | Indexes | Relations |
|---|---|---|---|
| User | 7 + auth | email | owns Opportunities, assigned Tasks, authored Notes |
| Company | 7 | name | has Contacts, Opportunities, Notes |
| Contact | 7 | name, email, companyId | belongs to Company; has Opportunities, Tasks, Notes |
| PipelineStage | 5 | order | has Opportunities |
| Opportunity | 8 | stageId, ownerId, companyId, contactId | belongs to Stage, Contact, Company, User; has Tasks, Notes |
| Task | 9 | assigneeId, status, dueDate, contactId, opportunityId | belongs to User, Contact, Opportunity |
| Note | 7 | authorId, contactId, companyId, opportunityId, createdAt | belongs to User, Contact, Company, Opportunity |

## Default Data (Seed)

The database seed script should create:

1. **Pipeline Stages** (in order):
   - Lead (order: 1)
   - Qualified (order: 2)
   - Proposal (order: 3)
   - Negotiation (order: 4)
   - Closed Won (order: 5)
   - Closed Lost (order: 6)

2. **Admin User**: A default admin account for initial system configuration.

## Index Strategy

Indexes are placed on:
- Foreign key columns (all relation fields) for JOIN performance
- Columns used in WHERE clauses for filtering (status, dueDate, email, name)
- Columns used in ORDER BY (order on PipelineStage, createdAt on Note)

No composite indexes are needed at MVP scale (5-25 users, low query volume).

## Migration Strategy

- Prisma Migrate generates SQL migrations from schema changes.
- Migrations are stored in `prisma/migrations/` and committed to version control.
- `npx prisma migrate deploy` runs in production; `npx prisma migrate dev` during development.
- The seed script runs via `npx prisma db seed` after initial migration.
