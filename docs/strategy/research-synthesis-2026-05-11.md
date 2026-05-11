---
title: Research synthesis — what we should do now and why (2026-05-11)
status: synthesis across internal program docs, external literature, competitive landscape; non-claim-eligible per program-status §3a
operator: 45ck
date: 2026-05-11
based-on: 3 parallel research agents (internal docs sweep, external white papers, competitive landscape map)
---

# Research synthesis — 2026-05-11

<!-- cspell:ignore internalise lynchpins tinymd rpncalc Khattab Neur Tripwired standardises neighbours smolagents productised SLSA optimisation neighbour ICSE ICSME PLDI Portarium unrealised -->

> **Supersession note (2026-05-12):** This synthesis is retained as historical
> context, but its novelty and priority claims were revised by
> [Research Synthesis Challenge and Defense](research-synthesis-challenge-and-defense-2026-05-11.md)
> and [Current Plan After May 11 Evidence](current-plan-2026-05-12.md). In
> particular, the `100/100` micro-task result is directional engineering signal,
> not claim-grade novelty, and operator signer provisioning is no longer the main
> blocker by itself.

After today's five engineering-readiness pilots, three parallel
research agents pulled the camera back: internal docs the program
already knew, external academic literature, and the competitive
landscape. Here's the unified picture and the resulting
recommendation.

## Headline

**Today's micro-task pilots are not a waste, but they are not the
thesis.** They are positional engineering-readiness work.
The program's actual thesis (H1-H6 in `thesis.md`) is largely
untested, and the most exciting and publishable contribution
the program could make is the _unification_, not any individual
piece.

## Three findings to internalise

### 1. The program already knew most of what today's pilots discovered

Internal-research agent finding (per its full report
`docs/strategy/day-summary-2026-05-11.md` cross-references):

- **FSCRUD R30-R45 already established** that local models work as
  _bounded semantic selectors inside a deterministic envelope_, not
  as autonomous implementers. My v2 spec-density ablation
  rediscovered a slim version of this finding.
- **The thesis (`docs/strategy/thesis.md`) lists H1-H6 falsifiable
  hypotheses.** H1 (gates work) is partially supported. H4
  (recovery logic encoded in PL), H5 (parallel specialist
  coordination), H6 (PL as primary engineering surface) are the
  thesis lynchpins and are **untested**.
- **E1 (10 distinct failure patterns), E3 (wisdom file
  accumulation), E5 (parallel specialist orchestration) were
  designed in detail and not run.** E5's full-SDLC E7 enterprise
  factory failed at live-smoke 2026-04-17, blocking parallel-
  coordination evidence.
- **Today's pilots are explicitly framed as engineering-readiness,
  not thesis evidence.** The program's positioning
  (`docs/strategy/positioning.md`) intentionally narrows the
  shipped product claim to "supervision runtime" — not the larger
  "primary engineering surface" thesis. Honest about evidence
  boundaries.
- **Kill rule: mechanistically reachable in 2-3 more pilots.** With
  TODO CLI (negative), tinymd (negative), rpncalc (negative), the
  hybrid pattern at non-micro-task scope is one or two more
  failure-class results away from the formal kill threshold.

### 2. External literature: the unified play is unclaimed

External-research agent finding:

- **DSPy (Khattab et al., NeurIPS 2023)** is the canonical
  "programs as compiler artifacts" claim. T5-770M and Llama2-13b
  DSPy programs match GPT-3.5 prompt chains. This is the closest
  theoretical anchor for PL's larger thesis.
- **Verification-first runtimes exist separately:** AgentGuard,
  AgentSpec (closest published analogue to a PL flow), Compiled
  AI, Tripwired. None combine deterministic gates + retry
  semantics + signed witness chains in a single executable
  program.
- **Cost-aware routing exists separately:** FrugalGPT (98% cost
  cut), RouteLLM (ICLR 2025), BEST-Route, Arch-Router,
  Speculative Thinking. None tie routing decisions to
  verification-gate outcomes.
- **Signed AI provenance exists separately:** Atlas
  (arxiv:2502.19567) chains per-cycle Merkle trees;
  draft-sharif IETF standardises per-inference output signing.
  None tie this to executable agent flows.
- **Oracle weakness is the dominant unsolved problem:**
  SWE-Bench+ found 47.93% of "resolved" SWE-Bench issues passed
  weak tests. Resolution rate dropped from 51.7% to 25.9% on
  Verified after filtering. ACH/Mutation-Guided LLM Test
  Generation (FSE 2025) is the state of the art.
