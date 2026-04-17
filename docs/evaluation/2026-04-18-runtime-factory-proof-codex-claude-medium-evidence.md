# 2026-04-18 Runtime Factory Proof: Codex + Claude, Medium Effort

Bounded evidence note for the `factory-runtime-proof` series under
[`experiments/results/factory-runtime-proof/`](../../experiments/results/factory-runtime-proof/).

## Claim

The strongest honest claim from this series is:

- prompt-language advanced a real bounded CRM-factory discovery slice through the PL runtime on both Codex and Claude
- provenance-backed bundles in this series show both lanes persisting `.prompt-language/session-state.json`, `provenance.jsonl`, and `audit.jsonl`
- the latest built-runtime Codex rerun (`20260418-055251`) reaches a bounded clean terminal outcome through `await all` and `review`
- the latest built-runtime Claude rerun (`20260418-055251`) materializes child `.prompt-language-discovery-*` state directories and child audit logs, but the parent still times out before closure
- this is bounded runtime-backed evidence for a real runner path on both hosts, plus a bounded clean completion datapoint on Codex only; it is not a clean end-to-end factory completion claim for both hosts

This note is **runtime-backed evidence**, not **claim-eligible evidence**.
These bundles are not presented as verifier-closed or attested runs, so they
do not count toward the thesis verdict gates in
[`docs/strategy/program-status.md`](../strategy/program-status.md).

## Why this matters

The April 17 series established that the bounded factory slice could parse,
import, spawn, and write artifacts through PL, but Claude hit a Windows
`grounded-by` shell-normalization failure during review. The current codebase
fixes that runtime defect in `src/application/advance-flow.ts` by translating
chained Windows `test -f` review checks into a PowerShell predicate instead of
building an invalid `cmd.exe` command.

The April 18 reruns are the post-fix confirmation passes. Interpret "after the
fix" as "after the built runtime used in the checked-in bundle", not merely
"after `src/` changed".

## Checked-in run matrix

| Run               | Lane            | Observed result                                                                                                 | What it proves                                                                      | Limitation                                                               |
| ----------------- | --------------- | --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `20260417-182016` | `codex-medium`  | `pl-run.log` reports `Flow completed.`                                                                          | Harness root and CLI wiring worked                                                  | This probe omitted imports and is not used as proof of factory execution |
| `20260417-182016` | `claude-medium` | Prompt runner timeout after `600000ms`                                                                          | Claude lane was reachable                                                           | No useful factory evidence                                               |
| `20260417-183231` | `codex-medium`  | Prompt runner failed                                                                                            | Imports were invalid                                                                | Not a product/runtime claim                                              |
| `20260417-183231` | `claude-medium` | Prompt runner timeout after `600000ms`                                                                          | Same invalid-import pack exercised Claude lane                                      | Not a product/runtime claim                                              |
| `20260417-183900` | `codex-medium`  | PL session paused before completion; active at node `11` with spawned children                                  | Imported PL flow advanced through spawn/await                                       | Non-terminal                                                             |
| `20260417-183900` | `claude-medium` | Prompt runner timeout after `900000ms`                                                                          | Claude lane reached the bounded imported flow                                       | No terminal outcome                                                      |
| `20260417-190300` | `codex-medium`  | PL session paused before completion; active at node `8` with spawned children                                   | Discovery-only slice wrote docs through PL and reached `await all`                  | Non-terminal                                                             |
| `20260417-190300` | `claude-medium` | PL session paused at review prompt; `_review_result.reason = Grounded review checks failed with exit code 1.`   | Claude advanced the same discovery slice through PL into review                     | Blocked by Windows `grounded-by` shell translation                       |
| `20260418-044547` | `codex-medium`  | Four resume attempts all pause before completion; session remains active at node `8` with spawned children      | Post-fix Codex lane still proves runtime-backed spawn/await and artifact production | Non-terminal                                                             |
| `20260418-044547` | `claude-medium` | Session remains active at node `9.0` after review-loop entry                                                    | Post-fix Claude no longer fails on the broken Windows `grounded-by` path            | Still non-terminal; outer rerun wrapper timed out before closure         |
| `20260418-055251` | `codex-medium`  | Parent `session-state.json` reaches `status: "completed"`; `await all` runs through 65 polls and review passes  | Built-runtime Codex lane now has a bounded clean terminal outcome through review    | Bundle is stronger on completion than provenance completeness            |
| `20260418-055251` | `claude-medium` | Parent run still times out before closure, but child `.prompt-language-discovery-*` dirs and child audits exist | External child-session path now materializes Claude child state on disk             | Parent still non-terminal; no bounded clean completion on Claude         |

