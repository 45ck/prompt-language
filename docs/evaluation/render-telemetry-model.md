# Render Telemetry Model

## Status

Contract note for bead `prompt-language-0ovo.1.1`.

This file defines the telemetry payload shape that render-time and turn-time
evaluation should emit. It does not claim that the repo already records every
field below.

## Purpose

The evaluation stack needs a stable telemetry contract so render behavior can be
measured across candidates, prompts, hooks, retries, and recovery paths without
inventing ad hoc JSON per experiment.

This model is designed to answer four questions consistently:

- how much prompt and output material was processed
- how much variable state changed between turns
- where wall-clock time was spent across hooks, I/O, and gates
- whether safety or config controls disabled, downgraded, or redirected behavior

## Event boundary

One telemetry record represents one evaluated render attempt for one flow turn.

The recommended emission point is after the turn result is known, so the record
can include:

- input prompt sizing
- output sizing
- timing totals and sub-spans
- gate outcomes
- fallback and recovery outcomes
- config gating or disable decisions

## Canonical JSON shape

```json
{
  "schemaVersion": "render-telemetry.v1",
  "recordedAt": "ISO-8601 timestamp",
  "runId": "string",
  "caseId": "string",
  "candidate": "string",
  "flowId": "string",
  "turnId": "string",
  "nodeId": "string",
  "nodeKind": "prompt | ask | run | let | var | if | while | retry | foreach | try | gate | end",
  "renderMode": "fresh | threaded | resumed | replay",
  "metrics": {
    "turnCounts": {
      "turnIndex": "integer >= 0",
      "turnCountInRun": "integer >= 1",
      "renderAttemptCount": "integer >= 1"
    },
    "bytes": {
      "promptBytes": "integer >= 0",
      "promptDeltaBytes": "integer >= 0",
      "variableSnapshotBytes": "integer >= 0",
      "variableDeltaBytes": "integer >= 0",
      "outputBytes": "integer >= 0",
      "stderrBytes": "integer >= 0",
      "stdoutBytes": "integer >= 0"
    },
    "variables": {
      "visibleVariableCount": "integer >= 0",
      "changedVariableCount": "integer >= 0",
      "addedVariableCount": "integer >= 0",
      "updatedVariableCount": "integer >= 0",
      "removedVariableCount": "integer >= 0"
    },
    "timingsMs": {
      "total": "number >= 0",
      "render": "number >= 0",
      "hooksTotal": "number >= 0",
      "ioTotal": "number >= 0",
      "gatesTotal": "number >= 0",
      "modelWait": "number >= 0",
      "recoveryTotal": "number >= 0"
    },
    "hookTimingsMs": {
      "userPromptSubmit": "number >= 0",
      "stop": "number >= 0",
      "taskCompleted": "number >= 0"
    },
    "ioTimingsMs": {
      "stdinWrite": "number >= 0",
      "stdoutRead": "number >= 0",
      "stderrRead": "number >= 0",
      "artifactWrite": "number >= 0"
    },
    "gateTimingsMs": {
      "preRender": "number >= 0",
      "doneWhen": "number >= 0",
      "postRender": "number >= 0"
    },
    "fallbacks": {
      "fallbackCount": "integer >= 0",
      "fallbackKinds": ["string"]
    },
    "recovery": {
      "recoveryIncidentCount": "integer >= 0",
      "recovered": "boolean",
      "incidentKinds": ["string"]
    }
  },
  "configGating": {
    "configHash": "string",
    "gated": "boolean",
    "disabled": "boolean",
    "disableSource": "none | config | cli | env | safety | unknown",
    "gatePolicy": "none | soft-block | hard-block | observe-only",
    "reasons": ["string"]
  },
  "outcome": {
    "status": "success | failed | blocked | fallback | recovered",
    "gateStatus": "passed | failed | skipped | blocked",
    "fallbackUsed": "boolean",
    "recoveryUsed": "boolean"
  }
}
```

## Field semantics

### Identity

- `schemaVersion`: stable payload version. Increment only for a breaking shape
  change.
