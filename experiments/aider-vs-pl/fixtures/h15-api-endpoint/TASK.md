# H15: API Endpoint Addition — PATCH /api/contacts/:id with Validation

## Task

Add a `PATCH /api/contacts/:id` endpoint to the existing Express-like API. The endpoint should support partial updates with field-level validation.

## Validation Rules

- `name`: string, 2-100 characters
- `email`: must contain `@` and a `.` after the `@`
- `phone`: digits, dashes, spaces, and optional leading `+` only; 7-20 chars
- `company`: string, 1-200 characters (or null to clear)

## Acceptance Criteria

1. PATCH endpoint exists and accepts partial updates
2. Returns 200 with updated record on success
3. Returns 400 with descriptive error for invalid fields
4. Returns 404 when contact ID doesn't exist
5. Only provided fields are updated (partial update, not full replace)
6. At least 8 test cases covering valid updates, invalid inputs, and edge cases
7. All tests pass
