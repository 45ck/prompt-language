# H16: Bug Reproduction — Crash on Empty Array

## Issue Report

> "When I call `getStatistics()` on a contacts list that has been filtered to zero results, the application crashes with 'Cannot read properties of undefined'. This happens when I filter by a company that doesn't exist."

## Task

1. Reproduce the bug described in the issue
2. Write a failing test that demonstrates the crash
3. Fix the bug
4. Verify the fix passes the test

## Acceptance Criteria

1. A test exists that would have caught this bug before the fix
2. The `getStatistics()` function handles empty arrays without crashing
3. The `filterByCompany()` + `getStatistics()` pipeline works for nonexistent companies
4. All existing functionality still works
5. The fix handles all empty-array edge cases, not just the reported one
