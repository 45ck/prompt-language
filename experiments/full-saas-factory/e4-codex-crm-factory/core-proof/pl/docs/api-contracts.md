# CRM Core API Contracts

## Purpose
Define the API contracts for the bounded CRM core. These contracts assume a thin presentation layer over in-memory application services and pure TypeScript domain logic.

## Contract Style
- Requests and responses use JSON.
- IDs are opaque strings.
- Timestamps use ISO-8601 UTC strings.
- Validation failures return `400`.
- Missing records return `404`.
- Uniqueness or illegal transition conflicts return `409`.

## Shared Types

### OpportunityStage
- `Lead`
- `Qualified`
- `Proposal`
- `Won`
- `Lost`

### TaskStatus
- `Open`
- `Completed`

### LinkedEntityType
- `Contact`
- `Company`
- `Opportunity`

### ErrorResponse
```json
{
  "error": {
    "code": "validation_error",
    "message": "Human-readable summary",
    "details": [
      {
        "field": "email",
        "issue": "must be unique when present"
      }
    ]
  }
}
```

## Contact Contracts

### Create Contact
- Method: `POST`
- Path: `/contacts`

Request:
```json
{
  "firstName": "Avery",
  "lastName": "Cole",
  "email": "avery@example.com",
  "phone": "+61-400-000-000",
  "companyId": "company_123"
}
```

Success `201`:
```json
{
  "id": "contact_123",
  "firstName": "Avery",
  "lastName": "Cole",
  "email": "avery@example.com",
  "phone": "+61-400-000-000",
  "companyId": "company_123",
  "createdAt": "2026-04-12T00:00:00.000Z",
  "updatedAt": "2026-04-12T00:00:00.000Z"
}
```

Validation:
- `firstName` is required.
- `lastName` is required.
- `email` must be unique when present.
- `companyId` must reference an existing company when present.

### Update Contact
- Method: `PATCH`
- Path: `/contacts/{contactId}`

Allowed fields:
- `firstName`
- `lastName`
- `email`
- `phone`
- `companyId`

Success `200`: returns the updated contact.

### List Contacts
- Method: `GET`
- Path: `/contacts`
- Query:
  - `search?`: case-insensitive substring match on full name or email

Success `200`:
```json
{
  "items": [
    {
      "id": "contact_123",
      "firstName": "Avery",
      "lastName": "Cole",
      "email": "avery@example.com",
      "phone": "+61-400-000-000",
      "companyId": "company_123",
      "createdAt": "2026-04-12T00:00:00.000Z",
      "updatedAt": "2026-04-12T00:00:00.000Z"
    }
  ]
}
```

## Company Contracts

### Create Company
- Method: `POST`
- Path: `/companies`

Request:
```json
{
  "name": "Northstar Manufacturing",
  "website": "https://northstar.example.com",
  "industry": "Manufacturing"
}
```

Success `201`:
```json
{
  "id": "company_123",
  "name": "Northstar Manufacturing",
  "website": "https://northstar.example.com",
  "industry": "Manufacturing",
  "createdAt": "2026-04-12T00:00:00.000Z",
  "updatedAt": "2026-04-12T00:00:00.000Z"
}
```

Validation:
- `name` is required.
- `name` must be unique after normalization.

### Update Company
- Method: `PATCH`
- Path: `/companies/{companyId}`

Allowed fields:
- `name`
- `website`
- `industry`

Success `200`: returns the updated company.

### List Companies
- Method: `GET`
- Path: `/companies`
- Query:
  - `search?`: case-insensitive substring match on company name

Success `200` returns `{"items": [...]}` with company objects.

## Opportunity Contracts

### Create Opportunity
- Method: `POST`
- Path: `/opportunities`

Request:
```json
{
  "name": "Northstar Renewal",
  "companyId": "company_123",
  "primaryContactId": "contact_123",
  "amount": 12000,
  "targetCloseDate": "2026-05-31"
}
```

Success `201`:
```json
{
  "id": "opportunity_123",
  "name": "Northstar Renewal",
  "companyId": "company_123",
  "primaryContactId": "contact_123",
  "stage": "Lead",
  "amount": 12000,
  "targetCloseDate": "2026-05-31",
  "createdAt": "2026-04-12T00:00:00.000Z",
  "updatedAt": "2026-04-12T00:00:00.000Z",
  "closedAt": null
}
```

Validation:
- `name` is required.
- `companyId` is required and must exist.
- Initial stage is always `Lead`; clients cannot override it.
- `primaryContactId`, when present, must exist.
- `amount`, when present, must be non-negative.

### Update Opportunity
- Method: `PATCH`
- Path: `/opportunities/{opportunityId}`

Allowed fields while opportunity is open:
- `name`
- `companyId`
- `primaryContactId`
- `amount`
- `targetCloseDate`

Success `200`: returns the updated opportunity.

Validation:
- Closed opportunities cannot be edited through the generic update path.

### List Opportunities
- Method: `GET`
- Path: `/opportunities`
- Query:
  - `search?`: case-insensitive substring match on name
  - `stage?`: one of `Lead`, `Qualified`, `Proposal`, `Won`, `Lost`

Success `200` returns `{"items": [...]}` with opportunity objects.

### Change Opportunity Stage
- Method: `POST`
- Path: `/opportunities/{opportunityId}/stage-transitions`

Request:
```json
{
  "toStage": "Qualified"
}
```

Success `200`:
```json
{
  "id": "opportunity_123",
  "name": "Northstar Renewal",
  "companyId": "company_123",
  "primaryContactId": "contact_123",
  "stage": "Qualified",
  "amount": 12000,
  "targetCloseDate": "2026-05-31",
  "createdAt": "2026-04-12T00:00:00.000Z",
  "updatedAt": "2026-04-13T00:00:00.000Z",
  "closedAt": null
}
```

