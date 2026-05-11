---
title: Confirmation review — Concord/VHO TODO CLI pilot
reviewer: independent agent, run 2026-05-11 by 45ck via Claude Code
role: confirmation — judge whether experiment supports stated hypothesis
---

# Confirmation review

**1. Does the experiment support the stated hypothesis?**

No — it supports a weaker, methodology-contaminated version. The
headline "5/7 local, frontier on the 2 hardest" is structurally
wrong because:

- **T1 (add) was a methodology artifact, not a model failure.**
  qwen3-coder's T1 output (manifest.json:16-17) is functionally
  identical to devstral's T1 (line 28-29) and to Claude's final
  repair (workspace/todo.mjs:5-8) — all three implement
  `max(id)+1` correctly. Both locals failed only because
  oracle/todo.test.mjs:31-38 (`T1_add_after_remove_does_not_reuse_id`)
  calls `todo.remove()` which was still the throw-stub at T1's
  gate. The router runs tasks **strictly in declaration order**
  with no dependency-aware scheduling (router.mjs:159-215). The
  oracle had a hidden cross-task dependency that the spec did not
  surface.
- **The spec's hypothesis-support condition required T5 and T7 as
  the failed-hard tasks.** T5 passed local (manifest:100-119), and
  T1 (trivially "easy" per the spec's own falsification clause at
  spec.md:108-109: "frontier escalations on the easy tasks
  T1/T2/T6") was one of the two failures. Read literally, the
  spec's *falsification* clause is what triggered, not its support
  clause.

After correcting for the dependency artifact: real result is closer
to **6/7 locally correct, 1/7 (T7) genuinely needs frontier** — but
this is a re-interpretation, not what the experiment-as-run produced.

**2. Independent grading of "local-pass" tasks**

- **T2 list** (manifest:42-49): Correct. Empty→'empty', distinct
  `[x]`/`[ ]` markers. Real solution.
- **T3 complete** (manifest:69-71): Correct but with a suspicious
  tell — the "not found" detection compares
  `newItem.every((item, index) => item === state.items[index])`
  after a `.map` that returns a new object on match. This works
  only because `===` on the unchanged items is identity-true. Not
  pattern-matched, but unidiomatic; passes oracle correctly.
- **T4 remove** (manifest:90-91): Correct, idiomatic. Real solution.
- **T5 save/load** (manifest:111-112): Correct. Real solution.
- **T6 formatJson** (manifest:132): Trivial one-liner, correct.

**No qwen3-coder hardcoded-prime-list-style cheating found.**
Oracles are strong enough (deepEqual, roundtrip, mutation checks at
oracle/todo.test.mjs:39-44, 76-81, 117-120) that a memorized
lookup wouldn't generalize.

**3. Independent grading of "frontier-required"**

- **T1 (add)**: As above — code was correct. **Oracle ordering
  bug, not a model failure.**
- **T7 (runCli)**: Both locals had **real bugs**. qwen3-coder
  (manifest:153) called `add(state, arg1)` and `complete(state, ...)`
  and `remove(...)` **without assigning the return value** —
  these are pure functions per spec, so state never updated; also
  called `save(opts.todoFile, state)` with arguments reversed
  (signature is `save(state, path)`). Devstral (manifest:165) also
  reversed `save(state, todoFile)` — wait, devstral got that
  right, but it called `formatJson(list(state))` (passing a string
  to formatJson) which breaks the `--json` test. Both genuinely
  failed; T7 frontier-need is legitimate.

**4. Net verdict**

This experiment is **too contaminated to cite as evidence for the
hybrid hypothesis as stated**, but it is moderately useful as
proof-of-life:

- The *actual* signal — locals correctly produced 6/7 functions
  and the 1 hard one (T7, with shared-mutable-state coordination
  across multiple helpers) needed frontier — is consistent with
  the hybrid hypothesis but was *not* what the manifest's
  pass/fail reports. Citing the 5/7 number is misleading; citing
  the corrected 6/7 requires a manual re-read the spec did not
  require.
- The oracle design is the real flaw: per-task slices that depend
  on **other tasks' implementations** (T1's third test calls
  `remove`) violate the spec's own "Each task = ... a specific
  slice of todo.test.mjs" framing (spec.md:54). This is a
  methodology bug worth fixing before the next pilot — either
  topologically order tasks, stub-out cross-task helpers in the
  test, or score per-task on isolation.
- Strict-format-fit smoke pattern (hardcoded prime list) **did
  not recur here**.
- Already non-claim-eligible per spec.md:3. Recommend filing as:
  *"hybrid path completed the app; per-task local-success rate
  not reliably measurable from this run due to inter-task oracle
  coupling; T7-class coordination tasks remain a credible
  frontier-escalation candidate."*

Strength: **weak proof-of-life, not evidence for the support
condition.**
