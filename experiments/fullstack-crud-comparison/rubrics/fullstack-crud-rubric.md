# Full-Stack CRUD Rubric

Total: `100` points.

## Product Completeness: 35

- Customer CRUD complete: `6`
- Asset CRUD complete: `6`
- Work order CRUD complete: `6`
- Relationship integrity enforced: `7`
- Status and priority rules enforced: `5`
- Seed data and documented local run path: `5`

## Cross-Layer Consistency: 20

- Data model, API, UI, and tests use the same field names: `5`
- UI exposes list/create/edit/detail/delete for each entity: `5`
- Error handling surfaces validation failures clearly: `4`
- Delete behavior avoids dangling references: `3`
- README matches actual commands: `3`

## Verification Strength: 20

- Install/build/typecheck evidence captured: `4`
- Unit tests cover validation rules: `5`
- Integration tests cover each entity family: `5`
- Verifier passes: `4`
- Verification report cites command output accurately: `2`

## Engineering Quality: 15

- Simple architecture with clear boundaries: `4`
- No placeholder handlers or fake green tests: `4`
- Minimal dependency footprint: `2`
- Maintainable naming and structure: `3`
- No broad speculative features: `2`

## Research Evidence: 10

- Run manifest complete: `3`
- Trace/audit artifacts complete for the arm: `3`
- Runner/model/version/timeout captured: `2`
- No oracle access violation: `2`

## Hard Fail Conditions

Score the run as failed regardless of numeric total if:

- the workspace cannot be installed
- the app lacks one of the three required entity families
- tests or verifier were fabricated instead of executed
- hidden verifier files were read or modified
- the run has no manifest
