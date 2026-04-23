# The rescue-viability research plan

Date: 2026-04-20
Motivating claim (user): _prompt-language should enhance lower-capability models because PL provides pre-baked methodology (decomposition, context, retries, gates) at the top level — wisdom the model itself does not have to contain._

## 1. What "rescue" means here, precisely

Given a task T and a model M, let:

- `solo(T, M)` = pass rate of M driving the runner directly (no PL)
- `pl(T, M, φ)` = pass rate of M driving the runner under a PL flow of feature-intensity φ
- `rescue(T, M, φ) = pl(T, M, φ) - solo(T, M)`

A model M is _rescuable_ on task-class T if there exists some φ where `rescue > 0` and `pl > solo_ceiling`. A feature f _matters_ on (T, M) if removing f from φ drops `pl` measurably.

The existing scorecard only measures `rescue(H1..H10, qwen3-opencode:30b, full-pl)` — six positives, three ties, zero negatives. What it does not show:

- Where on the model-size axis does rescue start working and stop working?
- Which PL features are carrying the rescue, and which are cosmetic?
- Does rescue grow or shrink as task difficulty climbs above H10?

This plan sets up measurements for all three.

## 2. Three orthogonal axes to sweep

```
          model capability  (weakest → strongest)
             │
             ▼
 ┌───────┬───────┬───────┬───────┐
 │gemma  │qwen3  │qwen3  │frontier│      ← ceiling comparator, not local
 │e4b    │:8b    │:30b   │(claude)│
 └───────┴───────┴───────┴───────┘
          │
          ▼ task difficulty
   E-SMALL → H1..H10 → H11..H20
          │
          ▼ PL intensity
   solo → pl-lite (decompose) → pl-medium (+ retry) → pl-full (+ gate + review)
```

Fixing any two axes and sweeping the third is a legitimate sub-experiment.

## 3. Experiments to run

Numbered R1…Rn; prefix mirrors H-experiments but concerns rescue specifically.

### R1 — Model-capability sweep on a fixed easy task (E-SMALL)

**Question:** at what model capability does PL rescue kick in on a task PL already handles perfectly at 30B?

**Arms:**

- `gemma4-opencode:e4b` solo / pl-full
- `qwen3:8b` solo / pl-full
- `qwen3-opencode:30b` solo / pl-full (reuse LOCAL-MODEL-VIABILITY-FINDINGS data)

**Fixture:** reuse `e-small-fixtures/verify.js` (11 assertions, CSV→JSON CLI).

**Cost:** 4 new runs × ~5 min = ~20 min on local hardware.

**Prediction:** gemma e4b rescue = 0 (decoding trap, confirmed). qwen3:8b rescue ≥ 0 if it can literally emit JS; possibly significant. This is the cheapest experiment that could falsify the "rescue is universal" claim.

### R2 — PL-intensity ablation at a fixed medium model (qwen3:8b) on medium task

**Question:** which PL feature is carrying the rescue?

**Arms on qwen3:8b:**

- solo-aider
- pl-lite: decomposition only (one-prompt-per-file, no retry, no gate)
- pl-medium: pl-lite + `retry max 3 + if command_failed`
- pl-full: pl-medium + `grounded-by` + `review max 2` + variable capture

**Fixture:** H8 foreach batch ops (best rescue signal in H1–H10: 0/4 → 4/4). Re-measure at 8B.

**Cost:** 4 runs × ~10 min.

**Prediction:** retry + gate carries 60–80% of the win. Decomposition alone probably only 20% on H8 specifically (because solo already created the files — it just failed spec conformance). Test.

### R3 — Task-difficulty ladder at fixed model (qwen3-opencode:30b)

**Question:** at what difficulty does PL rescue die?

**Fixtures, graded:** E-SMALL (easy) → H8 (medium-easy) → H11 phase-2 (hard, known 2/12 solo → 3/12 PL).

**Arms:** solo vs pl-full at each level.

**Cost:** 3 fixtures × 2 arms = 6 runs, some already banked.

**Prediction:** rescue monotonically decays. The point where `rescue → 0` is the operational ceiling of PL at this model size. We already have partial evidence for this shape.

### R4 — Runner sensitivity of the rescue effect

**Question:** does rescue depend on the runner being thin (`aider`) vs thick (`opencode`)?

**Arms:** pl-full × {aider, opencode} at qwen3-opencode:30b on H8 and H12. Opencode runner requires the `src/` port of today's patch.

**Prediction:** aider advantages on small/medium. Opencode's inner agent partially duplicates PL's orchestration, so PL's marginal lift is smaller; the thick runner might win on wall time but lose on pass rate because opencode bypasses PL's retry loop.

### R5 — Spawn / race / review probe at fixed model (qwen3:8b)

**Question:** do PL's parallel-agent primitives add measurable rescue, or are they cosmetic at local-model scale?

**Arms on qwen3:8b on H8:**

- pl-full (serial)
- pl-full with `foreach-spawn max 2` on independent subtasks
- pl-full with `race` — two attempts, first to pass gates wins

**Prediction:** `race` wins on pass rate at the cost of ~2× wall time; `foreach-spawn` only helps if the task decomposes cleanly, which H8 does. If neither helps, these primitives are cosmetic at this scale and the research agenda should reprioritize.

## 4. Measurement protocol (non-negotiables)

- One fixture per run; no in-place mutation.
- Fixture snapshots: `fixtures/rN/input/` copied fresh to `runs/rN/<arm>/<timestamp>/` before each run.
- Pass rate: the fixture's own oracle (`verify.js`, `pytest`, `npm test`, `next build`), exit code ≤ 1 → count of passing assertions / total.
- Wall time: walltime of `prompt-language run` (for PL arms) or of the aider invocation (for solo).
- Tokens: sum of `input_tokens + output_tokens` from aider's ledger; parallel to PL's audit log.
- Retries: PL's `audit.jsonl` count of `retry_invoke` events. Solo = 0 by definition.
- Each run produces a one-page `results/rN/<arm>.md` with the above fields.

Fail-closed: if a flow aborts due to a PL runtime defect (cf. EVIDENCE-CONSOLIDATION 2 × P1), **that run is excluded, not imputed to zero**. Exclusion is noted in the per-run writeup. Anything else biases the rescue estimate.

## 5. What would falsify the rescue thesis

- R1: if `qwen3:8b` solo 1/11 and pl-full also 1/11, rescue ≈ 0 at this size. PL wisdom does not transfer below 30B on E-SMALL.
- R3: if `rescue(H11, 30B) < rescue(H8, 30B)`, PL's value shrinks with task difficulty — it's not "universal wisdom," it's "boilerplate smoothing."
- R2: if pl-lite ≈ pl-full, all the rescue is just decomposition; the gate/retry/review machinery is overhead for no gain.

Any of these should update the practical guide.

## 6. Priority order (what to run first)

1. **R1** — cheapest, clearest signal on the rescue thesis. Start now. (~20 min total.)
2. **R2** — confirms which PL feature is load-bearing. (~40 min total.)
3. **R3** — bridges rescue to operational ceiling. Largely already banked, just needs write-up.
4. **R4** — needs the opencode-runner src/ patch first (engineering debt).
5. **R5** — only run if R2 is inconclusive or surprising.

## 7. This plan is deliberately narrow

It does not address: latency/cost tradeoffs, UX of writing flows, fine-tuning as an alternative to decomposition, or comparison against fully agentic harnesses like `smol-agent` or `openhands`. Those are good research directions but they fight for attention with the rescue question. Either we know whether PL-as-wisdom works at low model capability or we don't; that question is worth answering cleanly first.
