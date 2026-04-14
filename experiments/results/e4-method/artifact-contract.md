# E4 Artifact Contract (ksih.3)

Authoritative specification of the SDLC artifact contract for E4 factory runs.

The artifact contract answers: "Did this lane produce the required project documentation and
deliverables, not just passing code?" It is evaluated independently of the build verification
contract. A lane can pass the build verification contract but fail the artifact contract (produced
working code with no documentation), and vice versa.

---

## Purpose

Software factories are not just code generators. A governed factory must produce the full set of
artifacts that a second team needs to understand, extend, and maintain what was built. The artifact
contract specifies the minimum required set and the evidence format for verifying it.

The contract is defined at the batch level in a shared product contract. Both lanes are evaluated
against the same artifact contract. Lane-specific process artifacts (PL session state, codex event
stream, postmortems, interventions) are supplementary and evaluated separately under the closure
contract (ksih.5).

---

## Required SDLC artifacts

### 1. Requirements artifact

**What**: A document or structured file that records the product scope, user goals, and acceptance
criteria for the bounded slice.

**Minimum content**:
- A defined product scope statement (what is in scope and what is out of scope)
- At least three acceptance criteria that can be verified by inspection or test

**Accepted forms**: `requirements.md`, `requirements.json`, `spec.md`, `SCOPE.md`, or equivalent.
A README section that fulfills the content requirements is acceptable.

**Verdict**: `present | partial | absent`
- `present`: file exists and contains scope + criteria
- `partial`: file exists but criteria are missing or underspecified
- `absent`: no file found

### 2. Architecture artifact

**What**: A document that explains the high-level structure of what was built — sufficient for a
second engineer to understand the design decisions without reading all the code.

**Minimum content**:
- Component or module decomposition
- Key design decisions or trade-offs (at least one)
- Data flow or system boundary description (even a brief one)

**Accepted forms**: `architecture.md`, `ARCHITECTURE.md`, `design.md`, `docs/architecture.md`, or
equivalent. ADRs count if they collectively fulfill the content requirements.

**Verdict**: `present | partial | absent`

### 3. Implementation artifact

**What**: The actual code produced by the factory run. This is the primary product artifact.

**Minimum content**:
- Source files in the declared workspace root
- At least one test file (unit or integration) colocated or in a test directory
- A `package.json`, `go.mod`, `Cargo.toml`, or equivalent project descriptor

**Verdict**: `present | partial | absent`
- `present`: source + tests + project descriptor exist
- `partial`: source exists but tests or project descriptor are missing

### 4. Test strategy artifact

**What**: A document or file that records the test approach — not just the test files themselves,
but the intent, coverage goals, and any known gaps.

**Minimum content**:
- What is tested (unit, integration, e2e) and why that scope was chosen
- At least one known gap or limitation acknowledged explicitly

**Accepted forms**: `test-strategy.md`, a `## Testing` section in `README.md`, a `QA.md`, or
equivalent. A test file with a clearly structured describe block that explains scope is partial
credit.

**Verdict**: `present | partial | absent`

### 5. Handover artifact

**What**: Enough information for a new engineer to run the product locally and understand how to
continue development.

**Minimum content**:
- Setup steps (install + start commands)
- At least one "how to extend" note (e.g. how to add a new entity, how to add a test)

**Accepted forms**: `README.md` (when it contains the required content), `HANDOVER.md`,
`GETTING_STARTED.md`, or equivalent.

**Verdict**: `present | partial | absent`

### 6. Verification evidence artifact

**What**: The machine-readable output of the build verification contract (ksih.2).

**Minimum content**: The `verification-evidence.json` file with all required fields populated.

**Accepted forms**: `verification-evidence.json` only. A human-readable summary is insufficient on
its own.

**Verdict**: `present | absent`
- No partial credit: the machine-readable file either exists and is valid JSON or it does not.

---

## Machine-readable inventory

Every run must produce an `artifact-inventory.json` file in the lane's artifact directory. This
file is the machine-readable record of the artifact contract verdict.

**Schema**:

```json
{
  "laneId": "string",
  "runId": "string",
  "contractVersion": "1",
  "artifacts": {
    "requirements": {
      "path": "string | null",
      "verdict": "present | partial | absent",
      "notes": "string"
    },
    "architecture": {
      "path": "string | null",
      "verdict": "present | partial | absent",
      "notes": "string"
    },
    "implementation": {
      "path": "string | null",
      "verdict": "present | partial | absent",
      "notes": "string"
    },
    "testStrategy": {
      "path": "string | null",
      "verdict": "present | partial | absent",
      "notes": "string"
    },
    "handover": {
      "path": "string | null",
      "verdict": "present | partial | absent",
      "notes": "string"
    },
    "verificationEvidence": {
      "path": "string | null",
      "verdict": "present | absent",
      "notes": "string"
    }
  },
  "contractVerdict": "pass | partial | fail",
  "presentCount": 0,
  "partialCount": 0,
  "absentCount": 0,
  "notes": "string"
}
```

**Hash field**: When the artifact content is stable at closure time (i.e. no further writes are
expected), each artifact entry should include a `sha256` field with the hex-encoded SHA-256 hash of
the file at closing time. This enables downstream provenance verification.

```json
"requirements": {
  "path": "requirements.md",
  "sha256": "e3b0c44298fc1c149...",
  "verdict": "present",
  "notes": ""
}
```

The `sha256` field is optional for runs where the workspace is not stable at the time of inventory
capture. When omitted, set `sha256: null`.

---

## Verdict computation

### Per-artifact verdicts

Each artifact is scored independently against its minimum content requirements. The scorer (human
or automated checker) must record the evidence path and a brief rationale for the verdict in the
`notes` field.

### Contract-level verdict

| Condition | Contract verdict |
| --- | --- |
| All six artifacts are `present` | `pass` |
| `verificationEvidence` is `present` AND all others are `present` or `partial`, with no more than two `partial` | `partial` |
| `verificationEvidence` is `absent`, OR three or more artifacts are `absent` | `fail` |

### Scorecard mapping

The `artifactContractPass` scorecard field maps as follows:
- `2` — contract verdict `pass`
- `1` — contract verdict `partial`
- `0` — contract verdict `fail`

---

## Failure handling

### Explicit artifact-contract failure

When the contract verdict is `fail`, the run must record `artifactContractFailed: true` in
`run.json`. The run may still be closed and used as supporting context, but it is not admissible
for factory-quality superiority claims.

Failure reasons must be documented in `postmortem.json` under `artifactContractFailures`, with one
entry per absent or failed artifact:

```json
"artifactContractFailures": [
  {
    "artifact": "testStrategy",
    "verdict": "absent",
    "reason": "No test strategy document produced. Test files exist but no intent document.",
    "responsible": "codex-alone | prompt-language | harness | ambiguous"
  }
]
```

The `responsible` field attributes the failure to the lane under test, the opposing lane's
structure, the harness protocol, or an ambiguous cause. This prevents lane-specific artifacts from
being used to penalize the other lane.

### Silent downgrade prohibition

A run may **not** silently omit the artifact contract check or omit `artifact-inventory.json` from
the closure artifacts. If the artifact inventory was not produced, the run must record this in
`run.json` under `evidenceGaps`:

```json
"evidenceGaps": [
  {
    "field": "artifactInventory",
    "reason": "Harness did not capture artifact inventory before workspace teardown."
  }
]
```

A run with `evidenceGaps` that include `artifactInventory` is classified as `evidence` failure for
the factory-quality claim family and is not admissible as a primary comparison.

---

## Lane-specific vs shared artifacts

The product artifact contract (requirements, architecture, implementation, test strategy, handover,
verification evidence) applies equally to both lanes. Both lanes are expected to produce all six
artifact types.

Lane-specific control artifacts that do not count toward the product contract:

- Prompt-language lane: `session-state.json`, `.prompt-language/audit.jsonl`,
  `.prompt-language/vars/`, PL phase scripts, flow files
- Codex-alone lane: codex event stream, raw conversation logs, codex workspace state

These lane-specific artifacts are evaluated under the trace and closure contracts (ksih.4, ksih.5),
not here. They must not be used to downgrade the opposing lane on product completion dimensions.

---

## Artifact contract vs build verification contract

| Dimension | Artifact contract (this doc) | Build verification contract (ksih.2) |
| --- | --- | --- |
| Question | Are all required SDLC documents present? | Does the code pass lint, typecheck, test, build? |
| Evidence format | `artifact-inventory.json` | `verification-evidence.json` |
| Verdict | `pass / partial / fail` per artifact | `pass / fail` with exit codes |
| Failure class | `product / evidence / runtime` | `product / runtime / config / evidence` |
| Partial credit | Yes (partial presence) | No (exit code is binary) |

Both contracts must pass for a lane to be classified as a clean factory-quality result. A lane that
passes verification but fails the artifact contract has demonstrated code correctness without
factory discipline.
