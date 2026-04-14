# H9: Code Structure Quality - PL WINS (decisive)

## Scores

| Criterion              | Solo       | PL        |
| ---------------------- | ---------- | --------- |
| Separation of concerns | 1/5        | 4/5       |
| Type safety            | 3/5        | 4/5       |
| Test quality           | 1/5        | 3/5       |
| Tests pass             | NO (crash) | YES (5/5) |

## Key issues

- Solo: missing `export` on class, `beforeEach` not imported, everything in one file
- PL: separate task.ts + task-manager.ts, proper exports, factory pattern, tests run
- Neither arm tests edge cases (missing ID, empty list, file not found)
