# REST API Contracts

All endpoints are served from the Next.js App Router under `/api/`. All requests require a valid NextAuth.js session cookie unless noted otherwise. Responses use JSON. Timestamps are ISO 8601 strings.

## Authentication

### POST /api/auth/register

Create a new user account.

- **Request Body:** `{ "email": string, "password": string, "name": string }`
- **Response (201):** `{ "id": string, "email": string, "name": string, "role": "Rep" }`
- **Errors:** 400 (validation), 409 (email already exists)

### POST /api/auth/[...nextauth]

NextAuth.js handles login, logout, and session endpoints.

- **POST /api/auth/callback/credentials** — Login with `{ "email": string, "password": string }`
- **GET /api/auth/session** — Returns current session or `null`
- **POST /api/auth/signout** — Ends the session
- **Response (200):** NextAuth session object `{ "user": { "id": string, "email": string, "name": string, "role": string } }`
- **Errors:** 401 (invalid credentials)

---

## Contacts

### GET /api/contacts

List contacts with pagination, search, and filtering.

- **Query Params:** `page` (default 1), `limit` (default 25), `search` (name/email), `companyId`, `status` (Active/Inactive)
- **Response (200):** `{ "data": Contact[], "total": number, "page": number, "limit": number }`

### GET /api/contacts/:id

Get a single contact with related company, opportunities, tasks, and notes.

- **Response (200):** `Contact` (with includes)
- **Errors:** 404 (not found)

### POST /api/contacts

Create a new contact.

- **Request Body:** `{ "name": string, "email"?: string, "phone"?: string, "companyId"?: string, "status"?: "Active" | "Inactive" }`
- **Response (201):** `Contact`
- **Errors:** 400 (validation)

### PATCH /api/contacts/:id

Update a contact.

- **Request Body:** Partial `{ "name"?, "email"?, "phone"?, "companyId"?, "status"? }`
- **Response (200):** `Contact`
- **Errors:** 400 (validation), 404 (not found)

### DELETE /api/contacts/:id

Delete a contact. Fails if contact has linked opportunities.

- **Response (204):** No content
- **Errors:** 404 (not found), 409 (has linked opportunities)

---

## Companies

### GET /api/companies

List companies with pagination and search.

- **Query Params:** `page` (default 1), `limit` (default 25), `search` (name)
- **Response (200):** `{ "data": Company[], "total": number, "page": number, "limit": number }`

### GET /api/companies/:id

Get a single company with linked contacts and opportunities.

- **Response (200):** `Company` (with includes)
- **Errors:** 404

### POST /api/companies

Create a new company.

- **Request Body:** `{ "name": string, "industry"?: string, "website"?: string, "phone"?: string, "address"?: string }`
- **Response (201):** `Company`
- **Errors:** 400 (validation), 409 (duplicate name)

### PATCH /api/companies/:id

Update a company.

- **Request Body:** Partial `{ "name"?, "industry"?, "website"?, "phone"?, "address"? }`
- **Response (200):** `Company`
- **Errors:** 400, 404

### DELETE /api/companies/:id

Delete a company. Fails if company has linked contacts or opportunities.

- **Response (204):** No content
- **Errors:** 404, 409 (has linked records)

---

## Opportunities

### GET /api/opportunities

List opportunities with filtering and sorting.

- **Query Params:** `page` (default 1), `limit` (default 25), `stageId`, `ownerId`, `companyId`, `contactId`, `sortBy` (value/expectedCloseDate/createdAt), `sortOrder` (asc/desc)
- **Response (200):** `{ "data": Opportunity[], "total": number, "page": number, "limit": number }`

### GET /api/opportunities/:id

Get a single opportunity with related stage, contact, company, owner, tasks, and notes.

- **Response (200):** `Opportunity` (with includes)
- **Errors:** 404

### POST /api/opportunities

Create a new opportunity.

- **Request Body:** `{ "title": string, "value": number, "stageId": string, "contactId"?: string, "companyId"?: string, "ownerId": string, "expectedCloseDate"?: string }`
- **Response (201):** `Opportunity`
- **Errors:** 400 (validation), 404 (invalid FK reference)

### PATCH /api/opportunities/:id

Update an opportunity. Used for stage transitions (drag-and-drop).

- **Request Body:** Partial `{ "title"?, "value"?, "stageId"?, "contactId"?, "companyId"?, "ownerId"?, "expectedCloseDate"? }`
- **Response (200):** `Opportunity`
- **Errors:** 400, 404

### DELETE /api/opportunities/:id

Delete an opportunity.

- **Response (204):** No content
- **Errors:** 404

---

## Pipeline Stages

### GET /api/stages

List all non-archived stages, ordered by `order` field.

