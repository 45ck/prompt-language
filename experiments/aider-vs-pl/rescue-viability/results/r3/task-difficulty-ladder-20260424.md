# R3 task-difficulty ladder synthesis

run_id: r3-task-difficulty-ladder-20260424
timestamp_utc: 2026-04-24T02:35:00Z
fixture: e-small, h8, h11-phase2
runner: aider
model: qwen3-opencode:30b
pl_intensity: solo, pl
excluded: false
excluded_reason: "synthesis only; no new compute run"

## Question

At fixed local model capacity (`qwen3-opencode:30b`), does PL rescue survive as
task difficulty increases?

R3 uses banked artifacts only. It is a ladder synthesis, not a new arm and not a
claim-eligible result bundle.

## Evidence Table

| Difficulty | Fixture                 | Solo                | PL                                  | Delta | Source                                                                                                        | Caveat                                                                                                                                    |
| ---------- | ----------------------- | ------------------- | ----------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Easy       | E-SMALL CSV CLI         | 11/11               | 11/11 manual PL-style decomposition | 0     | `results/r1/qwen3-opencode-30b-solo-r1e-commonjs-20260424.md`, `LOCAL-MODEL-VIABILITY-FINDINGS.md` section 2d | Real PL+aider 30B E-SMALL was not rerun in this rescue folder; manual PL-style arm is parity evidence only.                               |
| Medium     | H8 foreach batch ops    | 0/4 spec-conformant | 4/4 spec-conformant                 | +4    | `results/h8-batch.md`, `EVIDENCE-CONSOLIDATION.md` section 2                                                  | Phase-1 narrative evidence: N=1, no predeclared fixture, no reproducibility manifest.                                                     |
| Hard       | H11 multi-file refactor | 2/12                | 3/12                                | +1    | `results/h11-phase2/scorecard.json`, `results/h11-phase2/README.md`                                           | k=1 rigor-scaffolding pilot; not blinded, not signed, no cross-family reviewer, known oracle contamination from `.aider.chat.history.md`. |

## Result

The ladder does not support a broad "PL wisdom scales with task difficulty"
claim.

The observed shape is narrower:

- Easy task: the 30B local model already reaches the ceiling solo, so PL has no
  headroom.
- Medium gate-heavy task: PL's decomposition/scoping/gate pattern shows a large
  phase-1 lift, but that evidence is not claim-grade.
- Hard multi-file refactor: both solo and PL fail; PL wins by only one
  assertion while taking 1.48x wall time.

This is not monotonic rescue. It is a capability-band result: PL helps most when
the model can write plausible code but needs external structure, scoped prompts,
and gate feedback. Once the task is above the model's implementation threshold,
the PL wrapper does not by itself create enough capability.

## Decision

R3 satisfies the roadmap falsifier as an honest negative/pivot signal.

Do not expand into R5/R6 multi-agent local races as the next default step. The
current evidence says the higher-value path is either:

1. repeat H11 with a better-controlled runner/context setup to test whether the
   2/12 to 3/12 ceiling is an aider/context failure, or
2. keep work in the qwen3:8b band where R2/R9 show concrete rescue mechanisms
   and measure cost/reliability with N>=3.

## Timeout and Runtime Notes

No new long-running LLM process was launched for R3. The synthesis reuses banked
artifacts whose timeouts and runtime caveats are recorded in their respective
result files. For future reruns, use bounded shell timeouts, bounded aider turn
timeouts, and explicit in-flow oracle timeouts as in R9-E.

## Bottom Line

For `qwen3-opencode:30b`, local inference is viable on easy tasks, PL can help
on medium gate-heavy tasks, and H11-class multi-file refactors remain below the
reliable local-model threshold under the current aider runner.

## Follow-up: Phase-6 H11 Pilot

After this synthesis, phase-6 added a fixed-denominator H11 oracle and a
repeatable context-controlled harness. The first pilots did not justify
launching a `k>=3` series: solo stayed at 2/11, PL reached 7/11 with
`task-artisan.flow` but timed out at 1200s, and `qwen3-opencode-big:30b` with
`task-artisan-v5.flow` timed out at 6/11 after 1800s.

A later H11-specific correction changed the result: `task-artisan-v6.flow` plus
separate outer/per-turn timeouts and opt-in scoped-message prompting completed
cleanly at 11/11 in 370s. Treat that as a corrected-protocol precondition for
repetition, not as a broad rescue claim. The generic `npm run eval:smoke:aider`
check still fails on local-model capture/context cases in this environment.
