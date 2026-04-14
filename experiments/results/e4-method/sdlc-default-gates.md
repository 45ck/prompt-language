# E4 SDLC Default Gates and Software-Quality Contract (ksih.6)

Authoritative specification of the factory flow quality standards for E4 runs and for
prompt-language factory flows in general.

---

## Purpose

A software factory is not just a code generator. A factory that produces passing code but omits
required phases, skips verification steps, or produces no artifacts beyond source files is a
deficient factory — even if the code itself is correct.

This document defines the minimum quality contract that a factory flow must satisfy to be scored as
a complete factory run. It applies both to the prompt-language lane (which uses a PL flow pack) and
to the codex-alone baseline (which produces its own process, however ad hoc).

---

## Required factory stages

A compliant factory run must demonstrate evidence of all four required stages. Evidence is a trace
entry, audit log entry, or output file that proves the stage was actually executed — not a claim by
the lane that it was executed.

### Stage 1: Build

**What**: Compilation or project setup. The factory must invoke the declared build step (if
applicable) and record the result.

**Evidence required**:
- A `run:` node execution (PL) or a shell command invocation (codex) of the build command
- Exit code and duration captured in the audit log or harness log
- Build artifact present in the workspace (or `buildApplicable: false` recorded)

**Classification when missing**:
- If build is applicable but not invoked: `partial` stage — stage skipped
- If build is not applicable for the declared scope: `not-applicable`, not penalized

### Stage 2: Lint

**What**: Static analysis pass. The factory must invoke the lint tool and record the result before
claiming the scope is complete.

**Evidence required**:
- Invocation of the lint command
- Exit code (0 = pass, non-zero = fail)
- Log captured (even if truncated)

**Classification when missing**:
- Lint not invoked: `stage-skipped`
- Lint invoked but log not captured: `evidence-gap`

### Stage 3: Typecheck

**What**: Type system validation. The factory must run the typecheck pass and record the result.

**Evidence required**: Same as lint — command, exit code, log.

**Classification when missing**: Same as lint.

### Stage 4: Test

**What**: Test runner pass. The factory must run the test suite and record pass/fail counts.

**Evidence required**:
- Test command invocation
- Exit code
- Pass and fail counts (even if approximate)
- Raw test output log

**Classification when missing**: Same as lint.

---

## Required SDLC artifacts in the normal flow

A factory flow is compliant with the SDLC artifact standard when its **normal path** (no error
branch, no recovery loop) includes nodes or phases that produce each of the following. These are
structural requirements on the flow design, not just the output.

### Requirements phase

The normal flow path must include a node or phase that:
- Produces or reads a requirements document before implementation begins
- Uses the requirements as input to the implementation phase (e.g., through variable interpolation
  or file reference in a prompt)

A factory that jumps directly from "goal statement" to implementation without a requirements
artifact violates this standard.

### Architecture phase

The normal flow path must include a node or phase that:
- Produces or reads an architecture document before implementation begins
- Makes at least one explicit design decision traceable to the implementation

### Implementation phase

The normal flow path must include nodes that:
- Produce source code artifacts in the declared workspace root
- Produce at least one test file

### Verification phase

The normal flow path must include nodes that:
- Execute the build verification contract steps (lint, typecheck, test) at least once on the
  produced artifacts before the flow declares success

A flow that delegates verification entirely to a `done when:` gate without any in-flow verification
step is `partial` — gates enforce completion but do not replace in-flow verification discipline.

### Handover phase

The normal flow path must include a node or phase that:
- Produces or updates a handover artifact (README or equivalent)
- Is positioned after implementation and verification, not before

---

## Review and approval stages

When a factory flow includes `review` or `approve` nodes (as in E7), those nodes must reference
gate evidence:

### Review node requirements

A `review` node in a compliant factory flow must:
1. Receive as input the output of a preceding verification phase (test results, lint output, or
   artifact inventory)
2. Produce a review verdict that references specific evidence (not a generic "looks good")

A review node that operates without reading verification evidence is decorative, not governed.

### Approve node requirements

An `approve` node in a compliant factory flow must:
1. Be preceded by a review node or a gate evaluation
2. Block advancement until the approval condition is satisfied
3. Record the approval decision with a timestamp in the audit trail

An approval that always passes regardless of verification evidence is not a real checkpoint.

---

## Classification: partial vs failed

### For missing stages

| Condition | Classification |
| --- | --- |
| All four stages present and evidenced | `complete` |
| 3 of 4 stages present (build missing but not applicable) | `complete` |
| 3 of 4 stages present (lint, typecheck, or test missing) | `partial` |
| 2 of 4 stages present | `partial` |
| 1 or 0 stages present | `failed` |

