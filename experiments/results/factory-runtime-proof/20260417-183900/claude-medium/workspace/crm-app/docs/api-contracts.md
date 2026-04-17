# REST API Contracts -- CRM MVP

All endpoints require authentication (session cookie). All responses include `Content-Type: application/json`. Organization scoping is implicit from the authenticated user's session -- clients never pass `orgId`.

## Auth

### POST /api/auth/login

Authenticate user and create session.

- **Request:** `{ "email": "string", "password": "string" }`
- **Response 200:** `{ "user": { "id", "email", "name", "role", "orgId" } }`
- **Response 401:** `{ "error": "Invalid email or password" }`

### POST /api/auth/logout

Destroy session.

- **Response 200:** `{ "ok": true }`

### GET /api/auth/me

Return current authenticated user.

- **Response 200:** `{ "user": { "id", "email", "name", "role", "orgId" } }`
- **Response 401:** `{ "error": "Not authenticated" }`

### POST /api/auth/users (Admin only)

Invite/create a new user.

- **Request:** `{ "email": "string", "name": "string", "password": "string", "role": "ADMIN | SALES_MANAGER | SALES_REP | SERVICE_AGENT" }`
- **Response 201:** `{ "user": { "id", "email", "name", "role" } }`
- **Response 400:** `{ "error": "Validation error details" }`
- **Response 403:** `{ "error": "Admin access required" }`
- **Response 409:** `{ "error": "Email already registered" }`

---

## Contacts

### GET /api/contacts

List contacts for the organization. Supports search and filtering.

- **Query params:** `?search=string&companyId=uuid&ownerId=uuid&page=1&limit=25`
- **Response 200:** `{ "data": [Contact], "total": number, "page": number, "limit": number }`

### GET /api/contacts/:id

Get a single contact with linked company, opportunities, tasks, and notes.

- **Response 200:** `{ "data": Contact }`
- **Response 404:** `{ "error": "Contact not found" }`

### POST /api/contacts

Create a new contact.

- **Request:** `{ "firstName": "string", "lastName": "string", "email?": "string", "phone?": "string", "companyId?": "uuid" }`
- **Response 201:** `{ "data": Contact }`
- **Response 400:** `{ "error": "Validation error details" }`

### PATCH /api/contacts/:id

Update a contact.

- **Request:** `{ "firstName?", "lastName?", "email?", "phone?", "companyId?" }`
- **Response 200:** `{ "data": Contact }`
- **Response 404:** `{ "error": "Contact not found" }`

### DELETE /api/contacts/:id

Delete a contact.

- **Response 204:** (no body)
- **Response 404:** `{ "error": "Contact not found" }`

---

## Companies

### GET /api/companies

List companies.

- **Query params:** `?search=string&ownerId=uuid&page=1&limit=25`
- **Response 200:** `{ "data": [Company], "total": number, "page": number, "limit": number }`

### GET /api/companies/:id

Get a single company with linked contacts and opportunities.

- **Response 200:** `{ "data": Company }`
- **Response 404:** `{ "error": "Company not found" }`

### POST /api/companies

- **Request:** `{ "name": "string", "industry?": "string", "website?": "string" }`
- **Response 201:** `{ "data": Company }`

### PATCH /api/companies/:id

- **Request:** `{ "name?", "industry?", "website?" }`
- **Response 200:** `{ "data": Company }`

### DELETE /api/companies/:id

- **Response 204:** (no body)

---

## Opportunities

### GET /api/opportunities

List opportunities. Supports filtering by stage, owner, and company.

- **Query params:** `?stageId=uuid&ownerId=uuid&companyId=uuid&contactId=uuid&page=1&limit=25`
- **Response 200:** `{ "data": [Opportunity], "total": number, "page": number, "limit": number }`

### GET /api/opportunities/:id

Get a single opportunity with linked contact, company, stage, tasks, and notes.

- **Response 200:** `{ "data": Opportunity }`
- **Response 404:** `{ "error": "Opportunity not found" }`

### POST /api/opportunities

- **Request:** `{ "title": "string", "value?": number, "stageId": "uuid", "contactId": "uuid", "companyId?": "uuid", "expectedCloseDate?": "YYYY-MM-DD" }`
- **Response 201:** `{ "data": Opportunity }`

### PATCH /api/opportunities/:id

- **Request:** `{ "title?", "value?", "stageId?", "contactId?", "companyId?", "expectedCloseDate?" }`
- **Response 200:** `{ "data": Opportunity }`

When `stageId` changes to a "Closed Won" or "Closed Lost" stage, the API sets `closedAt` automatically.

### DELETE /api/opportunities/:id

- **Response 204:** (no body)

---

## Pipeline Stages

### GET /api/pipeline-stages

List pipeline stages for the organization, ordered by position.

