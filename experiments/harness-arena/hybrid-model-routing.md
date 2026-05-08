# Hybrid Model Routing Experiment

Date: 2026-04-28
Status: active; H14/H15 route policies and runner profiles added 2026-05-08;
H11 local-screen evidence added 2026-05-09
Bead: `prompt-language-sfd3`

## Summary

This experiment tests a dynamic routing policy for Prompt Language runs:

- local models handle cheap bulk work, mechanical edits, repeated test repair, and artifact generation
- Codex/GPT-5.5-class frontier models handle high-ambiguity reasoning, architecture, security, root-cause analysis after repeated failure, and final review
- Prompt Language owns the routing structure, gates, escalation thresholds, and evidence trail

The point is not an "advisor" that only writes suggestions. The router must be able to change which runner/model does the next unit of work.

Current evidence should keep the policy conservative. H14 now has promoted local
routes for `qwen3-coder:30b`, but H15 endpoint work is explicitly
`frontier-baseline` because the measured hybrid route used more frontier calls
than the frontier-only baseline and the local lanes still drifted on API
preservation, validation behavior, or runtime resources. FSCRUD R28 remains adjacent local-model evidence: local
Ollama plus prompt-language scaffolding improved artifact coverage over solo
local prompting, while the domain lane still collapsed the required CommonJS
export surface. Together, these results support local-first bulk work and
public-checkpoint repair, but they do not justify claiming local-only completion
for unpromoted routes or using frontier help inside a local-only batch.

## Decision Framing

| Option         | Structure                                                                         | Upside                                                                       | Weakness                                                                   | Verdict                   |
| -------------- | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ------------------------- |
| Advisor-only   | Ask a strong model when local work seems weak, then continue locally              | Easy pilot; low runtime changes                                              | Advice can be ignored or mistranslated by the local model                  | Useful baseline only      |
| Static split   | Pre-assign stages to local or frontier models                                     | Simple manifests and cost control                                            | Cannot react when the local model gets stuck or when a task turns out easy | Good first implementation |
| Dynamic router | Classify each step, run local by default, escalate based on gates/risk/confidence | Tests the real hypothesis; minimizes frontier usage while preserving quality | Needs stronger manifests, budget caps, and runner support                  | Recommended               |
| Frontier-first | Use Codex/GPT-5.5 for all hard work, local only for tests and formatting          | Highest likely quality                                                       | Does not answer whether local models can carry bulk work                   | Control arm               |

Recommended path: start with a static split pilot, then move to a dynamic router once the manifest format and escalation criteria are stable.

## Routing Policy V0

Local-first work:

- broad file search and inventory
- deterministic script execution
- repetitive edits with clear acceptance criteria
- boilerplate generation
- test writing from explicit examples
- retry loops where verifier output names the failing assertion
- documentation drafts from already-decided design

Escalate to frontier work:

- architectural decisions with multiple valid designs
- security-sensitive changes
- data-loss, auth, permissions, or migration logic
- cross-layer changes where repository boundaries are uncertain
- repeated local gate failure after two repair attempts
- local no-edit or timeout classification
- repeated public API or export-surface collapse after deterministic checkpoints
- conflicting evidence from tests, lints, or user intent
- final review before commit on high-risk changes

Do not escalate:

- formatting, spelling, lint cleanup, or simple import fixes
- tasks with a deterministic failing test and a narrow diff
- low-risk repeated fixture runs where local cost is the point of the measurement
- local-only claim batches, except to stop the batch and relabel the follow-up as a
  hybrid/advisor/frontier arm

## H14 Local Portfolio Overlay

The 2026-05-08 H14 subrole runs refine Routing Policy V0 into a local-model
portfolio. The machine-readable overlay is
[`h14-local-routing-policy.v1.json`](./h14-local-routing-policy.v1.json). Use
[`h14-local-routing-policy.mjs`](./h14-local-routing-policy.mjs) to resolve a
subrole before launching a local lane.

The older qwen-coder-only overlay remains available for historical reproduction:
[`h14-qwen3-coder-routing-policy.v1.json`](./h14-qwen3-coder-routing-policy.v1.json).

Current H14 routing decisions:

