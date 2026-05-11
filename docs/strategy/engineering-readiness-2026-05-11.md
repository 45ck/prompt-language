---
title: Concord/VHO engineering-readiness verdict (2026-05-11)
status: synthesis across four same-day pilots; non-claim-eligible per program-status §3a
operator: 45ck
date: 2026-05-11
---

# Engineering-readiness verdict, 2026-05-11

<!-- cspell:ignore Portarium EQTY OVERCLAIMED tinymd rpncalc characterised Catchable Generalisation amortisation genericised amortises realsoftware -->

> **Correction note (2026-05-12):** The operator signer has since been
> provisioned as `operator-45ck-2026-05`, so references below to an empty
> trusted-signers registry are stale. This does not make any run claim-eligible:
> the signed-bundle path still needs verifier-clean trace/state/witness evidence
> and real cross-family review. Use
> [Current Plan After May 11 Evidence](current-plan-2026-05-12.md) for the active
> roadmap.

After a single day of focused experimentation, what kinds of
engineering work can honestly start, and what still needs more
evidence?

## TL;DR (revised 2026-05-11 night, post-adversarial review)

| Engineering decision                                   | Verdict                                                                                                                                    |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Ship a Claude Code skill for narrow micro-task routing | **GO** (with the boundary that even at micro-task scope, oracle weakness inflates pass rates — see "honest revised" finding below)         |
| Add hybrid routing to existing harness-arena pipelines | **GO**                                                                                                                                     |
| Use hybrid routing in personal/internal projects       | **CONDITIONAL GO** (only if work is bounded micro-tasks with oracles, and oracles are written by a different author than the prompts)      |
| Build the Portarium ↔ PL integration contract          | **NO** (premature; trigger not met)                                                                                                        |
| Promote hybrid as a primary engineering paradigm       | **NO** (evidence too narrow)                                                                                                               |
| Claim hybrid is novel research finding                 | **NO** (refuted by adversarial review — EQTY/Hybrid LLM/HumanLayer scoop major claims; published baselines make 100/100 the expected mode) |
| Use hybrid for real-software builds (cost-justified)   | **NO** (revised — never breaks even at any N on dollar grounds; only justified by privacy/latency/quota)                                   |
| Use hybrid for client app-build work                   | **NO** (loses tokens at app-build scope)                                                                                                   |
| Provision a real operator signer to clear §3a gate 5   | **OPTIONAL** (downgraded from GO — bookkeeping; doesn't advance any thesis hypothesis directly)                                            |

## The five same-day pilots (corrected)

| Pilot                                   | Scope-tag                  | Verdict                                      | Key number                                                                                                                        |
| --------------------------------------- | -------------------------- | -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| TODO CLI                                | `app-build-orchestration`  | Hybrid loses                                 | 2-3× more expensive than frontier-only                                                                                            |
| Micro-task v2 (full prompts) at k=10    | `micro-task` clear specs   | Hybrid wins on cost; **NOVELTY OVERCLAIMED** | 100/100 at k=10 is the expected mode (P=60% by chance from 95% baseline); cross-family review found 1 real qwen bug oracle missed |
| Micro-task v2 (starved prompts) at k=10 | `micro-task` thin specs    | Hybrid mixed                                 | **40/100** at k=10, deterministic per-task                                                                                        |
| tinymd                                  | `real-software-multistage` | Hybrid loses (revised)                       | 6/8 first-attempt, 14× more expensive at N=1                                                                                      |
| **rpncalc (cross-app reuse)**           | `real-software-multistage` | **Hybrid loses at any N**                    | 6/7 first-attempt; ~5.5k per-pilot scaffolding cost vs ~600 per-pilot saving — never breaks even                                  |

The pattern is **scope- and reuse-sensitive**, not universally
cost-positive or cost-negative.

## What is proven

1. **The routing system works mechanically.** It can build real,
   testable software end-to-end (tinymd, 24/24 oracles). It can
   reliably gate per-task code generation against deterministic
   oracles and roll back on failure.

2. **Some local-model output was real code, but spec density did real
   work.** On `parseQuery` in v2, local produced _more correct_
   behavior than frontier's pre-committed reference (handled
   `+`-as-space per application/x-www-form-urlencoded). That is a
   meaningful signal, but the dense specs also acted as answer keys and
   likely inflated performance.