## Strongest artifacts

Post-fix provenance-backed proof bundle:

- Codex:
  [`20260418-044547/codex-medium/pl-run.log`](../../experiments/results/factory-runtime-proof/20260418-044547/codex-medium/pl-run.log)
  [`20260418-044547/codex-medium/workspace/crm-app/.prompt-language/session-state.json`](../../experiments/results/factory-runtime-proof/20260418-044547/codex-medium/workspace/crm-app/.prompt-language/session-state.json)
  [`20260418-044547/codex-medium/workspace/crm-app/.prompt-language/provenance.jsonl`](../../experiments/results/factory-runtime-proof/20260418-044547/codex-medium/workspace/crm-app/.prompt-language/provenance.jsonl)
  [`20260418-044547/codex-medium/workspace/crm-app/.prompt-language/audit.jsonl`](../../experiments/results/factory-runtime-proof/20260418-044547/codex-medium/workspace/crm-app/.prompt-language/audit.jsonl)
- Claude:
  [`20260418-044547/claude-medium/pl-run.log`](../../experiments/results/factory-runtime-proof/20260418-044547/claude-medium/pl-run.log)
  [`20260418-044547/claude-medium/workspace/crm-app/.prompt-language/session-state.json`](../../experiments/results/factory-runtime-proof/20260418-044547/claude-medium/workspace/crm-app/.prompt-language/session-state.json)
  [`20260418-044547/claude-medium/workspace/crm-app/.prompt-language/provenance.jsonl`](../../experiments/results/factory-runtime-proof/20260418-044547/claude-medium/workspace/crm-app/.prompt-language/provenance.jsonl)
  [`20260418-044547/claude-medium/workspace/crm-app/.prompt-language/audit.jsonl`](../../experiments/results/factory-runtime-proof/20260418-044547/claude-medium/workspace/crm-app/.prompt-language/audit.jsonl)

Strongest bounded completion datapoint:

- Codex:
  [`20260418-055251/codex-medium/workspace/crm-app/.prompt-language/session-state.json`](../../experiments/results/factory-runtime-proof/20260418-055251/codex-medium/workspace/crm-app/.prompt-language/session-state.json)
  [`20260418-055251/codex-medium/workspace/crm-app/.prompt-language/audit.jsonl`](../../experiments/results/factory-runtime-proof/20260418-055251/codex-medium/workspace/crm-app/.prompt-language/audit.jsonl)
- Claude child-state materialization:
  [`20260418-055251/claude-medium/workspace/crm-app/.prompt-language-discovery-problem/session-state.json`](../../experiments/results/factory-runtime-proof/20260418-055251/claude-medium/workspace/crm-app/.prompt-language-discovery-problem/session-state.json)
  [`20260418-055251/claude-medium/workspace/crm-app/.prompt-language-discovery-requirements/session-state.json`](../../experiments/results/factory-runtime-proof/20260418-055251/claude-medium/workspace/crm-app/.prompt-language-discovery-requirements/session-state.json)

Generated discovery artifacts are present in both latest lanes:

- `docs/prd.md`
- `docs/acceptance-criteria.md`
- `docs/personas.md`
- `docs/non-functional-requirements.md`
- `docs/use-cases.md`
- `docs/architecture/`
- `docs/adr/`
- `docs/research/`

## Evidence interpretation

- Presence of `.prompt-language/session-state.json`, `provenance.jsonl`, and
  `audit.jsonl` is what makes this runtime-backed evidence.
- `audit.jsonl` in `20260418-044547` records `spawn:discovery-problem`,
  `spawn:discovery-requirements`, and repeated `await all` advancement on both
  lanes, which is the concrete proof that the parent factory flow advanced
  through PL rather than a raw host shortcut.
- `provenance.jsonl` records `source: "runtime"` state transitions and
  `source: "adapter"` agent invocations, which is the concrete proof that the
  runner path stayed inside the PL runtime-backed execution surface.
- `20260418-055251` is stronger on Codex bounded completion than `20260418-044547`,
  but weaker as a provenance citation because no `provenance.jsonl` was captured
  in that rerun.
- File presence in `docs/` should be read as bounded discovery outputs, not as
  proof of a broad end-to-end factory claim.

## What this does not prove

- It does not prove a clean bounded completion on Claude.
- It does not prove verifier closure, attestation, or claim eligibility.
- It does not prove medium reasoning is optimal; medium effort is only the
  documented configuration used for this evidence series.
- It does not supersede the April 17 E6/E7 live-smoke falsifier. Those broader
  factory flows remain blocked on separate cold-start and parsing issues.
