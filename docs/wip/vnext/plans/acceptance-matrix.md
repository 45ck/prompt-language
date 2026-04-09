# Acceptance matrix

## Runtime trust

| Feature     | Acceptance signal                                                                      |
| ----------- | -------------------------------------------------------------------------------------- |
| Strict mode | Unknown vars, parse failures, review exhaustion, and approval timeouts can fail closed |
| Checkpoints | Flow can restore state/files/both predictably                                          |
| Budgets     | Exceeded budgets pause or fail with structured reasons                                 |

## Boundedness

| Feature          | Acceptance signal                            |
| ---------------- | -------------------------------------------- |
| Contracts        | Contracts can package gates + scope + limits |
| Contract linting | Impossible/conflicting contracts are flagged |
| Contract tests   | Contracts can be tested in isolation         |

## Effects and policy

| Feature          | Acceptance signal                                                   |
| ---------------- | ------------------------------------------------------------------- |
| Effect nodes     | External side effects are explicit in syntax                        |
| Idempotency keys | Retries/resume do not re-run already-recorded effects unless forced |
| Policy           | Risk tier determines auto/review/approve behavior                   |

## Replay and observability

| Feature   | Acceptance signal                                         |
| --------- | --------------------------------------------------------- |
| Event log | Runs emit append-only structured events                   |
| Replay    | Past runs can be reconstructed and inspected              |
| Reports   | Run reports explain failure, pause, or completion reasons |

## Evaluation and learning

| Feature              | Acceptance signal                                            |
| -------------------- | ------------------------------------------------------------ |
| Judges               | Named judges emit structured outputs with abstention         |
| Evals                | Suites support repeat runs, metrics, and baseline comparison |
| Regression promotion | Failed runs can be turned into reusable fixtures             |
| Memory governance    | Durable items carry provenance/confidence/TTL                |
