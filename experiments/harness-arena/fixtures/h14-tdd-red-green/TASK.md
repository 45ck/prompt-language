# H14: TDD Red-Green - Merge Duplicate Contacts

## Task

Implement `mergeDuplicates(contacts)` using TDD discipline:

1. First add failing tests for duplicate-contact merging in `src/test.js`.
2. Then implement the minimal passing function in `src/contacts.js`.
3. Export `mergeDuplicates` from `src/contacts.js`.

## Acceptance Criteria

1. Contacts with the same `email` are merged into one contact.
2. Later non-empty `name`, `phone`, and `company` fields override earlier values.
3. Earlier non-empty fields are preserved when later duplicate records are empty.
4. Contacts with unique emails are preserved.
5. Tests cover basic merge, later-field priority, older fallback, no duplicates, and multiple duplicate groups.
6. `npm test` passes.
