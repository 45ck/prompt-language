# Sequence Diagram -- Contact to Closed Deal

## Overview

This sequence shows the core sales workflow: a Sales Rep creates a contact, links it to a company, creates an opportunity, moves it through pipeline stages, and closes the deal.

## Sequence (Mermaid)

```mermaid
sequenceDiagram
    actor Rep as Sales Rep
    participant UI as Next.js Frontend
    participant API as Next.js API Routes
    participant DB as PostgreSQL (Prisma)

    Note over Rep,DB: Step 1 -- Create Contact

    Rep->>UI: Fill in contact form (name, email, phone)
    UI->>API: POST /api/contacts { firstName, lastName, email, phone }
    API->>DB: INSERT INTO contacts (...)
    DB-->>API: Contact record (id, ...)
    API-->>UI: 201 { id, firstName, lastName, ... }
    UI-->>Rep: Show contact detail page

    Note over Rep,DB: Step 2 -- Create Company and Link

    Rep->>UI: Create new company from contact page
    UI->>API: POST /api/companies { name, industry, website }
    API->>DB: INSERT INTO companies (...)
    DB-->>API: Company record (id, ...)
    API-->>UI: 201 { id, name, ... }

    Rep->>UI: Link contact to company
    UI->>API: PATCH /api/contacts/:contactId { companyId }
    API->>DB: UPDATE contacts SET company_id = ... WHERE id = ...
    DB-->>API: Updated contact
    API-->>UI: 200 { id, companyId, ... }
    UI-->>Rep: Show company link on contact page

    Note over Rep,DB: Step 3 -- Create Opportunity

    Rep->>UI: Click "New Opportunity" from contact page
    UI->>API: POST /api/opportunities { title, value, contactId, companyId, stageId, expectedCloseDate }
    API->>DB: INSERT INTO opportunities (...)
    DB-->>API: Opportunity record (id, stageId = "New Lead", ...)
    API-->>UI: 201 { id, title, stage, ... }
    UI-->>Rep: Show opportunity in pipeline board

    Note over Rep,DB: Step 4 -- Move Through Pipeline Stages

    Rep->>UI: Drag opportunity to "Qualification" stage
    UI->>API: PATCH /api/opportunities/:id { stageId: qualificationStageId }
    API->>DB: UPDATE opportunities SET stage_id = ... WHERE id = ...
    DB-->>API: Updated opportunity
    API-->>UI: 200 { id, stageId, ... }

    Rep->>UI: Add note about qualification call
    UI->>API: POST /api/notes { body, entityType: "OPPORTUNITY", entityId }
    API->>DB: INSERT INTO notes (...)
    DB-->>API: Note record
    API-->>UI: 201 { id, body, ... }

    Rep->>UI: Drag opportunity to "Proposal"
    UI->>API: PATCH /api/opportunities/:id { stageId: proposalStageId }
    API->>DB: UPDATE opportunities SET stage_id = ...
    API-->>UI: 200

    Rep->>UI: Drag opportunity to "Negotiation"
    UI->>API: PATCH /api/opportunities/:id { stageId: negotiationStageId }
    API->>DB: UPDATE opportunities SET stage_id = ...
    API-->>UI: 200

    Note over Rep,DB: Step 5 -- Close the Deal

    Rep->>UI: Drag opportunity to "Closed Won"
    UI->>API: PATCH /api/opportunities/:id { stageId: closedWonStageId }
    API->>DB: UPDATE opportunities SET stage_id = ..., closed_at = NOW()
    DB-->>API: Updated opportunity
    API-->>UI: 200 { id, stageId, closedAt, ... }

    Rep->>UI: Add win reason note
    UI->>API: POST /api/notes { body: "Won: competitive pricing", entityType: "OPPORTUNITY", entityId }
    API->>DB: INSERT INTO notes (...)
    API-->>UI: 201

    UI-->>Rep: Pipeline board updated, dashboard reflects closed deal
```

## Step-by-Step Narrative

### Step 1: Create Contact

The rep fills in a contact form with first name, last name, email, and phone. The frontend sends a `POST /api/contacts` request. The API validates the input, sets the `ownerId` to the authenticated user and `orgId` from the session, then inserts the record via Prisma. The new contact is returned and displayed.

### Step 2: Create Company and Link

From the contact detail page, the rep creates a new company record. Then they link the contact to the company by updating the contact's `companyId`. Both operations are standard CRUD calls.

### Step 3: Create Opportunity

The rep creates an opportunity linked to the contact (and optionally the company). The opportunity is assigned to the first pipeline stage ("New Lead") by default, or the rep selects a stage explicitly. The opportunity appears on the pipeline board.

### Step 4: Move Through Pipeline Stages

The rep drags the opportunity card across the pipeline board. Each drag triggers a `PATCH /api/opportunities/:id` call that updates the `stageId`. The rep adds notes at each stage to record context (qualification details, proposal feedback, negotiation terms).

### Step 5: Close the Deal

When the deal is won, the rep moves the opportunity to "Closed Won". The API sets the `closedAt` timestamp. The rep adds a final note recording the win reason. The dashboard totals update to reflect the new closed revenue.

## Error Cases

| Scenario | Handling |
|----------|----------|
| Contact creation with duplicate email | API returns 409 Conflict with message |
| Opportunity moved to invalid stage | API validates stageId belongs to org, returns 400 |
| Unauthenticated request | API returns 401, frontend redirects to login |
| User tries to access another org's data | API filters by orgId from session, returns 404 |
