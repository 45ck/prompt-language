# HA-HR1 Live Pilot Plan

Date: 2026-05-08
Status: structure checks pass; native Ollama smoke passes only when a Windows
Ollama server is exposed to WSL on a non-localhost endpoint

## Goal

Test whether a small frontier coordinator can spend fewer frontier calls by
delegating bounded bulk work to local models while Prompt Language keeps
verification, routing decisions, oracle isolation, and evidence capture
authoritative.

In plain engineering terms:

- Codex/frontier models act like a lead engineer for classification, stuck-state
  repair, and final review.
- Local models act like slow but dollar-cheap junior workers for explicit,
  checkable tasks.
- Prompt Language owns the work queue, gates, retries, stop conditions, and run
  manifest.

## Claim Boundary

This pilot may support a hybrid-routing claim only if every arm writes complete
manifests and keeps hidden oracle material outside model-visible context.

Allowed claims:

- local models can be useful for bounded, public-gate work;
- Prompt Language can make local work safer through decomposition, gates, retry,
  and manifests;
- a hybrid router can reduce frontier calls if it matches local-only quality and
  uses fewer frontier calls than frontier-only.

Disallowed claims:

- local models are autonomous senior engineers;
- local-only full-stack implementation is proven;
- dry-run or fake-live harness output is model-performance evidence;
- a local-only run is still local-only after frontier advice or frontier code
  enters the workspace.

## Arms

| Arm             | Purpose                             | Provider policy                                      |
| --------------- | ----------------------------------- | ---------------------------------------------------- |
| `local-only`    | Local baseline under PL supervision | Local model only; no frontier input                  |
| `frontier-only` | Quality/cost control                | Frontier model performs reasoning and edits          |
| `advisor-only`  | Tests whether advice alone helps    | Frontier plans/reviews; local model performs edits   |
| `hybrid-router` | Treatment                           | Local by default; frontier only on recorded triggers |

## First Fixtures

Use one fixture first, then scale only after manifest and leak checks pass.

| Priority | Fixture/task shape       | Why first                                                        |
| -------- | ------------------------ | ---------------------------------------------------------------- |
| 1        | H14 TDD red-green        | Exposes local over-staging and repair quality without huge scope |
| 2        | H15 API endpoint         | Prior evidence shows local PL can win on this shape              |
| 3        | H11 multi-file refactor  | Tests cross-file limits, no-edit, and timeout classification     |
| 4        | Tiny FSCRUD domain slice | Tests one narrow executable behavior, not full-stack autonomy    |

## Routing Policy

Default to local work for:

- file inventory and summaries;
- repetitive edits with owned paths;
- boilerplate and docs from settled design;
- public-check repair where the failure names the assertion;
- low-risk test or fixture updates.

Escalate to frontier work for:

- architecture, security, auth, migration, data-loss, or permission risk;
- high ambiguity or conflicting evidence;
- the second failure of the same local gate;
- local timeout, no-edit, malformed tool/action output, or export-surface
  collapse;
- final read-only review of high-risk diffs.

## Live Readiness Gates

Run these before any live local/frontier model claim:

```sh
ollama --version
ollama list
ollama ps
curl -sS --max-time 2 http://127.0.0.1:11434/api/tags
npm run harness:conformance
node experiments/harness-arena/runner.mjs --dry-run --run-id HA-HR1-structure-001 --output-root .tmp/harness-arena
node experiments/harness-arena/runner.mjs --fake-live --run-id HA-HR1-fake-live-001 --output-root .tmp/harness-arena
```

Only after the HTTP readiness check passes:

```sh
EVAL_MODEL=ollama/qwen3:8b node scripts/eval/smoke-test.mjs --harness ollama --quick --only E
```

## Current Local Preflight

Observed on 2026-05-08:

| Check                      | Result  | Note                                                            |
| -------------------------- | ------- | --------------------------------------------------------------- |
| `ollama --version`         | pass    | `0.20.5`                                                        |
| `ollama ps`                | pass    | CLI responds; no model resident                                 |
| Ollama HTTP `/api/tags`    | blocked | `127.0.0.1:11434` refused connection                            |
| HA-HR1 dry-run structure   | pass    | All four arm workspaces and manifests materialized under `.tmp` |
| HA-HR1 fake-live structure | pass    | Deterministic shell/oracle plumbing materialized under `.tmp`   |

Interpretation: the harness structure is ready for the next implementation
increment, but live local-model evidence is blocked until the Ollama API endpoint
used by the native runner is reachable.

Follow-up on 2026-05-08:

| Check                                      | Result | Note                                                                 |
| ------------------------------------------ | ------ | -------------------------------------------------------------------- |
| Windows `127.0.0.1:11434` via PowerShell   | pass   | Windows Ollama API returns `{"version":"0.20.5"}`                    |
| WSL `127.0.0.1:11434` via `curl`           | fail   | Connection refused                                                   |
| Temporary Windows `0.0.0.0:11435` from WSL | pass   | WSL gateway endpoint returns `{"version":"0.20.5"}`                  |
| Ollama smoke `--only E` with `qwen3:8b`    | pass   | `1/1` smoke case passed through `prompt-language ci --runner ollama` |

The working local-runner pattern for this host is:

```sh
HOST=$(ip route | awk '/default/ {print $3}')
PROMPT_LANGUAGE_OLLAMA_BASE_URL="http://$HOST:11435" \
  EVAL_MODEL=ollama/qwen3:8b \
  node scripts/eval/smoke-test.mjs --harness ollama --quick --only E
```

The temporary Windows Ollama server used for that smoke was stopped after the
run. Do not treat this as HA-HR1 live evidence; it proves native Ollama runner
connectivity for one small smoke case only.

## Evidence Contract

Every live arm must retain:

- `hybrid-routing-manifest.json`;
- raw runner stdout/stderr artifacts;
- exact runner, requested model, actual model, provider class, endpoint, cwd,
  timeout, exit code, wall time, and route trigger;
- prompt-program or flow identity;
- frontier call count and pricing basis;
- local GPU active seconds or an explicit unavailable value;
- final diff patch;
- public test/verifier output;
- private oracle stdout/stderr outside the model-visible workspace;
- leak-audit status.

Provider fallback must either be disabled for claim runs or recorded as a
substitution that invalidates strict model identity for that lane.

## Acceptance Criteria

The pilot is worth scaling only if:

- every arm has a schema-valid manifest;
- the hybrid-router arm uses fewer frontier calls than frontier-only;
- the hybrid-router arm matches or beats local-only oracle score;
- local-only arms receive no frontier advice, patches, or hidden oracle content;
- failures are classified as model, route-policy, harness, oracle-leak, budget, or
  senior-behavior failures.

## Next Implementation Increment

1. Use the runner budget flags (`--frontier-call-limit`, `--usd-limit`,
   `--wall-seconds-limit`, `--local-repair-attempt-limit`, and `--retry-policy`)
   on every new claim-bearing live run.
2. Treat `qwen3-coder:30b` as the promoted local route only for checked H14 full
   TDD and checked H11 multi-file refactor. Do not infer broad local ownership.
3. For H15, keep full endpoint work on the frontier-only baseline until a narrower
   local micro-flow changes the evidence.
4. Make H15 PATCH test-authoring the next local route-hardening target. The
   useful failures are now narrow enough to fix with public gate labels and
   fresh-fixture guidance.
5. Run any H15 hybrid retry with an explicit frontier-call cap:
   `--frontier-call-limit 2` for classifier plus review only, or
   `--frontier-call-limit 3` when one repair is intentionally allowed. Dynamic
   repair insertion is budget-aware, so a capped run can now prove it did not
   spend an extra hidden frontier call.
