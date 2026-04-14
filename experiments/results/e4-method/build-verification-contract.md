# E4 Build Verification Contract (ksih.2)

Authoritative specification of the shared verification contract for E4 factory runs.

Both the prompt-language lane and the codex-alone lane must satisfy this contract for a pair to be
admissible. The contract is defined independently of which lane is being evaluated. Lane-specific
control artifacts (PL session state, codex event stream) are supplementary evidence, not part of
the product contract.

---

## Purpose

The build verification contract answers: "Did this lane actually build working software?"

It is a hard binary gate. A lane either passes the contract or it does not. Partial credit is
recorded in the scorecard but does not convert a `contract-failed` lane into a passing lane for
comparison purposes.

The contract is deliberately tool-agnostic. It does not specify how the lane must complete the
steps — only what evidence must exist and what the exit codes must be.

---

## Required steps

The contract has four required verification steps. Steps must be run in this order. A failure at
any step is a blocking failure; later steps may still be attempted and recorded, but the lane is
classified as failing the contract at the first failed step.

### Step 1: Lint

**Command class**: static analysis (ESLint, Prettier check, or equivalent for the target stack).

**Required evidence**:
- `lintCommand` — the exact command string executed (e.g. `npm run lint`)
- `lintExitCode` — numeric exit code (0 = pass)
- `lintDurationMs` — wall-clock duration in milliseconds
- `lintLogPath` — path to captured stdout+stderr (relative to run artifact dir)

**Pass condition**: `lintExitCode === 0`.

**Failure classification**:
- Exit code non-zero with lint errors in the target workspace code: `product failure`
- Exit code non-zero due to missing linter binary or config: `config failure`
- Lint not run (no evidence): `evidence failure`

### Step 2: Typecheck

**Command class**: type system validation (tsc --noEmit, pyright, or equivalent).

**Required evidence**:
- `typecheckCommand`
- `typecheckExitCode`
- `typecheckDurationMs`
- `typecheckLogPath`

**Pass condition**: `typecheckExitCode === 0`.

**Failure classification**: same pattern as lint.

### Step 3: Test

**Command class**: test runner (vitest, jest, pytest, go test, or equivalent for the target stack).

**Required evidence**:
- `testCommand`
- `testExitCode`
- `testDurationMs`
- `testLogPath`
- `testPassCount` — number of passing tests (integer or null if not parseable)
- `testFailCount` — number of failing tests (integer or null if not parseable)
- `testSkipCount` — number of skipped tests (integer or null if not parseable)

**Pass condition**: `testExitCode === 0`.

**Failure classification**:
- Tests fail with assertion errors in product code: `product failure`
- Test runner not installed or config missing: `config failure`
- Test not run: `evidence failure`

### Step 4: Build (conditional)

**Command class**: compilation or bundle step (tsc, webpack, next build, go build, cargo build, or
equivalent). This step is **required only when the bounded product slice declares a build target**.

**Required evidence** (when applicable):
- `buildCommand`
- `buildExitCode`
- `buildDurationMs`
- `buildLogPath`
- `buildArtifactPath` — path to the primary build output (relative to workspace root)

**Pass condition**: `buildExitCode === 0` and `buildArtifactPath` exists.

**Failure classification**: same pattern. A missing build step when the slice does not declare a
build target is **not a failure** — record `buildApplicable: false`.

---

## Evidence format

Each lane's verification evidence must be captured in a machine-readable file:

**File**: `verification-evidence.json` (in the run's lane artifact directory)

**Schema**:

```json
{
  "laneId": "string",
  "runId": "string",
  "contractVersion": "1",
  "steps": {
    "lint": {
      "command": "string",
      "exitCode": 0,
      "durationMs": 0,
      "logPath": "string",
      "result": "pass | fail | skipped | not-run"
    },
    "typecheck": {
      "command": "string",
      "exitCode": 0,
      "durationMs": 0,
      "logPath": "string",
      "result": "pass | fail | skipped | not-run"
    },
    "test": {
      "command": "string",
      "exitCode": 0,
      "durationMs": 0,
      "logPath": "string",
      "passCount": null,
      "failCount": null,
      "skipCount": null,
      "result": "pass | fail | skipped | not-run"
    },
    "build": {
      "applicable": true,
      "command": "string",
      "exitCode": 0,
      "durationMs": 0,
      "logPath": "string",
      "artifactPath": "string",
      "result": "pass | fail | skipped | not-run | not-applicable"
    }
  },
  "contractVerdict": "pass | fail",
  "firstFailingStep": "lint | typecheck | test | build | null",
  "failureClass": "product | runtime | config | evidence | null",
  "verificationPassRate": 0.0,
  "notes": "string"
}
```

`verificationPassRate` = (count of steps with `result: pass`) / (count of applicable steps).

---

## Failure classification rules

Failure classification is applied at the **run level** after all steps have been attempted, not
per-step.

| Failure class | Meaning | Scorecard treatment |
| --- | --- | --- |
| `product` | The agent produced code that does not pass the verification contract | Admissible for comparison; the lane failed on product quality |
| `runtime` | The harness, process spawner, or underlying toolchain failed independently of product code | Invalidates the pair for primary comparison; recorded as `runtime-confound` |
| `config` | Workspace setup, path, permission, or missing binary failure before or independent of product work | Invalidates the pair if it affects only one lane asymmetrically |
| `evidence` | The verification steps were not run, logs are missing, or exit codes were not captured | Invalidates the pair; re-run required with proper instrumentation |

### Distinguishing `product` from `runtime`

A failure is `product` when:
- The log clearly contains errors in files that the agent wrote (compilation errors, assertion
  failures, lint errors in generated code).
- Removing the agent's code changes would make the step pass.

A failure is `runtime` when:
- The error occurs before any product code is touched (e.g., node not found, vitest not installed,
  Docker daemon not running).
- The same error would occur on a clean workspace with no agent changes.
- The error is in the test harness runner itself, not in the agent's test code.

When ambiguous, classify as `runtime` and document the decision in `postmortem.json` under
`failureClassRationale`.

---

## Shared contract across lanes

The same `verification-evidence.json` schema is used by both lanes. The commands may differ (a
prompt-language lane may invoke steps through a `run:` node in its flow; a codex-alone lane runs
them directly), but the evidence captured must be equivalent.

The shared product contract (which commands to run, which targets to verify) is declared in the
batch spec before any lane starts. The batch spec must record:

- `lintCommand` — canonical lint command for this scope
- `typecheckCommand` — canonical typecheck command
- `testCommand` — canonical test command
- `buildCommand` — canonical build command (or `null` if not applicable)
- `workspaceRoot` — path relative to the batch workspace where commands are executed
- `techStack` — brief identifier (e.g. `nodejs-vitest`, `python-pytest`, `go-test`)

Both lanes execute these exact commands against their respective workspaces.

---

## Verification timing envelope

Verification steps must run within the timed work envelope that defines the claim family:

- For **throughput** runs: verification steps are part of the timed envelope. The clock stops when
  the contract passes.
- For **factory-quality** runs: verification steps may be invoked multiple times during the run
  (e.g. by PL gates). The primary clock covers the full factory session. The first passing
  verification run is recorded as `timeToFirstGreenSec` for informational context only.
- For **recovery** runs: verification steps after the resume signal are part of the
  `resumeToGreenSec` envelope.

---

## What the contract does not cover

The build verification contract answers only whether the software passes static and dynamic checks.
It does not measure:

- behavioral correctness under external load (covered by E5 family 2)
- maintainability or changeability (covered by E5 family 4)
- feature completeness against spec (covered by the artifact contract, ksih.3)
- deployment readiness (not in scope for E4 factory-quality)

These are separate contracts with separate evidence requirements.
