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

1. Add a task-specific private oracle for the first HA-HR1 fixture instead of the
   connectivity-only smoke oracle.
2. Add budgeted frontier command templates and run frontier-only/advisor-only arms.
3. Run the hybrid-router arm only after local-only and frontier-only baselines are
   archived with schema-valid manifests.

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
