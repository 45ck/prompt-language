# HA-HR1 Live Pilot Plan

Date: 2026-05-08
Status: ready for structure checks; blocked on Ollama HTTP API readiness before
live local-model evidence

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

1. Extend the manifest/schema or runbook with missing claim-grade fields:
   requested/actual model, endpoint, pricing basis, prompt-program identity,
   provider-substitution status, data classification, and explicit budget
   enforcement.
2. Add tests that reject missing claim-grade fields for live-mode manifests while
   preserving dry-run/fake-live compatibility.
3. Add a live preflight command that fails fast when the Ollama HTTP API is not
   reachable.
4. Only then wire the first live local lane for a small fixture.
