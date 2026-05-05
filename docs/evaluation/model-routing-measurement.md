# Model Routing Measurement Plan

Last reviewed: 2026-05-06

This note defines the measurement layer needed to decide whether prompt-language
is useful or just extra ceremony when compared with direct local or frontier model
use.

## Measurement Question

For a fixed bounded task with a locked oracle, does PL improve verified success
enough to justify its extra wall time, tokens, routing complexity, and maintenance
cost?

The answer must be measured per arm, not inferred from narrative quality.

## Required Metrics

| Metric                     | Why it matters                                          | Source                                               |
| -------------------------- | ------------------------------------------------------- | ---------------------------------------------------- |
| Oracle score / pass        | Decides whether the result actually works               | Locked public and hidden verifier                    |
| Wall time                  | Measures operator wait and runtime overhead             | Harness start/end timestamps                         |
| Prompt/input tokens        | Main frontier cost driver                               | Codex JSONL usage, Claude JSON result, provider logs |
| Output/reasoning tokens    | Secondary frontier cost driver and reasoning intensity  | Codex JSONL usage, Claude JSON result, provider logs |
| Estimated USD              | Makes cloud/frontier use comparable                     | Provider pricing table captured at run time          |
| Frontier calls             | Measures hybrid escalation cost                         | Harness route manifest                               |
| Local GPU active time      | Makes local inference cost visible                      | `ollama ps` snapshots and process sampling           |
| Retry count                | Shows whether PL is doing useful repair or looping      | PL audit trace and route manifest                    |
| Human intervention minutes | Captures real babysitting cost                          | Operator log                                         |
| Failure class              | Separates model failure from runtime/harness failure    | Manifest classification                              |
| Scope/oracle leak status   | Prevents invalid evidence                               | Fixture leak audit and protected-file checks         |
| Maintenance/review defects | Measures whether the output is actually easier to trust | Blinded review or deterministic defect checklist     |

## First Probe Results

These are smoke probes only. They are useful for telemetry shape, not model
quality claims.

| Arm                    | Model               | Result       | Wall time   | Usage captured                                                             | Direct cost signal               |
| ---------------------- | ------------------- | ------------ | ----------- | -------------------------------------------------------------------------- | -------------------------------- |
| Raw Ollama             | `qwen3:8b`          | Exit 0       | 13.0s       | No token usage from raw CLI; output included thinking/control text         | $0 API cost                      |
| Codex frontier         | `gpt-5.4-mini`      | Exit 0       | 9.2s        | 19,597 input, 2,432 cached input, 238 output, 153 reasoning tokens         | API-equivalent estimate required |
| Claude bare print      | `haiku`             | Auth failure | 2.2s        | JSON result reported zero tokens and `Not logged in`                       | $0                               |
| Codex local via Ollama | `qwen3:8b`          | Exit 0       | 26.6s       | 4,096 input, 369 output tokens in Codex JSONL; `ollama ps` showed 100% GPU | $0 API cost                      |
| HA-HR1 fake-live       | deterministic shell | Exit 0       | ~1.1s total | Per-step wall time, timeout, exit code, estimated USD, GPU seconds         | Harness only                     |

Using OpenAI's published GPT-5.4 mini API price as a rough equivalent
($0.75/1M input tokens and $4.50/1M output tokens, published 2026-03-17), the
Codex frontier probe is roughly $0.014-$0.016 if billed like API usage. Codex
CLI may account by quota rather than raw API billing, so store the raw token
usage and compute cost from the run's declared pricing table.

## Decision Criteria

PL is useful when at least one of these is true:

- It raises oracle pass rate enough to offset added wall time and setup.
- It prevents false completion or invalid output that direct prompting misses.
- It reduces human intervention minutes through gates, retries, and clearer
  failure states.
- It enables local models to complete bounded work that direct local prompting
  cannot complete.
- It reduces frontier calls per successful task without lowering oracle score.
- It produces better traceability when auditability is an explicit requirement.

PL is probably wasteful when:

- Direct prompting matches oracle score with materially lower wall time.
- PL adds retries but does not improve pass rate, defect count, or intervention
  time.
- The task is trivial, one-shot, and low risk.
- The harness/runtime failure rate is high enough that model quality cannot be
  interpreted.
- Hybrid routing uses frontier calls close to frontier-only volume without a
  quality gain.

## Next Implementation Slice

Add live measurement support to `experiments/harness-arena/runner.mjs` before
running larger pilots:

1. Add `--live-probe` or `--live` support for one read-only prompt task.
2. Capture stdout, stderr, timeout, exit code, wall time, and raw provider events.
3. Parse Codex JSONL usage into manifest fields.
4. Parse Claude JSON usage when authenticated; record auth failures as harness
   failures, not model failures.
5. Parse or estimate local Ollama tokens; always capture `ollama ps` before,
   during, and after local runs.
6. Store a pricing table with every run so estimated USD is reproducible.
7. Keep `local-only`, `frontier-only`, `advisor-only`, and `hybrid-router` claims
   separate.

## Minimum Pilot

Run one task across four arms:

| Arm             | Purpose                                       |
| --------------- | --------------------------------------------- |
| `local-only`    | Measures cheap local capability               |
| `frontier-only` | Measures quality/time/cost of direct frontier |
| `advisor-only`  | Measures whether advice without routing helps |
| `hybrid-router` | Measures local bulk plus frontier escalation  |

Hard caps for the first pilot:

- Wall time: 15 minutes per arm.
- Frontier spend: $1 total for the smoke pilot.
- Frontier calls: 2 maximum for hybrid on one task.
- Local repair loops: 2 maximum before classifying failure.
- Repeat count: `k=1` only until telemetry is clean, then `k=3`.
