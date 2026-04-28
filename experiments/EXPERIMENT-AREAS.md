# Experiment Areas — Naming, Charters, and the New Stack-vs-Stack Area

Date: 2026-04-20
Status: Proposal. Names are not yet adopted. No directories created.
Purpose: Give each thematic cluster in `experiments/` a memorable, distinct codename plus a one-sentence charter, inventory what each has measured, and specify a new area that compares whole coding stacks (cloud harness + frontier model vs PL + local model + task-tuned flow).

This document is normative only if the user adopts the codenames. Until then, treat it as a design memo.

---

## 1. Ground-truth inventory

One paragraph per existing directory. Evidence strength is marked with three tiers:

- **strong**: multiple locked runs, reproducible, scorecard-backed
- **medium**: at least one complete run or a published scorecard, but limited replication
- **thin**: design docs, scaffold, or unexecuted

### 1.1 `aider-vs-pl/` (H1–H10, plus Phase 2 design)

Head-to-head head-to-head of Aider-solo vs Aider-under-PL on the **same local model** (Qwen3 30B Q4_K_M). Ten hypotheses executed (H1 retry, H2 TDD, H3 decomposition, H4 pipeline, H5 scoping, H6 branching, H7 speed, H8 foreach, H9 structure, H10 ceiling). Scorecard: PL 6 wins / 0 losses / 3 ties. Locked result: gate loops and decomposition drive most of the lift; speed penalty 1.5–3.5x. Phase 2 designed (H11–H20) covering multi-file refactor, security fix, perf, TDD, API endpoint, bug repro, dep upgrade, config redesign, error handling, doc generation; only H11 and H14 have partial Phase-2 evidence. Evidence: **strong** for H1–H10 on one model; **thin** above H10; **thin** across model tiers.

### 1.2 `aider-vs-pl/rescue-viability/` (R1–R10)

Isolates the "does PL rescue a weaker model" claim by sweeping three axes: model capability (gemma-e4b, qwen3:8b, qwen3:30b, frontier), task difficulty (E-SMALL, H1–H10, H11–H20), PL intensity (solo, pl-lite, pl-medium, pl-full). R7 design exists (foreach-spawn vs sequential scaffolding) with a single-GPU Ollama sequentiality hypothesis. Evidence: **thin** — plan and R7 design only, one live-notes file, no locked run matrix.

### 1.3 `aider-vs-pl/ecosystem-analysis/`

Positional survey of the adjacent coding-agent landscape (aider, opencode, OpenHands, Cline, Continue, Claude Code, Codex CLI, smol-developer, gpt-engineer), plus focused write-ups on pi-mono, hermes-agent, openclaw. Frames PL as a verification-first DSL orchestrator that wraps harnesses rather than replacing them. Evidence: **medium** for the survey (knowledge-based, not run-backed, but internally consistent); **thin** for integration claims.

### 1.4 `meta-factory/` (M1–Mn)

Self-hosting program: PL authors PL. M1 ("PL writes a smoke test") authored as runnable DSL on a frozen `dist/` snapshot in an isolated git worktree, with acceptance criteria O1 PARSE / O2 NOVELTY / O3 RUNNABLE / O4 TRACED / O5 CATALOG. M2–M9 not yet authored. Evidence: **thin** — M1 authored but not executed live; two emerged-artifact result directories exist but no acceptance verdict.

### 1.5 `full-saas-factory/e4-codex-crm-factory/`

End-to-end CRM MVP built by Codex either alone or under a PL flow pack. 16 runs across batches A02–A19 / B01–B06, with manifest.json, outcome.md, postmortem, interventions, scorecard, trace-summary per run. Verdict B02: Codex-alone faster on throughput (median 719s vs 1514s); PL better on auditability and factoryQuality (10 vs 8). Evidence: **strong** for throughput at this scope; **medium** for the auditability claim (rubric-graded).

### 1.6 `full-saas-factory/e6-pl-crm-factory/` and `e7-enterprise-crm-factory/`