- **The k=10 100/100 deterministic substitution result for
  well-specified single-function tasks (today's v2 micro-task
  pilot at full prompt density) is genuinely novel signal.**
  No published paper isolates this task class with this finding.

### 3. Competitive landscape: the position is empty

Competitive-landscape agent finding:

- **Closest neighbours:** LangGraph (workflow gates +
  checkpoints, no signed trace), Aider (architect/editor cost
  split, no gate-driven escalation), Continue.dev (CI-enforceable
  rules, IDE-bound).
- **Per-dimension gaps in the entire field:**
  - Verification gates as first-class workflow primitives:
    LangGraph has it, Continue.dev has it. Most don't.
  - Hybrid local/frontier routing: Aider, OpenCode, smolagents
    all have it. RouteLLM is the cleanest published version
    (~85% cost cut). Most don't tie it to gate outcomes.
  - Signed witness chains for agent execution:
    Agent-Sentry/ProvSEEK exist as research, **none productised
    for coding agents**.
- **The unique unclaimed position:** a runtime where (a) every
  gate outcome appends to a signed Merkle witness chain, (b) the
  router escalates to frontier only when local fails a gate N
  times — turning the chain into the cost signal, and (c) the
  chain is published as build provenance (SLSA-style
  attestation) that downstream CI can cryptographically verify
  rather than trust model self-reports.

## The exciting thing we're working towards

**Auditable hybrid orchestration with signed proofs of
equivalence.**

In long form: an executable program where engineers write
flows like

```
let plan = prompt using "frontier-architect" : design ${task}
foreach step in ${plan}
  retry max 3
    let attempt = prompt using "local-worker" : implement ${step}
    done when: tests_pass and lint_pass
    if not done
      let attempt = prompt using "frontier-repair" : fix ${attempt} given ${failures}
    end
  end
end
attest run as operator-signed
```

…and the result is not a guess about whether the agents did the
right thing — it's a **signed, hash-chained, replayable
attestation** that an external auditor (or downstream CI) can
verify cryptographically. The router's choice of local vs
frontier is not a heuristic; it's _driven by gate outcomes
recorded in the witness chain_. The cost saving is a
side-effect of the verification pattern, not the goal.

This makes hybrid orchestration **auditable engineering with
signed proofs of equivalence** rather than vibes-based cost
optimisation.

It's the first time the field has had a single executable
artifact that combines all four:

1. Programs-as-engineering-medium (DSPy-style)
2. Verification-first deterministic gates (AgentSpec/Compiled AI)
3. Hybrid local/frontier routing (FrugalGPT/RouteLLM)
4. Signed Merkle witness chain (Atlas/IETF draft)

PL has all four pieces shipping in `src/` already. None are wired
together as a single user-visible flow that produces an
attested-by-default bundle.

## The thesis-level claim PL is positioned to prove

(Verbatim from external-research agent.)

> _Spec density is a measurable, ex-ante predictor of when a
> deterministic local-model substitution is provably safe under
> adversarial cross-family verification, turning hybrid
> orchestration from a heuristic cost-saver into an auditable
> engineering discipline with signed proofs of equivalence._

Today's v2 ablation (full vs starved at k=10) is the **first
empirical evidence** for the spec-density part of this claim
— specific, measurable, deterministic. The witness-chain part
is shipped but unused. The "provably safe under adversarial
cross-family verification" part exists in code (cross-family
reviewer is shipped at `scripts/experiments/meta/cross-family-review.mjs`)
but has not been wired into any micro-task pilot.

## What we should do next, ranked by leverage

### 1. Provision the operator signer (~30 min)

Without it, every new run continues being "non-claim-eligible
engineering signal" forever. With it, every subsequent pilot
produces an attested bundle, and the **signed witness chain**
becomes the program's actual differentiator vs every neighbour
in the landscape. This is one ed25519 keypair commit and ~50
lines of `docs/security/trusted-signers.json`. Per
program-status §3a, it gates everything else.

### 2. Re-run rpncalc (or v2) using the actual PL flow runtime, not my hand-rolled router (~2-3 hours)

Today's pilots used `node` + Ollama HTTP. The actual `prompt-language ci --runner ollama` path is shipped and unused
in any of today's evidence. Running one pilot through the real
DSL with `retry max 3` + `done when: tests_pass` + `attest`
would (a) test whether multi-attempt repair recovers the
starved-prompt failures (potentially flipping 4/10 → higher),
(b) produce the program's first cryptographically-attested
hybrid run, and (c) measure whether scaffolding cost actually
drops when the runtime does the work my router did.

