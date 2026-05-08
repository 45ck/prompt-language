# H14-S3: Preserve Contact APIs While Fixing Duplicate Merge

## Task

Fix `mergeDuplicates(contacts)` in `src/contacts.js`.

The public tests in `src/test.js` already describe the API contract and merge
behavior. Use those tests to drive the implementation.

## Acceptance Criteria

1. Preserve the existing CommonJS exports: `createContact`, `findByEmail`,
   `addContact`, `removeContact`, and `mergeDuplicates`.
2. Preserve positional function APIs and arity for all exported functions.
3. Preserve existing create/find/add/remove behavior.
4. Contacts with the same `email` are merged into one contact.
5. Later non-empty `name`, `phone`, and `company` fields override earlier values.
6. Earlier non-empty fields are preserved when later duplicate records are empty.
7. Unique contacts remain present in their original group order.
8. `npm test` passes.
