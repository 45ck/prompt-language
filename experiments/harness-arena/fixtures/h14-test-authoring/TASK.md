# H14-S4: Author Merge Duplicate Contact Tests

## Task

Add executable public tests for `mergeDuplicates(contacts)` in `src/test.js`.

The implementation in `src/contacts.js` already exists and should not be edited.
This subrole isolates whether the local worker can author useful tests while
preserving the existing contact module.

## Acceptance Criteria

1. Import `mergeDuplicates` from `src/contacts.js`.
2. Add at least five tests that call `mergeDuplicates`.
3. Cover basic duplicate merge.
4. Cover later non-empty field priority.
5. Cover earlier non-empty fallback when later duplicate records are empty.
6. Cover no-duplicate preservation.
7. Cover multiple duplicate groups.
8. Preserve the existing create/find/add/remove tests.
9. `npm test` passes.
