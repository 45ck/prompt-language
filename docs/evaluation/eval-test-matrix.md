# Evaluation Stack Test Matrix

This note records the automated coverage expected around the v1 evaluation stack.

It is a QA planning artifact, not a claim that live smoke is optional. Live validation still belongs to the parity and smoke docs.

## Coverage areas

| Area                          | What must be covered                                                                                                   | Current anchors                                                                                                            |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Parser / lint / render        | `rubric`, `judge`, `review strict`, and missing or duplicate references                                                | `src/application/parse-flow*`, `src/domain/lint-flow*`, `src/domain/render-flow*`                                          |
| Runtime verdict handling      | typed judge-result parsing, review strict fail-closed behavior, retry and abstain paths                                | `src/domain/judge-result.test.ts`, `src/application/advance-flow-new-nodes.test.ts`                                        |
| Named review judges           | capture prompt generation, JSON parsing, hook resume/compact behavior                                                  | `src/domain/review-judge-capture.test.ts`, `src/presentation/hooks/*review*`, `src/presentation/hooks/pre-compact.test.ts` |
| Dataset parsing               | malformed JSONL, missing fields, duplicate ids, real dataset-file loading, invalid repeat counts                       | `src/infrastructure/adapters/eval-dataset-runner.test.ts`                                                                  |
| Dataset and fixture contracts | checked-in dataset file parse, fixture path expectations, input-file contract, verify command shape                    | `src/infrastructure/adapters/eval-dataset-runner.test.ts`, `experiments/eval/datasets/*.jsonl`                             |
| Eval reporting                | summary metrics, case-level baseline comparison, nested report output paths, report re-read                            | `src/infrastructure/adapters/eval-dataset-runner.test.ts`                                                                  |
| Harness boundary              | Claude, Codex, and OpenCode prompt-vs-flow routing, smoke routing, timeout rules, and runner-specific command assembly | `src/infrastructure/adapters/eval-harness-contract.test.ts`                                                                |
| CLI surface                   | `run`, `ci`, and `eval` command wiring plus key options                                                                | `src/infrastructure/adapters/cli.test.ts`                                                                                  |

## Critical failure modes

These should stay represented in automated tests before the stack is called stable:

- malformed judge-result JSON
- missing named judge captures after body exhaustion
- strict review exhaustion without a passing verdict
- missing or duplicate dataset identifiers
- missing fixture or missing input file
- invalid baseline report comparisons
- report output paths that require directory creation
- harness regressions that collapse OpenCode flow execution back into prompt-only mode

## Coverage expectation

- Domain and application logic should keep direct unit coverage.
- Dataset runner and report generation should have deterministic infrastructure-level tests with mocked harness execution where possible.
- CLI wiring should keep source-contract or narrow integration coverage so command flags do not silently drift.
- Live smoke remains a separate gate for supported hosts; it is not replaced by this matrix.

## Deferred areas

The following remain outside the current automated matrix until the corresponding features land:

- replay by run id
- locked baseline promotion workflows beyond file-level comparison
- human annotation queues
- trace-heavy artifact bundles

Those belong to the later artifact and replay backlog, not the current seeded runner slice.
