# Research Synthesis: 2026-05-06

This document summarizes what the prompt-language research program currently
indicates across shipped runtime work, A/B experiments, factory runs, and local
model diagnostics.

It is intentionally conservative: a hypothesis is only marked supported when the
repo has concrete run evidence, not just a plausible design.

## Bottom Line

The research so far supports prompt-language as a **verification-first supervision
runtime**. The strongest mechanisms are deterministic gates, retry loops, scoped
decomposition, review structure, and evidence capture.

The research does **not** yet support the larger thesis that prompt-language is a
primary engineering medium. That remains an open research direction.

For local models, the strongest current result is narrower still: local inference
works best as a bounded semantic selector/ranker/rationale source inside a
deterministic PL envelope. It is not yet a reliable autonomous implementer.

## Hypothesis Verdicts

| Hypothesis                                                                  | Current verdict         | Evidence                                                                                                           | Boundary                                                                                          |
| --------------------------------------------------------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| Gates and retry improve failure-prone bounded work.                         | Supported               | E1 seed, E7-MK, Aider H2/H5/H8, repo CI/gate behavior.                                                             | Strongest when the oracle is executable and visible enough for repair.                            |
| Decomposition helps local models on non-trivial tasks.                      | Directionally supported | Aider H3/H8/H9 and local ladder results.                                                                           | Over-staging can hurt; H14 favored solo.                                                          |
| PL improves auditability and process fidelity.                              | Directionally supported | E4 CRM factory artifacts, scorecards, manifests, trace-oriented evidence.                                          | The signal is useful, but some rubrics reward PL's own structure and are not independent oracles. |
| PL is faster than direct prompting.                                         | Rejected for now        | E4 and Aider results repeatedly show PL overhead; direct Codex was faster in the key CRM comparison.               | Runtime overhead may be acceptable when correctness, auditability, or zero API cost matters.      |
| Local models can build a full-stack CRUD app through better prompting.      | Not supported           | FSCRUD R30-R39 showed brittle implementation, artifact following, and senior-plan authoring.                       | Deterministic scaffolds can make protected controls pass; that is not local product authorship.   |
| Local models can make bounded semantic choices under PL control.            | Supported, medium       | FSCRUD R40-R45: section selection, decision matrix, rubric choice, weighted ranking, rationale, and risk response. | Product behavior, schema repair, rendering, and verification were deterministic.                  |
| Senior-engineer prose alone improves local-model implementation quality.    | Not supported           | FSCRUD R38-R39: senior-plan payloads were shallow or failed deterministic quality scoring.                         | Senior structure may still help if converted into bounded executable checks.                      |
| Multi-agent PL improves throughput on this local host.                      | Not supported           | Single-GPU Ollama queueing makes local parallelism mainly isolation/review, not speed.                             | Multi-agent may still help quality or isolation when seams are real.                              |
| Structured prompts alone are equivalent to PL runtime execution.            | Rejected                | E8 showed Claude followed flow-like text, but runtime hooks/gates did not activate.                                | Process-shaped output is not the same as runtime-controlled execution.                            |
| PL can become the primary engineering surface for bounded software systems. | Untested                | No claim-eligible evidence yet for flow-first maintenance, wisdom accumulation, or engineer preference.            | The product can still succeed as a supervision runtime if this remains unproven.                  |
| Hybrid local/frontier routing is the right operating model.                 | Motivated, untested     | FSCRUD suggests local for bounded choice and frontier for high-ambiguity review; HA-HR1 is designed.               | Needs live arms with frontier calls tracked separately from local-only claims.                    |

## What Has Held Up

### Verification Beats Self-Report

The most durable result is that real gates beat model self-report. When a task can
be checked by tests, scripts, hidden oracles, or explicit file predicates, PL has a
clear role: keep the loop alive until evidence passes or a bounded failure state is
reached.

### Structure Helps When It Matches the Failure

PL helps when the flow gives the model the right amount of structure: scoped files,
explicit failing assertions, retry budget, and concrete repair feedback. This is
why gate-heavy and decomposition-heavy tasks look better than broad prose-only
tasks.

### Auditability Is a Real Product Value

