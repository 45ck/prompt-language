# H15-M2: PATCH Contact Test Authoring Only

## Task

Add validation-focused tests for the existing `patchContact(id, data)` function
in `src/test.js`.

This micro-flow isolates the H15 test-authoring role. The PATCH implementation
in `src/app.js` is already complete and must not be edited. Do not redesign the
endpoint, change the data model, or alter existing tests.

## Validation Rules To Cover

- `name`: string, 2-100 characters
- `email`: string containing `@` and a `.` after the `@`
- `phone`: string using only digits, dashes, spaces, and optional leading `+`, 7-20 characters
- `company`: string, 1-200 characters, or `null` to clear the field

## Acceptance Criteria

1. Edit only `src/test.js`.
2. Preserve the existing list/get/create/delete/PATCH happy-path tests.
3. Add at least eight executable PATCH validation tests.
4. Cover invalid short name, invalid long name, invalid email without a dot after
   `@`, invalid email without `@`, invalid phone characters, invalid short
   phone, empty company string, `null` company accepted, partial update
   preservation, and missing ID behavior.
5. `node src/test.js` passes.
