# Sequence Diagram: Contact to Opportunity Workflow

## Overview

This diagram shows the primary sales workflow: a user creates a contact, links it to a company, creates an opportunity, and moves it through pipeline stages. This is the core workflow targeted to complete in under 3 minutes.

## Sequence

```
Actor          Browser (Next.js)       API Routes           Prisma           PostgreSQL
  |                  |                     |                   |                  |
  |  1. Create Company                    |                   |                  |
  |  POST /api/companies                  |                   |                  |
  |----------------->|                     |                   |                  |
  |                  |-------------------->|                   |                  |
  |                  |                     |  validate input   |                  |
  |                  |                     |  check auth/role  |                  |
  |                  |                     |------------------>|                  |
  |                  |                     |                   |  INSERT company  |
  |                  |                     |                   |----------------->|
  |                  |                     |                   |<-- company row --|
  |                  |                     |<-- Company obj ---|                  |
  |                  |<-- 201 { company }--|                   |                  |
  |<-- render form --|                     |                   |                  |
  |                  |                     |                   |                  |
  |  2. Create Contact (linked to Company)                    |                  |
  |  POST /api/contacts { companyId }     |                   |                  |
  |----------------->|                     |                   |                  |
  |                  |-------------------->|                   |                  |
  |                  |                     |  validate input   |                  |
  |                  |                     |  verify companyId |                  |
  |                  |                     |------------------>|                  |
  |                  |                     |                   |  INSERT contact  |
  |                  |                     |                   |----------------->|
  |                  |                     |                   |<-- contact row --|
  |                  |                     |<-- Contact obj ---|                  |
  |                  |<-- 201 { contact }--|                   |                  |
  |<-- render detail-|                     |                   |                  |
  |                  |                     |                   |                  |
  |  3. Fetch Pipeline Stages             |                   |                  |
  |  GET /api/stages                      |                   |                  |
  |----------------->|                     |                   |                  |
  |                  |-------------------->|                   |                  |
  |                  |                     |------------------>|                  |
  |                  |                     |                   |  SELECT stages   |
  |                  |                     |                   |  ORDER BY order  |
  |                  |                     |                   |----------------->|
  |                  |                     |                   |<-- stage rows ---|
  |                  |                     |<-- Stage[] -------|                  |
  |                  |<-- 200 { stages }---|                   |                  |
  |<-- populate form-|                     |                   |                  |
  |                  |                     |                   |                  |
  |  4. Create Opportunity                |                   |                  |
  |  POST /api/opportunities { stageId, contactId, companyId, ownerId }          |
  |----------------->|                     |                   |                  |
  |                  |-------------------->|                   |                  |
  |                  |                     |  validate input   |                  |
  |                  |                     |  verify FKs exist |                  |
  |                  |                     |------------------>|                  |
  |                  |                     |                   | INSERT opportun. |
  |                  |                     |                   |----------------->|
  |                  |                     |                   |<-- opp row ------|
  |                  |                     |<-- Opportunity ---|                  |
  |                  |<-- 201 { opp } -----|                   |                  |
  |<-- render board--|                     |                   |                  |
  |                  |                     |                   |                  |
  |  5. Move Opportunity to Next Stage    |                   |                  |
  |  PATCH /api/opportunities/:id { stageId }                 |                  |
  |----------------->|                     |                   |                  |
  |                  |-------------------->|                   |                  |
  |                  |                     |  validate stageId |                  |
  |                  |                     |  check ownership  |                  |
  |                  |                     |------------------>|                  |
  |                  |                     |                   | UPDATE stageId   |
  |                  |                     |                   |----------------->|
  |                  |                     |                   |<-- updated row --|
  |                  |                     |<-- Opportunity ---|                  |
  |                  |<-- 200 { opp } -----|                   |                  |
  |<-- update board--|                     |                   |                  |
```

## Steps Detail

| Step | Action | API Call | Database Operation |
|---|---|---|---|
| 1 | User creates a new company | POST /api/companies | INSERT INTO Company |
| 2 | User creates a contact and links it to the company | POST /api/contacts | INSERT INTO Contact (with companyId FK) |
| 3 | System fetches available pipeline stages for the opportunity form | GET /api/stages | SELECT FROM PipelineStage WHERE isArchived = false ORDER BY order |
| 4 | User creates an opportunity tied to the contact, company, and a stage | POST /api/opportunities | INSERT INTO Opportunity (with stageId, contactId, companyId, ownerId FKs) |
| 5 | User drags the opportunity to a new stage on the pipeline board | PATCH /api/opportunities/:id | UPDATE Opportunity SET stageId = :newStageId |

## Notes

- All API calls require a valid session (NextAuth.js session cookie).
- Steps 1 and 2 can be reordered: a contact can be created first without a company link, then associated later via PATCH.
- Step 5 can repeat as the opportunity progresses through Lead, Qualified, Proposal, Negotiation, and eventually Closed Won or Closed Lost.
- The frontend pipeline board uses optimistic updates: the UI moves the card immediately and reverts on API failure.
