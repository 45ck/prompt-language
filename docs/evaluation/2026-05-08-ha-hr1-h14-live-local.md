<!-- cspell:ignore stdin subrole subroles wsarecv -->

# HA-HR1 H14 Live Evidence

Date: 2026-05-08

## Summary

The first task-shaped HA-HR1 runs used the H14 TDD red-green fixture through the
WSL-reachable Windows Ollama endpoint and Codex as the frontier runner.

Result so far:

- local `qwen3:8b` fails H14 local-only and advisor-only;
- frontier-only Codex passes;
- failure-aware hybrid can pass, but is frontier-repair dominated;
- local `qwen3-coder:30b` is materially stronger than `qwen3:8b` and now has
  clean local-only H14 passes for implementation-from-tests, API preservation,
  standalone test authoring, and full H14 TDD under the hardened PowerShell
  stdin transport;
- `devstral-small-2:24b` is now a promoted full-H14 fallback after three clean
  full-lane passes under the same hardened route. One additional pass is recorded
  as functionally positive but residency-contaminated and is not counted in the
  clean `3/3` set.

## Runs

### `HA-HR1-H14-local-ollama-001`

The generic local-bulk flow allowed premature completion because
`local-worker-summary.md` was the only completion gate. The model wrote a summary
after inventory and did not edit `src/contacts.js` or `src/test.js`.

Outcome:

- step exit code: `0`
- step wall time: `43.496s`
- private oracle: failed
- classification: model failure

Oracle result:

```text
Results: 2/6 passed
```

### `HA-HR1-H14-local-ollama-002`

The H14-specific local flow added public gates for `mergeDuplicates` structure and
`npm test`. This prevented the false pass. The local runner exited unsuccessful
after the gates stayed red.

Outcome:

- step exit code: `1`
- step wall time: `282.942s`
- private oracle: failed
- classification: model failure

The model replaced the fixture with a shallow `mergeContacts` helper and
comment-only tests while claiming the implementation and tests were complete. The
public gates rejected the run before the private oracle result was considered a
pass.

Representative runner outcome:

```json
{
  "status": "unsuccessful",
  "reason": "Completion gates failed: h14_public_contract. Fix the failing checks before completing the task. Last assistant output: Summary written with file changes and test status."
}
```

Oracle result:

```text
Results: 2/6 passed
```

## Interpretation

This supports the routing hypothesis that local `qwen3:8b` is useful for cheap
connectivity and narrow smoke work, but it should not be trusted for H14 TDD
implementation without stronger decomposition, smaller edit steps, or escalation.
The H14 public-gated flow is a better harness than the generic local-bulk flow
because it turns false completion into explicit model failure evidence.

### `HA-HR1-H14-frontier-codex-001`

The frontier-only baseline used the same H14 public-gated flow with Codex.

Outcome:

- step exit code: `0`
- step wall time: `210.182s`
- private oracle: passed
- classification: pass

Oracle result:

```text
Results: 6/6 passed
```

The run implemented `mergeDuplicates`, exported it, added five public
merge/duplicate tests, and passed the hidden behavior checks.

### `HA-HR1-H14-advisor-codex-ollama-001`

The advisor-only run executed frontier advice first, then asked local `qwen3:8b`
to apply the H14 public-gated flow.

Outcome:

- frontier-advice exit code: `0`
- frontier-advice wall time: `89.671s`
- local-apply exit code: `1`
- local-apply wall time: `291.338s`
- private oracle: failed
- classification: model failure

Representative local-apply outcome:

```json
{
  "status": "unsuccessful",
  "reason": "Completion gates failed: h14_public_contract. Fix the failing checks before completing the task. Last assistant output: Summary written with file changes and test status."
}
```

Oracle result:

```text
Results: 2/6 passed
```

Interpretation: frontier advice alone did not rescue this local model on H14. The
local lane still replaced the fixture with a shallow helper and comment-only tests.
For this fixture, successful completion required frontier execution, not just
frontier review/advice.

### `HA-HR1-H14-hybrid-codex-ollama-001`

The hybrid-router run executed frontier classify, local bulk, and frontier review.

Outcome:

- frontier-classify exit code: `0`
- frontier-classify wall time: `51.287s`
- local-bulk exit code: `1`
- local-bulk wall time: `290.396s`
- frontier-review exit code: `0`
- frontier-review wall time: `67.755s`
- private oracle: failed
- classification: model failure

Representative local-bulk outcome:

```json
{
  "status": "unsuccessful",
  "reason": "Completion gates failed: h14_public_contract. Fix the failing checks before completing the task. Last assistant output: Summary written with file changes and test status."
}
```

Oracle result:

```text
Results: 2/6 passed
```

The frontier review correctly diagnosed the incomplete local output: no
`mergeDuplicates` implementation, no export, and no executable merge tests. The
static hybrid-router shape still failed because review happened after the failed
local implementation and did not include a frontier repair step.

## Decision

For H14, the current static hybrid shape is not worth scaling. The evidence says:

- local-only `qwen3:8b` fails this TDD implementation fixture;
- frontier advice followed by local apply also fails;
- frontier-only passes;
- hybrid classify/local/review detects the failure but does not repair it.

The next useful increment is not more repetitions of the same static hybrid arm.
It is a failure-aware hybrid arm that escalates from local failure to a bounded
frontier repair step, then re-runs the private oracle.

### `HA-HR1-H14-hybrid-repair-codex-ollama-001`

The first failure-aware hybrid run inserted `frontier-repair` after local public
gate failure.

Outcome:

- frontier-classify exit code: `0`
- local-bulk exit code: `1`
- frontier-repair exit code: `0`
- frontier-review exit code: `0`
- private oracle: failed

Oracle result:

```text
Results: 5/6 passed
```

The repair step restored `mergeDuplicates` and public tests but dropped the
existing `createContact` export. This exposed a gap in the public H14 gate.

### `HA-HR1-H14-hybrid-repair-codex-ollama-002`

After the public gate was hardened to require original export names, the second
failure-aware hybrid run still failed hidden behavior.

Outcome:

- frontier-classify wall time: `90.645s`
- local-bulk timed out: `900.104s`
- frontier-repair wall time: `206.776s`
- frontier-review wall time: `91.048s`
- private oracle: failed

Oracle result:

```text
Results: 5/6 passed
```

The repair preserved export names but changed the original positional APIs. This
exposed a second public-gate gap: export names alone were not enough.

### `HA-HR1-H14-hybrid-repair-codex-ollama-003`

After the public gate was hardened again to exercise original positional APIs, the
third failure-aware hybrid run passed.

Outcome:

- frontier-classify wall time: `168.576s`
- local-bulk exit code: `3`
- local-bulk wall time: `129.746s`
- frontier-repair wall time: `175.595s`
- frontier-review wall time: `161.263s`
- private oracle: passed

Oracle result:

```text
Results: 6/6 passed
```

The local step failed with an Ollama runtime connection error, not a successful
local implementation. The inserted frontier repair completed the task and the
private oracle passed.

## H14 Routing Result

For H14, failure-aware hybrid can recover from local failure, but the current policy
does not beat the frontier-only baseline on frontier-call count:

- frontier-only passed with one frontier call;
- static hybrid failed;
- failure-aware hybrid passed with three frontier calls plus a failed local call.

This means H14 is a bad candidate for cost-saving local delegation with `qwen3:8b`.
The useful policy is to classify H14-like TDD implementation as frontier-owned, or
to use local only for narrower substeps with stronger public gates and a strict
early-failure cutoff.

## Qwen3-Coder Follow-Up

After the readiness smoke promoted `qwen3-coder:30b`, two local-only H14 runs were
executed through the same WSL-reachable Windows Ollama endpoint at
`http://172.17.32.1:11435`.

### `HA-HR1-H14-local-qwen3-coder-001`

This run used commit `bf205d7` and the H14 public-gated local flow before the flow
was hardened for the summary artifact.

Outcome:

- step exit code: `1`
- step wall time: `798.365s`
- private oracle: passed
- classification: product pass with artifact-completion failure
- provider telemetry: 10 Ollama records, 27,898 input tokens, 3,638 output
  tokens, 31,536 total tokens, zero provider API cost, no retries
- residency snapshot during the run: 19,014,187,008 bytes loaded,
  15,775,507,456 bytes VRAM, 4,096 context

