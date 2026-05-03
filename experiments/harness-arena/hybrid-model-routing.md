# Hybrid Model Routing Experiment

Date: 2026-04-28
Status: planned; static-split team-flow scaffolds added 2026-05-04
Bead: `prompt-language-sfd3`

## Summary

This experiment tests a dynamic routing policy for Prompt Language runs:

- local models handle cheap bulk work, mechanical edits, repeated test repair, and artifact generation
- Codex/GPT-5.5-class frontier models handle high-ambiguity reasoning, architecture, security, root-cause analysis after repeated failure, and final review
- Prompt Language owns the routing structure, gates, escalation thresholds, and evidence trail

The point is not an "advisor" that only writes suggestions. The router must be able to change which runner/model does the next unit of work.

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
- conflicting evidence from tests, lints, or user intent
- final review before commit on high-risk changes

Do not escalate:

- formatting, spelling, lint cleanup, or simple import fixes
- tasks with a deterministic failing test and a narrow diff
- low-risk repeated fixture runs where local cost is the point of the measurement

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

Build a small HA-HR1 runner that executes the same fixture under HR-A through HR-D and writes one JSON manifest per lane. Use H14 first because we already know the failure modes and can detect whether frontier escalation fixes the missing import/incomplete merge problem without paying for a larger task.

Runbook: [`TEAM-OF-AGENTS-RUNBOOK.md`](./TEAM-OF-AGENTS-RUNBOOK.md).
Manifest schema: [`hybrid-routing-manifest.schema.json`](./hybrid-routing-manifest.schema.json).