6. Run the hybrid-router arm only after the relevant local-only and frontier-only
   baselines are archived with schema-valid manifests.

## Latest Live Evidence

On 2026-05-08, the first local-only live lane passed through the WSL-reachable
Windows Ollama endpoint using `qwen3:8b`. The resulting manifest is:

```text
.tmp/harness-arena/HA-HR1-live-local-ollama-002/01-local-only/hybrid-routing-manifest.json
```

It records `claimStatus: live-model-evidence`, local Ollama metadata, step exit code
`0`, step wall time `7.316s`, and `oracle.passed: true`. Treat this as
connectivity-level local model evidence, not full HA-HR1 routing evidence.

The first task-shaped H14 local-only runs are:

```text
.tmp/harness-arena/HA-HR1-H14-local-ollama-001/01-local-only/hybrid-routing-manifest.json
.tmp/harness-arena/HA-HR1-H14-local-ollama-002/01-local-only/hybrid-routing-manifest.json
```

`001` used the generic local-bulk flow and exposed a harness-flow weakness: the
local model wrote `local-worker-summary.md` without editing `src/contacts.js` or
`src/test.js`, so the private oracle failed. `002` used the H14 public-gated flow;
the runner correctly blocked completion as unsuccessful after `282.942s`, and the
private oracle failed because the local model replaced the fixture with a shallow
`mergeContacts` helper and comment-only tests. This is useful local-only failure
evidence, not a harness failure.

The first H14 frontier-only baseline is:

```text
.tmp/harness-arena/HA-HR1-H14-frontier-codex-001/01-frontier-only/hybrid-routing-manifest.json
```

Codex completed the same public-gated H14 flow in `210.182s`, and the private
oracle passed `6/6`.

The first H14 advisor-only run is:

```text
.tmp/harness-arena/HA-HR1-H14-advisor-codex-ollama-001/01-advisor-only/hybrid-routing-manifest.json
```

The frontier advice step passed in `89.671s`, but the local apply step failed the
public gates after `291.338s`; the private oracle failed `2/6`. For this fixture,
frontier advice alone did not rescue local `qwen3:8b`.

The first static H14 hybrid-router run is:

```text
.tmp/harness-arena/HA-HR1-H14-hybrid-codex-ollama-001/01-hybrid-router/hybrid-routing-manifest.json
```

Frontier classify passed in `51.287s`, local bulk failed the public gates after
`290.396s`, frontier review passed in `67.755s`, and the private oracle failed
`2/6`. The frontier review correctly identified the missing implementation/export
and missing executable tests, but the static hybrid arm did not include a frontier
repair step, so it could only diagnose the failed local work.

Decision: do not scale the static H14 hybrid shape. The next useful increment is a
failure-aware hybrid arm that escalates from local public-gate failure to bounded
frontier repair before the private oracle.

Follow-up failure-aware hybrid runs:

```text
.tmp/harness-arena/HA-HR1-H14-hybrid-repair-codex-ollama-001/01-hybrid-router/hybrid-routing-manifest.json
.tmp/harness-arena/HA-HR1-H14-hybrid-repair-codex-ollama-002/01-hybrid-router/hybrid-routing-manifest.json
.tmp/harness-arena/HA-HR1-H14-hybrid-repair-codex-ollama-003/01-hybrid-router/hybrid-routing-manifest.json
```

`001` inserted frontier repair and reached public-test success, but hidden oracle
failed `5/6` because the repair dropped the original `createContact` export. `002`
kept export names but changed original positional APIs; hidden oracle again failed
`5/6`. `003` used a public gate hardened for original API compatibility. The local
step failed with an Ollama runtime connection error, frontier repair passed, final
review passed, and the private oracle passed `6/6`.

Decision: H14 failure-aware hybrid can recover, but it used three frontier calls
versus one frontier call for the passing frontier-only baseline. For H14-like TDD
implementation, local `qwen3:8b` is not a cost-saving bulk worker under this policy.