| Subrole                       | Selected local model | Fallbacks                                    | Route decision |
| ----------------------------- | -------------------- | -------------------------------------------- | -------------- |
| Implementation from tests     | `qwen3-coder:30b`    | `devstral-small-2:24b`, `qwen3-opencode:30b` | local-promoted |
| API-preserving implementation | `qwen3-coder:30b`    | `devstral-small-2:24b`, `qwen3-opencode:30b` | local-promoted |
| Standalone test authoring     | `qwen3-coder:30b`    | —                                            | local-promoted |
| Full TDD ownership            | `qwen3-coder:30b`    | —                                            | local-promoted |

Policy implication: keep promoted local models for bounded implementation work,
standalone H14 test authoring, and full H14 TDD only where the route policy has
clean-pass evidence. Prefer `qwen3-coder:30b` for all selected H14 routes today
because it is the fastest promoted model in the latest sampled H14 screens and
the only model with a clean full-TDD screen. Use `devstral-small-2:24b` or
`qwen3-opencode:30b` as fallback implementation workers, but not as fallback
standalone test authors or full-TDD owners yet.

Example:

```sh
node experiments/harness-arena/h14-local-routing-policy.mjs api-preservation --json
```

## H11 Multi-File Refactor Screen

The 2026-05-09 H11 route adds a Harness Arena screen for the older Contact-to-
Client multi-file refactor. The machine-readable overlay is
[`h11-qwen3-coder-routing-policy.v1.json`](./h11-qwen3-coder-routing-policy.v1.json).
Use [`h11-qwen3-coder-routing-policy.mjs`](./h11-qwen3-coder-routing-policy.mjs)
before launching the local lane.

Current H11 routing decision:

| Task                | Current model     | Route decision | Reason                                                               |
| ------------------- | ----------------- | -------------- | -------------------------------------------------------------------- |
| Multi-file refactor | `qwen3-coder:30b` | local-promoted | Current live screen is `3/5`; promoted for this flow/oracle contract |

Policy implication: H11 is now a promoted local route because it tests cross-file
reasoning, no-edit/timeout behavior, import resolution, and API drift under a
claim-grade live oracle.
The current H11 flow makes obsolete-file deletion, the `local-worker-summary.md`
artifact, and behavior preservation public gates before promotion. Runs 003 and
004 passed the private oracle as repeat screens, and run 005 met the three-clean
pass threshold. Treat the promotion as scoped to this exact route, model,
runtime, flow, and oracle.

## FSCRUD R29 Implication

R29 micro-v2 is the next local-only diagnostic before a hybrid FSCRUD arm. Its
purpose is to test whether public API artifacts, checkpoint scripts, and
deterministic export normalization can stabilize the local model's domain edits
without exposing the hidden verifier or providing a completed domain kernel.

If R29 keeps the export surface stable but fails behavior, the router has evidence
that domain implementation may need frontier repair or a deterministic kernel while
local Ollama remains useful for server, UI, docs, and fixture work. If R29 still
collapses the export surface, route policy should treat that as a local model fit
failure for this domain layer, not as a reason to make broader prompts.

## H15 Frontier Baseline Overlay

The 2026-05-08 H15 endpoint runs refine Routing Policy V0 in the opposite
direction from H14: `qwen3-coder:30b` is useful as an experimental local draft
worker, but not a local-only owner or current cost-saving hybrid default. The machine-readable overlay is
[`h15-qwen3-coder-routing-policy.v1.json`](./h15-qwen3-coder-routing-policy.v1.json).
Use [`h15-qwen3-coder-routing-policy.mjs`](./h15-qwen3-coder-routing-policy.mjs)
to resolve the task before launching the current baseline lane.

Current H15 routing decision:

| Task                 | Current model     | Route decision    | Reason                                                                      |
| -------------------- | ----------------- | ----------------- | --------------------------------------------------------------------------- |
| API endpoint         | Codex             | frontier-baseline | One frontier-only call passed; measured hybrid used three frontier calls    |
| Validation only      | `qwen3-coder:30b` | local-screen      | Route is `1/2`; repeat run exhausted action rounds and failed oracle        |
| PATCH test-authoring | `qwen3-coder:30b` | local-promoted    | Route is `4/8`; tests-only route passed three times after the fixture guard |

Policy implication: the next full H15 claim should use frontier-only. The
checked-in validation-only route remains screen-only after a failed repeat, while
the PATCH test-authoring route is promoted for tests-only ownership. Hybrid
remains experimental until local micro-flows reliably reduce frontier
repair/review work. A passing hybrid run would still not be local-only evidence.

## Prompt Language Shape

The target flow is a supervisor program, not a persona prompt:

