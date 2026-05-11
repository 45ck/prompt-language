---
title: Day summary — Concord/VHO research arc, 2026-05-11
status: synthesis; non-claim-eligible per program-status §3a
operator: 45ck
date: 2026-05-11
---

# Day summary — 2026-05-11

One day of focused experimentation on the Concord/VHO hybrid local/
frontier orchestration thesis. Five pilots, three reviewer agents,
five commits to each affected repo. Below is the executive brief.

## The headline

**Hybrid local/frontier orchestration is a real working pattern at
narrow scope, never breaks even on dollar economics outside that
scope.**

Specifically:
- For **bounded single-function tasks** with clear specs and
  deterministic oracles: hybrid saves 100% of the equivalent
  frontier output tokens, deterministically (100/100 at k=10).
  Real wins.
- For **real-software multistage builds** (markdown converter,
  RPN calculator): hybrid produces working code, but per-pilot
  scaffolding cost (~5.5k frontier tokens) dominates per-pilot
  local saving (~600 tokens). **No break-even at any N**, even with
  scaffolding reuse measured empirically.
- For **app-build orchestration** (TODO CLI): hybrid is 2-3× more
  expensive than frontier-only. Same scaffolding-dominance pattern.

The non-cost benefits of routing to local (privacy, latency, quota
independence, no API outage exposure) are real and apply at every
scope. The dollar savings only apply at micro-task scope.

## What got built and shipped today

### Code and experiments
- 5 pilots under `experiments/`:
  - `concord-vho-pilot-todo-cli/` — app-build orchestration (negative)
  - `concord-vho-microtask-cost/` — micro-task v2 with full/starved
    ablation and k=3 then k=10 stability (positive at full, mixed
    at starved, both deterministic at k=10)
  - `concord-vho-realsoftware-tinymd/` — multistage build (negative
    on cost; positive on mechanical works)
  - `concord-vho-realsoftware-rpncalc/` — cross-app reuse measurement
    (disproves the earlier N≈12 break-even claim)
  - `local-format-fit-smoke/` — single-day strict-format-fit micro-
    smoke + adversarial follow-up (methodology evidence)
- Working software produced:
  - `tinymd` Markdown→HTML converter (24/24 oracle pass)
  - `rpncalc` RPN calculator (23/23 oracle pass)
  - 10 micro-task functions in v2 (30/30 then 100/100 oracle pass)

### Documentation
- `docs/strategy/thesis.md` — added kill rule
- `docs/strategy/program-status.md` — §2a hybrid-efficiency tracker
  with scope-divided portfolio verdict
- `docs/strategy/engineering-readiness-2026-05-11.md` — explicit
  GO/CONDITIONAL/NO verdict per engineering decision
- `docs/strategy/day-summary-2026-05-11.md` — this file
- `docs/research/portarium-integration-spike.md` — cross-ref to
  Portarium's side
- `docs/research/local-coding-models-landscape-2026-05-11.md` —
  external research synthesis (confirmed Qwen is the local-rig
  leader for this hardware class)
- Portarium: `docs/integration/prompt-language-runtime.md` —
  surface mapping + 5 contract gaps
- Portarium: `README.md` — honest PL relationship note

### Shipped artifact
- `skills/concord-microtask-router/SKILL.md` — Claude Code skill with
  explicit scope boundaries, prompt-writing rules, and evidence base
  pointers

## Engineering-readiness verdict (final, evening-revised)

| Decision | Verdict | One-line why |
|---|---|---|
| Ship `concord-microtask-router` skill | **GO** ✅ | Done; backed by 100/100 at k=10 |
| Add hybrid to harness-arena routes | **GO** ✅ | Already running; HA-HR1 awaits supported-host auth |
| Use hybrid in personal projects | **CONDITIONAL GO** ⚠️ | Only for bounded micro-tasks with oracles |
| Build Portarium ↔ PL integration | **NO** ❌ | Premature; trigger not met |
| Hybrid as primary engineering paradigm | **NO** ❌ | n=5 doesn't change this; thesis H1-H6 still unmeasured |
| Hybrid for real-software builds (cost-justified) | **NO** ❌ | Never breaks even on dollars (rpncalc-confirmed) |
| Hybrid for client app-build work | **NO** ❌ | Same scaffolding-dominance problem |
| Provision operator signer (clear §3a gate 5) | **GO** ✅ | Orthogonal but unblocks claim-eligibility for everything else |

## What materially changed today (vs. yesterday's state)

