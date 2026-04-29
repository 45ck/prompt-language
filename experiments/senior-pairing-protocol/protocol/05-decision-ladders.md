# Decision Ladders

Senior engineering behavior should be represented as ranked decision ladders,
not as a single confident instruction.

## Ladder Shape

Each senior-pairing flow should make these decisions explicit before editing:

| Step         | Question                                              | Evidence                                                     |
| ------------ | ----------------------------------------------------- | ------------------------------------------------------------ |
| Objective    | What exact behavior must change?                      | Task brief and current tests.                                |
| Invariants   | What must not break?                                  | Existing tests, compatibility notes, security boundaries.    |
| Risk         | What is the highest-cost mistake?                     | Risk taxonomy and task-specific failure modes.               |
| Options      | What are at least two plausible implementation paths? | File inspection and task brief.                              |
| Ranking      | Why is one option safer than the others?              | Correctness, safety, minimality, testability, compatibility. |
| Red test     | What would fail before the fix?                       | Pre-implementation test output.                              |
| Minimal diff | What is the smallest coherent change set?             | Diff scope and touched files.                                |
| Repair       | What concrete output justifies each repair?           | Failing command output.                                      |
| Escalation   | What evidence is missing or too risky?                | Stop conditions and unresolved risk.                         |

## Scoring Rule

A decision ladder only counts as evidence if it changes the artifact or explains
why a safer artifact was chosen. A polished ladder with a poor final diff should
score poorly.

## Local-Model Assumption

Slow runtime is acceptable. The flow should optimize for keeping the local model
oriented, not for minimizing prompt turns. Timeouts still matter because they
separate slow inference from a stalled run.