### 3. Wire cross-family reviewer into the v2 pilot (~1 hour)

The `cross-family-reviewer.mjs` is shipped. v2's headline
"100/100 at k=10" was scored by an oracle whose tests I (the
prompt author) wrote. Running a different model lane to
independently grade the same outputs is the **adversarial
cross-family verification** part of the thesis claim. If
cross-family agrees: the headline holds and we have stronger
evidence. If it disagrees: we found a real bias in our own
oracle.

### 4. Run E1 (repeated-failure-elimination) at scale (~1-2 days)

This is the actual H4 thesis test. Curate 10 distinct recurring
failure patterns from real Claude Code/Codex usage, run baseline
agent workflows, encode the fixes into PL (gates, retries,
escalation rules), rerun the same task family. Success criterion:
fewer repeated interventions, lower cleanup time, higher pass
rate, **failures shift from known patterns to new patterns**.
Per `thesis.md` §"Experiments that can prove or disprove the
thesis" §1.

### 5. Eventually: write the short paper (~2-4 weeks)

Three things together would be a defensible 6-8 page paper at a
SE/PL conference (FSE, ICSE Industrial, ICSME, PLDI Workshops):

- **Taxonomy of task scopes** (`micro-task` / `sibling-contract`
  / `multistage` / `app-build`) with the 5-pilot evidence base.
- **Spec-density metric** that predicts ex-ante when local
  substitution is safe.
- **Witness-chain replayability** as the methodological
  contribution that distinguishes PL from FrugalGPT-style cost-
  routing benchmarks.

The published competitors (RouteLLM, FrugalGPT, BEST-Route,
DSPy) all measure cost/quality but none provide
**reproducibility from a signed trace**. That's the academic-
legibility wedge.

## What we should NOT do next

- **Don't run more micro-task pilots.** The 100/100 result is
  the novel signal. Rediscovering it adds nothing.
- **Don't try to push real-software-multistage hybrid past
  break-even on cost grounds.** Today's rpncalc pilot
  empirically refuted that claim. The honest play is privacy/
  latency/quota benefits, not dollars.
- **Don't build the Portarium ↔ PL contract yet.** The trigger
  isn't met. Premature.
- **Don't promote the larger primary-engineering-surface
  thesis (H6) yet.** The hardest hypotheses (H4-H6) have no
  evidence; today did not change that.

## Why this matters

The program has been doing honest research and shipped a real
skill today. But viewed against the field, the **biggest
unrealised lever is the unification of pieces the program
already has shipped separately**:

- Witness chain: shipped (`scripts/eval/verify-trace.mjs`)
- Cross-family reviewer: shipped (`scripts/experiments/meta/cross-family-review.mjs`)
- Attestation: shipped (`scripts/experiments/meta/attest.mjs`)
- Local-frontier routing (manual): shipped
  (`experiments/harness-arena/h11/h14/h15-*-routing-policy.mjs`)
- Flow DSL with `retry`/`done when`: shipped
  (`src/parser`, `src/runtime`)

What's missing is **one user-visible flow that exercises all
five in a single attested bundle**. That bundle would be the
first of its kind in the published landscape, and it would
flip §3a claim-eligibility from "zero runs satisfy" to "one
or more runs satisfy" — instantly clearing the gate that
blocks everything else.

The smallest concrete next move is the operator signer. The
single most thesis-advancing move is wiring the existing
pieces together for one rpncalc-or-v2 attested run.

## Cross-references

- Today's day summary: [`day-summary-2026-05-11.md`](day-summary-2026-05-11.md)
- Today's engineering-readiness verdicts: [`engineering-readiness-2026-05-11.md`](engineering-readiness-2026-05-11.md)
- Long-form thesis with H1-H6: [`thesis.md`](thesis.md)
- Living program-state: [`program-status.md`](program-status.md)
- Existing cross-family reviewer design: [`cross-family-reviewer.md`](cross-family-reviewer.md)
- Existing thesis-roadmap with E1-E5 priorities: [`thesis-roadmap.md`](thesis-roadmap.md)
- Existing FSCRUD bounded-choice evidence: [`../evaluation/2026-05-06-evidence-snapshot.md`](../evaluation/2026-05-06-evidence-snapshot.md)
