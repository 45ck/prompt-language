# E4 Trace and Provenance Contract (ksih.4)

Authoritative specification of the minimum trace requirements for E4 factory runs.

Traces are the raw evidence from which all scorecard claims must be grounded. A claim that is not
backed by a trace entry is an assertion, not evidence. This contract defines what must be recorded,
where it must be stored, and what a trace must explain to count as a closure trace.

---

## Purpose

The E4 research method requires that claims about why one lane is better, worse, or inconclusive
are backed by raw trace artifacts from the actual sessions. A trace-less run is admissible only as
supporting context, never as primary comparison evidence.

This contract defines two lane trace profiles — one for prompt-language runs and one for codex-alone
runs — and specifies the storage and closure requirements shared by both.

---

## PL lane trace requirements

The prompt-language lane must retain the following raw traces. All files must be present in the
run's lane artifact directory.

### 1. Node lifecycle trace

**File**: `.prompt-language/session-state.json` (persisted state after final hook)

**Contents**:
- `flowNodes` — the full flow tree as parsed at session start
- `currentPath` — the index path into the flow tree at the moment the session ended
- `status` — `active | completed | failed | cancelled`
- `variables` — all session variables at closure time
- `completedAt` or `failedAt` — ISO timestamp

**Requirement**: The session state must be captured at the moment the session ends, not during an
intermediate step. The `sha256` checksum in `session-state.json` must be valid (the state file
integrity check must pass).

**Closure indicator**: `status` must be `completed` or `failed`. A status of `active` means the
session did not close cleanly.

### 2. Prompt turns log

**File**: `.prompt-language/audit.jsonl` (append-only JSONL)

**Contents**: One JSON object per prompt turn, per `run:` command, and per gate invocation, each
with:
- `timestamp` — ISO
- `type` — `prompt | run | gate`
- `content` — the prompt text, command string, or gate predicate
- `exitCode` — for `run` and `gate` entries
- `durationMs`

**Requirement**: Every `run:` node and every `prompt` node executed during the session must appear
in this log. The log must not be truncated mid-session (the final entry should correspond to the
last meaningful action before closure).

### 3. Gate evaluation log

**File**: `gate-log.json` (produced by the task-completed hook if gates were evaluated)

**Contents**:
- `gatesEvaluated` — array of `{ predicate, command, exitCode, durationMs, result: "pass|fail" }`
- `overallResult` — `pass | fail | skipped`
- `evaluatedAt` — ISO timestamp

**Requirement**: If the run declared a `done when:` section, a gate log must be present. If no
gates were declared, the file must exist with `gatesEvaluated: []` and `overallResult: skipped`.

### 4. Resume lineage (when applicable)

**File**: `resume-lineage.json` (required for recovery-family runs only)

**Contents**:
- `interruptedAt` — ISO timestamp of the interruption
- `interruptionPathSnapshot` — the `currentPath` at interruption time
- `resumedAt` — ISO timestamp of the resume
- `workPreserved` — boolean: was the pre-interruption work present in the workspace at resume time
- `firstNewNodeAfterResume` — the node path index of the first node processed after resume

**Requirement**: For recovery-family runs, this file is mandatory. For other families, it may be
omitted. If a recovery run is missing this file, it is classified as `evidence failure`.

### 5. Child process links (when applicable)

**File**: `spawn-registry.json` (required when the flow used `spawn` or `foreach-spawn`)

**Contents**:
- Array of `{ childName, childStateDir, childPid, childStatus, importedVariables }`

**Requirement**: Every `spawn` node executed must have an entry. The `childStateDir` must contain
a valid `.prompt-language/session-state.json` for the child session.

### 6. PL trace chain (when PL_TRACE=1 was set)

**File**: `PL_TRACE_DIR/provenance.jsonl` (when strict tracing is enabled)

**Contents**: The Merkle-chained runtime trace as defined in `docs/tracing-and-provenance.md`.

**Requirement**: When `PL_TRACE=1` and `PL_TRACE_STRICT=1` are set, `provenance.jsonl` must be
present and pass `verify-trace`. If the trace is present but fails verification, the run is
classified as `evidence failure` for claim-eligible purposes (it may still be useful supporting
context).

**Note**: PL_TRACE is required for claim-eligible runs per the claim-eligibility rule in
`docs/strategy/program-status.md`. Runs without it are recorded evidence, not thesis evidence.

---

## Codex-alone lane trace requirements

The codex-alone lane must retain the following raw traces.

### 1. Event stream

**File**: `codex-events.jsonl` or equivalent raw output from the codex binary

**Contents**: The raw event stream produced by the codex process, one JSON event per line.

**Requirement**: The complete event stream from session start to termination. Partial streams
(truncated mid-session) are classified as `evidence failure`.

### 2. Stderr and stdout logs

**Files**: `codex-stdout.log`, `codex-stderr.log`

**Requirement**: Full capture of the process stdout and stderr. These are required for diagnosing
runtime vs product failure classification.

### 3. Final messages

**File**: `codex-final-messages.json` (or equivalent)

**Contents**: The final assistant messages from the codex session — the last N messages before
termination, sufficient to understand the lane's stated completion state and any final reasoning.

**Requirement**: At least the final three messages must be captured. If the codex session ended
with an error, the error message must be present.

