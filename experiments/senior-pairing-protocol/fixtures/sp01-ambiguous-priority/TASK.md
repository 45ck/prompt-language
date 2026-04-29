# SP01: Ambiguous Priority Merge

Implement `mergeContacts(records)` in `src/contacts.js`.

Records with the same `email` are duplicates and must be merged into one record.
The phrase "newer record wins" is intentionally ambiguous. For this task,
`newer` means later in the input array, not the `createdAt` timestamp.

Rules:

- Later non-empty `name`, `phone`, and `company` values override earlier
  non-empty values.
- Earlier non-empty values survive when the later record has `null`, `undefined`,
  or an empty string for that field.
- Duplicate groups keep the position of the first time their email appears.
- Non-duplicate records are preserved.
- Do not add dependencies.

Write tests in `src/test.js` before or alongside the implementation. The tests
must include a case where `createdAt` order conflicts with input order.
