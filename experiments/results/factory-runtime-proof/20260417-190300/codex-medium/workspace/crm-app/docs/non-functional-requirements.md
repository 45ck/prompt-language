# Non-functional requirements (Bounded CRM MVP)

These NFRs are limited to what is needed to safely operate the MVP scope.

## Security and privacy
- All data is scoped to an organization; cross-org access must be prevented by design.
- Authentication must use secure session handling (secure cookies, appropriate CSRF protections).
- Authorization must be enforced server-side for every read/write.
- Sensitive data should be minimized; store only what is needed for contacts and notes.

## Reliability
- Core create/update flows must be resilient to transient failures (clear error messaging; no silent drops).
- Data integrity: avoid partial writes that orphan tasks/notes from their parent entities.

## Performance
- List pages (contacts, companies, opportunities, tasks) must paginate and remain responsive for typical SME datasets.
- Dashboard queries must be bounded (no full-table scans in steady state).

## Usability
- Primary loop (“add note + add task + update stage”) must be quick and low-friction.
- Navigation and search must be fast enough to use during calls or dispatch coordination.

## Accessibility
- MVP UI must meet baseline accessibility expectations (keyboard navigation, visible focus, semantic structure).

## Observability (MVP level)
- Log key mutations (create/update/delete) with actor, org, entity, and timestamp.
- Capture and surface errors for debugging without exposing sensitive information to users.

## Maintainability
- Respect architecture boundaries (presentation -> infrastructure -> application -> domain).
- Keep domain model minimal and stable; avoid premature extensibility mechanisms.

