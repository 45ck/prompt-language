# Non-functional requirements (MVP)

## Security & privacy
- Authentication protects access to organization data; users cannot access data from other organizations.
- All sensitive routes require authentication.
- Secrets are not committed to the repo; environment-based configuration is used.
- Password handling uses a proven library/provider (no custom crypto).

## Reliability
- Graceful handling of common failure modes (database unavailable, validation errors).
- Clear user-facing error messages for validation and “not found”.

## Performance
- List views and dashboard load quickly for typical SME dataset sizes (thousands of contacts, hundreds of opportunities).
- Pagination is used for list endpoints where appropriate.

## Usability
- Fast data entry for core entities; minimal required fields.
- Clear relationships between records (contact ↔ company ↔ opportunity; tasks/notes linked).

## Accessibility
- Keyboard navigation for primary flows (create/edit/list/detail).
- Color is not the only indicator for status/stage.

## Observability
- Server logs include request correlation identifiers.
- Errors are captured with enough context to reproduce (endpoint, user/org, entity ids where safe).

## Maintainability
- Follow architecture boundaries: `presentation -> infrastructure -> application -> domain`.
- Domain layer has no external dependencies.