Even when direct Codex is faster, PL produces better experiment artifacts:
manifests, trace summaries, scorecards, run boundaries, and explicit gates. That is
a practical value independent of the larger thesis. The evidence is still marked
directional because several scorecards measure process shape partly by PL-native
artifact quality.

### Local Models Need a Deterministic Envelope

The FSCRUD sequence shows the useful local-model boundary. The local model can rank,
choose, and provide short criteria-grounded rationale when PL owns the option set,
shape normalization, rendering, protected files, and verification.

## What Failed or Narrowed

### "Better Prompting Makes Local Models Senior Engineers"

This did not hold up. Richer senior prose did not make the local model reliably
author concrete senior plans or implement the full product. R39 is the key
falsifier: the local senior plan stayed shallow under deterministic scoring.

### "More Agents Means Faster"

On this single-GPU local setup, parallel local inference is queue-bound. Multi-agent
still matters as a way to isolate responsibilities and compare outputs, but not as
a speed primitive.

### "Factory Shape Proves Runtime Execution"

Large flow-shaped artifacts are not enough. E8 and the E6/E7 live-smoke failures
show that the difference between structured prompt text and actual PL runtime
control must stay explicit.

### "PL Always Wins"

The evidence is mixed. PL wins where gates, decomposition, and recovery match the
task. It can lose on trivial tasks, over-staged flows, or raw throughput.

## What Remains Unproved

- Multi-file PL projects are more maintainable than single large flows.
- Wisdom or memory reduces repeated human correction across runs.
- Engineers prefer editing PL artifacts before code on real maintenance tasks.
- Hybrid local/frontier routing improves cost per verified success.
- A PL-authored change to PL can pass a claim-grade self-hosting run.
- Local models can own even one tiny implementation slice under strict scope and
  hidden verification.

## Research Direction Implied

The next useful research should not be a larger factory or another selector-only
FSCRUD pass.

The next sequence should be:

1. **Package the bounded-choice pattern** as a reusable workflow example.
2. **Run the tiny local implementation slice** to test whether local ownership can
   expand by exactly one dimension.
3. **Run a clean hybrid-routing pilot** with local-only and frontier-assisted claims
   kept separate.
4. **Return to thesis-level experiments** only after the runtime/product evidence is
   stable: wisdom accumulation, multi-file maintainability, and engineering surface
   preference.

Keep only two active research tracks at once until one produces locked evidence:
the runtime-truth/claim-eligibility track and one bounded value-lift track. Do not
merge `solo-local`, `pl-selector`, `pl-tiny-impl`, and hybrid-frontier evidence
into a single "local model works" claim.

## Evidence Quality Notes

| Evidence family            | Strength            | Notes                                                                                                    |
| -------------------------- | ------------------- | -------------------------------------------------------------------------------------------------------- |
| Repo runtime and CI        | Strong              | Current product/runtime claims are backed by tests and CI.                                               |
| E7-MK marketing factory    | Medium-strong       | Repeated small-scope wins with deterministic checks; not general software delivery proof.                |
| E4 CRM factory             | Medium-directional  | Useful comparative evidence; direct Codex faster, PL more auditable, but rubric independence is limited. |
| Aider H1-H10               | Directional         | Useful historical signal, but not claim-eligible thesis proof.                                           |
| FSCRUD R30-R45             | Medium diagnostic   | Strong for boundary finding; not a claim-grade full-product local implementation batch.                  |
| E6/E7 large factories      | Weak for completion | Good stress scaffolds; failed or partial live smoke means no clean runtime completion claim.             |
| HA-HR1 / SPP / E5 / thesis | Designed only       | Important plans, but no outcome evidence yet.                                                            |

## Current Answer to "Did Our Hypotheses Come True?"

Some did, but narrower than originally hoped.

The **runtime supervision hypothesis** has held up: gates, retries, state, review,
and scoped decomposition are useful.

The **local autonomous engineering hypothesis** has not held up. Local models are
not yet reliable full-stack implementers under prose supervision.

The **bounded local judgment hypothesis** has emerged as the strongest new finding:
local models can contribute useful semantic decisions if PL owns the deterministic
control plane.

The **primary engineering medium hypothesis** is still open. It needs evidence that
humans can maintain and evolve software more effectively by editing PL projects
first. We do not have that evidence yet.