3. **Two real local failure modes are characterised and learnable:**
   - Subtle code errors in generated lines (regex backslash bugs).
     Catchable by per-function tests with adversarial cases.
   - Wrong sibling-contract assumptions when prompts share
     signatures but not return types. Fixable by adding return-type
     declarations to prompts.

4. **Spec density is load-bearing.** At tutorial-quality prompts:
   10/10 micro-task pass, 6/8 real-software pass. At starved
   prompts: 4/10. The frontier author's prompt-writing effort is
   real engineering work.

5. **Three independent reviewer agents** (the TODO CLI confirmation
   - critic agents and the v2 pre-flight critic) caught real
     methodology bugs before any of these findings reached the §2a
     tracker. The dual-reviewer workflow itself is shippable.

6. **Hardware works at this size.** i7-14700K + RX 7600 XT 16GB +
   64GB RAM + Vulkan/Ollama runs qwen3-coder:30b reliably at
   ~44 tok/s and was the bottleneck in zero pilots today.

## What is not yet proven

1. **Generalisation to tasks not chosen by the experiment author.**
   All 27 tasks across the three positive pilots were curated by me
   (the frontier author) to fit shapes I knew local could plausibly
   handle. Critic agent flagged this as biggest selection bias.
   Sample bias: ~30%+ confidence interval on the headline pass rates.

2. **Adversarial oracle writing.** Oracles and prompts were both
   written by the same author (me). A different author writing
   tests would likely catch behaviors my own implementation also
   missed. Need a cross-family setup (per harness-arena's existing
   `cross-family-reviewer` design).

3. **Independent reliability.** The later k=10 micro-task sweep was a
   useful determinism check against the original oracle, but not an
   independent reliability result. The strict-format-fit smoke earlier
   today showed temperature=0 can still be non-deterministic on Vulkan.

4. **Positive cross-app scaffolding reuse economics.** The rpncalc
   follow-up measured reuse and corrected the earlier N≈12 break-even
   claim. Current measured reuse still leaves real-software multistage
   hybrid dollar-negative.

5. **Privacy / latency / quota-independence benefits.** Claimed in
   the skill doc; not measured in this session.

6. **Claim-eligibility** per program-status §3a. Zero runs across
   all four pilots satisfy the gates (strict trace, ready preflight,
   attestation, cross-family reviewer, trusted signer, and the newer
   runner-safety profile requirement). The operator signer is now
   provisioned, but no verifier-clean signed bundle exists. This is
   **independent of** the hybrid question — it's an infrastructure gap.

## Engineering decisions, with required evidence and current status

### 1. Ship the `concord-microtask-router` Claude Code skill — **GO**

Required evidence:

- ✅ At least one task class shows clear local pass at clear oracle
- ✅ Explicit boundaries documented (no app-builds, no debugging,
  no multi-file)
- ✅ Failure modes characterised
- ✅ Real-world skill consumer (Claude Code) exists

Current state: **shipped** at `skills/concord-microtask-router/SKILL.md`.
Has two pilots' worth of evidence behind its boundaries. Honest
about the modest dollar savings vs the privacy/latency benefits.

### 2. Adopt hybrid routing in harness-arena experiments — **GO**

The harness-arena's H11/H14/H15 promoted routes are already running
this pattern (per program-status §2a). Pilots confirm the general
approach. Continue running cross-arm fixtures to fill in the §2a
tracker with claim-eligible numbers.

Concrete next action: run the HA-HR1 pilot's priority-1 fixture
(H14 TDD red-green cross-arm) on a supported host with auth, so the
first claim-eligible bundle exists.

### 3. Use hybrid routing in personal/internal projects — **CONDITIONAL GO**

Use if:

- Task is a single function with a clear ≤100-token spec
- A deterministic test or property check exists
- Tutorial-quality prompts can be written

Do NOT use if:

- Task touches multiple files
- Task is debugging, refactoring, or unbounded ("add a feature")
- A wrong answer is silently accepted (oracle weak or absent)
- N=1 (only one task — frontier-only one-shot is cheaper)

### 4. Build the Portarium ↔ PL integration contract — **NO**

Trigger condition (per `docs/integration/prompt-language-runtime.md`
in Portarium): "portfolio-level positive evidence on PL's
hybrid-efficiency tracker." Current state: 2 of 4 same-day pilots
positive, 1 mixed, 1 negative — **insufficient consensus** to
harden a Portarium HTTP contract around. Wait for at least k=10
stability and a cross-app reuse measurement.

### 5. Promote hybrid as a primary engineering paradigm — **NO**

