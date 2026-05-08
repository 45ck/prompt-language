# H14-S2: Implement Merge Duplicate Contacts From Tests

## Task

Implement `mergeDuplicates(contacts)` in `src/contacts.js`.

The public tests in `src/test.js` are already written. Do not rewrite the test
contract. Use the tests to drive the implementation.

## Acceptance Criteria

1. Contacts with the same `email` are merged into one contact.
2. Later non-empty `name`, `phone`, and `company` fields override earlier values.
3. Earlier non-empty fields are preserved when later duplicate records are empty.
4. Contacts with unique emails are preserved.
5. Existing exports and positional APIs for `createContact`, `findByEmail`,
   `addContact`, and `removeContact` are preserved.
6. `npm test` passes.