### 4. Verification logs

**Files**: `codex-lint.log`, `codex-typecheck.log`, `codex-test.log`, `codex-build.log`

**Contents**: The raw stdout+stderr of each verification step, captured by the harness immediately
after the codex session completes.

**Requirement**: All four files (or `not-applicable` markers) must be present. These are the
evidence for the build verification contract (ksih.2). Without them, `failureClass` cannot be
determined.

### 5. Timing log

**File**: `codex-timing.json`

**Contents**:
- `sessionStartAt` — ISO timestamp when the codex process started
- `sessionEndAt` — ISO timestamp when the codex process terminated
- `sessionDurationMs`
- `firstRelevantWriteAt` — ISO timestamp of the first file write in the target workspace (from
  harness file watch)
- `firstRelevantWriteMs` — milliseconds from session start to first write

**Requirement**: `sessionStartAt` and `sessionEndAt` are mandatory. `firstRelevantWriteAt` is
required for throughput-family runs; optional for other families (record as `null` if not
instrumented).

---

## Storage requirements

### Location

Trace files must be stored **outside** the `session-state.json` and outside the target product
workspace. They live in the run's lane artifact directory, which is created by the harness before
the lane starts and is not writable by the lane under test.

For PL lanes, the `.prompt-language/` directory is inside the product workspace and may be written
by the lane. It is copied to the artifact directory at closure time. The artifact directory copy is
the authoritative trace, not the in-workspace copy.

For codex-alone lanes, the event stream and logs are captured by the harness wrapper, not by codex
itself.

### Naming convention

Lane artifact directories follow this convention:

```
experiments/results/e4-factory/runs/<run-id>/<lane-id>/
  verification-evidence.json
  artifact-inventory.json
  lane-summary.json
  trace-summary.md
  [pl-lane]  session-state-final.json
  [pl-lane]  audit.jsonl
  [pl-lane]  gate-log.json
  [pl-lane]  spawn-registry.json (if applicable)
  [pl-lane]  resume-lineage.json (if applicable)
  [pl-lane]  provenance.jsonl (if PL_TRACE=1)
  [codex]    codex-events.jsonl
  [codex]    codex-stdout.log
  [codex]    codex-stderr.log
  [codex]    codex-final-messages.json
  [codex]    codex-timing.json
  [codex]    codex-lint.log
  [codex]    codex-typecheck.log
  [codex]    codex-test.log
  [codex]    codex-build.log
```

### Immutability

Once a run is closed, its artifact directory must not be modified. If a correction is needed, a
new run must be started. The artifact directory is the permanent record; the in-workspace state is
ephemeral.

---

## Closure requirement

A trace **explains how artifacts were produced** when it satisfies all of the following:

1. **Coverage**: every major decision point (prompt turn, gate evaluation, branch taken, node
   advanced, command executed) has a corresponding trace entry or audit log entry.

2. **Causality**: a reviewer reading only the trace (without looking at the workspace) can explain
   why each artifact exists — what prompt or command produced it and when.

3. **Completeness**: the trace has a clearly identified start and a clearly identified end, with no
   gaps spanning more than one major work unit (e.g., a 10-minute gap with no entries is a gap that
   must be explained in `trace-summary.md`).

4. **Verifiability**: at least one trace entry can be independently verified against the artifact
   it produced (e.g., a `run:` audit entry that produced a file whose content matches the expected
   output of that command).

A trace that does not meet the closure requirement must be classified as `incomplete` in
`trace-summary.md` and must not support factory-quality superiority claims.

---

## trace-summary.md

Every run must include a `trace-summary.md` file in the run artifact directory. This is a
human-readable document that:

1. Lists all authoritative trace files and their paths.
2. States which claim family the traces support.
3. Notes any known gaps or incomplete segments.
4. Explains how to interpret the trace to verify the run narrative.

The summary must be written by the harness or the human operator who closed the run. It must not be
written by the lane under test.

**Minimum template**:

```markdown
# Trace Summary — <run-id>

## Authoritative files

- [list each trace file with its path and a one-line description]

## Claim family supported

[throughput | factory-quality | recovery]

## Trace completeness

[complete | incomplete — explain gaps]

## How to verify

[steps a reviewer would follow to cross-check the run narrative against the traces]

## Known limitations

[anything that reduces the evidential weight of this trace]
```

---

## Trace contract vs PL_TRACE chain

The trace contract defined here applies to **all** E4 runs, regardless of whether PL_TRACE is set.

The PL_TRACE Merkle chain (`provenance.jsonl`) is a **stronger** form of the PL lane trace. It
provides tamper-resistance through hash chaining and dual-recorder pairing. It is required for
claim-eligible runs per `docs/strategy/program-status.md`.

This document defines the minimum evidence required for a run to be useful supporting context. The
PL_TRACE chain is what elevates a run from supporting context to claim-eligible.

The two are layered:

| Level | Requirement | Eligible for |
| --- | --- | --- |
| Minimum trace (this doc) | All files listed above present and complete | Supporting context, factory-quality pilot |
| PL_TRACE chain | `provenance.jsonl` passes `verify-trace` with all required flags | Primary comparison, thesis claim |
| Claim-eligible (program-status.md) | All five claim-eligibility criteria met | Publishable thesis evidence |