```yaml
flow:
  let classification = prompt using profile "frontier-advisor": Classify the task risk, ambiguity, and likely local-model fit.

  if classification recommends_local
    prompt using profile "local-bulk": Implement the bounded next step.
  else
    prompt using profile "frontier-reasoner": Produce the decision, minimal plan, or critical patch.
  end

  until command_succeeded max 3
    run: npm test
    if command_failed
      let repair_route = prompt using profile "frontier-advisor": Decide whether this failure is local-repairable or needs escalation.
      if repair_route recommends_local
        prompt using profile "local-repair": Fix only the failing test cause.
      else
        prompt using profile "frontier-repair": Diagnose root cause and produce a minimal repair.
      end
    end
  end

  prompt using profile "frontier-reviewer": Review the final diff for hidden risk before commit.
```

Current repo constraint: profile-level model metadata exists, but runtime model
selection is still not a full per-turn provider router. The first pilot can
therefore run as an external harness that invokes separate PL/Codex/local
commands and records each lane in a manifest. The checked-in static-split flow
scaffolds are:

- [`flows/hybrid-router-v0.flow`](./flows/hybrid-router-v0.flow)
- [`flows/local-bulk-worker.flow`](./flows/local-bulk-worker.flow)
- [`flows/frontier-reviewer.flow`](./flows/frontier-reviewer.flow)

## Pilot Experiment

ID: HA-HR1

Question: Can a local-first/frontier-on-escalation policy match frontier-only pass rate while reducing frontier calls and preserving review quality?

Arms:

| Arm  | Description                                                                 |
| ---- | --------------------------------------------------------------------------- |
| HR-A | Local-only: aider + Ollama, task-tuned PL flow                              |
| HR-B | Frontier-only: Codex/GPT-5.5-class model for all reasoning and edits        |
| HR-C | Advisor-only: frontier produces plan/review, local model performs all edits |
| HR-D | Hybrid-router: local default, frontier escalation on policy triggers        |

Tasks:

- H14 TDD red-green, because recent local PL evidence shows over-staging and repair failures
- H15 API endpoint, because recent PL-local evidence shows a clean orchestration win
- H11 multi-file refactor, because it exposes timeout/no-edit and cross-file reasoning limits

Primary metrics:

- pass rate against locked oracle
- wall time
- frontier calls per successful task
- estimated USD cost per successful task
- local GPU active minutes
- final review defect count

Stop conditions:

- any oracle leak into model-visible prompt text
- any uncontrolled spend over the run budget
- repeated no-edit/timeout without classification in the manifest
- missing runner/model/cwd metadata for any lane

## Acceptance Criteria

- A manifest schema records runner, model, provider class, task, route decision,
  trigger, risk level, ambiguity level, artifact references, diff summary, review
  defects, wall time, exit code, and oracle result for every step.
- The pilot executes at least one task across all four arms.
- HR-D uses fewer frontier calls than HR-B.
- HR-D matches or beats HR-A on oracle score.
- The report separates routing-policy failure from model failure and harness failure.

## Open Implementation Questions

- Whether per-turn model/provider selection should become first-class DSL syntax or remain an experiment-harness concern.
- Whether context profiles should be allowed to select providers when runtime config also sets a model.
- How to cap frontier spend in a way that is enforced by the harness rather than trusted to the prompt.
- Whether final review should be mandatory for every hybrid run or only for risk-ranked tasks.

## Next Step

Use the H15 route profile for the current frontier-only baseline:

```sh
node experiments/harness-arena/runner.mjs --live --h15-qwen-coder-task api-endpoint --live-frontier-command ...
```

Use the validation-only local screen before another full local or hybrid attempt:

```sh
node experiments/harness-arena/runner.mjs --live --h15-qwen-coder-task validation-only --live-local-command ...
```

Use the full command template in
[`TEAM-OF-AGENTS-RUNBOOK.md`](./TEAM-OF-AGENTS-RUNBOOK.md). The next local-model
step should either harden the H11 deletion/summary gates and rerun that screen,
or continue with narrower H15 micro-flows. The current H11 rerun target is two
more clean passes on the behavior-preservation route. It should not be another
full H15 local/hybrid attempt on the same hardware.

Runbook: [`TEAM-OF-AGENTS-RUNBOOK.md`](./TEAM-OF-AGENTS-RUNBOOK.md).
Manifest schema: [`hybrid-routing-manifest.schema.json`](./hybrid-routing-manifest.schema.json).
