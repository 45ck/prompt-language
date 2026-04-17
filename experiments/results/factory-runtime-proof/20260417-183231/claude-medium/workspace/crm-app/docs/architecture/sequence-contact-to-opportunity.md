# Sequence Diagram -- Contact to Opportunity Flow

A Sales Rep creates a contact, links it to a company, creates an opportunity, moves it through a pipeline stage, adds a note, and creates a follow-up task.

## Mermaid Diagram

```mermaid
sequenceDiagram
    actor Rep as Sales Rep
    participant UI as Next.js Frontend
    participant API as API Routes
    participant DB as PostgreSQL

    Note over Rep,DB: 1. Create Contact

    Rep->>UI: Fill contact form (firstName, lastName, email, phone)
    UI->>API: POST /api/contacts {firstName, lastName, email, phone}
    API->>API: Validate input (Zod), check auth, set ownerId
    API->>DB: INSERT INTO Contact
    DB-->>API: Contact record (id: contact-1)
    API-->>UI: 201 {id: contact-1, ...}
    UI-->>Rep: Show contact detail page

    Note over Rep,DB: 2. Link Contact to Company

    Rep->>UI: Search/select company "Acme Corp"
    UI->>API: PATCH /api/contacts/contact-1 {companyId: company-1}
    API->>API: Validate, check ownership
    API->>DB: UPDATE Contact SET companyId = company-1
    DB-->>API: Updated contact
    API-->>UI: 200 {id: contact-1, companyId: company-1, ...}
    UI-->>Rep: Show company linked on contact card

    Note over Rep,DB: 3. Create Opportunity

    Rep->>UI: Click "New Opportunity" from contact page
    UI->>API: POST /api/opportunities {title, value, contactId: contact-1, companyId: company-1}
    API->>API: Validate, set ownerId, resolve default stageId
    API->>DB: SELECT id FROM PipelineStage WHERE isDefault = true
    DB-->>API: PipelineStage (id: stage-1, name: "New Lead")
    API->>DB: INSERT INTO Opportunity (stageId: stage-1, ...)
    DB-->>API: Opportunity record (id: opp-1)
    API-->>UI: 201 {id: opp-1, stageId: stage-1, ...}
    UI-->>Rep: Show opportunity in pipeline board

    Note over Rep,DB: 4. Move Opportunity to New Stage

    Rep->>UI: Drag opportunity card to "Proposal" column
    UI->>API: PATCH /api/opportunities/opp-1 {stageId: stage-3, version: 1}
    API->>API: Validate, check ownership, verify version (optimistic lock)
    API->>DB: UPDATE Opportunity SET stageId = stage-3, version = 2 WHERE version = 1
    DB-->>API: Updated opportunity
    API-->>UI: 200 {id: opp-1, stageId: stage-3, version: 2, ...}
    UI-->>Rep: Card appears in "Proposal" column

    Note over Rep,DB: 5. Add Note to Opportunity

    Rep->>UI: Type note in opportunity detail panel
    UI->>API: POST /api/notes {content: "Client interested...", opportunityId: opp-1}
    API->>API: Validate, set authorId from session
    API->>DB: INSERT INTO Note
    DB-->>API: Note record (id: note-1)
    API-->>UI: 201 {id: note-1, ...}
    UI-->>Rep: Note appears in activity feed

    Note over Rep,DB: 6. Create Follow-up Task

    Rep->>UI: Click "Add Task", fill title and due date
    UI->>API: POST /api/tasks {title: "Send proposal", dueDate, opportunityId: opp-1, contactId: contact-1}
    API->>API: Validate, set assigneeId = current user
    API->>DB: INSERT INTO Task
    DB-->>API: Task record (id: task-1)
    API-->>UI: 201 {id: task-1, ...}
    UI-->>Rep: Task appears in task list and on opportunity detail
```

## Step-by-Step Narrative

1. **Create Contact** -- Rep submits a contact form. The API validates with Zod, assigns the current user as owner, and inserts into the Contact table. The new contact is returned with its generated UUID.

2. **Link to Company** -- Rep selects an existing company from a search dropdown. A PATCH request updates the contact's `companyId`. The API verifies the Rep owns the contact before allowing the update.

3. **Create Opportunity** -- Rep creates an opportunity from the contact's detail page. The API auto-assigns the default pipeline stage (the one with `isDefault = true`) and links the opportunity to both the contact and company.

4. **Move to New Stage** -- Rep drags the opportunity card on the Kanban board. The UI sends a PATCH with the new `stageId` and the current `version` for optimistic concurrency control. If another user modified the record, the API returns 409 Conflict.

5. **Add Note** -- Rep types a note in the opportunity's activity panel. The API sets the `authorId` from the authenticated session and links the note to the opportunity.

6. **Create Follow-up Task** -- Rep creates a task with a due date, linked to both the opportunity and the contact. The task is assigned to the current user by default.
