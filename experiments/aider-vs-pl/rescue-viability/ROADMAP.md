# Rescue-viability research program: execution roadmap (R1..R10)

Date: 2026-04-20. Epic bead: `prompt-gysa`. Standalone reference; do not assume reader has seen `RESCUE-VIABILITY-PLAN.md` or `MULTI-AGENT-REVIEW.md`.

## 1. Dependency graph

```
                    [infra: aider P1 x2 (EVIDENCE-CONSOLIDATION §3)]
                    [infra: opencode src-port (bead prompt-l1xz)]
                    [infra: child-index DSL (bead prompt-nba9)]
                    [infra: gate evaluator cwd bug (LIVE-NOTES)]
                                     |
                                     v
   R1 (qwen3:8b + PL-full on E-SMALL, N>=3)  <-- root node
        |          |          |
        v          v          v
       R2         R3         R8         R9        R10
     (PL       (difficulty  (spec     (review    (send/
     intensity)   ladder)   reviewer)  vs retry)  receive)
        |
        v
       R5 (spawn/race/review local probe)
        |
        v
       R6 (heterogeneous race; needs VRAM fit)

   R4 (runner sensitivity) depends only on opencode src-port (bead prompt-l1xz), independent of R1
   R7 (foreach-spawn Next.js) depends on beads prompt-l1xz AND prompt-nba9, independent of R1
```

Parallelisable: R1 runs in foreground; R4 can proceed whenever src-port lands; R7 blocked until both multi-agent beads close.
Serial: R2 -> R5 -> R6. R3, R8, R9, R10 all block on R1 baseline numbers (otherwise rescue delta is undefined).

## 2. Per-experiment readiness

| R   | Fixture                    | Flow                                   | Runner OK               | Baseline                                                                                                  | Wall/arm  | Arms                   | Notes                             |
| --- | -------------------------- | -------------------------------------- | ----------------------- | --------------------------------------------------------------------------------------------------------- | --------- | ---------------------- | --------------------------------- |
| R1  | e-small (verify.cjs fixed) | yes                                    | aider                   | solo 30b R1-E 11/11; 8b solo R1-A 1/11 timeout; PL-full 5/11, 5/11; gemma4 e4b 3/11; earlier 9/11 outlier | 8-15 min  | 6 (3 models x 2) + N=3 | First-pass R1 complete; R2 next   |
| R2  | H8 foreach copy            | needs 3 variants (lite/medium/full)    | aider                   | H8 30b 0/4->4/4                                                                                           | 10-15 min | 4                      | Gate carries most lift hypothesis |
| R3  | E-SMALL, H8, H11ph2        | exists                                 | aider                   | banked at 30b                                                                                             | 5-30 min  | 6 (mostly banked)      | Mostly write-up                   |
| R4  | H8, H12                    | exists                                 | aider + opencode        | H8 30b 4/4                                                                                                | 10-20 min | 4                      | Needs bead prompt-l1xz closed     |
| R5  | H8 with spawn/race         | not written                            | aider + PL_SPAWN_RUNNER | R2 results                                                                                                | 15-30 min | 3                      | VRAM: 8b+8b fits                  |
| R6  | E-SMALL                    | not written                            | PL_SPAWN_RUNNER=aider   | R1 numbers                                                                                                | 20-40 min | 1 race                 | VRAM thrash predicted             |
| R7  | nextjs scaffold v2         | v2 exists; needs foreach-spawn variant | opencode                | ~30 min seq                                                                                               | 30-40 min | 3 (seq, max=2, max=6)  | Beads prompt-l1xz + prompt-nba9   |
| R8  | E-SMALL                    | not written                            | 2 models via spawn      | R1 numbers                                                                                                | 15-25 min | 2                      | Heterogeneous models              |
| R9  | E-SMALL                    | review-variant of R1 flow              | aider                   | R1 PL-full                                                                                                | 12-20 min | 1                      | Direct swap retry->review         |
| R10 | nextjs scaffold            | not written                            | aider or opencode       | R7 baseline                                                                                               | 30-45 min | 1                      | send/receive orchestration        |

Total new arms: ~30. Banked: ~4.

## 3. Execution order (next 15 runs)

Each row = one arm. Ordered for blocker-retirement + falsification-power per hour.