E6 is the "pure PL" version of E4 (3 entities, no Codex-specific templates, parse-verified only). E7 is the enterprise build (15 entities, 5 system features, 6 SDLC phases, 14 specialized agents, 37 ship gates) — the most comprehensive PL factory to date. Evidence: E6 **thin** (not executed live); E7 **medium** (complete but single-lane, no solo comparator for the enterprise scope).

### 1.7 `marketing-factory/` (E7-MK)

Marketing-website generation: PL factory vs solo prompt across three sub-hypotheses (quality gates, section completeness, brand voice). V2 multi-run scorecard: PL 30/30 x3 (100% consistency) vs solo 28.3/30 avg (94.4%). Locked finding: retry-with-validation is the dominant pattern; favicon is a systematic solo failure. Evidence: **strong** for the +1.7 point gap; **medium** for generalisation beyond the CloudPulse fixture.

### 1.8 `website-factory/` (E8)

Enterprise 6-phase build (discovery → architecture → design system → implementation → QA → release), 22 flow files, 8 libraries. NightOwl fixture. Run 1: Factory (Astro) 3/4 vs Solo (Next.js) 4/4 — PL lost on lint-clean because Astro lacks default ESLint. Key open question: PL runtime hooks did not activate in `claude -p` subprocesses; the flow text was interpreted as prompt instructions, not executed by the runtime state machine. Evidence: **medium** for the 3/4 vs 4/4 result; **strong** for the negative runtime-activation finding.

### 1.9 `full-sdlc-factory/` (E9)

Single PL flow orchestrating requirements → design → tasks → implementation → QA → review for a marketing site (CloudPulse). Two standard runs plus a QA-heavy variant (Playwright, Lighthouse, complexity metrics, visual snapshots). 100-point rubric. Evidence: **medium** — phases execute end-to-end but no solo comparator at this SDLC scope.

### 1.10 `bounded-feature-benchmark/`, `parallel-planning/`, `parallel-isolated-modules/`, `premature-stop-benchmark/`, `self-healing-ci/`

Five scaffold directories with hypothesis documents and no runs. Grouped under the "Non-Factory Proof Program" as the next bounded proof layer. Evidence: **thin** — design only.

### 1.11 `eval/`

Shared infrastructure: E1 repeated-failure dataset (3 cases, gated 1/3 vs vanilla 0/3), context-adaptive benchmark pack, comparative-eval script (H101–H108 covering approval, retry-with-backoff, reflection, fan-out, variable pipeline, remember, long-flow stress, nested control). Not an experiment area — a substrate. Evidence: **medium** for E1; **medium** for H101–H108 harness.

### 1.12 `results/`, `templates/`, `factory-runtime-proof/`

Stores. `results/` holds locked baselines and scorecards. `templates/` holds hypothesis/methodology/metrics/results skeletons. `factory-runtime-proof/` contains run outputs from claude-medium vs codex-medium factory smoke passes at five timestamps. Not themed experiment areas; supporting infrastructure.

---

## 2. Proposed naming scheme

Criteria:

- Short (one word), memorable, distinct, not a pun that wears out.
- Does not collide with H-numbers, R-numbers, E-numbers, or M-numbers already in use.
- Each name has a single-sentence charter.
- Names read as **kinds of work** rather than product metaphors.