- `recordedAt`: timestamp when the record is emitted.
- `runId`: evaluation run identifier shared by all records in one suite run.
- `caseId`: dataset or scenario identifier.
- `candidate`: evaluated implementation or harness label.
- `flowId`: flow definition identifier or source-relative flow key.
- `turnId`: stable turn identifier within the run.
- `nodeId`: node instance being rendered or completed.
- `nodeKind`: node category used for aggregation and regression slicing.
- `renderMode`: execution posture for comparison across fresh, threaded, resumed,
  or replayed runs.

### Turn counts

- `turnIndex`: zero-based turn number within the run.
- `turnCountInRun`: one-based total turns observed so far when the record is
  emitted.
- `renderAttemptCount`: one-based count of how many times this turn was rendered
  or retried.

### Byte counters

- `promptBytes`: UTF-8 byte length of the rendered prompt submitted to the
  model.
- `promptDeltaBytes`: UTF-8 byte length of content newly introduced since the
  prior rendered turn. For turn zero, this should equal `promptBytes`.
- `variableSnapshotBytes`: UTF-8 byte length of the serialized variable view
  exposed to the render.
- `variableDeltaBytes`: UTF-8 byte length of the changed variable payload
  relative to the prior turn.
- `outputBytes`: UTF-8 byte length of the primary model output captured for the
  turn.
- `stderrBytes`: UTF-8 byte length of stderr captured from tooling or host I/O
  during the turn.
- `stdoutBytes`: UTF-8 byte length of stdout captured from tooling or host I/O
  during the turn.

### Variable counters

- `visibleVariableCount`: variables visible to the rendered node.
- `changedVariableCount`: total variables whose value or presence changed since
  the prior turn.
- `addedVariableCount`: variables newly introduced this turn.
- `updatedVariableCount`: variables whose value changed but remained present.
- `removedVariableCount`: variables removed from visibility since the prior
  turn.

These counters must satisfy:

```text
changedVariableCount = addedVariableCount + updatedVariableCount + removedVariableCount
```

### Timing model

All timings are wall-clock milliseconds.

- `timingsMs.total`: full elapsed time for the turn record.
- `timingsMs.render`: time spent constructing prompt material and preparing the
  request.
- `timingsMs.hooksTotal`: sum of all hook timing spans.
- `timingsMs.ioTotal`: sum of all tracked I/O timing spans.
- `timingsMs.gatesTotal`: sum of all tracked gate timing spans.
- `timingsMs.modelWait`: time waiting for the model or child session result.
- `timingsMs.recoveryTotal`: time spent in explicit recovery handling after an
  incident.

Recommended accounting invariant:

```text
total >= render + hooksTotal + ioTotal + gatesTotal + modelWait
```

The inequality is deliberate because implementation overhead, scheduler delay,
or uninstrumented spans may exist.

### Hook timings

- `userPromptSubmit`: time spent in the UserPromptSubmit hook path.
- `stop`: time spent in the Stop hook path.
- `taskCompleted`: time spent in the TaskCompleted hook path.

If a hook did not run, record `0` rather than omitting the field.

### I/O timings

- `stdinWrite`: time spent writing prompt or command input to the child process.
- `stdoutRead`: time spent reading stdout for the turn.
- `stderrRead`: time spent reading stderr for the turn.
- `artifactWrite`: time spent persisting logs, traces, or evaluation artifacts.

### Gate timings

- `preRender`: checks that execute before prompt submission.
- `doneWhen`: explicit completion or verification gate evaluation.
- `postRender`: checks that run after the model response but before final
  completion.

If no gate exists at one stage, record `0`.

### Fallback and recovery

- `fallbackCount`: number of fallback transitions used during the turn.
- `fallbackKinds`: normalized fallback labels such as `summary_truncation`,
  `safe_mode`, `alternate_renderer`, or `gate_skip`.
- `recoveryIncidentCount`: number of incidents requiring recovery logic.
- `recovered`: whether the turn ended in a recovered state.
- `incidentKinds`: normalized incident labels such as `hook_timeout`,
  `io_timeout`, `parse_error`, `gate_failure`, or `tool_exit_nonzero`.

