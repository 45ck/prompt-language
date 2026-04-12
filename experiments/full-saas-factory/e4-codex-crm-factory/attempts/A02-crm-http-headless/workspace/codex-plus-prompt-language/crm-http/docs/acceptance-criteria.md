# Acceptance Criteria: Bounded CRM HTTP Slice

## Summary
These criteria translate the bounded CRM slice into observable HTTP and persistence behavior. They cover success paths, important failures, and readiness signals for implementation.

## Criteria

### AC-1 Dev sign-in issues a token
- Given the service is running
- When a client sends `POST /auth/dev`
- Then the response status is `200`
- And the response body is JSON
- And the response includes a non-empty bearer token string

### AC-2 CRM endpoints require auth
- Given the service is running
- When a client calls `POST /contacts`, `GET /contacts`, `POST /opportunities`, `GET /opportunities`, `POST /opportunities/:id/stage-moves`, or `GET /dashboard/summary` without a valid bearer token
- Then the response status is `401`
- And the response body contains a stable error `code`
- And the response body contains a human-readable `message`

### AC-3 Contact creation succeeds with required fields
- Given a valid bearer token
- When a client sends `POST /contacts` with valid `name` and `email`
- Then the response status is `201`
- And the response body contains the created contact
- And the created contact contains a stable opaque `id`
- And the created contact echoes the submitted required fields

### AC-4 Contact creation rejects invalid input
- Given a valid bearer token
- When a client sends `POST /contacts` with missing or malformed required fields
- Then the response status is `400`
- And the response body contains a stable error `code`
- And no contact is persisted for that invalid request

### AC-5 Contacts can be listed for verification
- Given a valid bearer token and at least one previously created contact
- When a client sends `GET /contacts`
- Then the response status is `200`
- And the response body is JSON
- And the response contains the previously created contact records with stable IDs

### AC-6 Opportunity creation succeeds for an existing contact
- Given a valid bearer token
- And a persisted contact exists
- When a client sends `POST /opportunities` with valid `contactId`, `name`, and `amountCents`
- Then the response status is `201`
- And the response body contains the created opportunity
- And the created opportunity contains a stable opaque `id`
- And the created opportunity is linked to the provided `contactId`
- And the default stage is `prospecting` when the request omits `stage`

### AC-7 Opportunity creation rejects invalid references or values
- Given a valid bearer token
- When a client sends `POST /opportunities` with an unknown `contactId`
- Then the response status is `400`
- And the response body contains a stable error `code`

- Given a valid bearer token
- When a client sends `POST /opportunities` with an invalid stage or a non-integer or negative `amountCents`
- Then the response status is `400`
- And no invalid opportunity is persisted

### AC-8 Opportunities can be listed for verification
- Given a valid bearer token and at least one previously created opportunity
- When a client sends `GET /opportunities`
- Then the response status is `200`
- And the response contains the persisted opportunities with their contact linkage and current stages

### AC-9 Allowed stage moves succeed
- Given a valid bearer token
- And an opportunity exists in `prospecting`
- When a client sends `POST /opportunities/:id/stage-moves` with target stage `qualified`
- Then the response status is `200`
- And the response body contains the updated opportunity
- And the opportunity stage is now `qualified`

### AC-10 Disallowed or impossible stage moves are rejected
- Given a valid bearer token
- When a client sends a stage move request for an unknown opportunity ID
- Then the response status is `404`

- Given a valid bearer token
- And an opportunity exists in a current stage
- When a client requests a target stage that is not part of the supported stage set
- Then the response status is `400`

- Given a valid bearer token
- And an opportunity exists in a current stage
- When a client requests a transition that is outside the allowed transition graph
- Then the response status is `409`
- And the persisted stage does not change

### AC-11 Terminal stages remain terminal
- Given a valid bearer token
- And an opportunity is in `closed_won` or `closed_lost`
- When a client requests any further stage move
- Then the response status is `409`
- And the persisted stage remains unchanged

### AC-12 Dashboard reporting returns correct rollups
- Given a valid bearer token
- And persisted contacts and opportunities exist across multiple stages
- When a client sends `GET /dashboard/summary`
- Then the response status is `200`
- And the response body contains `totalContacts`
- And the response body contains `totalOpportunities`
- And the response body contains `opportunitiesByStage`
- And the response body contains `openPipelineValueCents`
- And the response body contains `closedWonValueCents`
- And the totals reflect the current persisted state

### AC-13 Persistence survives restart
- Given a contact and opportunity were created successfully
- When the service process stops and starts again against the same JSON file
- Then `GET /contacts`, `GET /opportunities`, and `GET /dashboard/summary` reflect the previously persisted records
- And record IDs remain stable after restart

### AC-14 Responses are JSON and errors are consistent
- Given any supported endpoint in this slice
- When the endpoint responds
- Then the response content type is JSON
- And error responses use a stable shape with at least `code` and `message`

## Negative criteria
- The slice does not need browser rendering, cookies, sessions, or HTML responses.
- The slice does not need delete, edit, search, pagination, or multi-user auth behavior.
- The slice does not need production-grade auth or encrypted credential storage.

## Ready-for-test checklist
- Endpoint inventory is fixed for this slice.
- Stage IDs and transition rules are centrally defined.
- JSON persistence location is configurable for tests.
- Restart recovery can be exercised in an automated or smoke environment.