| Codename                                | Existing dir(s)                                                                                                                   | Charter                                                                                                                                                        |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **ladder**                              | `aider-vs-pl/` (H1–H10, H11–H20)                                                                                                  | Rung-by-rung solo-vs-PL head-to-heads at a single model tier, designed to walk from trivial to hard tasks and locate where orchestration stops mattering.      |
| **rescue**                              | `aider-vs-pl/rescue-viability/` (R1–R10)                                                                                          | Hold task constant, vary model capability and PL feature intensity, measure whether PL lifts weaker models into usefulness.                                    |
| **atlas**                               | `aider-vs-pl/ecosystem-analysis/` (pi-mono, hermes-agent, openclaw, adjacent-ecosystem)                                           | Map the surrounding harness and orchestrator landscape so positioning, wrap-points, and threat calls are explicit.                                             |
| **forge**                               | `meta-factory/` (M1–Mn)                                                                                                           | Can PL author PL — controlled self-hosting experiments on a frozen runtime, single-target per run, with authoritative gate.                                    |
| **foundry**                             | `full-saas-factory/`, `marketing-factory/`, `website-factory/`, `full-sdlc-factory/` (E4, E6, E7, E7-MK, E8, E9)                  | End-to-end product-build factories where PL orchestrates a full delivery and a solo prompt serves as comparator.                                               |
| **crucible**                            | `bounded-feature-benchmark/`, `premature-stop-benchmark/`, `self-healing-ci/`, `parallel-planning/`, `parallel-isolated-modules/` | Narrow stress tests that isolate one DSL primitive (retry, stop-hook, gate, spawn/await) against a bounded fixture.                                            |
| **harness-arena** (new — see section 3) | _not yet created_                                                                                                                 | Compare **whole stacks**: cloud harness + frontier model vs PL + local model + task-tuned flow, on shared oracle tasks, with cost and wall-time on the x-axis. |

Top three picks and why:

1. **ladder** — captures the rung-by-rung progression of H1→H20 and makes the existing scorecard legible without rebranding it. H-numbers stay intact inside the ladder area.
2. **rescue** — the user has already been using this word (`rescue-viability/`, `RESCUE-VIABILITY-PLAN.md`). Adopt it rather than invent a synonym.
3. **foundry** — groups the four product-build efforts (E4, E7, E7-MK, E8, E9) that are currently scattered across four directories under one umbrella, so cross-factory comparisons stop being folder-math.

Deliberately **rejected** names: "gauntlet" (too close to ladder), "pilot" (ambiguous with rollout terminology), "lab" (generic), "bench" (clashes with benchmark-pack), "arena" as a standalone (reserved as half of `harness-arena`).

Non-themed items keep their current names: `eval/`, `results/`, `templates/`, `factory-runtime-proof/`. They are substrates, not areas.

---

## 3. The new area: **harness-arena**

### 3.1 Scope declaration (why this is distinct from rescue)

**rescue** holds the model constant and varies PL intensity. Canonical question: _does PL lift Qwen3-30b from 6/10 to 9/10 on task T?_

**harness-arena** varies **the entire stack** — harness, model tier, data boundary, and cost profile — and asks whether a carefully-tuned local-model + PL stack can match or beat a vanilla cloud-harness + frontier-model stack on the same oracle. Canonical question: _given a fixed task T, is (Claude Code + Sonnet) better or worse than (opencode + qwen3-opencode-big:30b + task-tuned PL flow) on cost, wall-time, pass-rate, and human-review time?_

These are not nested: rescue assumes you have already picked a model; harness-arena is a **stack bake-off**. Results in one do not imply results in the other.

### 3.2 Research question (crisp)

For a fixed, bounded coding task with a locked oracle, can a PL flow tuned to that task, running a frontier-class local model under a local harness, match or beat a vanilla frontier-cloud agent (Claude Code + Sonnet, Codex CLI + GPT) on a four-metric Pareto frontier of cost-per-task, wall-time, pass-rate, and human-review-minutes-after-delivery?

### 3.3 Hypothesis and null

- **H(harness-arena-1) primary**: On H11-class tasks (multi-file refactor, bug repro with tests, small-feature-add), the PL + opencode + qwen3-opencode-big:30b arm dominates at least one cloud arm on **cost-per-successful-task** by ≥10x while staying within 2x on wall-time and within 1 pass-rate point.
- **H(harness-arena-2) secondary**: The PL + local arm delivers **lower human-review-minutes** than solo-local and within parity of the cloud arms, because the task-tuned flow enforces the review rubric at generation time.
- **H0a**: Cost-per-successful-task of the PL + local arm is not ≥10x cheaper than both cloud arms, OR pass-rate deficit exceeds 1 point, OR wall-time exceeds 2x.
- **H0b**: Human-review-minutes across arms are statistically indistinguishable (t-test, alpha=0.1, n≥5 tasks x 3 graders).

### 3.4 Arms