### Config gating and disable behavior

- `configHash`: stable hash of the effective config used for the turn.
- `gated`: true when a config gate influenced execution path or eligibility.
- `disabled`: true when a feature path was disabled rather than merely gated.
- `disableSource`: source of the disable decision.
- `gatePolicy`: enforcement posture selected for the turn.
- `reasons`: machine-readable reason codes such as
  `context_limit_exceeded`, `unsafe_summary_candidate`,
  `render_telemetry_disabled`, or `host_mode_not_supported`.

This section is required even when the answer is "nothing was gated." In that
case use:

```json
{
  "gated": false,
  "disabled": false,
  "disableSource": "none",
  "gatePolicy": "none",
  "reasons": []
}
```

## Normalization rules

- Emit integers for byte and count fields.
- Emit numbers for millisecond timings; fractional milliseconds are allowed.
- Do not omit zero-valued timing buckets.
- Do not emit negative values.
- Use normalized lowercase snake_case strings for `fallbackKinds`,
  `incidentKinds`, and `configGating.reasons`.
- Prefer one record per turn attempt. If a turn is retried, increment
  `renderAttemptCount` and emit a new record.

## Example payload

```json
{
  "schemaVersion": "render-telemetry.v1",
  "recordedAt": "2026-04-11T14:22:39.481Z",
  "runId": "run_e1_2026_04_11_0017",
  "caseId": "E1-context-adaptive-render-03",
  "candidate": "prompt-language",
  "flowId": "flows/context-adaptive-summary.prompt",
  "turnId": "turn-07",
  "nodeId": "prompt.review_summary",
  "nodeKind": "prompt",
  "renderMode": "threaded",
  "metrics": {
    "turnCounts": {
      "turnIndex": 6,
      "turnCountInRun": 7,
      "renderAttemptCount": 1
    },
    "bytes": {
      "promptBytes": 4821,
      "promptDeltaBytes": 913,
      "variableSnapshotBytes": 744,
      "variableDeltaBytes": 118,
      "outputBytes": 1362,
      "stderrBytes": 0,
      "stdoutBytes": 224
    },
    "variables": {
      "visibleVariableCount": 9,
      "changedVariableCount": 3,
      "addedVariableCount": 1,
      "updatedVariableCount": 2,
      "removedVariableCount": 0
    },
    "timingsMs": {
      "total": 2842.7,
      "render": 41.8,
      "hooksTotal": 77.5,
      "ioTotal": 118.2,
      "gatesTotal": 149.4,
      "modelWait": 2420.9,
      "recoveryTotal": 0
    },
    "hookTimingsMs": {
      "userPromptSubmit": 19.6,
      "stop": 32.1,
      "taskCompleted": 25.8
    },
    "ioTimingsMs": {
      "stdinWrite": 8.4,
      "stdoutRead": 87.5,
      "stderrRead": 0,
      "artifactWrite": 22.3
    },
    "gateTimingsMs": {
      "preRender": 11.2,
      "doneWhen": 122.7,
      "postRender": 15.5
    },
    "fallbacks": {
      "fallbackCount": 1,
      "fallbackKinds": ["summary_truncation"]
    },
    "recovery": {
      "recoveryIncidentCount": 1,
      "recovered": true,
      "incidentKinds": ["hook_timeout"]
    }
  },
  "configGating": {
    "configHash": "sha256:5f714fa1f4f6a3a9",
    "gated": true,
    "disabled": false,
    "disableSource": "none",
    "gatePolicy": "soft-block",
    "reasons": ["context_limit_exceeded", "unsafe_summary_candidate"]
  },
  "outcome": {
    "status": "recovered",
    "gateStatus": "passed",
    "fallbackUsed": true,
    "recoveryUsed": true
  }
}
```

## Closure note

This bead is satisfied only at the contract level by this file. Implementation
work is still required before telemetry can be emitted, validated, or used by
evaluation tooling.
