# REST API Contracts -- CRM MVP

All endpoints require authentication unless noted otherwise. Authentication is via session cookie (NextAuth.js) or Bearer token.

```
Authorization: Bearer <jwt-token>
Content-Type: application/json
```

## Common Patterns

### Pagination

All list endpoints accept:

| Param  | Type   | Default | Description             |
| ------ | ------ | ------- | ----------------------- |
| page   | number | 1       | Page number (1-based)   |
| limit  | number | 20      | Items per page (max 100)|

Response envelope for paginated lists:

```json
{
  "data": [...],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 142,
    "totalPages": 8
  }
}
```

### Error Response

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable message",
    "details": [{ "field": "email", "message": "Invalid email" }]
  }
}
```

### Optimistic Locking

PATCH/PUT requests on entities with `version` must include the current version in the body. The server returns 409 if the version does not match.

---

## Authentication

### POST /api/auth/signin

NextAuth.js managed. Initiates Google OAuth flow or credential-based login.

### GET /api/auth/session

Returns the current session.

**Response 200:**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "Jane Doe",
    "role": "REP"
  },
  "expires": "2026-05-17T00:00:00.000Z"
}
```

### POST /api/auth/signout

Ends the session.

---

## Contacts

### GET /api/contacts

List contacts (filtered by ownership for Rep role).

**Query params:**

| Param     | Type   | Description                       |
| --------- | ------ | --------------------------------- |
| page      | number | Page number                       |
| limit     | number | Items per page                    |
| search    | string | Search firstName, lastName, email |
| companyId | uuid   | Filter by company                 |
| ownerId   | uuid   | Filter by owner (Manager/Admin)   |

**Response 200:**
```json
{
  "data": [
    {
      "id": "uuid",
      "firstName": "John",
      "lastName": "Smith",
      "email": "john@example.com",
      "phone": "+1234567890",
      "jobTitle": "VP Sales",
      "companyId": "uuid",
      "company": { "id": "uuid", "name": "Acme Corp" },
      "ownerId": "uuid",
      "createdAt": "2026-04-01T10:00:00Z",
      "updatedAt": "2026-04-01T10:00:00Z",
      "version": 1
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 50, "totalPages": 3 }
}
```

### GET /api/contacts/:id

**Response 200:** Single contact object (same shape as list item, plus related opportunities and tasks).

**Response 404:** `{ "error": { "code": "NOT_FOUND", "message": "Contact not found" } }`

### POST /api/contacts

**Request body:**
```json
{
  "firstName": "John",
  "lastName": "Smith",
  "email": "john@example.com",
  "phone": "+1234567890",
  "jobTitle": "VP Sales",
  "companyId": "uuid"
}
```

Required: `firstName`, `lastName`. All others optional.

**Response 201:** Created contact object.

**Response 400:** Validation error.

### PATCH /api/contacts/:id

**Request body:** Any subset of writable fields, plus `version` for optimistic locking.

```json
{
  "companyId": "uuid",
  "version": 1
}
```

**Response 200:** Updated contact.

**Response 409:** Version conflict.

### DELETE /api/contacts/:id

Soft delete (sets `deletedAt`).

**Response 204:** No content.

**Response 403:** Not owner (Rep role) or insufficient permissions.

---

## Companies

### GET /api/companies

**Query params:** `page`, `limit`, `search` (name, domain), `ownerId`.

**Response 200:** Paginated list of companies.

### GET /api/companies/:id

**Response 200:** Company with related contacts count and opportunities count.

### POST /api/companies

**Request body:**
```json
{
  "name": "Acme Corp",
  "domain": "acme.com",
  "phone": "+1234567890",
  "address": "123 Main St",
  "industry": "Technology"
}
```

Required: `name`.

**Response 201:** Created company.

### PATCH /api/companies/:id

**Request body:** Subset of writable fields + `version`.

**Response 200:** Updated company.

**Response 409:** Version conflict.

### DELETE /api/companies/:id

Soft delete.

**Response 204:** No content.

---

## Opportunities

### GET /api/opportunities

**Query params:** `page`, `limit`, `search` (title), `stageId`, `status` (OPEN/WON/LOST), `ownerId`, `contactId`, `companyId`.

**Response 200:** Paginated list of opportunities with `stage` and `owner` included.

### GET /api/opportunities/:id

**Response 200:** Full opportunity with stage, owner, contact, company, tasks, and notes.

### POST /api/opportunities

**Request body:**
```json
{
  "title": "Acme Enterprise Deal",
  "value": 50000,
  "currency": "USD",
  "stageId": "uuid",
  "contactId": "uuid",
  "companyId": "uuid",
  "expectedCloseDate": "2026-06-30"
}
```

Required: `title`. If `stageId` is omitted, the default stage is used.

**Response 201:** Created opportunity.

### PATCH /api/opportunities/:id

**Request body:** Subset of writable fields + `version`.

Used for stage transitions (drag-and-drop), value updates, and status changes (mark won/lost).

