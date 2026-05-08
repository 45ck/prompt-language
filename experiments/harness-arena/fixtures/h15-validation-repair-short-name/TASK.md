# H15-M2: PATCH Short-Name Validation Repair

## Task

Fix the existing `patchContact(id, data)` validation bug in `src/app.js`.

This is a repair micro-flow, not full endpoint ownership. Public tests already
exist. Do not redesign the endpoint, change the data model, or edit
`src/test.js`.

## Known Public Failure

`patchContact(1, { name: 'A' })` returns status `400`, but its response body is
missing an `error` field. Invalid PATCH responses must return status `400` with
an error body.

## Acceptance Criteria

1. Fix only `src/app.js`.
2. `patchContact` returns `400` with an error body for invalid short names.
3. Other validation rules for `email`, `phone`, and `company` keep working.
4. Valid partial PATCH updates keep working.
5. Existing `listContacts`, `getContact`, `createContact`, `deleteContact`,
   `patchContact`, and `contacts` exports remain present.
6. Successful `deleteContact` still returns status `204` with body `null`.
7. `node src/test.js` passes.
