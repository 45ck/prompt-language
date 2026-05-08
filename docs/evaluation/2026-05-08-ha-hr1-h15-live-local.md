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

### Validation-Only Local Screen

Run: `HA-HR1-H15-validation-only-qwen-coder-002`

Result:

- Repo commit: `e6686b9`
- Route: `--h15-qwen-coder-task validation-only`
- Step exit: `0`
- Public gate: `PASS`
- Public tests: `14/14`
- Private oracle: `PASS`, `8/8`
- Wall time: `143.995s`
- Model turns: `8`
- Tokens: `24,660`
- Resource samples: `62`
- Frontier calls: `0`

An earlier validation-only attempt exposed a flow bug rather than a model result:
the `#` character in a one-line flow command truncated the invalid phone test
value as a DSL comment marker. Commit `e6686b9` replaced that command fixture
value in the H15 flows, and the rerun above passed with the fixed route.

Decision: promote the H15 validation-only route as positive local-screen
evidence for `qwen3-coder:30b`. This does not promote full H15 endpoint
ownership; it proves the local model can handle the narrower validation
hardening micro-flow when the route contract is clean.

Run: `HA-HR1-H15-validation-only-qwen-coder-003`

Result:

- Route: `--h15-qwen-coder-task validation-only`
- Step exit: `3`
- Wall time: `540.429s`
- Model calls: `20`
- Tokens: `75,598`
- Resource samples: `232`
- Private oracle: `FAIL`, `7/8`
- Frontier calls: `0`

The Prompt Language runner stopped after the Ollama action-round limit (`20`).
The private oracle still ran against the workspace and found that short-name
validation returned an error status without the expected error body.

Decision: keep validation-only as `local-screen`, not promoted. The earlier clean
pass remains useful evidence, but run `003` shows the route is still unstable and
too expensive to own without another gate/flow revision.

Run: `HA-HR1-H15-validation-only-devstral-small-2-001`

Result:

- Model: `devstral-small-2:24b`
- Route: generic local-only H15 validation model screen
- Step exit: `3`
- Wall time: `263.631s`
- Model calls: `5`
- Tokens: `16,906`
- Resource samples: `117`
- Private oracle: `FAIL`, `6/8`
- Frontier calls: `0`

This run used the same H15 validation-only worker flow and private oracle, but
was launched as a generic model screen rather than the checked-in qwen3-coder
route profile. It completed without timeout or Ollama resource failure and stayed
resident as `devstral-small-2:24b` on GPU, but the Prompt Language runner
reported no observable workspace progress. The private oracle found that short
name validation still returned `200`, and `src/test.js` contained only one
validation-focused PATCH test.

Decision: do not promote `devstral-small-2:24b` for H15 validation ownership.
This is useful negative screen evidence because the failure was model/task
behavior, not host capacity.

Run: `HA-HR1-H15-validation-only-qwen3-opencode-001`

Result:

- Model: `qwen3-opencode:30b`
- Route: generic local-only H15 validation model screen
- Step exit: `3`
- Wall time: `949.854s`
- Model calls: `2`
- Tokens: `4,925`
- Resource samples: `412`
- Private oracle: `FAIL`, `6/8`
- Frontier calls: `0`

This run also used the H15 validation-only worker flow and private oracle as a
generic model screen. It stayed resident as `qwen3-opencode:30b` with a split
CPU/GPU load, but the Prompt Language runner ended during gate evaluation with
`PLR-007` after the Ollama PowerShell bridge timed out. The private oracle still
ran against the workspace and found the same no-progress result as the devstral
screen: short name validation still returned `200`, and `src/test.js` contained
only one validation-focused PATCH test.

Decision: do not promote `qwen3-opencode:30b` for H15 validation ownership. On
this route/runtime, it was slower than devstral and did not produce useful
workspace progress before the bridge timeout.

### PATCH Test-Authoring Local Screen

Run: `HA-HR1-H15-patch-test-authoring-qwen-coder-002`

Result:

- Repo commit: `50d98eb`
- Route: `--h15-qwen-coder-task test-authoring`
- Step exit: failed with `PLR-007`
- Failure reason: `Ollama runner exceeded the action round limit (12)`
- Private oracle: `FAIL`, `2/4`
- Frontier calls: `0`

Private oracle failures:

- missing required case: email without `@`
- public tests failed at `12/13`
- the partial-preservation test reused a shared contact after another PATCH test
  had already changed its company to `null`

Decision: do not promote PATCH test-authoring yet. This is a useful route
failure, not a local-model strategy failure. The next route revision should
surface exact missing-case labels in the public structural gate and explicitly
tell the local worker to use fresh contacts for PATCH tests that could mutate
shared fixture state.

Run: `HA-HR1-H15-patch-test-authoring-qwen-coder-003`

Result:

- Repo commit: `fc3108b`
- Route: `--h15-qwen-coder-task test-authoring`
- Step exit: failed with `PLR-007`
- Failure reason: `Ollama runner exceeded the action round limit (16)`
- Wall time: `580.995s`
- Private oracle: `FAIL`, `2/4`
- Frontier calls: `0`

The route revision improved the first attempt: the model added missing ID,
both email cases, `company: ''`, `company: null`, and the literal
`phone: '123456'` case after labeled feedback. It then regressed the test
harness by replacing the original `test(...)` blocks with custom functions and
assuming app functions returned raw contacts or threw validation exceptions.
The implementation actually returns `{ status, body }` response objects.

Decision: leave PATCH test-authoring at `0/2`. The next route revision should
make the response-object contract and test harness preservation explicit. Do
not count this as H15 local-screen success.

Run: `HA-HR1-H15-patch-test-authoring-qwen-coder-004`

Result:

- Repo commit: `8d5fdaa`
- Route: `--h15-qwen-coder-task test-authoring`
- Step exit: `0`
- Wall time: `385.343s`
- Private oracle: `PASS`, `4/4`
- Frontier calls: `0`

The route revision from `8d5fdaa` made the response-object contract and
test-harness preservation explicit. The local model still needed structural
repair turns, but it eventually produced executable PATCH tests that preserved
`src/app.js`, passed public tests, and killed the private PATCH validation
mutants.

Decision: count this as the first positive PATCH test-authoring local-screen
pass for `qwen3-coder:30b`. Keep the route as a screen, not a full H15 endpoint
promotion, until it has more clean passes.

Run: `HA-HR1-H15-patch-test-authoring-qwen-coder-005`

Result:

- Route: `--h15-qwen-coder-task test-authoring`
- Step exit: `0`
- Wall time: `108.354s`
- Private oracle: `FAIL`, `3/4`
- Frontier calls: `0`

The public flow completed and the generated tests looked structurally strong,
but the private oracle caught a real test-quality gap: the partial-update
preservation test compared against `getContact(1).body`, a live object reference
that `patchContact` mutates. That allowed the private mutant that overwrites
unrelated fields to survive.

Decision: keep PATCH test-authoring at one clean pass. The next route revision
must require primitive snapshots, such as `originalEmail`, `originalPhone`, and
`originalCompany`, before calling `patchContact`.

Run: `HA-HR1-H15-patch-test-authoring-qwen-coder-006`

Result:

- Route: `--h15-qwen-coder-task test-authoring`
- Step exit: `3`
- Wall time: `699.870s`
- Private oracle: `FAIL`, `3/4`
- Frontier calls: `0`

The primitive-snapshot issue was fixed in the generated partial-update test, but
the route still failed repeatability. The model rewrote the existing
`deleteContact` test to call `deleteContact(1)`, then the existing valid PATCH
test tried to update contact `1` and failed public tests. The flow hit the
16-action-round limit before repairing that shared-fixture ordering bug.

Decision: keep PATCH test-authoring at one clean pass. The next route revision
must structurally reject `deleteContact(1)` and require the delete test to create
and delete its own contact.

Run: `HA-HR1-H15-patch-test-authoring-qwen-coder-007`

Result:

- Route: `--h15-qwen-coder-task test-authoring`
- Step exit: `0`
- Wall time: `254.420s`
- Private oracle: `PASS`, `4/4`
- Frontier calls: `0`