### For missing SDLC artifacts

| Condition | Classification |
| --- | --- |
| All six artifacts `present` | `complete` |
| 4–5 artifacts `present`, 1–2 `partial` | `partial` |
| Any artifact `absent` except `verificationEvidence` | `partial` |
| `verificationEvidence` absent, or 3+ artifacts absent | `failed` |

### Combined classification

The overall factory compliance verdict combines the stage classification and the artifact
classification:

| Stage class | Artifact class | Factory compliance |
| --- | --- | --- |
| `complete` | `complete` | `compliant` |
| `complete` | `partial` | `compliant-partial-artifacts` |
| `partial` | `complete` | `compliant-partial-stages` |
| `partial` | `partial` | `partial` |
| `failed` | any | `failed` |
| any | `failed` | `failed` |

Only `compliant` and `compliant-partial-*` runs are admissible for factory-quality superiority
claims. `partial` and `failed` runs are supporting context only.

---

## Scorecard mapping

The `processConformance` scorecard dimension maps to factory compliance:

| Factory compliance | `processConformance` score |
| --- | --- |
| `compliant` | `2` |
| `compliant-partial-artifacts` | `2` (artifact gaps noted in narrative) |
| `compliant-partial-stages` | `1` |
| `partial` | `1` |
| `failed` | `0` |

The `artifactCompleteness` scorecard dimension maps to the artifact classification:

| Artifact classification | `artifactCompleteness` score |
| --- | --- |
| `complete` | `2` |
| `partial` | `1` |
| `failed` | `0` |

---

## Local factory-quality scope vs full factory contract

For the E4 factory-quality batch, the admissible local SDLC scope is deliberately limited to what
can be verified without external toolchain dependencies. The boundary is:

### In-scope for factory-quality pilot

- Requirements and architecture docs
- Implemented source code and focused tests
- Build step (if build target declared)
- `noslop doctor`, `noslop check --tier=fast` (when available)
- Lint, typecheck, test
- Handover documentation grounded in the actual workspace
- Release checklist (local)

### Out-of-scope for factory-quality pilot (requires external runners)

- `mqm` (external quality machine) — not installed on this host
- `demo-machine` — not installed on this host
- End-to-end browser tests (Playwright) — requires a running server
- External deployment verification — requires Docker + live environment

The external steps are part of the `fullFactoryFlow` contract, not the `factory-quality` pilot.
When they are not available, the run is scored only on the in-scope dimensions. The missing
external steps must be recorded in `lane-summary.json` under `outOfScopeStages`.

---

## Gate discipline in factory flows

### What gates must do

Gates in a factory flow (`done when:` section) are the enforcement layer. They are evaluated
**after** the flow completes, by the task-completed hook, independently of the agent. They must be
hard — the agent cannot pass a gate by claiming the condition is met.

### What gates must not do

Gates must not substitute for in-flow verification. A factory flow that has no verification nodes
in its body but relies entirely on gates to catch failures is a degenerate factory. It produces no
evidence of when the failure was first detected, no audit trail of attempts, and no recovery path.

### Required gate coverage

For a factory flow to be scored as `compliant` on `processConformance`, its gate section must cover:

1. At least one gate from the build verification contract steps (tests_pass, lint_pass, or
   equivalent custom gate)
2. At least one artifact existence gate (file_exists for a required artifact) when the flow
   declares required artifacts

A flow with zero gates is always classified as `partial` on `processConformance` regardless of
whether the agent verbally claims everything is done.

### Gate evidence in the closure artifacts

Every gate evaluation must appear in `gate-log.json` (see ksih.4). A gate that was declared in the
flow but does not appear in the gate log is an evidence gap.

---

## Separation of local and external evidence

The E4 scorecard explicitly separates local factory-quality evidence (what can be verified on the
current machine) from external QA/demo execution. This separation prevents local runs from being
unfairly penalized for missing external toolchain components that neither lane can access.

When scoring a run:

1. Identify which steps are in-scope for the current host.
2. Score only in-scope steps on the `processConformance` and `artifactCompleteness` dimensions.
3. Record out-of-scope steps in `outOfScopeStages` with a clear note.
4. Do not apply different in-scope/out-of-scope rules to the two lanes in the same pair.

Asymmetric scoping — where one lane is penalized for missing steps that the other lane is not
required to perform — is a validity threat per `research-method.md` and must be flagged in
`postmortem.json`.
