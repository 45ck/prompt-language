<!-- cspell:ignore subrole subroles -->

# HA-HR1 H14 Live Evidence

Date: 2026-05-08

## Summary

The first task-shaped HA-HR1 runs used the H14 TDD red-green fixture through the
WSL-reachable Windows Ollama endpoint and Codex as the frontier runner.

Result so far:

- local `qwen3:8b` fails H14 local-only and advisor-only;
- frontier-only Codex passes;
- failure-aware hybrid can pass, but is frontier-repair dominated;
- local `qwen3-coder:30b` is materially stronger than `qwen3:8b`, but has not
  produced a clean local-only H14 lane pass yet.

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