The thesis in `docs/strategy/thesis.md` aims much higher: that
prompt-language becomes the primary engineering surface for bounded
software, not just a token-saving routing layer. Today's evidence
supports the routing layer, not the primary-surface claim. Multi-file
projects, wisdom accumulation, and human-prefers-prompt-edit are all
still unmeasured per the thesis's own falsifiable hypotheses
(H2-H6).

### 6. Use hybrid for end-to-end app builds in client work — **NO** (now firmly)

Three pilots (TODO CLI, tinymd, rpncalc) show scaffolding-cost
dominance at app-build and real-software-multistage scopes. Hybrid
is 2-3× to 14× more expensive than frontier-only at N=1. The
rpncalc cross-app reuse pilot (2026-05-11 evening) measured the
actual amortisation — only ~42% of frontier scaffolding is
reusable. Per-pilot cost stays at ~5,500 frontier tokens once the
runner is genericised, vs per-pilot local saving of ~500-600
tokens. **Hybrid does not break even at any N on dollar
economics** at real-software-multistage scope.

What this means: don't pitch hybrid for client work on cost
grounds. The pattern is only justified by non-cost benefits
(privacy, latency, quota independence) for this scope.

### 7. Provision a real operator signer — **GO** (orthogonal)

The operator signer has since been provisioned in
`docs/security/trusted-signers.json`. That cleared only one procedural
blocker. Claim-eligible evidence still requires a verifier-clean signed
bundle with strict trace/state/nonce/freshness checks, real reviewer proof,
and the runner-safety profile now captured in the May 12 plan.

## Minimum experiments to flip "NO" verdicts

| Decision                            | Smallest experiment that would flip it                                                         | Estimated effort           |
| ----------------------------------- | ---------------------------------------------------------------------------------------------- | -------------------------- |
| Portarium integration contract      | Cross-app reuse pilot showing scaffolding amortises (build 2nd real-software with same runner) | ~1 hour                    |
| Hybrid as primary paradigm          | H1-H6 from `thesis.md` run with claim-eligible setup; multi-file project pilot                 | Weeks                      |
| Hybrid for client app-builds        | 5-pilot scaffolding-reuse measurement showing N≈12 break-even is real, not theoretical         | ~5 hours                   |
| Generalisation beyond curated tasks | Sample 50 random functions from a popular npm package; run v2 pattern against them             | ~2-3 hours                 |
| k≥10 stability                      | Bump v2 and tinymd to k=10 + seed sweep; recompute CIs                                         | ~30 minutes (just running) |

The 30-minute k=10 stability sweep is the highest leverage _next_
experiment — it would either firm up the headline numbers or expose
significant variance. If pass-rate at k=10 is within 2-3 percentage
points of k=3, we have stable evidence. If it swings by 10+ points,
the headlines are misleading.

## Honest summary

**Research has proved enough to start engineering on narrow scopes
with explicit boundaries — and not enough to commit to broad
architectural changes.**

The shipped skill (`concord-microtask-router`) is the right
artifact to embody today's evidence. Anything bigger needs more
runs.

The single highest-leverage engineering action this week, independent
of the hybrid question: provision an operator signer in
`docs/security/trusted-signers.json`. That unblocks claim-eligibility
for everything else.

## Cross-references

- The four pilot reports:
  - [`experiments/concord-vho-pilot-todo-cli/2026-05-11/results/report.md`](../../experiments/concord-vho-pilot-todo-cli/2026-05-11/results/report.md)
  - [`experiments/concord-vho-microtask-cost/2026-05-11/results/report.md`](../../experiments/concord-vho-microtask-cost/2026-05-11/results/report.md)
  - [`experiments/concord-vho-realsoftware-tinymd/2026-05-11/results/report.md`](../../experiments/concord-vho-realsoftware-tinymd/2026-05-11/results/report.md)
  - The local-format-fit smoke at [`experiments/local-format-fit-smoke/2026-05-11/README.md`](../../experiments/local-format-fit-smoke/2026-05-11/README.md)
- Strategy anchors:
  - [`docs/strategy/thesis.md`](thesis.md) — full thesis + kill rule
  - [`docs/strategy/program-status.md`](program-status.md) — §2a tracker
- Skill: [`skills/concord-microtask-router/SKILL.md`](../../skills/concord-microtask-router/SKILL.md)
- Portarium integration finding: [`../../../Portarium/docs/integration/prompt-language-runtime.md`](../../../Portarium/docs/integration/prompt-language-runtime.md)