- **Response 200:** `{ "data": [PipelineStage] }`

### POST /api/pipeline-stages (Admin only)

- **Request:** `{ "name": "string", "position": number }`
- **Response 201:** `{ "data": PipelineStage }`

### PATCH /api/pipeline-stages/:id (Admin only)

- **Request:** `{ "name?": "string", "position?": number }`
- **Response 200:** `{ "data": PipelineStage }`

### DELETE /api/pipeline-stages/:id (Admin only)

Fails if any opportunities are in this stage.

- **Response 204:** (no body)
- **Response 409:** `{ "error": "Cannot delete stage with existing opportunities" }`

---

## Tasks

### GET /api/tasks

List tasks. Supports filtering by assignee, entity, and completion status.

- **Query params:** `?assigneeId=uuid&entityType=CONTACT|COMPANY|OPPORTUNITY&entityId=uuid&completed=true|false&page=1&limit=25`
- **Response 200:** `{ "data": [Task], "total": number, "page": number, "limit": number }`

### GET /api/tasks/:id

- **Response 200:** `{ "data": Task }`

### POST /api/tasks

- **Request:** `{ "title": "string", "description?": "string", "dueDate?": "YYYY-MM-DD", "assigneeId": "uuid", "entityType": "CONTACT | COMPANY | OPPORTUNITY", "entityId": "uuid" }`
- **Response 201:** `{ "data": Task }`

### PATCH /api/tasks/:id

- **Request:** `{ "title?", "description?", "dueDate?", "completed?": boolean, "assigneeId?" }`
- **Response 200:** `{ "data": Task }`

### DELETE /api/tasks/:id

- **Response 204:** (no body)

---

## Notes

### GET /api/notes

List notes for an entity.

- **Query params:** `?entityType=CONTACT|COMPANY|OPPORTUNITY&entityId=uuid&page=1&limit=50`
- **Response 200:** `{ "data": [Note], "total": number, "page": number, "limit": number }`

### POST /api/notes

- **Request:** `{ "body": "string", "entityType": "CONTACT | COMPANY | OPPORTUNITY", "entityId": "uuid" }`
- **Response 201:** `{ "data": Note }`

### DELETE /api/notes/:id

- **Response 204:** (no body)

Notes are not editable after creation (append-only).

---

## Dashboard

### GET /api/dashboard

Aggregated dashboard data for the organization.

- **Response 200:**

```json
{
  "pipeline": {
    "stages": [
      { "id": "uuid", "name": "string", "position": 0, "count": 5, "totalValue": 125000 }
    ],
    "totalOpen": 20,
    "totalValue": 500000
  },
  "tasks": {
    "overdue": 3,
    "dueToday": 5,
    "upcoming": 12
  },
  "recentActivity": [
    { "type": "opportunity_created", "entityId": "uuid", "title": "string", "timestamp": "ISO8601", "userName": "string" }
  ]
}
```

---

## Common Response Shapes

### Contact

```json
{ "id": "uuid", "firstName": "string", "lastName": "string", "email": "string|null", "phone": "string|null", "companyId": "uuid|null", "ownerId": "uuid", "createdAt": "ISO8601", "updatedAt": "ISO8601" }
```

### Company

```json
{ "id": "uuid", "name": "string", "industry": "string|null", "website": "string|null", "ownerId": "uuid", "createdAt": "ISO8601", "updatedAt": "ISO8601" }
```

### Opportunity

```json
{ "id": "uuid", "title": "string", "value": "number|null", "stageId": "uuid", "contactId": "uuid", "companyId": "uuid|null", "ownerId": "uuid", "expectedCloseDate": "YYYY-MM-DD|null", "closedAt": "ISO8601|null", "createdAt": "ISO8601", "updatedAt": "ISO8601" }
```

### PipelineStage

```json
{ "id": "uuid", "name": "string", "position": 0, "createdAt": "ISO8601", "updatedAt": "ISO8601" }
```

### Task

```json
{ "id": "uuid", "title": "string", "description": "string|null", "dueDate": "YYYY-MM-DD|null", "completed": false, "assigneeId": "uuid", "entityType": "string", "entityId": "uuid", "createdAt": "ISO8601", "updatedAt": "ISO8601" }
```

### Note

```json
{ "id": "uuid", "body": "string", "authorId": "uuid", "entityType": "string", "entityId": "uuid", "createdAt": "ISO8601" }
```

## Status Code Summary

| Code | Meaning |
|------|---------|
| 200 | Success (read/update) |
| 201 | Created |
| 204 | Deleted (no content) |
| 400 | Validation error |
| 401 | Not authenticated |
| 403 | Insufficient permissions |
| 404 | Not found (or not in user's org) |
| 409 | Conflict (duplicate, in-use) |
| 500 | Server error |
