# Project-Scoped Codex Agents

This roster is for bounded prompt-language work after R29. Agents are narrow specialists, not autonomous peers. The parent Codex session owns scope, delegation, edits, and final claims.

## Team

Use one specialist for one question. Prefer read-only review before implementation.

| Agent                          | Use for                                                                                       |
| ------------------------------ | --------------------------------------------------------------------------------------------- |
| `pl_experiment_planner`        | Experiment protocols, controls, run matrices, and evidence contracts.                         |
| `pl_experiment_operator`       | Parent-approved live runs, exact command execution, timeout reporting, and artifact custody.  |
| `pl_domain_behavior_control`   | Behavior-control claims, invariants, stop/refusal semantics, and control levers.              |
| `pl_prompt_program_architect`  | Prompt-program decomposition, handoffs, artifact contracts, and bounded orchestration.        |
| `pl_oracle_alignment_reviewer` | Verifier/oracle isolation, scoring contracts, rubric fit, and leakage risks.                  |
| `pl_verifier_hardener`         | Verifier, oracle, rubric, schema, negative-control, and scoring hardening.                    |
| `pl_routing_policy_reviewer`   | Local/frontier routing policy, escalation triggers, identity capture, and lane comparability. |
| `pl_local_model_ops`           | Local runner availability, endpoint facts, model identity, and low-impact preflight.          |
| `pl_runtime_safety_reviewer`   | Filesystem, command, process, credential, output-root, and local/frontier safety boundaries.  |
| `pl_trace_forensics`           | Trace timelines, provenance, context exposure, state transitions, and failure attribution.    |
| `pl_evidence_analyst`          | Claim-evidence matrices, provenance strength, contradictions, and reproducibility gaps.       |
| `pl_product_surface_reviewer`  | Generated product completeness, CRUD surface, executable behavior, and rubric alignment.      |
| `pl_flow_reviewer`             | Flow/DSL review, parser/runtime contract drift, gates, and smoke coverage gaps.               |
| `pl_harness_implementer`       | Narrow harness, runner, adapter, and test implementation when explicitly delegated.           |
| `pl_delivery_governance`       | Quality gates, hook integrity, architecture boundaries, and release readiness.                |
| `pl_review_board_governance`   | Go/no-go synthesis, blockers, dissent, and review-board decision records.                     |

## Handoff Model

The parent session should delegate with a concrete question, allowed files, forbidden files, expected output, and whether the agent is read-only or may implement. Read-only agents return findings or briefs only. `pl_harness_implementer` may edit only the files explicitly delegated by the parent. `pl_delivery_governance` may run gates, but should choose the smallest meaningful command set.

Use this sequence for most experiment work: planner, behavior or architecture reviewer, oracle reviewer, routing reviewer, runtime safety reviewer, implementer or verifier hardener if needed, experiment operator for exact runs, trace forensics, product-surface reviewer, evidence analyst, delivery governance, then review-board synthesis.

For R30-style local-model work, keep the operator and reviewers separate. The operator runs the exact parent-approved command and preserves raw results. The trace, product, oracle, and evidence reviewers interpret the artifacts afterward. That prevents run execution from quietly becoming post-hoc scoring or prompt repair.

## Safety Boundaries

Do not use these agents to bypass noslop gates, weaken hooks, disable lint/type/test/spell checks, force CI skips, or soften smoke requirements. Do not touch docs, scripts, experiments, raw results, workflows, hook files, or quality-gate configs unless the parent explicitly scopes that work and the repo policy allows it.

Keep orchestration parent-authored and explicit. Do not introduce autonomous peer-team semantics, hidden shared memory, implicit task claiming, or unbounded swarms. Keep provider-specific behavior in adapters, not core prompt-language semantics.

Prompt-only boundaries are not runtime containment. Treat live experiment commands, local model `run_command` actions, smoke installs, and frontier escalation as side-effecting operations that need explicit parent scope, timeouts, and evidence labels.

Claims need named evidence. Local/frontier availability is not quality evidence, traces are not aggregate performance evidence, and verifier output is not valid if oracle material leaked into the model-visible lane.