1. R1-A qwen3:8b solo-aider on E-SMALL (no PL). **Done 2026-04-24:** timeout at 1800s, empty `csv2json.js`, 1/11.
2. R1-B qwen3:8b PL-full on E-SMALL rep 2. **Done 2026-04-24:** first attempt invalidated by ESM/CommonJS fixture hygiene; corrected run scored 5/11.
3. R1-C qwen3:8b PL-full on E-SMALL rep 3. **Done 2026-04-24:** corrected run scored 5/11, same header/data-row bug as R1-B.
4. R1-D gemma4-opencode:e4b PL-full on E-SMALL (confirm floor). **Done 2026-04-24:** 900s timeout, no implementation file, 3/11.
5. R1-E qwen3-opencode:30b solo-aider on E-SMALL (re-measure ceiling under current aider P1 patches). **Done 2026-04-24:** 11/11 in one solo attempt.
6. R2-A qwen3:8b pl-lite (decompose only) on H8. **Done 2026-04-24:** reconstructed H8 fixture, no retry/gate, 4/4.
7. R2-B qwen3:8b pl-medium (lite + retry) on H8. **Valid 2026-04-24 on semantic v3 fixture:** corrected retry-scoping v3b completed cleanly at 20/20 across N=3 after two excluded operational attempts scored 12/20 and 19/20.
8. R2-C qwen3:8b pl-full on H8. ~18 min.
9. R2-D qwen3:8b solo on H8. **Done 2026-04-24 on reconstructed fixture:** 4/4, so reconstruction is too easy for rescue evidence.
   Hardened semantic v3 follow-up: solo 18/20 vs PL-lite 15/20, so decomposition alone did not rescue qwen3:8b.
10. R3-A qwen3-opencode:30b solo on H11 phase-2 (if not banked under current patches). ~25 min.
11. R9-A qwen3:8b PL-review-max-3 (no retry) on E-SMALL. **Done 2026-04-24 as R9-E v4:** clean PL exit 0, 11/11, 482s, qwen3:8b at 100% GPU. Earlier R9-A..D attempts excluded while hardening the flow.
12. R4-A qwen3-opencode:30b PL-full on H8 via opencode runner (post-bead prompt-l1xz). ~20 min.
13. R4-B qwen3-opencode:30b PL-full on H12 via opencode runner. ~25 min.
14. R5-A qwen3:8b PL-full + race(8b, 8b) on H8 (sanity: race of same model). ~20 min.
15. R5-B qwen3:8b PL-full + foreach-spawn max 2 on H8. ~25 min.

Runs 1-5 retire the R1 baseline. Runs 6-9 isolate the load-bearing PL feature. 10-11 test falsifiers directly (difficulty decay, retry-vs-review). 12-15 branch into runner and multi-agent only after baseline solid.

## 4. Stop conditions per experiment

- R1: if 3-rep mean rescue(8b) >= +3/11 with non-overlapping variance vs solo, continue. If <= +1/11 or variance overlaps, thesis fails at 8B; stop and pivot to R3 to map the working band on 30B only.
- R2: if pl-lite >= 80% of pl-full, retry/gate are cosmetic; stop at R2, do not run R5/R9.
- R3: if rescue monotonically decays E-SMALL -> H8 -> H11, publish negative; stop sweep.
- R4: if opencode < aider on same fixture by >=1 assertion, thin-runner thesis confirmed; stop.
- R5: if neither race nor foreach-spawn changes pass rate by >= 1 assertion, multi-agent is cosmetic at this scale; skip R6/R7/R10.
- R6: expected serialisation; stop after one data point regardless.
- R7: if all three bands within 15% wall time, conclusion is "isolation not speed"; stop.
- R8: if specialist reviewer < same-model retry, pattern does not pay; stop.
- R9: if review wall time > 1.3x retry for same pass rate, retry preferred; archive.
- R10: run once for log-quality evaluation; no repeat unless qualitatively superior.

## 5. Compute budget

Per-turn rate: 3-5 min small prompt, 8-12 min medium, up to 25 min on H11. Cold model swap: 20-40 s, dominates when arms alternate models (R5, R6, R8 especially). Budget runs 1-15 as one serial block on a single ollama server; pin to one model per contiguous sub-block.

Estimated wall-hours:

- Runs 1-5 (R1 baseline): ~1.0 h.
- Runs 6-9 (R2): ~1.0 h.
- Runs 10-11 (R3/R9): ~0.8 h.
- Runs 12-13 (R4): ~0.8 h.
- Runs 14-15 (R5): ~0.8 h.
- Total first 15 runs: ~4.4 h contiguous; realistically 6-7 h including swaps, flaps, and one re-run per block.

Full R1..R10 (all arms, N=3 where required): ~25-30 wall-hours on this PC.

## 6. Cross-arm measurement consistency

