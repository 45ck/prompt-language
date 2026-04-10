# From Hydra Reach 2026-04-11

Bundles routed out of `hydra-reach` during cross-project cleanup.

This folder records which prompt-language zip packs were reviewed, what was folded into the repo, and where the durable outcomes live now.

## Bundle summary

| Source zip                                    | Repo outcome                                                                                                                                |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `prompt_language_plans.zip`                   | Added routing and fixed-stack experiment docs under `docs/wip/` and `examples/*/docs/`; created linked Beads follow-ups.                    |
| `prompt-language-memory-bundle.zip`           | Folded memory and knowledge notes into `docs/wip/memory/`; linked the memory roadmap and backlog.                                           |
| `prompt-language-context-adaptive-bundle.zip` | Added the render-mode ADR, research note, and evaluation template; created the context-adaptive Beads program.                              |
| `prompt-language-plan-bundle-2026-04-09.zip`  | Reviewed as planning pressure only; used to shape backlog and thesis/eval direction without copying the pack wholesale.                     |
| `prompt-language-vnext-pack.zip`              | Imported into `docs/wip/vnext/`; created the vNext umbrella Beads program.                                                                  |
| `prompt-language-artifacts-bundle.zip`        | Imported into `docs/wip/artifacts/`; created the artifact-design Beads program.                                                             |
| `prompt-language-swarm-design-pack.zip`       | Imported into `docs/wip/swarm/`; created the swarm-oriented backlog track.                                                                  |
| `prompt-language-review-pack.zip`             | Curated into `docs/wip/reviews/2026-04-10-review-pack/`; created the review-pack follow-up epic `prompt-language-r8vp`.                     |
| `prompt-language-plan-pack.zip`               | Curated into `docs/wip/reviews/2026-04-11-plan-pack/`; added fresh-context and docs-integrity follow-up Beads under `prompt-language-r8vp`. |
| `prompt-language-diagnostics-bundle.zip`      | Curated into `docs/wip/tooling/diagnostics/`; no runtime code was imported directly from the proposal.                                      |
| `prompt-language-plan.zip`                    | Reviewed and folded into existing memory/vNext tracks instead of creating a duplicate roadmap dump.                                         |

## Plan Pack

Source zip: `prompt-language-plan-pack.zip`

Most useful original documents:

- `plans/02-fresh-context-plan.md`
- `plans/03-documentation-integrity-plan.md`
- `plans/04-evaluation-plan.md`
- `plans/05-90-day-roadmap.md`
- `issues/ISSUE-008` through `issues/ISSUE-011`

Durable outcomes:

- [2026-04-11 plan pack review](../../wip/reviews/2026-04-11-plan-pack/README.md)
- [What Works Now](../../evaluation/what-works-now.md)
- Beads: `prompt-language-r8vp.5`, `prompt-language-r8vp.6`, `prompt-language-r8vp.7`, `prompt-language-r8vp.8`

## Diagnostics Bundle

Source zip: `prompt-language-diagnostics-bundle.zip`

Most useful original documents:

- `FINAL_PLAN.md`
- `DIAGNOSTIC_CONTRACT.md`
- `DIAGNOSTIC_CODES.md`
- `EXIT_CODES_AND_CLI_BEHAVIOR.md`
- `VALIDATE_PROFILE_POLICY.md`

Durable outcomes:

- [Diagnostics proposal pack](../../wip/tooling/diagnostics/README.md)
- Diagnostic-planning follow-ups stay in WIP until the design is accepted and scheduled
