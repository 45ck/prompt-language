# Escalation Policy

Escalation is a feature, not a failure. A senior engineer stops a junior from
guessing when the situation is unsafe.

## Must Escalate

- The task has conflicting requirements.
- The correct behavior depends on hidden product policy.
- A security or data-loss risk is high and not covered by tests.
- The model cannot explain why the selected implementation is safe.
- The deterministic oracle fails after the repair budget is exhausted.

## May Continue

- Ambiguity is minor and the flow states an explicit assumption.
- The assumption is verified by tests or oracle.
- The implementation can be reversed easily.

## Hybrid Route

Use an external strong judge when:

- the local model passes tests but risk remains high;
- the change crosses architecture boundaries;
- the task involves auth, data migration, or user-visible policy;
- the local model's explanation conflicts with the diff.
