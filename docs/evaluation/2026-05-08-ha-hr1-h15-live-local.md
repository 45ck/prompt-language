# 2026-05-08 HA-HR1 H15 Live Local Evidence

## Scope

This record extends the H14 local-model routing work to H15, the API endpoint
fixture at `experiments/aider-vs-pl/fixtures/h15-api-endpoint`.

The tested hypothesis was narrow:

- `qwen3-coder:30b` can own a bounded endpoint implementation locally when the
  public Prompt Language flow exposes deterministic gates.
- H15 should not be promoted to a local-only route unless a clean live manifest
  passes the private oracle without frontier input.

## Harness Changes

The original fixture flow and verifier were not sufficient for claim-grade live
evidence:

- `experiments/aider-vs-pl/fixtures/h15-api-endpoint/task.flow` printed the
  export type but did not fail when `patchContact` was missing.
- `experiments/aider-vs-pl/fixtures/h15-api-endpoint/verify.js` required
  `./src/app` relative to the verifier file, so it verified the source fixture
  rather than the mutated harness workspace.

This run group added:

- `experiments/harness-arena/flows/h15-api-endpoint-worker.flow`
- `experiments/harness-arena/oracles/h15-api-endpoint-oracle.mjs`
- `experiments/harness-arena/oracles/h15-api-endpoint-oracle.test.mjs`

The H15 oracle is workspace-aware and checks PATCH behavior, original GET/POST
and DELETE preservation, and at least eight PATCH-related tests. The test-count
rule accepts either named `test(...)` blocks or procedural `patchContact` /
`updateContact` calls because the acceptance criterion is test coverage, not a
specific test helper shape.

## Live Runs

All live runs used:

- runner: `ollama`
- model: `qwen3-coder:30b`
- transport: `PROMPT_LANGUAGE_OLLAMA_TRANSPORT=powershell`
- endpoint label: `ollama-powershell-stdin`
- output root: `/tmp/prompt-language-harness-arena`
- fixture: `experiments/aider-vs-pl/fixtures/h15-api-endpoint`

### Fixture Flow Smoke

Run:
`HA-HR1-H15-api-endpoint-qwen-coder-powershell-r16-smoke-20260508T092800Z`

Result:

- Step exit: `0`
- Private oracle: `FAIL`
- Oracle score under the original fixture verifier: `1/10`
- Root cause: the fixture verifier executed against the source fixture, not the
  mutated workspace.
- Workspace inspection showed the local model did implement and export
  `patchContact`, but accepted `company: ''` as valid.

Decision: do not use the fixture flow or verifier for routing claims.

### Gated r16 Smoke

Run:
`HA-HR1-H15-api-endpoint-qwen-coder-gated-powershell-r16-smoke-20260508T093309Z`

Result:

- Step exit: `3`
- Private oracle: `FAIL`
- Wall time: `410.781s`
- Model turns: `16`
- Tokens: `64,165`
- Resource samples: `179/179`
- Failure mode: action-round exhaustion plus semantic misses.

Private oracle failures:

- `company: null` returned `400`
- `bad@domain` returned `200`
- `company: ''` returned `200`
- DELETE behavior drifted from `204/null` to `200`

Decision: do not promote H15 at r16.

### Gated r24 Development Run

Run:
`HA-HR1-H15-api-endpoint-qwen-coder-gated-powershell-r24-smoke-20260508T094124Z`

Result as executed:

- Step exit: `1`
- Private oracle before test-count correction: `FAIL`
- Wall time: `818.804s`
- Model turns: `27`
- Tokens: `82,830`
- Resource samples: `357/357`

After correcting the test-count rule to accept procedural PATCH checks, the
same workspace passed the H15 oracle manually at `14/14`.

Decision: this is useful harness-development evidence, but not a clean promoted
cell because the manifest did not record a passing step and oracle at execution
time.

### Gated r24 Final Run

Run:
`HA-HR1-H15-api-endpoint-qwen-coder-gated-powershell-r24-final-001-20260508T095655Z`

Result:

- Step exit: `1`
- Private oracle: `FAIL`
- Oracle score: `11/14`
- Wall time: `951.937s`
- Model turns: `32`
- Tokens: `101,190`
- Resource samples: `412/412`
- Timeout: `false`
- Harness failure: `false`
- Model failure: `true`

Private oracle failures:

- Missing original `contacts` export
- DELETE behavior changed from `204/null` to `200/{}`
- `company: ''` returned `200`

Decision: H15 is not promoted for local-only ownership under
`qwen3-coder:30b`.

## Routing Decision

Do not mark the local-model strategy as a failure overall. Mark this as a
negative promotion result for one route:

- H14 full TDD is promoted for `qwen3-coder:30b` under the existing H14 route.
- H15 endpoint work is not promoted for local-only ownership yet.
- H15 can produce near-complete implementations, but the local loop is unstable,
  slow, and prone to API-surface drift.

Recommended H15 policy:

- Use local only for a bounded first attempt if wall time is acceptable.
- Escalate after the first public-gate failure involving validation semantics or
  existing API preservation.
- Treat r16 failure as a local route stop.
- Treat r24 as exploratory only until it passes at least `3/3` clean manifests.

## Developer Takeaway

In engineering terms: the local model can write most of the code, but it is not
yet reliable enough to own this endpoint task without review. The cost saving is
not automatic because the failed r24 run spent almost 16 minutes and about 101k
tokens, then still needed a frontier-level decision. The useful next design is a
hybrid route: local drafts the endpoint, deterministic gates catch obvious
misses, and frontier repair/review handles validation edge cases and API
preservation.