- **Query Params:** `includeArchived` (default false)
- **Response (200):** `PipelineStage[]`

### POST /api/stages

Create a new stage. **Admin only.**

- **Request Body:** `{ "name": string, "order": number }`
- **Response (201):** `PipelineStage`
- **Errors:** 400, 403 (not Admin), 409 (duplicate name)

### PATCH /api/stages/:id

Update a stage (rename, reorder, archive). **Admin only.**

- **Request Body:** Partial `{ "name"?, "order"?, "isArchived"? }`
- **Response (200):** `PipelineStage`
- **Errors:** 400, 403, 404

### DELETE /api/stages/:id

Delete a stage. **Admin only.** Fails if stage has linked opportunities.

- **Response (204):** No content
- **Errors:** 403, 404, 409 (has opportunities)

---

## Tasks

### GET /api/tasks

List tasks with filtering.

- **Query Params:** `page` (default 1), `limit` (default 25), `status` (Open/Completed), `priority` (Low/Medium/High), `assigneeId`, `contactId`, `opportunityId`, `dueBefore` (ISO date), `dueAfter` (ISO date)
- **Response (200):** `{ "data": Task[], "total": number, "page": number, "limit": number }`

### GET /api/tasks/:id

Get a single task with related assignee, contact, and opportunity.

- **Response (200):** `Task` (with includes)
- **Errors:** 404

### POST /api/tasks

Create a new task.

- **Request Body:** `{ "title": string, "description"?: string, "dueDate"?: string, "priority"?: "Low" | "Medium" | "High", "assigneeId": string, "contactId"?: string, "opportunityId"?: string }`
- **Response (201):** `Task`
- **Errors:** 400

### PATCH /api/tasks/:id

Update a task (including marking as completed).

- **Request Body:** Partial `{ "title"?, "description"?, "dueDate"?, "priority"?, "status"?, "assigneeId"?, "contactId"?, "opportunityId"? }`
- **Response (200):** `Task`
- **Errors:** 400, 404

### DELETE /api/tasks/:id

Delete a task.

- **Response (204):** No content
- **Errors:** 404

---

## Notes

### GET /api/notes

List notes filtered by entity.

- **Query Params:** `contactId`, `companyId`, `opportunityId` (at least one required), `page` (default 1), `limit` (default 50)
- **Response (200):** `{ "data": Note[], "total": number, "page": number, "limit": number }`

### POST /api/notes

Create a note attached to an entity.

- **Request Body:** `{ "content": string, "contactId"?: string, "companyId"?: string, "opportunityId"?: string }`
- **Response (201):** `Note`
- **Errors:** 400 (no entity specified, or content empty)

### PATCH /api/notes/:id

Update a note. **Author only.**

- **Request Body:** `{ "content": string }`
- **Response (200):** `Note`
- **Errors:** 400, 403 (not author), 404

### DELETE /api/notes/:id

Delete a note. **Author only.**

- **Response (204):** No content
- **Errors:** 403, 404

---

## Dashboard

### GET /api/dashboard

Aggregated dashboard data for the current user.

- **Response (200):**

```json
{
  "pipelineSummary": [
    { "stageId": string, "stageName": string, "count": number, "totalValue": number }
  ],
  "tasksDueToday": Task[],
  "tasksOverdue": Task[],
  "myOpenTasks": Task[],
  "recentOpportunities": Opportunity[]
}
```

---

## Common Response Shapes

### Contact

```json
{ "id": string, "name": string, "email": string | null, "phone": string | null, "status": "Active" | "Inactive", "companyId": string | null, "createdAt": string, "updatedAt": string }
```

### Company

```json
{ "id": string, "name": string, "industry": string | null, "website": string | null, "phone": string | null, "address": string | null, "createdAt": string, "updatedAt": string }
```

### Opportunity

```json
{ "id": string, "title": string, "value": number, "stageId": string, "contactId": string | null, "companyId": string | null, "ownerId": string, "expectedCloseDate": string | null, "createdAt": string, "updatedAt": string }
```

### PipelineStage

```json
{ "id": string, "name": string, "order": number, "isArchived": boolean, "createdAt": string, "updatedAt": string }
```

### Task

```json
{ "id": string, "title": string, "description": string | null, "dueDate": string | null, "priority": "Low" | "Medium" | "High", "status": "Open" | "Completed", "assigneeId": string, "contactId": string | null, "opportunityId": string | null, "createdAt": string, "updatedAt": string }
```

### Note

```json
{ "id": string, "content": string, "authorId": string, "contactId": string | null, "companyId": string | null, "opportunityId": string | null, "createdAt": string, "updatedAt": string }
```

### Error

```json
{ "error": string, "details"?: object }
```