The model implemented `mergeDuplicates`, exported it, preserved original APIs,
added executable merge/duplicate tests, passed public tests, and passed the hidden
oracle:

```text
Results: 6/6 passed
```

The lane still exited unsuccessful because `local-worker-summary.md` was missing:

```json
{
  "status": "unsuccessful",
  "reason": "Completion gates failed: file_exists local-worker-summary.md. Fix the failing checks before completing the task."
}
```

This is stronger than the `qwen3:8b` local-only evidence, but it is not a clean
local-only lane pass because the model did not satisfy the artifact completion
contract.

The run also exposed a flow weakness: the second `until command_succeeded` loop
skipped `npm test` because the previous structural gate had already set
`command_succeeded=true`. The final completion gate still ran `npm test`, so the
oracle pass is valid, but the flow shape was weaker than intended.

### Flow Hardening

Commit `758259d` hardened `experiments/harness-arena/flows/h14-local-bulk-worker.flow`
before the second replicate:

- replaced the two public-check `until command_succeeded` loops with `retry`
  blocks so the checks run at least once;
- clarified that `local-worker-summary.md` should be written only after public
  checks pass;
- added a bounded summary-file repair loop before the final completion gates.

### `HA-HR1-H14-local-qwen3-coder-002`

This run used commit `758259d` and the hardened flow.

Outcome:

- step timed out at `900.102s`
- private oracle: failed
- classification: model failure plus budget timeout
- provider telemetry: 17 Ollama records, 57,464 input tokens, 3,622 output
  tokens, 61,086 total tokens, zero provider API cost, no retries
- residency snapshot remained in the same 19 GB loaded / 15.8 GB VRAM envelope

Oracle result:

```text
Results: 5/6 passed
```

The model implemented and exported `mergeDuplicates`, and hidden behavior checks
passed, but `npm test` failed because `src/test.js` added merge tests without
importing `mergeDuplicates`:

```text
FAIL: public tests pass -- npm-equivalent test failed:
Results: 4/9 passed
VERDICT: FAIL (5 failed)
```

### Qwen3-Coder Decision

`qwen3-coder:30b` should not be marked as failed in the same sense as
`qwen3:8b`. It reached correct hidden H14 behavior once, which is a meaningful
capability signal. It also failed to produce a clean claim-grade local-only lane
across two attempts, which is a reliability and cost signal.

Current policy:

- do not claim `qwen3-coder:30b` is H14-capable local-only;
- promote it to narrower H14-derived subrole fixtures, especially
  implementation-from-tests and API-preservation;
- keep full H14 local-only behind a 3/3 clean-pass requirement;
- keep H14-like end-to-end TDD frontier-owned unless local subrole evidence
  improves.

## H14-Derived Subrole Results

### `HA-HR1-H14-S2-local-qwen3-coder-001`

The first narrower subrole fixture was `h14-impl-from-tests`. This fixture removes
the test-authoring burden: public merge tests already exist, and the local model
owns the implementation in `src/contacts.js` plus the required summary artifact.

The run used commit `b1689ab`, local `qwen3-coder:30b`, and the same
WSL-reachable Windows Ollama endpoint at `http://172.17.32.1:11435`.

Outcome:

- step exit code: `0`
- step wall time: `263.364s`
- private oracle: passed
- classification: clean local-only subrole pass
- provider telemetry: 6 Ollama records, 14,636 input tokens, 1,405 output tokens,
  16,041 total tokens, zero provider API cost, no retries
- residency snapshot during/after the run: 19,014,187,008 bytes loaded,
  3,457,613,824 bytes VRAM, 4,096 context

The Prompt Language lane completed normally:

```json
{
  "status": "ok",
  "outcomes": [
    {
      "code": "PLO-005",
      "summary": "Flow completed."
    }
  ]
}
```

The private oracle passed all checks:

```text
PASS: mergeDuplicates implementation exists
PASS: mergeDuplicates is exported
PASS: tests import and call mergeDuplicates
PASS: at least five merge/duplicate tests exist
PASS: public tests pass
PASS: hidden behavior checks pass

Results: 6/6 passed
```

Decision: `qwen3-coder:30b` has now earned a positive local lane for the
implementation-from-tests subrole. This supports the routing policy of assigning
bounded, public-gated implementation work to the local model. It does not overturn
the full-H14 decision because full TDD ownership still lacks a clean pass and has
shown timeout/artifact reliability problems.

### `HA-HR1-H14-S2-local-qwen3-coder-002`

The second implementation-from-tests replicate used the same fixture, flow, model,
endpoint, and private oracle.

Outcome:

- step exit code: `0`
- step wall time: `171.346s`
- private oracle: passed
- provider telemetry: 7 Ollama records, 19,114 input tokens, 1,607 output tokens,
  20,721 total tokens, zero provider API cost, no retries
- residency snapshot: 19,014,187,008 bytes loaded, 3,457,613,824 bytes VRAM,
  4,096 context

Oracle result:

```text
Results: 6/6 passed
```

### `HA-HR1-H14-S2-local-qwen3-coder-003`

The third implementation-from-tests replicate also passed.

Outcome:

- step exit code: `0`
- step wall time: `151.732s`
- private oracle: passed
- provider telemetry: 7 Ollama records, 19,114 input tokens, 1,607 output tokens,
  20,721 total tokens, zero provider API cost, no retries
- residency snapshot: 19,014,187,008 bytes loaded, 3,457,613,824 bytes VRAM,
  4,096 context

Oracle result:

```text
Results: 6/6 passed
```

### S2 Decision

`qwen3-coder:30b` is now `3/3` on the H14 implementation-from-tests subrole:

| Run   | Exit | Oracle | Wall time | Tokens |
| ----- | ---: | ------ | --------: | -----: |
| `001` |    0 | 6/6    |  263.364s | 16,041 |
| `002` |    0 | 6/6    |  171.346s | 20,721 |
| `003` |    0 | 6/6    |  151.732s | 20,721 |

Decision: promote `qwen3-coder:30b` for bounded implementation-from-tests work.
Do not promote it to full H14 local-only yet. The next required subrole is API
preservation under a separate fixture or an equivalent repeatable gate, because
full H14 failures showed artifact, timeout, and public-test reliability risks.

### `HA-HR1-H14-impl-from-tests-routed-qwen-coder-001`

After commit `ff4f4d9` wired the checked-in H14 qwen-coder policy into the
HA-HR1 runner, the implementation-from-tests subrole was re-run through the route
profile:

```sh
node experiments/harness-arena/runner.mjs \
  --live \
  --h14-qwen-coder-subrole implementation-from-tests \
  --live-local-command '<ollama prompt-language command>' \
  --local-endpoint http://172.17.32.1:11435 \
  --run-id HA-HR1-H14-impl-from-tests-routed-qwen-coder-001 \
  --output-root .tmp/harness-arena
```

The profile selected `local-only`, the `h14-impl-from-tests` fixture, the H14
TDD oracle, policy version `h14-qwen3-coder-subrole-routing-v1`, and the
`h14-impl-from-tests-worker.flow` prompt program.

Outcome:

- step exit code: `0`
- step wall time: `239.808s`
- private oracle: passed
- provider telemetry: 6 Ollama records, 14,636 input tokens, 1,405 output tokens,
  16,041 total tokens, zero provider API cost, no retries
- route trigger:
  `h14-qwen3-coder:h14-implementation-from-tests:local-promoted`

Oracle result:

```text
PASS: mergeDuplicates implementation exists
PASS: mergeDuplicates is exported
PASS: tests import and call mergeDuplicates
PASS: at least five merge/duplicate tests exist
PASS: public tests pass
PASS: hidden behavior checks pass

Results: 6/6 passed
```

Decision: the runner integration is live-valid for the promoted
implementation-from-tests subrole. Together with the routed API-preservation pass,
both locally promoted H14 qwen-coder routes have now been exercised through the
runner profile rather than only through manual fixture/oracle wiring.

## H14 API-Preservation Subrole Results

The second narrower subrole fixture is `h14-api-preservation`. This fixture keeps
the test-authoring burden out of the local lane, but makes API safety explicit:
the worker must fix `mergeDuplicates` while preserving CommonJS export names,
function argument counts, create/find/add/remove behavior, non-mutating behavior,
and the required summary artifact.

The fixture starts red:

- `npm test` initially passes `7/9` public tests;
- `h14-api-preservation-oracle.mjs` initially passes `3/5` checks because public
  merge behavior and hidden merge behavior fail.

Commit `5a40477` added the fixture, flow, oracle, and oracle tests.

### `HA-HR1-H14-S3-local-qwen3-coder-001`

The first API-preservation run used local `qwen3-coder:30b` and the same
WSL-reachable Windows Ollama endpoint at `http://172.17.32.1:11435`.

Outcome:

- step exit code: `0`
- step wall time: `459.860s`
- private oracle: passed
- provider telemetry: 6 Ollama records, 14,412 input tokens, 1,270 output tokens,
  15,682 total tokens, zero provider API cost, no retries
- residency snapshot during/after the run: 19,014,187,008 bytes loaded,
  2,693,683,200 bytes VRAM, 4,096 context
- repo state: run used commit `89f0082` with the uncommitted S3 fixture present

Oracle result:

```text
PASS: source keeps expected export names
PASS: public tests keep API contract coverage
PASS: public tests pass
PASS: hidden API checks pass
PASS: hidden merge checks pass

Results: 5/5 passed
```

### `HA-HR1-H14-S3-local-qwen3-coder-002`

The second API-preservation replicate used clean commit `5a40477`.

Outcome:

- step exit code: `0`
- step wall time: `122.002s`
- private oracle: passed
- provider telemetry: 6 Ollama records, 13,913 input tokens, 1,247 output tokens,
  15,160 total tokens, zero provider API cost, no retries
- residency snapshot: 19,014,187,008 bytes loaded, 2,693,683,200 bytes VRAM,
  4,096 context

Oracle result:

```text
Results: 5/5 passed
```

### `HA-HR1-H14-S3-local-qwen3-coder-003`

The third API-preservation replicate also used clean commit `5a40477`.

Outcome:

- step exit code: `0`
- step wall time: `119.855s`
- private oracle: passed
- provider telemetry: 6 Ollama records, 13,913 input tokens, 1,247 output tokens,
  15,160 total tokens, zero provider API cost, no retries
- residency snapshot: 19,014,187,008 bytes loaded, 2,693,683,200 bytes VRAM,
  4,096 context

Oracle result:

```text
Results: 5/5 passed
```

### S3 Decision

`qwen3-coder:30b` is now `3/3` on the H14 API-preservation subrole:

| Run   | Exit | Oracle | Wall time | Tokens |
| ----- | ---: | ------ | --------: | -----: |
| `001` |    0 | 5/5    |  459.860s | 15,682 |
| `002` |    0 | 5/5    |  122.002s | 15,160 |
| `003` |    0 | 5/5    |  119.855s | 15,160 |

Decision: promote `qwen3-coder:30b` for bounded API-preserving implementation
work when public tests already exist and completion gates are explicit. This
strengthens the local-bulk-worker policy for narrow implementation subroles, but
still does not promote the model for full H14 local-only ownership. Full H14 still
requires the model to author tests, preserve APIs, satisfy artifact contracts, and
finish within budget in the same lane.

### `HA-HR1-H14-api-preservation-routed-qwen-coder-001`

After commit `ff4f4d9` wired the checked-in H14 qwen-coder policy into the
HA-HR1 runner, the API-preservation subrole was re-run through the route profile:

```sh
node experiments/harness-arena/runner.mjs \
  --live \
  --h14-qwen-coder-subrole api-preservation \
  --live-local-command '<ollama prompt-language command>' \
  --local-endpoint http://172.17.32.1:11435 \
  --run-id HA-HR1-H14-api-preservation-routed-qwen-coder-001 \
  --output-root .tmp/harness-arena
```

The profile selected `local-only`, the `h14-api-preservation` fixture, the
API-preservation oracle, policy version
`h14-qwen3-coder-subrole-routing-v1`, and the
`h14-api-preservation-worker.flow` prompt program.

Outcome:

- step exit code: `0`
- step wall time: `183.645s`
- private oracle: passed
- provider telemetry: 6 Ollama records, 13,913 input tokens, 1,228 output tokens,
  15,141 total tokens, zero provider API cost, no retries
- route trigger:
  `h14-qwen3-coder:h14-api-preserving-implementation:local-promoted`

Oracle result:

```text
PASS: source keeps expected export names
PASS: public tests keep API contract coverage
PASS: public tests pass
PASS: hidden API checks pass
PASS: hidden merge checks pass

Results: 5/5 passed
```

Decision: the runner integration is live-valid for the promoted API-preservation
subrole. This is not a new broader capability claim; it proves the routing profile
can execute the already-promoted local subrole and preserve claim-grade manifest
metadata without manually restating fixture and oracle paths.

### `HA-HR1-H14-api-preservation-h14flow-qwen-coder-001`

After commit `bd475c1` required H14 route-profile commands to reference the routed
flow, the API-preservation route was run with the `<h14Flow>` placeholder instead
of a manually repeated flow path.

Outcome:

- step exit code: `3`
- step wall time: `3.635s`
- private oracle: failed against the unchanged red fixture
- placeholder expansion: passed; the recorded command contains the absolute
  `h14-api-preservation-worker.flow` path selected by the policy
- runtime result: blocked before useful inference

Runner output:

```text
Prompt runner exited with code 1. Ollama runner failed: model requires more system memory (16.3 GiB) than is available (15.5 GiB)
```

Decision: this is not a `qwen3-coder:30b` model-quality failure and does not
change the promoted API-preservation route. It is a local-runtime resource block
that proved the `<h14Flow>` placeholder expands through the live command path.
The follow-up harness patch classifies this resource-failure shape as
`harnessFailure: true`, `modelFailure: false`, and `resourceFailure: true`.

## H14 Test-Authoring Subrole Results

The third narrower subrole fixture is `h14-test-authoring`. This fixture keeps the
implementation correct and asks the local worker to edit `src/test.js` only:

- import `mergeDuplicates`;
- preserve the existing create/find/add/remove tests;
- add at least five executable merge/duplicate tests;
- leave `src/contacts.js` unchanged.

The private oracle checks more than public pass/fail. It verifies that
`src/contacts.js` is unchanged, that the tests import and call `mergeDuplicates`,
that public tests pass, and that the authored tests reject three broken
implementations: returning original contacts, keeping only first duplicate values,
and erasing older values with empty later values.

Commit `dfc35cf` added the fixture, flow, oracle, and oracle tests.

### `HA-HR1-H14-S4-local-qwen3-coder-001`

The first test-authoring run used local `qwen3-coder:30b`, the WSL-reachable
Windows Ollama endpoint at `http://172.17.32.1:11435`, and the same local action
round budget used by the earlier subrole runs.

Outcome:

- step timed out at `900.023s`
- private oracle: failed
- provider telemetry: 4 Ollama records, 10,696 input tokens, 1,795 output tokens,
  12,491 total tokens, zero provider API cost, no retries
- classification: model failure plus budget timeout
- run config: `PROMPT_LANGUAGE_OLLAMA_ACTION_ROUNDS=24`

Oracle result:

```text
PASS: contacts implementation remains unchanged
PASS: tests import and exercise mergeDuplicates
FAIL: public tests pass -- npm-equivalent test failed:
Results: 8/9 passed
VERDICT: FAIL (1 failed)
FAIL: mergeDuplicates older non-empty fallback -- name priority: expected "Alice A", got "Alice"
PASS: tests reject broken merge implementations

Results: 3/4 passed
```

The model authored executable tests, but one test encoded the wrong semantics:
it expected an older non-empty `name` to survive even when a later duplicate had
a non-empty `name`. The public test gate rejected the suite.

### `HA-HR1-H14-S4-local-qwen3-coder-002`

The second run used the same fixture and oracle, but tightened the local action
round budget to reduce runaway first-prompt behavior.

Outcome:

- step exit code: `0`
- step wall time: `376.896s`
- private oracle: passed
- provider telemetry: 8 Ollama records, 21,184 input tokens, 2,491 output tokens,
  23,675 total tokens, zero provider API cost, no retries
- run config: `PROMPT_LANGUAGE_OLLAMA_ACTION_ROUNDS=8`

Oracle result:

```text
PASS: contacts implementation remains unchanged
PASS: tests import and exercise mergeDuplicates
PASS: public tests pass
PASS: tests reject broken merge implementations

Results: 4/4 passed
```