The shared-fixture delete guard prevented the run `006` failure mode. The local
model preserved `src/app.js`, kept the original harness structure, passed public
tests, and killed the private PATCH validation mutants.

Decision: count this as the second positive PATCH test-authoring local-screen
pass for `qwen3-coder:30b`. Keep it screen-only: the route is now `2/6`, with
clear value but still poor repeatability and high latency.

Run: `HA-HR1-H15-patch-test-authoring-qwen-coder-008`

Result:

- Route: `--h15-qwen-coder-task test-authoring`
- Step exit: `0`
- Wall time: `154.862s`
- Private oracle: `PASS`, `4/4`
- Frontier calls: `0`

This run repeated the post-guard success and completed faster than `007`. The
generated tests preserved `src/app.js`, avoided deleting shared fixture id `1`,
passed public tests, and killed the private PATCH validation mutants.

Decision: count this as the third positive PATCH test-authoring local-screen
pass for `qwen3-coder:30b`. This promotes the micro-flow as useful local-screen
coverage, but not full H15 endpoint ownership because the route reached `3/7`
only after several prompt/gate hardening failures.

Run: `HA-HR1-H15-patch-test-authoring-qwen-coder-009`

Result:

- Route: `--h15-qwen-coder-task test-authoring`
- Step exit: `0`
- Wall time: `98.723s`
- Model calls: `7`
- Tokens: `20,910`
- Resource samples: `43`
- Private oracle: `PASS`, `4/4`
- Frontier calls: `0`

The post-guard success repeated for a third consecutive run. The generated tests
preserved `src/app.js`, kept the response-object test harness intact, passed
public tests at `15/15`, and killed the private PATCH validation mutants.

Decision: promote the PATCH test-authoring micro-flow to local ownership for
`qwen3-coder:30b`. The route is now `4/8` overall and `3/3` after the
shared-fixture delete guard. This is still tests-only H15 support; full H15
endpoint implementation remains frontier-baseline.

## Routing Decision

Do not mark the local-model strategy as a failure overall. Mark this as a
negative promotion result for one route:

- H14 full TDD is promoted for `qwen3-coder:30b` under the existing H14 route.
- H15 endpoint work is not promoted for local-only ownership yet.
- H15 validation-only work has one clean local-screen pass and one failed repeat;
  it is not promoted.
- `devstral-small-2:24b` and `qwen3-opencode:30b` also failed the H15
  validation-only screen, so the next H15 local attempt should change the route
  contract or runtime, not rerun these fallback models unchanged.
- H15 PATCH test-authoring is promoted as a tests-only local route after three
  consecutive clean post-guard passes; it is not full H15 endpoint ownership.
- H15 can produce near-complete implementations, but the local loop is unstable,
  slow, and prone to API-surface drift.

Executable routing policy:

- Standalone resolver:
  `node experiments/harness-arena/h15-qwen3-coder-routing-policy.mjs api-endpoint --json`
- Harness runner profile:
  `node experiments/harness-arena/runner.mjs --h15-qwen-coder-task api-endpoint`

Recommended H15 policy:

- Use frontier-only as the current full-task baseline.
- Use the checked-in `--h15-qwen-coder-task validation-only` route as the first
  promoted local-screen diagnostic before any future full H15 local or hybrid
  retry.
- Treat r16 failure as a local route stop.
- Treat r24 as exploratory only until it passes at least `3/3` clean manifests.
- Do not repeat the full local/hybrid lane on the same hardware unless runtime
  settings, model selection, or the task contract changes.

## Developer Takeaway

In engineering terms: the local model can write most of the code, but it is not
yet reliable enough to own this endpoint task without review. The cost saving is
not automatic because the failed r24 run spent almost 16 minutes and about 101k
tokens, then still needed a frontier-level decision. After the later hybrid and
frontier baselines, the useful next local design is not another full endpoint
attempt. It is a smaller micro-flow that isolates validation rules, PATCH test
coverage, or one public-gate repair loop before H15 gets another local or hybrid
full-task run.
