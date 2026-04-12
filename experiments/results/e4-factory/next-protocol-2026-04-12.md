# Next Protocol

Date: `2026-04-12`

## Objective

Run the next E4 comparison as a true patched A/B benchmark for raw throughput and governed
completion.

## Primary Benchmark

Use the patched sequential prompt-language lane as the primary benchmark.

- Prompt-language lane:
  [core-proof-sequential.flow](/D:/Visual%20Studio%20Projects/prompt-language/experiments/full-saas-factory/e4-codex-crm-factory/control/core-proof-sequential.flow:1)
- Direct Codex lane:
  [codex-alone-core-proof.prompt.md](/D:/Visual%20Studio%20Projects/prompt-language/experiments/full-saas-factory/e4-codex-crm-factory/control/codex-alone-core-proof.prompt.md:1)

Keep the multi-agent flow out of the primary throughput comparison. Use it only as a secondary
restart/orchestration stress test.

## Frozen Variables

- same repo commit for the full batch
- same Codex runner and model
- same machine, OS, shell, Node/npm versions, and lockfile
- same fresh workspace bootstrap
- same bounded scope and outcome contract
- same verification commands: `npm run lint`, `npm run typecheck`, `npm run test`
- no runtime fixes mid-batch

## Run Structure

- run pairs serially, not concurrently
- randomize lane order across pairs
- capture a system snapshot before each run:
  - free RAM
  - active Codex processes
  - active `ollama` processes
  - CPU load
- use a fresh cloned workspace for every run

## Mandatory Traces

Direct Codex must retain:

- `events.jsonl`
- stderr
- final message
- verification logs
- start/end timestamps

Prompt-language must retain:

- `session-state.json`
- `audit.jsonl`
- lane-level verification logs or equivalent authoritative state evidence
- start/end timestamps

Every run must produce `trace-summary.md` stating which trace files are authoritative.

## Metrics

Primary:

- `success_to_green`
- `time_to_green_sec`
- `intervention_count`
- `runtime_failure_count`

Secondary:

- `time_to_first_code_sec`
- `verification_reruns`
- `artifact_completeness`
- `trace_completeness`
- `orphan_process_count`
- `closure_completeness`

Every failure must be classified as `product`, `runtime`, `config`, or `evidence`.

## Interruption Scenarios

- `S0 Clean`: no interruption
- `S1 Mid-build hard stop`: interrupt after docs/specs exist and before `packages/api/src/index.ts`
- `S2 Pre-verification hard stop`: interrupt after both code files exist and before successful
  verification

Resume rule:

- prompt-language resumes from persisted state with the same flow
- direct Codex resumes from current workspace with the same frozen prompt plus one fixed resume
  sentence

## Repeat Count

Minimum credible batch:

- `4` clean A/B pairs
- `2` `S1` interruption A/B pairs
- `2` `S2` interruption A/B pairs

Total: `8` pairs / `16` runs

## Decision Rules

Claim `prompt-language` is better for raw throughput only if:

- success rate is at least equal to direct Codex
- median `time_to_green_sec` is at least `10%` better
- median intervention count is not worse
- runtime/config failures are not more frequent

Claim parity if:

- success rates match
- median `time_to_green_sec` is within `10%`

Claim prompt-language is better for governed factory work if interruption runs show:

- better recovery success
- lower rescue burden
- complete closure artifacts
