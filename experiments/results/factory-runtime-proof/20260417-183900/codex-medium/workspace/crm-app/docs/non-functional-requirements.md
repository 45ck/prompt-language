# Non-Functional Requirements (MVP)

Scope: bounded CRM MVP (auth, contacts, companies, opportunities, pipeline stages, tasks, notes, dashboard).

## Security

- Passwords must be stored using a secure, modern hashing approach (no plaintext).
- Sessions must be protected (secure cookies, appropriate expiration).
- Access must be scoped to the user’s organization (no cross-org data leakage).
- Basic protection against brute force login attempts (rate limiting or equivalent).

## Privacy / Data handling

- Only collect necessary fields for MVP.
- Provide clear deletion/archival behavior (define in build phase; must be consistent and testable).

## Performance

- Search and list views must be responsive for typical SME datasets.
- Lists must be paginated where necessary.

## Reliability

- Errors must be user-friendly and actionable (validation messages, not raw stack traces).
- System should degrade safely on failures (no partial writes without clear outcome).

## Maintainability

- Follow architecture boundaries: `presentation -> infrastructure -> application -> domain`.
- Domain must not depend on external libraries beyond language/runtime essentials.
- Automated tests cover all new business logic and key query behaviors.