### `HA-HR1-H14-S4-local-qwen3-coder-003`

The third run repeated the tightened local action round budget.

Outcome:

- step exit code: `3`
- step wall time: `579.069s`
- private oracle: failed
- provider telemetry: 8 Ollama records, 23,865 input tokens, 4,038 output tokens,
  27,903 total tokens, zero provider API cost, no retries
- run config: `PROMPT_LANGUAGE_OLLAMA_ACTION_ROUNDS=8`

Oracle result:

```text
FAIL: contacts implementation remains unchanged -- src/contacts.js changed; this subrole is tests-only
FAIL: tests import and exercise mergeDuplicates -- existing test removed: removeContact removes by email
FAIL: public tests pass -- npm-equivalent test failed:
Results: 7/10 passed
VERDICT: FAIL (3 failed)
PASS: tests reject broken merge implementations

Results: 1/4 passed
```

The model violated the tests-only ownership contract and still produced wrong
merge expectations.

### S4 Decision

`qwen3-coder:30b` is `1/3` on the H14 test-authoring subrole:

| Run   |    Exit | Oracle | Wall time | Tokens | Action rounds |
| ----- | ------: | ------ | --------: | -----: | ------------: |
| `001` | timeout | 3/4    |  900.023s | 12,491 |            24 |
| `002` |       0 | 4/4    |  376.896s | 23,675 |             8 |
| `003` |       3 | 1/4    |  579.069s | 27,903 |             8 |

Decision: do not promote `qwen3-coder:30b` for standalone test authoring on this
fixture. The model can pass once under a tighter action budget, but the replicate
set is not stable enough for local-bulk routing. H14-like test authoring should
remain frontier-owned or be replaced by deterministic test templates plus local
implementation work.

## Sampled Promoted-Subrole Refresh

After the HA-HR1 runner added `resourceSnapshotSummary`, both locally promoted
H14 qwen-coder subroles were rerun through the route profile with sampled
`/api/ps` probes. The temporary Windows Ollama listener was exposed to WSL at
`http://172.17.32.1:11435` with `OLLAMA_CONTEXT_LENGTH=8192`,
`OLLAMA_NUM_PARALLEL=1`, and `OLLAMA_FLASH_ATTENTION=1`.

Before the runs, stale Windows `ollama.exe runner` processes were terminated and
`ollama ps` was empty. After cleanup, Windows free memory was about 30.6 GiB.

### `HA-HR1-H14-impl-from-tests-qwen-coder-sampled-001`

Command shape:

```sh
PROMPT_LANGUAGE_OLLAMA_BASE_URL="$ENDPOINT" \
node experiments/harness-arena/runner.mjs \
  --live \
  --h14-qwen-coder-subrole implementation-from-tests \
  --live-local-command "bash -lc 'PROMPT_LANGUAGE_OLLAMA_BASE_URL=$ENDPOINT PROMPT_LANGUAGE_OLLAMA_TIMEOUT_MS=900000 PROMPT_LANGUAGE_OLLAMA_ACTION_ROUNDS=24 node $(pwd)/bin/cli.mjs run --runner ollama --model qwen3-coder:30b --json --file <h14Flow>'" \
  --local-resource-snapshot-command "bash -lc 'curl -sS --max-time 2 <localEndpoint>/api/ps'" \
  --local-resource-snapshot-interval-ms 2000 \
  --local-endpoint "$ENDPOINT" \
  --step-timeout-ms 900000 \
  --oracle-timeout-ms 10000 \
  --run-id HA-HR1-H14-impl-from-tests-qwen-coder-sampled-001 \
  --output-root .tmp/harness-arena
```

Outcome:

- manifest:
  `.tmp/harness-arena/HA-HR1-H14-impl-from-tests-qwen-coder-sampled-001/01-local-only/hybrid-routing-manifest.json`
- claim status: `live-model-evidence`
- route trigger: `h14-qwen3-coder:h14-implementation-from-tests:local-promoted`
- prompt program:
  `experiments/harness-arena/flows/h14-impl-from-tests-worker.flow`
- model: `qwen3-coder:30b`
- endpoint: `http://172.17.32.1:11435`
- step exit code: `0`
- step wall time: `88.499s`
- private oracle: passed `6/6`
- `resourceSnapshotSummary`: 44 sampled ticks, 138 total resource artifact refs,
  zero probe failures
- residency: all 44 sampled `/api/ps` stdout artifacts contained
  `qwen3-coder:30b`

Oracle result:

```text
PASS: mergeDuplicates implementation exists
PASS: mergeDuplicates is exported
PASS: tests import and call mergeDuplicates
PASS: at least five merge/duplicate tests exist
PASS: public tests pass
PASS: hidden behavior checks pass

Results: 6/6 passed
```

Representative residency sample:

```json
{
  "name": "qwen3-coder:30b",
  "model": "qwen3-coder:30b",
  "size": 19215513600,
  "digest": "06c1097efce0431c2045fe7b2e5108366e43bee1b4603a7aded8f21689e90bca",
  "details": {
    "family": "qwen3moe",
    "parameter_size": "30.5B",
    "quantization_level": "Q4_K_M"
  },
  "size_vram": 15585304576,
  "context_length": 8192
}
```

### `HA-HR1-H14-api-preservation-qwen-coder-sampled-001`

Command shape:

```sh
PROMPT_LANGUAGE_OLLAMA_BASE_URL="$ENDPOINT" \
node experiments/harness-arena/runner.mjs \
  --live \
  --h14-qwen-coder-subrole api-preservation \
  --live-local-command "bash -lc 'PROMPT_LANGUAGE_OLLAMA_BASE_URL=$ENDPOINT PROMPT_LANGUAGE_OLLAMA_TIMEOUT_MS=900000 PROMPT_LANGUAGE_OLLAMA_ACTION_ROUNDS=24 node $(pwd)/bin/cli.mjs run --runner ollama --model qwen3-coder:30b --json --file <h14Flow>'" \
  --local-resource-snapshot-command "bash -lc 'curl -sS --max-time 2 <localEndpoint>/api/ps'" \
  --local-resource-snapshot-interval-ms 2000 \
  --local-endpoint "$ENDPOINT" \
  --step-timeout-ms 900000 \
  --oracle-timeout-ms 10000 \
  --run-id HA-HR1-H14-api-preservation-qwen-coder-sampled-001 \
  --output-root .tmp/harness-arena
```

Outcome:

- manifest:
  `.tmp/harness-arena/HA-HR1-H14-api-preservation-qwen-coder-sampled-001/01-local-only/hybrid-routing-manifest.json`
- claim status: `live-model-evidence`
- route trigger:
  `h14-qwen3-coder:h14-api-preserving-implementation:local-promoted`
- prompt program:
  `experiments/harness-arena/flows/h14-api-preservation-worker.flow`
- model: `qwen3-coder:30b`
- endpoint: `http://172.17.32.1:11435`
- step exit code: `0`
- step wall time: `90.552s`
- private oracle: passed `5/5`
- `resourceSnapshotSummary`: 45 sampled ticks, 141 total resource artifact refs,
  zero probe failures
- residency: all 45 sampled `/api/ps` stdout artifacts contained
  `qwen3-coder:30b`

Oracle result:

```text
PASS: source keeps expected export names
PASS: public tests keep API contract coverage
PASS: public tests pass
PASS: hidden API checks pass
PASS: hidden merge checks pass

Results: 5/5 passed
```

### Refresh Decision

The refreshed sampled runs strengthen the existing routing policy for
`qwen3-coder:30b`: implementation-from-tests and API-preservation remain
local-promoted subroles, now with direct model-residency evidence in every sample
tick. This still does not promote full H14 local-only or test authoring. Full H14
and standalone test-authoring remain frontier-owned or hybrid-repair candidates
until their replicate evidence reaches the same bar.

## Devstral Small 2 Subrole Screen

After `devstral-small-2:24b` passed the Prompt Language readiness smoke with
sampled `/api/ps` residency, it was screened on the same two H14 implementation
subroles. These runs used the generic HA-HR1 `local-only` arm with explicit H14
fixtures and private oracles, not the checked-in qwen-coder route profile.

