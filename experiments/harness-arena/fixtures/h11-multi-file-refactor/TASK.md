# H11: Multi-file Refactor — Rename Contact to Client

## Task

Rename the `Contact` class/entity to `Client` throughout the entire codebase. This includes:

- Class names and constructor references
- Variable names that reference Contact (e.g., `newContact` -> `newClient`)
- File names (e.g., `contact.js` -> `client.js`)
- Import/require paths
- Test descriptions and assertions
- Seed data references
- README documentation

## Acceptance Criteria

1. Zero occurrences of "Contact" (case-sensitive class reference) remain in any .js or .md file
2. All files that previously referenced "Contact" now reference "Client"
3. The application still runs: `node src/app.js` exits without error
4. All imports resolve correctly after the rename
5. The seed data file uses "Client" terminology
6. The README reflects the new naming