1. **Scope-divided framing.** The hybrid hypothesis was previously
   discussed as a binary win/lose across all scopes. Five pilots
   forced it into four explicit scopes (micro-task, real-software-
   multistage, app-build-orchestration, harness-arena-route), each
   with its own evidence and verdict.

2. **A real working skill shipped.** Before today the routing
   pattern was a thesis. After today it's a Claude Code skill at
   `skills/concord-microtask-router/SKILL.md` with documented
   boundaries.

3. **An overclaim caught and corrected.** Morning tinymd pilot
   claimed "break-even at N≈12." Afternoon rpncalc pilot measured
   the actual amortisation (~42% of frontier scaffolding reuses,
   not ~100%) and showed there's no break-even at any N. Honest
   science correcting itself.

4. **k=10 stability proven for micro-task scope.** Earlier strict-
   format-fit smoke flagged qwen3-coder non-determinism on isPrime.
   k=10 sweep proves that's task-specific; most tasks ARE
   deterministic at temp=0, and the 100/100 micro-task win is not
   a lucky run.

5. **Two real local failure modes characterised.** Subtle regex/
   syntax errors and wrong sibling-contract assumptions. Both
   recurred across two real-software pilots; both are fixable with
   tighter prompts and dependency ordering. Encoded into the skill.

6. **Three reviewer agents demonstrated value.** TODO CLI's
   confirmation + critic agents caught real methodology bugs
   (frontier contamination, weak oracles, cherry-picked tasks,
   metric gaming). v2's pre-flight critic prevented running a
   flawed design. The dual-reviewer workflow itself is now a
   reusable artifact.

7. **Repo locations stabilised.** Moved both 45ck/Portarium and
   45ck/prompt-language to `C:/projects/` per user direction.

## What did NOT happen today (the honest gap list)

- **No operator signer provisioned.** §3a gate 5 is still the
  empty-placeholder blocker for claim-eligibility. Highest-leverage
  single piece of infrastructure work remaining.
- **No generalisation test.** All 5 pilots' tasks were curated by
  this Claude session. Random sampling from a real npm package is
  the next experiment.
- **No HA-HR1 live cross-arm run.** PL bead `prompt-language-040u`
  (Windows Claude auth) still blocks.
- **No multi-file project pilot.** All real-software pilots were
  single-file. The thesis's H1-H6 hypotheses about multi-file
  prompt-language projects remain unmeasured.
- **No Portarium ↔ PL contract draft.** Correctly deferred until
  PL evidence is stronger.

## The honest line for next research

The single most-defensible claim today's evidence supports is:

> "For bounded single-function code generation tasks with
> ≤100-token tutorial-quality specs and deterministic oracles,
> routing to qwen3-coder:30b on AMD/Vulkan local hardware saves
> the equivalent of frontier output tokens with 100% reliability
> at k=10."

Everything else is either bigger than the evidence supports or
smaller than the evidence requires.

## Recommended next sessions

In priority order:

1. **Provision operator signer** in
   `docs/security/trusted-signers.json` so §3a gate 5 clears for
   all future runs. ~15-30 minutes if the key is ready.
2. **Generalisation test** — sample 20-30 random small functions
   from a popular npm package (e.g. lodash, ramda) and run the
   micro-task pattern against them. Tests whether the 100/100 win
   generalises beyond curated tasks. ~2 hours.
3. **HA-HR1 live cross-arm fixture** once Claude auth on Windows
   resolves. Produces the first claim-eligible bundle.
4. **Multi-file project pilot** for thesis H1-H6. Weeks-scale, not
   day-scale.

## Files added or modified today (push log)

prompt-language (`a84e80e..fc13442` chain plus prior):
- `docs/strategy/thesis.md` (Kill rule)
- `docs/strategy/program-status.md` (§2a tracker)
- `docs/strategy/engineering-readiness-2026-05-11.md`
- `docs/strategy/day-summary-2026-05-11.md` (this file)
- `docs/research/portarium-integration-spike.md`
- `docs/research/local-coding-models-landscape-2026-05-11.md`
- `experiments/concord-vho-pilot-todo-cli/2026-05-11/...`
- `experiments/concord-vho-microtask-cost/2026-05-11/...`
- `experiments/concord-vho-realsoftware-tinymd/2026-05-11/...`
- `experiments/concord-vho-realsoftware-rpncalc/2026-05-11/...`
- `experiments/local-format-fit-smoke/2026-05-11/...`
- `skills/concord-microtask-router/SKILL.md`

Portarium (`d98d91dc`):
- `docs/integration/prompt-language-runtime.md`
- `README.md` (project-status PL relationship note)

Both repos on origin/main with the latest commits.
