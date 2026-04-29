# SP01: Ambiguous Priority Merge

## Task Shape

Implement a merge function where records with duplicate keys must be combined.
The ambiguity is priority: "newer" must be clarified as later input order, not a
timestamp field.

## Senior Skill Under Test

- Requirement ambiguity detection.
- TDD before implementation.
- Avoiding plausible but wrong timestamp-based logic.

## Fixture Contract

The task workspace should include:

- `TASK.md`
- `package.json`
- `src/contacts.js`
- `src/test.js`
- `verify.js`

The model may run `node verify.js` but must not read or modify `verify.js`
before the first verifier failure.

## Oracle Expectations

- Tests include at least one case where `createdAt` conflicts with input order.
- Later non-empty fields override earlier non-empty fields.
- Earlier non-empty fields survive when later fields are empty.
- Duplicate groups preserve first-seen group position.

## High-Risk Mistake

Using `createdAt` as priority despite the task requiring later input order.
