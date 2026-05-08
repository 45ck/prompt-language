# H15-M1: PATCH Contact Validation Only

## Task

Strengthen validation for the existing `patchContact(id, data)` function in
`src/app.js`.

This micro-flow isolates the H15 validation failure mode. The PATCH function and
original API exports already exist. Do not redesign the endpoint, change the data
model, or alter existing GET, POST, and DELETE behavior.

## Validation Rules

- `name`: string, 2-100 characters
- `email`: string containing `@` and a `.` after the `@`
- `phone`: string using only digits, dashes, spaces, and optional leading `+`, 7-20 characters
- `company`: string, 1-200 characters, or `null` to clear the field

## Acceptance Criteria

1. `patchContact` still returns 200 with the updated record for valid partial updates.
2. `patchContact` returns 400 with an error for invalid provided fields.
3. `patchContact` returns 404 for missing contact IDs.
4. Only provided fields are updated.
5. Existing `listContacts`, `getContact`, `createContact`, `deleteContact`, and `contacts` exports remain present.
6. Successful `deleteContact` still returns status 204 with body `null`.
7. Add at least six validation-focused PATCH tests in `src/test.js`.
8. `node src/test.js` passes.
