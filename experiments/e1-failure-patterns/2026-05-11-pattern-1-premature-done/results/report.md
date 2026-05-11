---
title: E1 Pattern 1 mini-experiment — report (2026-05-11 night)
status: ad-hoc evidence — non-claim-eligible per program-status §3a
operator: 45ck
date: 2026-05-11
purpose: first concrete attempt at H4 thesis evidence
verdict: NULL RESULT (fixture too easy; pattern did not reproduce)
---

# E1 Pattern 1 mini-experiment — report

## Headline

**Pattern 1 (premature "done") did NOT reproduce on this fixture.**
qwen3-coder:30b fixed all 3 broken math functions on the first
attempt in 10/10 runs (5 baseline + 5 PL-fix). The H4 thesis claim
("PL recovery beats per-output fix") cannot be tested when the
baseline has nothing to fix.

## Result table

| Arm     | k | All-pass | Avg iter | Total tokens |
| ------- | - | -------- | -------- | ------------ |
| Baseline| 5 | **5/5**  | 1.0      | 360 (~72/run)|
| PL-fix  | 5 | 5/5      | 1.0      | 360 (~72/run)|

Both arms: identical first-attempt success. PL-fix arm never
needed to invoke its retry loop — `done when: tests_pass` returned
true on iteration 1 every time.

## Why the fixture didn't reproduce the pattern

Three specific reasons, in order of weight:

1. **The bugs are too obvious.** All three functions had a single
   wrong operator (`+`/`-`/`*` swap). qwen3-coder:30b at
   ~92.7%-class HumanEval baseline solves this kind of fix
   trivially.

2. **Single-file scope.** Pattern 1's evidence in
   `docs/evaluation/eval-analysis.md` §H2/H9/H26 is
   "gaslighting" — the agent was told tests already pass and
   skipped verification. My fixture didn't include any prompt
   gaslighting; the model was simply asked "fix the file."

3. **All bugs visible at once.** The premature-done pattern more
   commonly happens when the agent fixes one of N visible bugs and
   stops because the failure that surfaced is gone. My fixture had
   three independent bugs, but the agent fixed all three in one
   shot — qwen3-coder:30b doesn't seem to exhibit single-bug-fix-
   and-stop behavior on a fixture this simple.

## What would need to change to reproduce Pattern 1

Drawing from the eval-analysis evidence and the premature-stop
benchmark spec:

- **Add gaslighting**: include in the prompt a claim like "this
  was already fixed by another agent; just verify"
- **Hide the breadth of failure**: make the test runner only
  surface 1 failing test name per run; require multiple attempts
  to discover all of them
- **Use a model that exhibits the pattern more reliably**:
  per the eval-analysis baseline, this was measured against
  Claude / Codex with full agentic prompts, not local qwen3-coder
- **Use harder bugs**: not single-operator swaps; use logic bugs
  that require deeper reading

## Methodological learnings

This null result is itself useful evidence:

1. **Trivial fixtures can't differentiate baseline from PL-fix.**
   For H4 evidence to mean anything, the baseline must
   reliably fail. The premature-stop benchmark in
   `docs/evaluation/experiments/premature-stop-benchmark.md`
   targets ≥15pp baseline failure rate as its premise — that
   threshold is explicit because below it, you can't demonstrate
   PL-fix improvement.

2. **qwen3-coder at temperature=0 with seed-per-run is
   surprisingly robust on simple-bug-fix tasks.** The 10/10 here
   is consistent with the published-baseline evidence
   (HumanEval ~92.7%) and the v2 micro-task pilot (10/10 first-
   attempt). For H4, you'd want a task that hits qwen's
   <80% baseline.

3. **The parser-bug in `runTests`** (`# pass N` regex didn't
   match node --test output on this version of Node, so
   `finalPassed` came back 0 even when all tests passed; only
   `r.status === 0` was reliable) is a reminder that test-runner
   output format is not stable. Real H4 experiments need to
   rely on exit codes, not regex-parsed counts.

## What this null result means for E1

Pattern 1 specifically needs a **harder fixture** before H4
evidence is producible from it. Two directions:

- **Use the existing premature-stop benchmark fixtures** at
  `experiments/premature-stop-benchmark/` — they were designed
  with the failure-rate target in mind.
- **Pick a different pattern from the catalog** where qwen
  reliably fails. Pattern 5 (capture/output flake) and
  Pattern 7 (long-flow hang) and Pattern 10 (shell quoting) are
  all interpreter-level patterns where the failure is structural
  and reliably reproducible.

## What this experiment IS evidence for

- **Negative evidence** that the program's H4 test cannot be run
  on simple fixtures.
- **Positive evidence** that qwen3-coder:30b is robust on simple
  multi-bug fix tasks — supports the "spec-quality routing
  works for narrow tasks" thesis, but not H4 specifically.
- **Methodology evidence** that the baseline-must-fail principle
  is real and load-bearing for H4 testing.

## Files

- `SPEC.md` — methodology
- `fixture/math.mjs` — the broken baseline (reset at end of run)
- `fixture/math.test.mjs` — the three failing tests
- `run-experiment.mjs` — driver
- `results/manifest.json` — per-rep raw data

## Cross-references

- Pattern source: [`../CATALOG.md`](../CATALOG.md) §1
- Evidence base: `docs/evaluation/eval-analysis.md` §H2/H9/H26
- Benchmark spec:
  `docs/evaluation/experiments/premature-stop-benchmark.md`
- Bead: `prompt-language-j64j` (P1) — needs harder fixtures for
  Pattern 1