The temporary Windows Ollama listener was exposed to WSL at
`http://172.17.32.1:11435` with `OLLAMA_CONTEXT_LENGTH=8192`,
`OLLAMA_NUM_PARALLEL=1`, and `OLLAMA_FLASH_ATTENTION=1`. The model card reported
by `/api/ps` during the runs was:

```json
{
  "name": "devstral-small-2:24b",
  "model": "devstral-small-2:24b",
  "size": 16696905744,
  "digest": "24277f07f62db8f9cb68e9dfc679ea1818a7fbac47a50eff0a701d3f645b63c8",
  "details": {
    "family": "mistral3",
    "parameter_size": "24.0B",
    "quantization_level": "Q4_K_M"
  },
  "size_vram": 14912782352,
  "context_length": 8192
}
```

### Implementation From Tests

The implementation-from-tests screen used:

- fixture: `experiments/harness-arena/fixtures/h14-impl-from-tests`
- flow: `experiments/harness-arena/flows/h14-impl-from-tests-worker.flow`
- oracle: `experiments/harness-arena/oracles/h14-tdd-red-green-oracle.mjs`
- policy version: `h14-devstral-subrole-screen-v1`

Command shape:

```sh
node experiments/harness-arena/runner.mjs \
  --live \
  --arms local-only \
  --fixture experiments/harness-arena/fixtures/h14-impl-from-tests \
  --task-id h14-implementation-from-tests-devstral \
  --policy-version h14-devstral-subrole-screen-v1 \
  --live-local-command "bash -lc 'PROMPT_LANGUAGE_OLLAMA_BASE_URL=$ENDPOINT PROMPT_LANGUAGE_OLLAMA_TIMEOUT_MS=900000 PROMPT_LANGUAGE_OLLAMA_ACTION_ROUNDS=24 node $(pwd)/bin/cli.mjs run --runner ollama --model devstral-small-2:24b --json --file $(pwd)/experiments/harness-arena/flows/h14-impl-from-tests-worker.flow'" \
  --local-resource-snapshot-command "bash -lc 'curl -sS --max-time 2 <localEndpoint>/api/ps'" \
  --local-resource-snapshot-interval-ms 2000 \
  --oracle-command "node $(pwd)/experiments/harness-arena/oracles/h14-tdd-red-green-oracle.mjs --workspace <workspace>" \
  --local-model devstral-small-2:24b \
  --local-endpoint "$ENDPOINT" \
  --step-timeout-ms 900000 \
  --oracle-timeout-ms 10000 \
  --output-root .tmp/harness-arena
```

Outcome:

| Run   | Oracle | Step exit | Wall time | Sample ticks | Residency hits |
| ----- | ------ | --------: | --------: | -----------: | -------------: |
| `001` | 6/6    |         0 |   94.528s |           47 |             47 |
| `002` | 6/6    |         0 |   94.509s |           47 |             47 |
| `003` | 6/6    |         0 |   94.520s |           47 |             47 |

Representative oracle result:

```text
PASS: mergeDuplicates implementation exists
PASS: mergeDuplicates is exported
PASS: tests import and call mergeDuplicates
PASS: at least five merge/duplicate tests exist
PASS: public tests pass
PASS: hidden behavior checks pass

Results: 6/6 passed
```

### API Preservation

The API-preservation screen used:

- fixture: `experiments/harness-arena/fixtures/h14-api-preservation`
- flow: `experiments/harness-arena/flows/h14-api-preservation-worker.flow`
- oracle: `experiments/harness-arena/oracles/h14-api-preservation-oracle.mjs`
- policy version: `h14-devstral-subrole-screen-v1`

Outcome:

| Run   | Oracle | Step exit | Wall time | Sample ticks | Residency hits |
| ----- | ------ | --------: | --------: | -----------: | -------------: |
| `001` | 5/5    |         0 |  106.689s |           53 |             53 |
| `002` | 5/5    |         0 |  102.592s |           51 |             51 |
| `003` | 5/5    |         0 |  102.574s |           51 |             51 |

Representative oracle result:

```text
PASS: source keeps expected export names
PASS: public tests keep API contract coverage
PASS: public tests pass
PASS: hidden API checks pass
PASS: hidden merge checks pass

Results: 5/5 passed
```

### Devstral Decision

`devstral-small-2:24b` is locally promoted for the same two narrow implementation
subroles as `qwen3-coder:30b`:

- implementation-from-tests: `3/3`
- API-preservation: `3/3`

Every subrole sample tick across all six runs contained the resident
`devstral-small-2:24b` `/api/ps` row, so these are model-residency-backed local
passes rather than endpoint-only smoke evidence.

This does not promote `devstral-small-2:24b` for full H14 local-only or
standalone test authoring. Those remain separate screens with their own replicate
requirements.

## Qwen3.6 27B Subrole Screen

After `qwen3.6:27b` passed the Prompt Language readiness smoke with sampled
`/api/ps` residency, it was screened first on H14 API-preservation as a newer
Qwen general-model control. The temporary Windows Ollama listener was exposed to
WSL at `http://172.17.32.1:11435` with `OLLAMA_CONTEXT_LENGTH=8192`,
`OLLAMA_NUM_PARALLEL=1`, and `OLLAMA_FLASH_ATTENTION=1`.

The model row reported by `/api/ps` was:

```json
{
  "name": "qwen3.6:27b",
  "model": "qwen3.6:27b",
  "size": 23336128416,
  "digest": "a50eda8ed977ab48a12431878896b27ffd5cef552c17af3317d9623b939a7f1e",
  "details": {
    "family": "qwen35",
    "parameter_size": "27.8B",
    "quantization_level": "Q4_K_M"
  },
  "size_vram": 15527374080,
  "context_length": 8192
}
```

The API-preservation screen used:

- fixture: `experiments/harness-arena/fixtures/h14-api-preservation`
- flow: `experiments/harness-arena/flows/h14-api-preservation-worker.flow`
- oracle: `experiments/harness-arena/oracles/h14-api-preservation-oracle.mjs`
- policy version: `h14-qwen3-6-subrole-screen-v1`
- run id: `HA-HR1-H14-api-preservation-qwen3-6-27b-001`

Outcome:

| Run   | Oracle | Step exit | Timed out | Wall time | Sample ticks | Residency hits |
| ----- | ------ | --------: | --------: | --------: | -----------: | -------------: |
| `001` | 3/5    |    `null` |      true |  900.102s |          448 |            448 |

Oracle result:

```text
PASS: source keeps expected export names
PASS: public tests keep API contract coverage
FAIL: public tests pass -- npm-equivalent test failed:

Results: 7/9 passed
VERDICT: FAIL (2 failed)

FAIL: mergeDuplicates later non-empty fields override earlier values -- later name: expected "Alice2", got "Alice"
FAIL: mergeDuplicates preserves unique contacts and group order -- alice phone merged: expected "555", got null

PASS: hidden API checks pass
FAIL: hidden merge checks pass -- mergeDuplicates first group incorrect: expected {"name":"First","email":"first@test.com","phone":"111","company":"NewCo"}, got {"name":"First","email":"first@test.com","phone":"111","company":"OldCo"}

Results: 3/5 passed
```

### Qwen3.6 Decision

`qwen3.6:27b` is not promoted for H14 API-preserving implementation. This is
claim-grade negative evidence because every sampled resource tick contained the
resident `qwen3.6:27b` row, so the failure is not an endpoint or model-residency
failure. The local step consumed the full 900s budget and still failed both
public and hidden merge semantics.

Stop this replicate set at `0/1` under the early cutoff policy. Running two more
900s API-preservation reps is lower value than screening the next installed
coding-tuned candidate. Keep `qwen3.6:27b` as a possible reviewer/classifier
control, not an implementation-owner candidate.

## Qwen3 OpenCode 30B Subrole Screen

After `qwen3-opencode:30b` passed readiness with sampled `/api/ps` residency, it
was screened on the same two narrow H14 implementation subroles as
`qwen3-coder:30b` and `devstral-small-2:24b`. These runs test whether the
coding-tuned OpenCode variant can act as a bounded local implementer when public
tests already exist and when existing public APIs must be preserved.

The temporary Windows Ollama listener was exposed to WSL at
`http://172.17.32.1:11435` with `OLLAMA_CONTEXT_LENGTH=8192`,
`OLLAMA_NUM_PARALLEL=1`, and `OLLAMA_FLASH_ATTENTION=1`. The model row reported
by `/api/ps` was:

```json
{
  "name": "qwen3-opencode:30b",
  "model": "qwen3-opencode:30b",
  "size": 19215513600,
  "digest": "f92f0cf2e8676d8dceb9e1b48b90d6ecc833307e8e72a4dd2a9599810a253010",
  "details": {
    "family": "qwen3moe",
    "parameter_size": "30.5B",
    "quantization_level": "Q4_K_M"
  },
  "size_vram": 15585304576,
  "context_length": 8192
}
```

The implementation-from-tests screen used:

- fixture: `experiments/harness-arena/fixtures/h14-impl-from-tests`
- flow: `experiments/harness-arena/flows/h14-impl-from-tests-worker.flow`
- oracle: `experiments/harness-arena/oracles/h14-tdd-red-green-oracle.mjs`
- policy version: `h14-qwen3-opencode-subrole-screen-v1`

Outcome:

| Run   | Oracle | Step exit | Wall time | Sample ticks | Residency hits |
| ----- | ------ | --------: | --------: | -----------: | -------------: |
| `001` | 6/6    |         0 |  354.030s |          176 |            176 |
| `002` | 6/6    |         0 |  444.608s |          221 |            221 |
| `003` | 6/6    |         0 |  444.640s |          221 |            221 |

Representative oracle result:

```text
PASS: mergeDuplicates implementation exists
PASS: mergeDuplicates is exported
PASS: tests import and call mergeDuplicates
PASS: at least five merge/duplicate tests exist
PASS: public tests pass
PASS: hidden behavior checks pass

Results: 6/6 passed
```

### API Preservation

The API-preservation screen used:

- fixture: `experiments/harness-arena/fixtures/h14-api-preservation`
- flow: `experiments/harness-arena/flows/h14-api-preservation-worker.flow`
- oracle: `experiments/harness-arena/oracles/h14-api-preservation-oracle.mjs`
- policy version: `h14-qwen3-opencode-subrole-screen-v1`

Outcome:

| Run   | Oracle | Step exit | Wall time | Sample ticks | Residency hits |
| ----- | ------ | --------: | --------: | -----------: | -------------: |
| `001` | 5/5    |         0 |  392.278s |          195 |            193 |
| `002` | 5/5    |         0 |  358.213s |          178 |            178 |
| `003` | 5/5    |         0 |  347.989s |          173 |            173 |

Representative oracle result:

```text
PASS: source keeps expected export names
PASS: public tests keep API contract coverage
PASS: public tests pass
PASS: hidden API checks pass
PASS: hidden merge checks pass

Results: 5/5 passed
```

### Qwen3 OpenCode Decision

`qwen3-opencode:30b` is locally promoted for the same two narrow implementation
subroles as `qwen3-coder:30b` and `devstral-small-2:24b`:

- implementation-from-tests: `3/3`
- API-preservation: `3/3`

The implementation screen had resident `qwen3-opencode:30b` evidence in every
sample tick. The API-preservation screen had resident model evidence in 544 of
546 sample ticks. These are model-residency-backed local passes rather than
endpoint-only smoke evidence.

This promotion is lower priority than the existing `devstral-small-2:24b` and
`qwen3-coder:30b` routes because it is much slower on the same fixtures. It is
not promoted for standalone test authoring or full H14 local-only until those
separate screens pass.

## H14 Local Portfolio PowerShell Bridge Smoke

### `HA-HR1-H14-api-preservation-powershell-20260508T072016Z`

After commits `c436bbc` and `77698ad` added the
`PROMPT_LANGUAGE_OLLAMA_TRANSPORT=powershell` bridge, the H14 local portfolio
route was run through the Windows-local Ollama API from WSL:

```sh
node experiments/harness-arena/runner.mjs \
  --live \
  --h14-local-subrole api-preservation \
  --live-local-command "bash -lc 'PROMPT_LANGUAGE_OLLAMA_TRANSPORT=powershell PROMPT_LANGUAGE_OLLAMA_TIMEOUT_MS=900000 PROMPT_LANGUAGE_OLLAMA_ACTION_ROUNDS=24 node $(pwd)/bin/cli.mjs run --runner ollama --model qwen3-coder:30b --json --file <h14Flow>'" \
  --oracle-command "node $(pwd)/experiments/harness-arena/oracles/h14-api-preservation-oracle.mjs --workspace <workspace>" \
  --local-resource-snapshot-command "ollama ps" \
  --local-resource-snapshot-interval-ms 2000 \
  --local-endpoint "ollama-powershell" \
  --run-id HA-HR1-H14-api-preservation-powershell-20260508T072016Z \
  --output-root .tmp/harness-arena
```

Outcome:

- route profile: `h14-local-portfolio`
- route trigger:
  `h14-local-portfolio:h14-api-preserving-implementation:local-promoted`
- policy version: `h14-local-subrole-routing-v1`
- selected model: `qwen3-coder:30b`
- transport telemetry: `metadata.transport=powershell`
- step exit code: `0`
- step wall time: `61.77s`
- timeout: `false`
- private oracle: passed
- oracle result: `5/5`
- provider substitution: `false`
- provider retries: `0` on all five Ollama turns
- provider telemetry totals: `11,911` tokens across five turns
- resource samples: `29/29` non-empty `ollama ps` samples

Oracle result:

```text
PASS: source keeps expected export names
PASS: public tests keep API contract coverage
PASS: public tests pass
PASS: hidden API checks pass
PASS: hidden merge checks pass

Results: 5/5 passed
```

Decision: this validates the new PowerShell bridge as a real WSL-to-Windows
Ollama transport for the H14 local portfolio route, not just a direct model
smoke. It does not change the model promotion matrix: `qwen3-coder:30b` remains
promoted for H14 implementation-from-tests and API-preserving implementation,
while full H14 local-only and standalone test authoring remain not promoted at
this point in the sequence.

### PowerShell Bridge Repeatability Band

The same H14 local portfolio `api-preservation` route was repeated three more
times to check whether the bridge-backed local promotion was stable rather than
a one-off smoke pass. The runs used the same live lane command, private oracle,
`qwen3-coder:30b` model, `ollama-powershell` endpoint, and 24 action-round
budget.

| Run id                                                               | Oracle | Step exit | Timeout | Wall time | Turns | Tokens | Retries | Samples |
| -------------------------------------------------------------------- | ------ | --------- | ------- | --------- | ----- | ------ | ------- | ------- |
| `HA-HR1-H14-api-preservation-powershell-repeat-001-20260508T072905Z` | 5/5    | 0         | false   | 61.406s   | 5     | 11,911 | 0       | 29/29   |
| `HA-HR1-H14-api-preservation-powershell-repeat-002-20260508T073008Z` | 5/5    | 0         | false   | 55.317s   | 6     | 15,497 | 0       | 26/26   |
| `HA-HR1-H14-api-preservation-powershell-repeat-003-20260508T073106Z` | 5/5    | 0         | false   | 55.015s   | 6     | 15,497 | 0       | 26/26   |

Aggregate:

- oracle pass rate: `3/3`
- total Ollama turns: `17`
- total provider tokens: `42,905`
- average step wall time: `57.246s`
- route trigger:
  `h14-local-portfolio:h14-api-preserving-implementation:local-promoted`
- provider substitution: `false` in all runs
- transport telemetry: `metadata.transport=powershell` in all provider records
- resource sample failures: `0`

Decision: this is enough to treat the PowerShell bridge as stable for the narrow
H14 API-preserving implementation lane on this workstation. It is not evidence
for promoting standalone test authoring, full H14 local-only, or larger
multi-file implementation work to local-only execution.

## H14 Test-Authoring PowerShell Screens

### Pre-Clarification PowerShell Screen

The non-promoted `h14-test-authoring` subrole was screened through the
PowerShell bridge with `qwen3-coder:30b`, the existing `h14-test-authoring`
flow, 8 action rounds, and the private test-authoring oracle. The run was
launched as an explicit `local-only` screen, not through the production
`--h14-local-subrole` route, because the checked-in policy still routed this
subrole to frontier or deterministic ownership.