| Arm | Harness           | Model                             | Flow                                                 | Data boundary |
| --- | ----------------- | --------------------------------- | ---------------------------------------------------- | ------------- |
| A1  | Claude Code       | claude-sonnet-4.x                 | vanilla (no PL, default system prompt)               | cloud         |
| A2  | Codex CLI         | gpt-5.x                           | vanilla                                              | cloud         |
| A3  | aider (solo)      | qwen3-opencode:30b (local Ollama) | vanilla aider                                        | local         |
| A4  | aider under PL    | qwen3-opencode:30b                | task-tuned flow with gates + retry + review          | local         |
| A5  | opencode under PL | qwen3-opencode-big:30b            | task-tuned flow (same shape as A4, different runner) | local         |

A3 is the **solo-local control** that separates "does PL help" from "does local help." Without A3, a win at A4 conflates the two variables.

Optional A6 (future): Cursor + Sonnet, Aider + Sonnet, as a cloud-frontier-under-PL control. Defer to avoid budget blow-up on run 1.

### 3.5 Tasks

Borrow from `aider-vs-pl/fixtures/`:

- **HA-T1**: H11 multi-file refactor (Contact Manager) — existing fixture, existing oracle.
- **HA-T2**: H12 security fix — existing fixture with known vulnerability and test.
- **HA-T3**: H14 TDD red-green — existing fixture with pre-written failing tests.

Plus one new end-to-end task:

- **HA-T4**: "Add a feature to a small repo." Seed a 500–1500 LOC fixture (e.g. a minimal Express todo-API) and require: add a tagging feature with GET/POST endpoints, a migration, tests, and a README update. Oracle: Playwright E2E + unit tests + lint. Target: 5–20 minutes per arm.

HA-T4 is the load-bearing new task because the existing H-fixtures are narrow. Small-repo feature-add is closer to the user's framing ("vs a PL project … vanilla harness vs a local model doing the same thing").

### 3.6 Metrics

| Metric               | Unit                               | How captured                                                                                                           | Notes                                                                                                                    |
| -------------------- | ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| cost_per_task        | USD                                | API billing export (cloud arms); electricity estimate + hardware amortisation (local arms)                             | Local = kWh × marginal grid rate + (hardware_cost / expected_lifetime_tasks). Declare the amortisation formula up front. |
| wall_time            | seconds                            | Start of harness invocation to `done when` resolution or final commit                                                  | Exclude human prep time.                                                                                                 |
| pass_rate            | 0–1 per task, averaged across runs | Shared oracle (Playwright + unit + lint) run by an **isolated grader script** that does not share files with the agent | Critical: the oracle commands must NOT appear in the agent's system prompt or flow text.                                 |
| human_review_minutes | minutes                            | Two graders with a fixed rubric review the delivered diff, independently, timer on                                     | Rubric in section 3.7. Inter-rater agreement target ≥0.7 Cohen's kappa.                                                  |

Derived:

- cost_per_successful_task = cost_per_task / pass_rate (per task, averaged).
- total_operator_minutes = wall_time_minutes + human_review_minutes.

### 3.7 Human-review rubric (must be pre-registered)

Grader checks, each 0/1/2:

1. Correctness beyond oracle (does it handle cases the oracle did not test?).
2. Code-review readability (naming, structure, commit granularity).
3. Test coverage quality (are the tests meaningful or tautological?).
4. Scope discipline (did the agent touch unrelated files?).
5. Artefact quality (README, migration, etc.).

Score out of 10 per task per grader. Two graders per task. Time each grader from open-diff to verdict.

### 3.8 Risks and mitigations