- Snapshot fixture directory to `runs/rN/<arm>/<UTC-timestamp>/` before every run. Never mutate in place.
- Single oracle binary per fixture (`verify.cjs` for E-SMALL, `spec.cjs` for H8). Hash the oracle; record hash in the per-run markdown.
- Pass rate = passing assertions / total assertions, as reported by oracle exit code plus parsed stdout. Exit >1 = flow excluded, not zero.
- Retry count = `count(event == "retry_invoke")` in `audit.jsonl`. Solo = 0 by convention.
- Flow commit SHA = `git -C C:/Projects/prompt-language rev-parse HEAD` at run start.
- Model identifier = exact ollama tag (e.g. `qwen3:8b`, `qwen3-opencode:30b`).
- N>=3 repeats per cell for any cell used in a published delta. Report median and range, not mean.

## 7. PL infrastructure bugs that must close before trust

- Before R1 trustable at N>=3: aider P1 defects (EVIDENCE-CONSOLIDATION §3) - ollama TCP drop under concurrent load, and parent-git-dir path resolution. Workarounds (git init fixture dir, kill opencode before aider) are acceptable for R1 but must be documented per-run.
- Before R4: bead `prompt-l1xz` (opencode-home isolation + src-port of dist patch). Without src-port, `npm run build` wipes the fix and R4 is not reproducible.
- Before R7: bead `prompt-l1xz` AND bead `prompt-nba9` (child-index DSL for foreach-spawn). Without child-index, per-item result aggregation is manual and variance is unreportable.
- Before R5/R6/R8/R10: PL_SPAWN_RUNNER env composition in `cli-process-spawner.ts` must be verified to pass `PROMPT_LANGUAGE_OPENCODE_TIMEOUT_MS` and `OLLAMA_API_KEY` through to children. Open question per MULTI-AGENT-REVIEW §8.
- Before any R: gate evaluator cwd bug (LIVE-NOTES 2026-04-20, `file_exists` returning false while file exists). Silently invalidates pass rate in any flow using `done when`.

## 8. Abandon criteria for the rescue thesis

Thesis: _PL provides top-level methodology that lifts lower-capability models above their solo ceiling._

Confirmed if: after R1 (N>=3) AND R2, `median rescue(qwen3:8b, E-SMALL, pl-full) >= +3/11`, AND at least one of (decompose, retry, gate) shows >= +2/11 marginal contribution in R2, AND R3 shows non-decaying rescue at H8.

Refuted if: R1 median rescue <= 0 with tight variance (range spans <=2 assertions), OR R2 pl-lite >= pl-full within noise, OR R3 shows rescue strictly decreasing with difficulty to zero by H11.

Ambiguous (most likely outcome): rescue positive on easy tasks, zero on hard tasks, single PL feature dominant. Report as "PL-as-boilerplate-smoother, not PL-as-universal-wisdom" and pivot roadmap accordingly.

Falsification milestone: end of Run 9 (R2-D complete). After that point, a further arm cannot rescue the thesis; it can only refine it. Decide publish-positive / publish-negative / pivot at that milestone, not later.

## 9. Output format

For each run, write `results/rN/<arm>.md` with frontmatter:

```
# R<N> <arm-label>
run_id: <ulid>
timestamp_utc: 2026-04-20T13:11:33Z
fixture: e-small
fixture_snapshot_sha: <sha256 of input dir tarball>
oracle: verify.cjs
oracle_sha: <sha256>
flow_commit: <git SHA of prompt-language repo>
flow_file: <path>
runner: aider|opencode
model: qwen3:8b
pl_intensity: solo|lite|medium|full
arm_label: R1-B-qwen8b-plfull-rep2
wall_seconds: 812
passes: 10
total: 11
pass_rate: 0.909
retries: 2
tokens_in: <n>
tokens_out: <n>
excluded: false
excluded_reason: ""
infra_workarounds: ["git init fixture dir", "opencode killed pre-run"]
```

Append to central `SCORECARD.md` one row:

```
| R1-B-qwen8b-plfull-rep2 | R1 | qwen3:8b | aider | full | e-small | 10/11 | 2 | 812s | <flow SHA> | 2026-04-20 |
```

Columns: arm_label, experiment, model, runner, intensity, fixture, passes/total, retries, wall, flow_sha, date. Match existing SCORECARD.md style (pipe table, no per-row prose).

## 10. Handover

A future operator needs only:

1. This file.
2. `fixtures/rN/input/` snapshots.
3. The listed bead IDs for engineering-debt status: `prompt-l1xz`, `prompt-nba9`, epic `prompt-gysa`.
4. `bin/cli.mjs` and the runner CLIs (`aider`, `opencode`) on PATH.

Everything else (SCORECARD, LIVE-NOTES, RESCUE-VIABILITY-PLAN, MULTI-AGENT-REVIEW, GUIDE-AND-ROADMAP) is context, not prerequisite. Start with Run 1 of section 3, stop at each section-4 stop condition, decide the thesis at end of Run 9.
