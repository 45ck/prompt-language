# Next Protocol

Date: `2026-04-12`

## Objective

Run the next E4 comparison in the area where prompt-language still has a plausible advantage:
governed interruption, restart, and recovery. The clean throughput batch has already completed.

## Phase Split

### `S0` Clean Throughput Batch

Use a throughput-specific prompt-language control file so the timed work envelope is closer to the
direct Codex baseline.

- Prompt-language lane:
  [core-proof-throughput.flow](/D:/Visual%20Studio%20Projects/prompt-language/experiments/full-saas-factory/e4-codex-crm-factory/control/core-proof-throughput.flow:1)
- Direct Codex lane:
  [codex-alone-core-proof.prompt.md](/D:/Visual%20Studio%20Projects/prompt-language/experiments/full-saas-factory/e4-codex-crm-factory/control/codex-alone-core-proof.prompt.md:1)

Run only clean uninterrupted pairs in this phase.

Status: completed with [B02 batch summary](./batches/e4-b02-s0-clean-gpt52-primary/summary.md).

### `S1` / `S2` Recovery Batch

Start interruption or resume scenarios only after the `S0` batch finishes and the batch summary
decides whether the clean throughput claim is eligible.

Current disposition: `S0` is complete and the batch-level throughput verdict is
`codex-alone-better`, so future E4 work should move into `S1` / `S2`.

## Frozen Variables

- same repo commit for the full batch
- same Codex runner and model
- same machine, OS, shell, Node/npm versions, and lockfile
- same fresh workspace bootstrap
- same bounded scope and outcome contract
- same outer verification commands: `npm run lint`, `npm run typecheck`, `npm run test`
- no runtime fixes mid-batch
- no repo edits mid-batch

## `S0` Batch Shape

Use a fixed alternating six-pair schedule:

- `P01` `codex-first`
- `P02` `pl-first`
- `P03` `codex-first`
- `P04` `pl-first`
- `P05` `codex-first`
- `P06` `pl-first`

This is the default clean throughput batch for `e4:batch`.

Treat `e4-b01-s0-clean-gpt52-pilot` as a pilot only. The first claim-eligible clean throughput
batch should start as a fresh predeclared batch with the full planned pair count frozen up front.

If a primary batch is interrupted, resume it on the same `batchId` and frozen commit instead of
changing `plannedPairs` or reusing the pilot batch as the primary evidence pack.

## Pre-Run Gate

Before every pair:

- git worktree must be clean
- no pre-existing Codex processes
- free RAM must stay above the floor enforced by the batch runner
- a system snapshot must be written before the pair starts

If the pair runner crashes before writing a closed run pack, preserve the incomplete evidence and
stop the batch.

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

- `timeToGreenSec`
- `success_to_green`
- `interventionCount`
- `runtimeFailureCount`

Secondary:

- `timeToFirstRelevantWriteSec`
- `restartCount`
- `artifactCompleteness`
- `traceCompleteness`
- `closureCompleteness`

Every failure must be classified as `product`, `runtime`, `config`, or `evidence`.

Only `timeToGreenSec` may drive the throughput verdict. `timeToFirstRelevantWriteSec` is retained
as exploratory context and may explain a result, but it must not flip the primary comparative
verdict on its own.

## Exclusion Rules

Exclude a pair from throughput claims if any of these apply:

- pre-run gate contamination
- harness crash before both lanes close bookkeeping
- missing required raw trace files
- mismatched commit/model/control surface

Excluded pairs still stay on disk as evidence.

## Batch-Level Decision Rules

The batch may support a throughput claim only if:

- at least `4` completed clean pairs remain after exclusions
- at least `2` pairs exist in each order
- no harness-fatal exclusions remain unresolved

Then decide:

- `prompt-language-better` only if success rate is not worse and median `timeToGreenSec` is at
  least `10%` better
- `codex-alone-better` by the same rule
- `parity` if success rates match and median `timeToGreenSec` is within `10%`
- otherwise `mixed`

## Recovery Phase

Only after `S0`:

- `S1` mid-build hard stop
- `S2` pre-verification hard stop

Those scenarios answer a different question: governed recovery, not raw throughput.