| Risk                                                         | Severity | Mitigation                                                                                                                                                                                                                                                                          |
| ------------------------------------------------------------ | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| API cost budget blows up (A1+A2 across 4 tasks × ≥3 repeats) | high     | Set a per-arm USD cap. Start with 1 repeat × 4 tasks, inspect, then expand. Pre-register the cap in the run manifest.                                                                                                                                                               |
| Shared oracle leaks into frontier agent's system prompt      | high     | The oracle script lives outside the agent's working directory and is invoked by the harness-arena runner, not the agent. Grep the agent's final transcript for oracle command strings before scoring. Reject runs where the oracle command appears verbatim in the agent's context. |
| Human-review metric subjectivity                             | medium   | Pre-registered rubric (section 3.7), two graders, kappa check, discard tasks with kappa<0.5.                                                                                                                                                                                        |
| Local-arm cost accounting is fuzzy                           | medium   | Declare amortisation formula in the run manifest. Report cost both with and without amortisation.                                                                                                                                                                                   |
| A4/A5 flow tuning becomes a moving target                    | medium   | Freeze the task-tuned flow per task before the run. Any flow change requires a new run ID. Record the flow SHA in the manifest.                                                                                                                                                     |
| Stack-vs-stack results conflate harness and model            | medium   | A3 (solo-local) control isolates "does PL help"; A1 vs A2 isolates cloud-harness-vs-cloud-harness; A4 vs A5 isolates aider-vs-opencode under same PL. Cross-table after the fact.                                                                                                   |
| Single-GPU Ollama sequentiality                              | low      | Document the hardware. Do not run A4 and A5 in parallel on the same box.                                                                                                                                                                                                            |

### 3.9 First two experiments (with predictions and stop conditions)

**HA-E1 — Pilot on HA-T1 only (H11 multi-file refactor), all five arms, 1 run each.**

- Purpose: shake out the runner, oracle-isolation check, cost-tracking plumbing, grader rubric calibration.
- Predictions:
  - A1 (Claude Code + Sonnet) passes oracle. Cost ≈ $0.10–$0.40. Wall-time 2–5 min.
  - A2 (Codex + GPT-5.x) passes oracle. Cost ≈ $0.05–$0.30. Wall-time 2–5 min.
  - A3 (aider solo, local) passes oracle 50–70% of the time. Wall-time 8–15 min. Cost ≈ $0.01 electricity.
  - A4 (aider + PL, local) passes oracle 70–90%. Wall-time 12–25 min.
  - A5 (opencode + PL, local) passes oracle 70–90%. Wall-time 10–20 min.
  - cost_per_successful_task: A4/A5 ≥30x cheaper than A1/A2.
  - human_review_minutes: A1 ≈ A2 ≈ A4 ≈ A5 (6–10 min); A3 significantly higher (12–20 min) due to lack of review gate.
- Stop conditions:
  - If oracle leaks into agent context on any arm, stop and fix the runner before proceeding.
  - If A3/A4/A5 all fail to compile on HA-T1, stop and triage the local stack; do not proceed to HA-E2.
  - If cloud cost exceeds $5 for HA-E1 total, stop and audit.

**HA-E2 — Full matrix on HA-T1, HA-T2, HA-T3, 3 runs per arm per task (45 runs total).**

- Purpose: first inferential pass. Pre-register hypotheses H(harness-arena-1) and H(harness-arena-2).
- Predictions:
  - cost_per_successful_task: A4 or A5 dominates at least one cloud arm by ≥10x on at least 2/3 tasks.
  - pass-rate deficit of A4/A5 vs best cloud: ≤1 absolute point per task.
  - wall-time ratio A4/A5 vs best cloud: 1.5x–3x (consistent with ladder-area findings).
  - human_review_minutes: parity within ±3 min between best PL arm and cloud arms.
- Stop conditions:
  - If A4/A5 pass-rate deficit exceeds 2 points on 2+ tasks, abandon H(harness-arena-1) as stated and reformulate.
  - If human-review inter-rater kappa <0.5, re-calibrate rubric and re-grade.
  - If total budget exceeds $50, pause and review.

Beyond HA-E2, the area opens out to HA-T4 (feature-add) and to the A6 cloud-frontier-under-PL control, but those are deferred until the pilot methodology holds.

### 3.10 Hybrid routing extension

The 2026-04-28 local-model reruns add a second harness-arena question: not just which stack wins, but when a supervisor should switch stacks during one task.

The planned HA-HR1 pilot treats model choice as a routing policy:

- local models do cheap bulk execution, mechanical edits, repeated verifier repair, and documentation drafts
- Codex/GPT-5.5-class models do high-ambiguity planning, architecture, security-sensitive reasoning, stuck-state repair, and final review
- Prompt Language owns the route decision, escalation threshold, budget cap, and manifest trail

This differs from an advisor-only pattern. An advisor can recommend a plan while the local model still performs every edit. A router is stronger: it can hand the next step to a different runner/model when risk, ambiguity, or repeated gate failure justifies the cost.

HA-HR1 is tracked in [`harness-arena/hybrid-model-routing.md`](./harness-arena/hybrid-model-routing.md) and bead `prompt-language-sfd3`.

---

## 4. Cross-references

- `experiments/README.md` — top-level index. Will need an edit to add the **harness-arena** row if adopted.
- `experiments/CATALOG.md` — summary table. Will need a new row.
- `experiments/aider-vs-pl/SCORECARD.md` — **ladder** area's headline scorecard.
- `experiments/aider-vs-pl/RESCUE-VIABILITY-PLAN.md` — **rescue** area's charter document; section 2.3 explicitly contrasts with what harness-arena now covers.
- `experiments/aider-vs-pl/ecosystem-analysis/adjacent-ecosystem.md` — **atlas** area's landscape survey; the arm list in section 3.4 draws directly from its project catalogue.
- `experiments/aider-vs-pl/SESSION-2026-04-20-OPENCODE-NEXTJS.md` — opencode + qwen3-opencode-big:30b evidence relevant to A5.
- `experiments/aider-vs-pl/fixtures/h11-multi-file-refactor/`, `h12-security-fix/`, `h14-tdd-red-green/` — HA-T1, HA-T2, HA-T3 fixtures.
- `experiments/eval/context-adaptive-benchmark-pack/` — candidate home for the HA-T4 feature-add fixture.
- `experiments/meta-factory/README.md` — **forge** area; unrelated to harness-arena but named here for completeness.
- `experiments/full-saas-factory/e4-codex-crm-factory/` and `experiments/marketing-factory/` — **foundry** area; harness-arena borrows the "PL vs solo on shared oracle" design pattern from E7-MK.

---

## 5. Evidence-quality summary

| Area          | Runs locked                    | Evidence tier                         | Open questions                                    |
| ------------- | ------------------------------ | ------------------------------------- | ------------------------------------------------- |
| ladder        | 10 (H1–H10) at 1 model         | strong at tier, thin cross-tier       | H11–H20 unexecuted; cross-model generalisation    |
| rescue        | 0 locked                       | thin                                  | entire matrix unexecuted                          |
| atlas         | — (survey)                     | medium                                | integration claims not run-backed                 |
| forge         | 0 accepted                     | thin                                  | M1 not executed live                              |
| foundry       | ~25 runs across E4/E7-MK/E8/E9 | strong at E4, E7-MK; medium at E8, E9 | E8 runtime-hook activation; E9 no solo comparator |
| crucible      | 0                              | thin                                  | all five sub-areas designed only                  |
| harness-arena | 0                              | thin (new)                            | full pilot needed before inference                |

Unresolved questions surfaced by this inventory:

1. **Runtime activation**: E8 showed PL runtime hooks did not fire under `claude -p`. Harness-arena A1 must answer whether the same is true under Claude Code proper, or the A1-vs-A4 comparison is confounded.
2. **Oracle isolation**: No existing area has a verified oracle-leak audit. Harness-arena forces this to be built first.
3. **Cost accounting for local arms**: Electricity + amortisation formula has not been pinned down anywhere in the repo. Harness-arena is the first area that needs it.

---

## 6. What to do next

If the user adopts the names:

1. Rename nothing on disk yet; add codename headers to the existing READMEs.
2. Update `experiments/README.md` and `experiments/CATALOG.md` with the codename column.
3. For **harness-arena**, create the directory, drop this section 3 content as its `README.md`, and build the runner plumbing (oracle-isolation first, cost-tracking second).
4. Run HA-E1 (pilot) before anything else.

If the user rejects or tweaks names: edit section 2 of this file and leave the rest.
