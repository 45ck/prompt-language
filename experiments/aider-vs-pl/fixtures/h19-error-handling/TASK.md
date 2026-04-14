# H19: Error Handling Overhaul — Replace Bare Catches with Structured Errors

## Task

The Express-like API in `src/` has multiple bare `catch` blocks that swallow errors silently. Replace them with a structured error handling system:

1. Create custom error classes (NotFoundError, ValidationError, DatabaseError)
2. Add an error handler middleware that formats errors consistently
3. Replace all bare `catch(e) {}` and `catch(e) { console.log(e) }` blocks with proper error propagation
4. Add error logging

## Acceptance Criteria

1. Custom error classes exist with name, message, statusCode properties
2. No bare catch blocks remain (every catch either re-throws, wraps in custom error, or handles specifically)
3. Error handler returns consistent `{ error: string, code: string }` responses
4. All existing routes still work for valid inputs
5. Invalid inputs return proper error responses (not 500 or silent failures)