| Run id                                                             | Oracle | Step exit | Timeout | Wall time | Turns | Tokens | Retries | Samples |
| ------------------------------------------------------------------ | ------ | --------- | ------- | --------- | ----- | ------ | ------- | ------- |
| `HA-HR1-H14-test-authoring-powershell-screen-001-20260508T073939Z` | 3/4    | 3         | false   | 141.463s  | 7     | 23,046 | 0       | 66/66   |
| `HA-HR1-H14-test-authoring-powershell-screen-002-20260508T074203Z` | 4/4    | 0         | false   | 109.849s  | 8     | 24,472 | 0       | 52/52   |
| `HA-HR1-H14-test-authoring-powershell-screen-003-20260508T074355Z` | 4/4    | 0         | false   | 107.884s  | 8     | 24,472 | 0       | 51/51   |

Aggregate:

- oracle pass rate: `2/3`
- total Ollama turns: `23`
- total provider tokens: `71,990`
- average step wall time: `119.732s`
- provider substitution: `false` in all runs
- transport telemetry: `metadata.transport=powershell` in all provider records
- resource sample failures: `0`

The failing sample preserved the implementation and exercised
`mergeDuplicates`, but wrote a public test with the older non-empty fallback
semantics reversed:

```text
FAIL: public tests pass -- npm-equivalent test failed:
Results: 8/9 passed
FAIL: mergeDuplicates handles older non-empty fallback -- name from first:
expected "Alice", got "Alice A"

Results: 3/4 passed
```

Decision: the PowerShell bridge improved the local test-authoring lane relative
to the earlier S4 `1/3` band, but `2/3` is still below the promotion threshold.
The failure was a prompt-control issue, not a transport, timeout, or resource
failure.

### Clarified Test-Authoring Screen

Commit `3292364` clarified the `h14-test-authoring-worker.flow` prompt with two
public-task examples:

- later non-empty duplicate values replace earlier non-empty values;
- later empty strings do not erase earlier non-empty values.

The fixture, private oracle, model, PowerShell transport, 8 action-round budget,
and tests-only ownership contract stayed the same.

| Run id                                                                | Oracle | Step exit | Timeout | Wall time | Turns | Tokens | Retries | Samples |
| --------------------------------------------------------------------- | ------ | --------- | ------- | --------- | ----- | ------ | ------- | ------- |
| `HA-HR1-H14-test-authoring-powershell-clarified-001-20260508T074939Z` | 4/4    | 0         | false   | 106.228s  | 8     | 25,289 | 0       | 50/50   |
| `HA-HR1-H14-test-authoring-powershell-clarified-002-20260508T075128Z` | 4/4    | 0         | false   | 105.779s  | 8     | 25,289 | 0       | 50/50   |
| `HA-HR1-H14-test-authoring-powershell-clarified-003-20260508T075316Z` | 4/4    | 0         | false   | 103.602s  | 8     | 25,289 | 0       | 49/49   |

Aggregate:

- oracle pass rate: `3/3`
- total Ollama turns: `24`
- total provider tokens: `75,867`
- average step wall time: `105.203s`
- provider substitution: `false` in all runs
- transport telemetry: `metadata.transport=powershell` in all provider records
- resource sample failures: `0`

Representative oracle result:

```text
PASS: contacts implementation remains unchanged
PASS: tests import and exercise mergeDuplicates
PASS: public tests pass
PASS: tests reject broken merge implementations

Results: 4/4 passed
```

### Clarified Test-Authoring Decision

Promote `h14-test-authoring` in the H14 local portfolio route only for
`qwen3-coder:30b` with the clarified prompt-language flow and 8 action rounds.
Do not add fallback local models for this subrole yet, because the fallback
portfolio evidence covers implementation subroles, not standalone test
authoring. Keep full H14 TDD ownership not promoted: this screen proves the
isolated test-authoring subrole, not combined red-green ownership.

### Routed Test-Authoring Smoke

After the promotion policy was committed, the route profile itself was smoke
tested with `--h14-local-subrole test-authoring` and the `<h14Flow>` placeholder:

```sh
node experiments/harness-arena/runner.mjs \
  --live \
  --h14-local-subrole test-authoring \
  --live-local-command "bash -lc 'PROMPT_LANGUAGE_OLLAMA_TRANSPORT=powershell PROMPT_LANGUAGE_OLLAMA_TIMEOUT_MS=900000 PROMPT_LANGUAGE_OLLAMA_ACTION_ROUNDS=8 node $(pwd)/bin/cli.mjs run --runner ollama --model qwen3-coder:30b --json --file <h14Flow>'" \
  --oracle-command "node $(pwd)/experiments/harness-arena/oracles/h14-test-authoring-oracle.mjs --workspace <workspace>" \
  --local-resource-snapshot-command "ollama ps" \
  --local-resource-snapshot-interval-ms 2000 \
  --local-endpoint "ollama-powershell" \
  --run-id HA-HR1-H14-test-authoring-routed-powershell-20260508T080008Z \
  --output-root .tmp/harness-arena
```

Outcome:

- route trigger: `h14-local-portfolio:h14-test-authoring:local-promoted`
- policy version: `h14-local-subrole-routing-v1`
- prompt program:
  `experiments/harness-arena/flows/h14-test-authoring-worker.flow`
- selected model: `qwen3-coder:30b`
- transport telemetry: `metadata.transport=powershell`
- step exit code: `0`
- step wall time: `110.671s`
- timeout: `false`
- private oracle: passed
- oracle result: `4/4`
- provider substitution: `false`
- provider retries: `0`
- provider telemetry totals: `25,289` tokens across 8 turns
- resource samples: `52/52` non-empty `ollama ps` samples

Decision: the promoted local-portfolio route now works end to end for
`test-authoring`; this is route smoke on top of the clarified `3/3` screen, not
a full H14 TDD promotion.

## H14 Full TDD PowerShell Stdin Screen

### Pre-Build Stdin Transport Screen

Commit `4d75fc0` changed the Ollama PowerShell bridge to pass the chat payload
over stdin instead of embedding it in the PowerShell `-Command` string. A first
rerun used the source change before rebuilding the ignored `dist/` runtime, so
the live CLI still exercised the old base64 command-line bridge.

Outcome:

- run ids:
  `HA-HR1-H14-full-tdd-powershell-stdin-r16-001-20260508T084114Z`,
  `HA-HR1-H14-full-tdd-powershell-stdin-r16-002-20260508T084330Z`,
  `HA-HR1-H14-full-tdd-powershell-stdin-r16-003-20260508T084546Z`
- oracle pass rate: `0/3`
- failure shape: unchanged `powershell.exe: Invalid argument`
- interpretation: invalid as model-quality evidence because the built CLI had
  not picked up the source transport fix.

### Built Stdin Transport Screen

After `npm run build`, the same full H14 TDD lane was rerun with:

- model: `qwen3-coder:30b`
- flow: `experiments/harness-arena/flows/h14-local-bulk-worker.flow`
- fixture: `experiments/harness-arena/fixtures/h14-tdd-red-green`
- oracle: `experiments/harness-arena/oracles/h14-tdd-red-green-oracle.mjs`
- transport: `PROMPT_LANGUAGE_OLLAMA_TRANSPORT=powershell`
- action-round budget: `16`
- policy version: `h14-full-tdd-local-powershell-stdin-built-r16-v1`

| Run id                                                                | Oracle | Step exit | Timeout | Wall time | Turns | Tokens | Retries | Samples |
| --------------------------------------------------------------------- | ------ | --------- | ------- | --------- | ----- | ------ | ------- | ------- |
| `HA-HR1-H14-full-tdd-powershell-stdin-built-r16-001-20260508T084923Z` | 2/6    | 3         | false   | 170.765s  | 12    | 44,368 | 0       | 74/74   |
| `HA-HR1-H14-full-tdd-powershell-stdin-built-r16-002-20260508T085214Z` | 6/6    | 0         | false   | 158.284s  | 11    | 37,334 | 0       | 68/68   |
| `HA-HR1-H14-full-tdd-powershell-stdin-built-r16-003-20260508T085453Z` | 6/6    | 0         | false   | 128.550s  | 8     | 27,341 | 0       | 56/56   |

Aggregate:

- oracle pass rate: `2/3`
- transport telemetry: `metadata.transport=powershell`
- provider substitution: `false`
- observed transport improvement: no command-line `Invalid argument` failure
- remaining failed-run shape: PowerShell surfaced an Ollama socket reset:
  `wsarecv: An existing connection was forcibly closed by the remote host`

This established that stdin transport fixed the command-line-size failure, but
also exposed a retry-classification gap for Windows-local Ollama socket resets.

