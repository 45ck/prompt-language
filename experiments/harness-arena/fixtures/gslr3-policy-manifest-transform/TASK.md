# Task: Build a Portarium Evidence Card Input

Implement `buildEvidenceCardInput(manifest)` in
`src/evidence-card-transform.mjs`.

Return shape:

```js
{ ok: true, errors: [], card: { ... } }
{ ok: false, errors: ["human-readable error", "..."], card: null }
```

The input is a Prompt Language Harness Arena manifest. Transform it into a
Portarium evidence-card input object without leaking raw payloads or hidden
oracle content.

Required card shape:

```js
{
  schemaVersion: "portarium.evidence-card-input.v1",
  source: {
    system: "prompt-language",
    area: "harness-arena",
    manifestSchemaVersion: manifest.schemaVersion ?? null
  },
  workItem: {
    id: manifest.taskId,
    runId: manifest.runId,
    runGroupId: manifest.runGroupId ?? null,
    policyVersion: manifest.policyVersion ?? null
  },
  route: {
    arm: manifest.arm,
    decision: manifest.arm,
    selectedModel: first non-empty step.actualModel or step.requestedModel,
    selectedProvider: first non-empty step.provider,
    reason: "derived-from-harness-manifest"
  },
  gates: {
    finalVerdict: manifest.finalVerdict.status,
    privateOracle: manifest.oracle.passed ? "pass" : "fail",
    blockingReviewDefects: all step.reviewDefects strings
  },
  cost: {
    frontierTokensTotal: sum of step.cost.totalTokens for frontier steps,
    cachedInputTokensTotal: sum of step.cost.cachedInputTokens,
    providerUsdTotal: sum of step.cost.providerReportedUsd,
    localWallSecondsTotal: sum of step.wallSeconds for local route steps
  },
  actionBoundary: {
    status: "research-only" or "blocked",
    reason: string
  },
  artifactRefs: {
    manifest: "hybrid-routing-manifest.json",
    oracleStdout: manifest.oracle.stdoutArtifactRef ?? null,
    oracleStderr: manifest.oracle.stderrArtifactRef ?? null
  }
}
```

Set `actionBoundary.status` to `research-only` only when:

- `manifest.finalVerdict.status === "pass"`;
- `manifest.oracle.passed === true`;
- there are no blocking review defects.

Otherwise set it to `blocked`.

Validation rules:

- Do not throw on malformed input.
- Do not mutate the input.
- A valid failed manifest should still transform into a card with
  `actionBoundary.status === "blocked"`.
- Reject raw or secret payloads anywhere in the manifest, including nested
  objects and arrays. Forbidden key names are `rawPayload`, `sourcePayload`,
  `studentPayload`, `credential`, `secret`, `token`, and `password`, matched
  case-insensitively.
- Do not copy raw stdout, stderr, oracle command text, source payloads, tokens,
  credentials, or hidden oracle bodies into the card.
- Preserve only artifact references and aggregate telemetry.
