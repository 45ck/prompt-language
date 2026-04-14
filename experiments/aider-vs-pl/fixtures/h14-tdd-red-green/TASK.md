# H14: TDD Red-Green-Refactor — Merge Duplicate Contacts

## Task

Implement a "merge duplicate contacts" feature using TDD discipline:

1. First write failing tests for the merge functionality
2. Then implement the minimal code to make tests pass
3. Refactor if needed

The feature should merge contacts that share the same email address, keeping the most complete record.

## Acceptance Criteria

1. A `mergeDuplicates()` function exists that merges contacts with the same email
2. When merging, non-empty fields from the newer record take priority
3. The merged result has no duplicate emails
4. Tests exist in `src/test.js` that cover: basic merge, field priority, no-duplicates case, multiple duplicates
5. All tests pass