Allowed transitions:
- `Lead -> Qualified`
- `Lead -> Lost`
- `Qualified -> Proposal`
- `Qualified -> Lost`
- `Proposal -> Won`
- `Proposal -> Lost`

Blocked transitions:
- any transition that skips forward
- any transition from `Won`
- any transition from `Lost`
- any transition back into an active stage from a terminal stage

Effects:
- Transition to `Won` or `Lost` sets `closedAt`.
- Terminal opportunities remain listable and visible in dashboard results.

## Task Contracts

### Create Task
- Method: `POST`
- Path: `/tasks`

Request:
```json
{
  "title": "Schedule proposal review",
  "dueDate": "2026-04-20",
  "linkedEntityType": "Opportunity",
  "linkedEntityId": "opportunity_123"
}
```

Success `201`:
```json
{
  "id": "task_123",
  "title": "Schedule proposal review",
  "status": "Open",
  "dueDate": "2026-04-20",
  "linkedEntityType": "Opportunity",
  "linkedEntityId": "opportunity_123",
  "createdAt": "2026-04-12T00:00:00.000Z",
  "updatedAt": "2026-04-12T00:00:00.000Z",
  "completedAt": null
}
```

Validation:
- `title` is required.
- `linkedEntityType` and `linkedEntityId` must reference exactly one existing record.

### Update Task
- Method: `PATCH`
- Path: `/tasks/{taskId}`

Allowed fields while open:
- `title`
- `dueDate`

Success `200`: returns the updated task.

Validation:
- Completed tasks cannot be edited.

### Complete Task
- Method: `POST`
- Path: `/tasks/{taskId}/complete`

Request:
```json
{}
```

Success `200`:
```json
{
  "id": "task_123",
  "title": "Schedule proposal review",
  "status": "Completed",
  "dueDate": "2026-04-20",
  "linkedEntityType": "Opportunity",
  "linkedEntityId": "opportunity_123",
  "createdAt": "2026-04-12T00:00:00.000Z",
  "updatedAt": "2026-04-14T00:00:00.000Z",
  "completedAt": "2026-04-14T00:00:00.000Z"
}
```

Validation:
- Only open tasks can be completed.

### List Tasks
- Method: `GET`
- Path: `/tasks`
- Query:
  - `status?`: `Open` or `Completed`
  - `linkedEntityType?`
  - `linkedEntityId?`

Success `200` returns `{"items": [...]}` with task objects.

## Note Contracts

### Create Note
- Method: `POST`
- Path: `/notes`

Request:
```json
{
  "body": "Confirmed budget and next-step timeline.",
  "linkedEntityType": "Opportunity",
  "linkedEntityId": "opportunity_123"
}
```

Success `201`:
```json
{
  "id": "note_123",
  "body": "Confirmed budget and next-step timeline.",
  "linkedEntityType": "Opportunity",
  "linkedEntityId": "opportunity_123",
  "createdAt": "2026-04-12T00:00:00.000Z"
}
```

Validation:
- `body` must be non-empty.
- `linkedEntityType` and `linkedEntityId` must reference exactly one existing record.

### List Notes For Linked Record
- Method: `GET`
- Path: `/notes`
- Query:
  - `linkedEntityType` required
  - `linkedEntityId` required

Success `200`:
```json
{
  "items": [
    {
      "id": "note_456",
      "body": "Sent updated commercial terms.",
      "linkedEntityType": "Opportunity",
      "linkedEntityId": "opportunity_123",
      "createdAt": "2026-04-13T00:00:00.000Z"
    },
    {
      "id": "note_123",
      "body": "Confirmed budget and next-step timeline.",
      "linkedEntityType": "Opportunity",
      "linkedEntityId": "opportunity_123",
      "createdAt": "2026-04-12T00:00:00.000Z"
    }
  ]
}
```

Behavior:
- Results are ordered by `createdAt` descending.
- No update or delete contract exists for notes in this proof.

## Dashboard Contract

### Get Dashboard Summary
- Method: `GET`
- Path: `/dashboard`

Success `200`:
```json
{
  "totalContacts": 12,
  "totalCompanies": 5,
  "openTaskCount": 7,
  "overdueTaskCount": 2,
  "opportunityCountByStage": {
    "Lead": 3,
    "Qualified": 2,
    "Proposal": 1,
    "Won": 4,
    "Lost": 1
  },
  "openPipelineAmount": 42000
}
```

Rules:
- `openTaskCount` counts only tasks with status `Open`.
- `overdueTaskCount` counts only open tasks where `dueDate` is before the current date.
- `openPipelineAmount` sums amounts only for `Lead`, `Qualified`, and `Proposal` opportunities where `amount` is present.

## Error Code Catalogue
- `validation_error`: malformed or invalid request data.
- `not_found`: requested entity does not exist.
- `duplicate_email`: contact email already exists.
- `duplicate_company_name`: company name already exists after normalization.
- `invalid_stage_transition`: requested opportunity stage transition is not allowed.
- `immutable_note`: client attempted to modify an existing note.
- `closed_opportunity`: client attempted to mutate a closed opportunity through a blocked path.
- `completed_task_locked`: client attempted to edit a completed task.

## Implementation Notes
- The API layer should remain a translation boundary only.
- Application services should be synchronous or promise-wrapped over in-memory repositories.
- The domain layer should expose pure TypeScript helpers for normalization, validation, stage transitions, and derived dashboard calculations.