### Retry-Hardened Full TDD Screen

Commit `e3e82fe` added the Windows socket reset wording to Ollama transient
retry detection, then the CLI was rebuilt and the same screen was repeated with
policy version `h14-full-tdd-local-powershell-stdin-retry-r16-v1`.

| Run id                                                                | Oracle | Step exit | Timeout | Wall time | Turns | Tokens | Retries | Samples |
| --------------------------------------------------------------------- | ------ | --------- | ------- | --------- | ----- | ------ | ------- | ------- |
| `HA-HR1-H14-full-tdd-powershell-stdin-retry-r16-001-20260508T090234Z` | 6/6    | 0         | false   | 131.436s  | 8     | 27,341 | 0       | 57/57   |
| `HA-HR1-H14-full-tdd-powershell-stdin-retry-r16-002-20260508T090446Z` | 6/6    | 0         | false   | 128.919s  | 8     | 27,341 | 0       | 56/56   |
| `HA-HR1-H14-full-tdd-powershell-stdin-retry-r16-003-20260508T090655Z` | 6/6    | 0         | false   | 132.992s  | 8     | 27,341 | 0       | 57/57   |

Aggregate:

- oracle pass rate: `3/3`
- total Ollama turns: `24`
- total provider tokens: `82,023`
- average step wall time: `131.116s`
- provider substitution: `false`
- transport telemetry: `metadata.transport=powershell`
- provider retries observed: `0`
- resource sample failures: `0`

Representative oracle result:

```text
PASS: mergeDuplicates implementation exists
PASS: mergeDuplicates is exported
PASS: tests import and call mergeDuplicates
PASS: at least five merge/duplicate tests exist
PASS: public tests pass
PASS: hidden behavior checks pass

Results: 6/6 passed
```

### Full TDD Decision

Promote full local H14 TDD for `qwen3-coder:30b` only, using the hardened H14
flow, PowerShell stdin transport, and a 16 action-round budget. Do not add
fallback local models for full TDD yet: the fallback evidence covers narrower
implementation subroles, not combined red-green ownership. Keep frontier repair
as the escalation path on any public-gate, private-oracle, timeout, or transport
failure.

### Routed Full TDD Smoke

After the local portfolio policy was updated, the promoted route was smoke
tested with `--h14-local-subrole full-tdd` and the `<h14Flow>` placeholder:

```sh
node experiments/harness-arena/runner.mjs \
  --live \
  --h14-local-subrole full-tdd \
  --live-local-command "bash -lc 'PROMPT_LANGUAGE_OLLAMA_TRANSPORT=powershell PROMPT_LANGUAGE_OLLAMA_TIMEOUT_MS=900000 PROMPT_LANGUAGE_OLLAMA_ACTION_ROUNDS=16 node $(pwd)/bin/cli.mjs run --runner ollama --model qwen3-coder:30b --json --file <h14Flow>'" \
  --oracle-command "node $(pwd)/experiments/harness-arena/oracles/h14-tdd-red-green-oracle.mjs --workspace <workspace>" \
  --local-resource-snapshot-command 'powershell.exe -NoProfile -Command "ollama ps"' \
  --local-resource-snapshot-interval-ms 2000 \
  --local-endpoint ollama-powershell-stdin \
  --run-id HA-HR1-H14-full-tdd-routed-powershell-stdin-20260508T091237Z \
  --output-root .tmp/harness-arena
```

Outcome:

- route trigger: `h14-local-portfolio:h14-full-tdd:local-promoted`
- policy version: `h14-local-subrole-routing-v1`
- prompt program: `experiments/harness-arena/flows/h14-local-bulk-worker.flow`
- selected model: `qwen3-coder:30b`
- transport telemetry: `metadata.transport=powershell`
- step exit code: `0`
- step wall time: `129.757s`
- timeout: `false`
- private oracle: passed
- oracle result: `6/6`
- provider substitution: `false`
- provider retries: `0`
- provider telemetry totals: `27,341` tokens across 8 turns
- resource samples: `56/56` non-empty `ollama ps` samples

Decision: the promoted local-portfolio route now works end to end for
`full-tdd`. This is route smoke on top of the retry-hardened `3/3` full-lane
screen.

## H14 Full TDD Devstral Fallback Screen

After the full H14 route was promoted for `qwen3-coder:30b`, the next useful
fallback question was whether the smaller installed `devstral-small-2:24b` model
could also own the combined red-green H14 task, not just the narrower
implementation subroles it had already passed.

Command shape:

```sh
node experiments/harness-arena/runner.mjs \
  --live \
  --arms local-only \
  --fixture experiments/harness-arena/fixtures/h14-tdd-red-green \
  --policy-version h14-devstral-full-tdd-screen-r16-v1 \
  --live-local-command "bash -lc 'PROMPT_LANGUAGE_OLLAMA_TRANSPORT=powershell PROMPT_LANGUAGE_OLLAMA_TIMEOUT_MS=900000 PROMPT_LANGUAGE_OLLAMA_ACTION_ROUNDS=16 node $(pwd)/bin/cli.mjs run --runner ollama --model devstral-small-2:24b --json --file $(pwd)/experiments/harness-arena/flows/h14-local-bulk-worker.flow'" \
  --oracle-command "node $(pwd)/experiments/harness-arena/oracles/h14-tdd-red-green-oracle.mjs --workspace <workspace>" \
  --local-resource-snapshot-command 'powershell.exe -NoProfile -Command "ollama ps"' \
  --local-resource-snapshot-interval-ms 2000 \
  --local-model devstral-small-2:24b \
  --local-endpoint ollama-powershell-stdin \
  --step-timeout-ms 1200000 \
  --run-id HA-HR1-H14-full-tdd-devstral-r16-001-20260508T205853Z \
  --output-root .tmp/harness-arena
```

Screen outcome:

- model: `devstral-small-2:24b`
- transport telemetry: `metadata.transport=powershell`
- clean promotion set: runs `001`, `002`, and `004`
- clean private-oracle pass rate: `3/3`, `6/6` in every run
- provider substitution: `false` in all four runs
- counted provider retries: `0` in clean runs `001`, `002`, and `004`
- clean residency evidence: sampled `ollama ps` showed `16 GB`, `100% GPU`, and
  `4096` context for `devstral-small-2:24b`

| Run id                                                  | Oracle | Step exit | Timeout | Wall time | Calls | Tokens | Retries | Samples | Counted |
| ------------------------------------------------------- | ------ | --------- | ------- | --------- | ----- | ------ | ------- | ------- | ------- |
| `HA-HR1-H14-full-tdd-devstral-r16-001-20260508T205853Z` | 6/6    | 0         | false   | 209.762s  | 7     | 19,171 | 0       | 90/90   | yes     |
| `HA-HR1-H14-full-tdd-devstral-r16-002-20260508T211134Z` | 6/6    | 0         | false   | 211.265s  | 7     | 19,171 | 0       | 92/92   | yes     |
| `HA-HR1-H14-full-tdd-devstral-r16-003-20260508T211542Z` | 6/6    | 0         | false   | 473.192s  | 7     | 19,171 | 1       | 203/203 | no      |
| `HA-HR1-H14-full-tdd-devstral-r16-004-20260508T212436Z` | 6/6    | 0         | false   | 210.886s  | 7     | 19,171 | 0       | 92/92   | yes     |

Run `003` is excluded from the clean promotion set because the sampled resource
artifacts captured `qwen3-opencode-big:30b` in a `Stopping...` state for part of
the run, and provider telemetry recorded one retry. It remains a functional
private-oracle pass with `actualModel=devstral-small-2:24b`, but it is not clean
residency evidence.

Private oracle result:

```text
PASS: mergeDuplicates implementation exists
PASS: mergeDuplicates is exported
PASS: tests import and call mergeDuplicates
PASS: at least five merge/duplicate tests exist
PASS: public tests pass
PASS: hidden behavior checks pass

Results: 6/6 passed
```

Decision: promote `devstral-small-2:24b` as the fallback full-H14 local worker
for the same hardened H14 flow, PowerShell stdin transport, and 16 action-round
budget. Keep `qwen3-coder:30b` as the selected first-choice model because it is
faster on the same route. Do not promote Devstral for standalone test authoring
or H15 endpoint ownership from this evidence.
