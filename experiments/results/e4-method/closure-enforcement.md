# E4 Closure Enforcement (ksih.5)

Authoritative specification of what it means for an E4 run to be closed, and what must be true for
closure to be admissible.

---

## What closure means

A run is **closed** when:

1. The lane under test has terminated (process exited or session ended).
2. All required closure artifacts have been written to the lane artifact directory.
3. `lane-summary.json` accurately reflects the final state of the run.
4. No further writes to the artifact directory are expected.

Closure is not the same as success. A lane that fails the build verification contract can still
be closed. A lane that was interrupted and not resumed can be closed as `interrupted`. What closure
prohibits is ambiguity: a run that is neither clearly finished nor clearly failed is not closed.

A run that is closed as `interrupted` may be reopened for a recovery-family pair. In that case, the
pre-interruption artifact state must be snapshotted before the resume, and the recovery pair must
reference the pre-interruption snapshot explicitly.

---

## Required closure artifacts

Every closed E4 run must end with the following files in the lane artifact directory. Files that
were not produced must be recorded in `run.json` under `evidenceGaps` — they may not be silently
omitted.

### 1. `lane-summary.json`

**Purpose**: Single-file summary of the lane's final state. Machine-readable. Used by the batch
summary and scorecard scripts.

**Required fields**:

```json
{
  "laneId": "string",
  "runId": "string",
  "batchId": "string",
  "pairId": "string",
  "laneType": "prompt-language | codex-alone",
  "claimFamily": "throughput | factory-quality | recovery",
  "startedAt": "ISO",
  "endedAt": "ISO",
  "durationMs": 0,
  "outcome": "success | partial | failed | interrupted | evidence-failure",
  "failureClass": "product | runtime | config | evidence | null",
  "contractVerdict": "pass | partial | fail",
  "artifactContractVerdict": "pass | partial | fail",
  "verificationPassRate": 0.0,
  "timeToGreenSec": 0,
  "timeToFirstRelevantWriteSec": 0,
  "resumeToGreenSec": 0,
  "interventionCount": 0,
  "restartCount": 0,
  "runtimeFailureCount": 0,
  "factoryQualityOverall": 0,
  "closureQuality": 0,
  "processConformance": 0,
  "traceAuthority": 0,
  "reuseReadiness": 0,
  "claimStrength": 0,
  "traceCompleteness": "complete | incomplete | absent",
  "closureCompleteness": "strong | mixed | partial | absent",
  "evidenceGaps": [],
  "notes": "string"
}
```

Fields that were not measured must be recorded as `null`, not omitted. A `lane-summary.json`
with omitted fields is an evidence gap.

### 2. `artifact-inventory.json`

**Purpose**: Machine-readable record of the artifact contract verdict (see ksih.3).

**Requirement**: All six artifact categories (requirements, architecture, implementation,
testStrategy, handover, verificationEvidence) must have verdicts. Files that were not produced must
have `verdict: "absent"`, not be missing from the inventory.

### 3. `postmortem.json`

**Purpose**: Structured record of what went wrong and why.

**Required fields**:

```json
{
  "runId": "string",
  "laneId": "string",
  "outcome": "success | partial | failed | interrupted | evidence-failure",
  "failureClass": "product | runtime | config | evidence | null",
  "failureClassRationale": "string",
  "productFailures": [],
  "runtimeFailures": [],
  "configFailures": [],
  "evidenceGaps": [],
  "artifactContractFailures": [],
  "interventions": [],
  "recoveryLineage": null,
  "rootCause": "string",
  "lessonsLearned": [],
  "wouldRepeatPair": true,
  "notes": "string"
}
```

For a successful run with no failures, `productFailures`, `runtimeFailures`, `configFailures`,
`evidenceGaps`, and `artifactContractFailures` must all be empty arrays — not `null`. An empty
postmortem is valid. A missing postmortem is an evidence gap.

### 4. `interventions.json`

**Purpose**: Machine-readable record of every human intervention during the lane.

**Required fields**:

```json
{
  "runId": "string",
  "laneId": "string",
  "interventions": [
    {
      "timestamp": "ISO",
      "kind": "restart | manual-command | path-correction | output-edit | scope-change | other",
      "description": "string",
      "wasNecessary": true,
      "effectOnEvidence": "none | reduced-admissibility | invalidates-pair"
    }
  ],
  "totalInterventions": 0,
  "interventionsBurden": "none | low | medium | high"
}
```

`interventionBurden` is:
- `none`: zero interventions
- `low`: 1–2 interventions, none that reduce admissibility
- `medium`: 3–5 interventions, or 1–2 that reduce admissibility
- `high`: 6+ interventions, or any that invalidate the pair

### 5. `provenance.json` or `trace-summary.md`

**Purpose**: Record of which trace files are authoritative and what they imply.

**Requirement**: At minimum, `trace-summary.md` must be present (see ksih.4 for format). If
`provenance.jsonl` is present (PL_TRACE runs), a `provenance.json` manifest must additionally be
present with:

```json
{
  "runId": "string",
  "traceFile": "path/to/provenance.jsonl",
  "verifyCommand": "string",
  "verifyExitCode": 0,
  "verifyOutputPath": "string",
  "shimBinaryHash": "string | null",
  "expectedPairCount": 0,
  "verificationLevel": "strict | partial | none"
}
```

---

## Recovery lineage (for interruption/resume runs)

When a run was interrupted and resumed (recovery-family), the closure artifacts must include an
additional `recovery-lineage.json`:

```json
{
  "runId": "string",
  "laneId": "string",
  "claimFamily": "recovery",
  "interruptionProtocol": "predeclared",
  "interruptedAt": "ISO",
  "interruptionPathSnapshot": "path/to/pre-interruption-snapshot/",
  "interruptionWorkspaceHash": "sha256-of-workspace-at-interruption",
  "resumedAt": "ISO",
  "resumeSignal": "string",
  "workPreservedAtResume": true,
  "resumeToGreenSec": 0,
  "recoveredAfterInterruption": true,
  "resumeInterventionCount": 0,
  "recoveryQuality": 0
}
```

A recovery run without `recovery-lineage.json` is classified as `evidence failure` for the
recovery claim family.

---

## Batch consistency requirements

A batch is a predeclared set of pairs on a fixed protocol. For a batch to be admissible, all pairs
in the batch must share:

| Attribute | Requirement |
| --- | --- |
| `commitHash` | Identical for all pairs — both lanes in all pairs ran on the same frozen commit of the runtime and harness |
| `modelVersion` | The model identifier (e.g. `gpt-4.5`, `claude-opus-4-6`) must be recorded and identical across lanes in the same batch |
| `controlHash` | SHA-256 of the batch spec file (the predeclared protocol document). Proves the protocol was not changed mid-batch |
| `promptHash` | SHA-256 of the canonical prompt or flow file used as the factory input. Identical for all pairs on the same bounded scope |
| `bootstrapSeed` | The random seed or equivalent initialization for any stochastic components (model temperature, order randomization). Must be recorded even if not controllable |
| `scenario` | The bounded product scope identifier (e.g. `crm-core-v1`). Identical for all pairs |

These fields must appear in the batch spec file, in `run.json` for each pair, and in
`lane-summary.json` for each lane.

### Hash computation

- `controlHash`: `sha256(utf8(batchSpecFileContents))`
- `promptHash`: `sha256(utf8(canonicalPromptOrFlowFileContents))`
- `commitHash`: the git SHA-1 of `HEAD` at the moment each pair started (must be identical; if it
  differs, the pair is a protocol violation)

### Recording drift

If any batch consistency attribute differs across pairs (e.g. a model was updated mid-batch),
the run must record:

```json
"batchConsistencyViolations": [
  {
    "attribute": "modelVersion",
    "expectedValue": "gpt-4.5-2025-09-01",
    "actualValue": "gpt-4.5-2025-10-01",
    "detectedAt": "ISO",
    "effect": "invalidates-throughput | reduces-admissibility | none"
  }
]
```

in `run.json`. A batch with any `invalidates-throughput` or `invalidates-factory-quality`
consistency violation is demoted to supporting context for that claim family.

---

## Confounded run handling

A run is **confounded** when a factor outside the protocol affected the result in a way that cannot
be attributed to the lane under test. Examples:

- Windows path-space bug that only affected the PL launcher (A02, A04)
- Network timeout during codex event stream capture
- Node version mismatch between lanes
- Harness crash that required manual restart

### Classification

Confounded runs must be classified in `run.json` under `confounds`:

```json
"confounds": [
  {
    "confoundType": "runtime | config | environment | unknown",
    "description": "string",
    "affectedLane": "both | prompt-language | codex-alone",
    "severity": "fatal | significant | minor",
    "mitigated": true,
    "mitigationDescription": "string",
    "admissibilityEffect": "invalidates-pair | reduces-to-supporting-context | none"
  }
]
```

### Handling rules

| Severity | Effect |
| --- | --- |
| `fatal` | Pair must be excluded from the batch entirely. A new pair must replace it if the batch has not yet reached minimum pair count. |
| `significant` | Pair is demoted to `supporting-context`. It may not be used for primary comparison verdicts but remains in the record. |
| `minor` | Pair remains admissible but the confound must be acknowledged in the scorecard narrative. |

A confound that affects only one lane asymmetrically is always at least `significant`.

---

## Admissibility hardening

### What a closed run cannot claim

A run that is closed but fails one or more of the following conditions is **not admissible** for
the declared claim family (it becomes supporting context):

1. `lane-summary.json` is missing or has more than two `null` fields in primary metrics.
2. `artifact-inventory.json` is missing or has any `verdict: "absent"` for `verificationEvidence`.
3. `postmortem.json` is missing.
4. `interventions.json` is missing.
5. `trace-summary.md` is missing.
6. Any `confounds` entry has `admissibilityEffect: "invalidates-pair"`.
7. Any `interventions` entry has `effectOnEvidence: "invalidates-pair"`.
8. `batchConsistencyViolations` contains any `invalidates-*` violation.

### Self-reporting prohibition

The lane under test must not write its own `lane-summary.json`, `postmortem.json`, or
`interventions.json`. These are harness-level artifacts. The harness or the human operator writes
them after the lane has terminated.

For PL lanes, the flow may produce intermediate summaries (e.g., via `remember` or `let x = run`
commands that write status files), but the canonical closure artifacts must be written by the
harness wrapper, not the PL session itself.

### Re-run policy

A pair that is confounded or missing evidence may be re-run only if:

1. The re-run uses the same batch spec (same `controlHash`).
2. The re-run uses the same frozen commit (same `commitHash`).
3. The re-run is explicitly labeled as a replacement for the original pair, not an addition.
4. The original pair's artifacts are preserved in the artifact directory (not overwritten).

A batch that replaces more than one pair due to confounds is not a clean primary batch and must be
labeled as `pilot` or `replacement-batch` in the batch summary.