```json
{
  "stageId": "uuid",
  "status": "WON",
  "version": 3
}
```

**Response 200:** Updated opportunity.

**Response 409:** Version conflict.

### DELETE /api/opportunities/:id

Soft delete.

**Response 204:** No content.

---

## Pipeline Stages

### GET /api/pipeline-stages

Returns all stages ordered by `position`. No pagination (small fixed set).

**Response 200:**
```json
{
  "data": [
    { "id": "uuid", "name": "New Lead", "position": 0, "color": "#3B82F6", "isDefault": true },
    { "id": "uuid", "name": "Qualified", "position": 1, "color": "#10B981", "isDefault": false },
    { "id": "uuid", "name": "Proposal", "position": 2, "color": "#F59E0B", "isDefault": false },
    { "id": "uuid", "name": "Negotiation", "position": 3, "color": "#EF4444", "isDefault": false },
    { "id": "uuid", "name": "Closed Won", "position": 4, "color": "#22C55E", "isDefault": false }
  ]
}
```

### POST /api/pipeline-stages

**Auth:** Admin only.

**Request body:**
```json
{
  "name": "Discovery",
  "position": 1,
  "color": "#8B5CF6"
}
```

**Response 201:** Created stage.

### PATCH /api/pipeline-stages/:id

**Auth:** Admin only.

**Request body:** Subset of writable fields.

**Response 200:** Updated stage.

### DELETE /api/pipeline-stages/:id

**Auth:** Admin only. Fails if opportunities are linked to this stage.

**Response 204:** No content.

**Response 409:** `{ "error": { "code": "STAGE_IN_USE", "message": "Cannot delete stage with active opportunities" } }`

---

## Tasks

### GET /api/tasks

**Query params:** `page`, `limit`, `status` (TODO/IN_PROGRESS/DONE), `priority` (LOW/MEDIUM/HIGH), `assigneeId`, `contactId`, `companyId`, `opportunityId`, `dueBefore` (ISO date), `dueAfter` (ISO date).

**Response 200:** Paginated list of tasks with assignee name included.

### GET /api/tasks/:id

**Response 200:** Task with linked entities.

### POST /api/tasks

**Request body:**
```json
{
  "title": "Send proposal to John",
  "description": "Include pricing tier 2",
  "dueDate": "2026-04-25T17:00:00Z",
  "priority": "HIGH",
  "assigneeId": "uuid",
  "contactId": "uuid",
  "opportunityId": "uuid"
}
```

Required: `title`, `assigneeId`.

**Response 201:** Created task.

### PATCH /api/tasks/:id

**Request body:** Subset of writable fields + `version`.

**Response 200:** Updated task.

### DELETE /api/tasks/:id

Soft delete.

**Response 204:** No content.

---

## Notes

### GET /api/notes

**Query params:** `page`, `limit`, `contactId`, `companyId`, `opportunityId`.

At least one entity filter is required (no global note listing).

**Response 200:** Paginated list of notes with author name included.

### POST /api/notes

**Request body:**
```json
{
  "content": "Client expressed interest in annual plan.",
  "contactId": "uuid",
  "opportunityId": "uuid"
}
```

Required: `content`, at least one entity ID.

**Response 201:** Created note.

### PATCH /api/notes/:id

**Request body:**
```json
{
  "content": "Updated note text",
}
```

Only the author can edit a note.

**Response 200:** Updated note.

### DELETE /api/notes/:id

Hard delete (notes are lightweight; no soft delete).

**Response 204:** No content.

---

## Dashboard

### GET /api/dashboard

Returns aggregated metrics for the current user (or all users for Manager/Admin).

**Query params:** `period` (7d/30d/90d, default 30d).

**Response 200:**
```json
{
  "pipeline": {
    "stages": [
      { "id": "uuid", "name": "New Lead", "count": 12, "totalValue": 240000 },
      { "id": "uuid", "name": "Qualified", "count": 8, "totalValue": 180000 }
    ],
    "totalOpen": 35,
    "totalValue": 750000
  },
  "recentActivity": [
    {
      "type": "opportunity_created",
      "entityId": "uuid",
      "title": "Acme Deal",
      "userId": "uuid",
      "userName": "Jane Doe",
      "timestamp": "2026-04-17T14:30:00Z"
    }
  ],
  "tasks": {
    "overdue": 3,
    "dueToday": 5,
    "upcoming": 12
  },
  "wonLost": {
    "won": { "count": 10, "value": 320000 },
    "lost": { "count": 4, "value": 85000 }
  }
}
```

---

## Status Codes Summary

| Code | Meaning                                    |
| ---- | ------------------------------------------ |
| 200  | Success (read or update)                   |
| 201  | Created                                    |
| 204  | Deleted (no content)                       |
| 400  | Validation error                           |
| 401  | Not authenticated                          |
| 403  | Insufficient permissions                   |
| 404  | Resource not found                         |
| 409  | Version conflict or constraint violation   |
| 500  | Internal server error                      |
