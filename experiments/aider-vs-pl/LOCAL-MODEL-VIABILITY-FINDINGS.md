# Local-model viability with prompt-language — research findings

Date: 2026-04-17
Scope: empirical answer to the question "are local models viable and good with prompt-language?" based on the E-SMALL small-model probe (gemma4-opencode:e2b, gemma4-opencode:e4b, qwen3-opencode:30b), the H11 phase-2 rigor-artifact run (qwen3-opencode:30b on a harder task), and two PL runtime defects uncovered during the E-SMALL real-PL arm.
Audience: operators and reviewers deciding whether to cite the aider-vs-PL evidence as support for the small-model thesis.
Companion docs: [`EVIDENCE-CONSOLIDATION.md`](EVIDENCE-CONSOLIDATION.md) (full methodology ledger), [`SCORECARD.md`](SCORECARD.md) (phase-1 narrative), [`../../docs/security/aider-vs-pl-scrutiny.md`](../../docs/security/aider-vs-pl-scrutiny.md) (methodology audit).

## 1. Short answer

| Model class        | Size (active params)    | Solo aider                          | Real PL (`ci --runner aider`)                      | Viable with PL?                                                         |
| ------------------ | ----------------------- | ----------------------------------- | -------------------------------------------------- | ----------------------------------------------------------------------- |
| Gemma4 small (MoE) | ~2B active (e2b)        | **1/11** — degenerate comment loop  | **3/11** — flow aborted mid-step (PL runtime bugs) | **No** on this host — blocked by PL defects before thesis can be tested |
| Gemma4 small (MoE) | ~4B active (e4b)        | **1/11** — aider parsed 0-byte file | **3/11** — flow aborted mid-step                   | **No** on this host — same blocker                                      |
| Qwen3 30B (MoE)    | ~3B active of 30B total | **11/11** on E-SMALL CSV task       | — (not run on E-SMALL real-PL arm; see H11 below)  | Yes on easy tasks; **2/12** solo / **3/12** PL on H11 harder task       |

Bottom line: **on this Windows host, with Ollama on AMD Vulkan, local small models (≤4B active) are NOT currently viable through the real `prompt-language ci --runner aider` path** — and not because the small models are hopeless, but because the real PL runtime has two defects that prevent the orchestration from actually running. Qwen3 30B is viable solo on simple tasks but degrades sharply on harder tasks (H11 multi-file refactor) where even the rigor-artifact PL run reached only 3/12.

The user's core thesis — "with prompt-language on top of the harness we can use much less powerful models like SMLs locally and see good results with working software" — is **not yet tested** end-to-end. The real-PL arm failed before small-model capability could be probed. The manual PL-style decomposition arm is still running and will be the first honest test.

## 2. Evidence

### 2a. E-SMALL solo arm

Source: background agent `a8fe165506fcd92ea` report, fixtures at `/tmp/e-small/`.

Task: write a CSV-to-JSON CLI (`csv2json.js`) from argv, handling quoted commas, empty-to-null, and three error-exit paths. Oracle: [`e-small-fixtures/verify.js`](e-small-fixtures/verify.js), 11 assertions, objective exit code.

| Cell                                              | `csv2json.js` shape                                                                                                                                                 | verify.js pass | notes                                                                                                               |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------- |
| solo / gemma4-opencode:e2b (~2B active, 5.1B MoE) | 28,592 bytes of comment-only text — the single line `// I'm going to use the file system to read the file.` repeated hundreds of times. Zero executable statements. | **1/11**       | Degenerate repetition loop. Wall 194s, tokens 860 sent / 8.3k received.                                             |
| solo / gemma4-opencode:e4b (~4B active, 8.0B MoE) | 0 bytes — aider could not extract a valid edit block from the model output.                                                                                         | **1/11**       | Different pathology, same endpoint: repetition of the word "maximally". Wall 326s, tokens 791 sent / 9.4k received. |
| solo / qwen3-opencode:30b                         | 1,632 bytes — character-by-character CSV parser with quoted-comma handling, argv/ENOENT/empty-file error paths, `JSON.stringify(..., null, 2)`.                     | **11/11**      | Wall 498s, tokens 803 sent / 6.3k received.                                                                         |

Interpretation: the small-model failures are **not partial-correctness failures**. They are complete output-generation failures — token-decoding degenerates into a repetition trap. This is a stability/decoding problem at inference time, not a reasoning-about-CSV problem. Any measurement of solo small-model coding capability on this host is bottle-necked by this stability issue before it reaches the skill question.

### 2b. E-SMALL real-PL arm

Source: background agent `a7ec27698ded33f6e` report, state at `C:/Users/MQCKENC/AppData/Local/Temp/e-small-real-pl/.prompt-language/session-state.json`.

Command (per cell):

```bash
PYTHONUTF8=1 OLLAMA_API_BASE=http://127.0.0.1:11434 \
  PROMPT_LANGUAGE_AIDER_TIMEOUT_MS=600000 \
  node C:/Projects/prompt-language/bin/cli.mjs ci --runner aider \
  --model ollama_chat/gemma4-opencode:e{2b,4b} csv2json.flow
```

| Cell                          | PL session status                        | Nodes completed                        | `csv2json.js` created | verify.js pass                                                                                                               | Notes                                                                                                                                                                                                       |
| ----------------------------- | ---------------------------------------- | -------------------------------------- | --------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| real-PL / gemma4-opencode:e4b | `active` (not `completed`, not `failed`) | n1, n2 before abort (flow has 7 nodes) | no                    | **3/11** — only trivial error-path tests (missing-file, empty-file, no-argument all exit 1 because the script doesn't exist) | Flow aborted mid-step 3 with `Can't initialize prompt toolkit: Found xterm-256color, while expecting a Windows console`. `if command_failed` never triggered (failure is on a prompt node, not a run node). |
| real-PL / gemma4-opencode:e2b | `active`                                 | only n1 before abort                   | no                    | **3/11** — same trivial passes                                                                                               | Same xterm-256color crash, one step earlier.                                                                                                                                                                |

The "3/11" score is deceptive: all three passing tests pass only because there is no script to run, so any invocation exits 1 as the oracle expects. The oracle reports `VERDICT: FAIL` for both cells.

Two concrete PL runtime defects were discovered and filed:

- **`prompt-qtn7`** (P1 bug, filed 2026-04-17): second aider subprocess crashes with prompt-toolkit xterm-256color error on Windows/git-bash. First aider invocation in a flow succeeds; second in the same flow fails. Deterministic on this host. Workaround found by the H11 agent: export `TERM=dumb` before `ci --runner aider`.
- **`prompt-khm1`** (P1 bug, filed 2026-04-17): prompt nodes marked `completed` at dispatch time, `completedAt - startedAt = 0-1ms`, no subprocess-output verification. When aider exits 0 with no file edits (model produced a 700-token essay with no code fences), PL advances anyway. The gate-based recovery loop premise is defeated for prompt-node failures because the failure signal never fires.

Interpretation: **the real PL path never got far enough to measure small-model capability under orchestration**. Both flows aborted before node 3 of 7. Whether a small model could succeed with 7-node gated decomposition is not answered by this arm — the answer is blocked by the two defects above.

### 2c. Phase-2 H11 rigor run

Source: background agent `a8729d65df3f93d89`, artifacts at [`results/h11-phase2/`](results/h11-phase2/), combined scorecard at [`results/h11-phase2/scorecard.json`](results/h11-phase2/scorecard.json).

Task: rename `Contact` → `Client` across 5+ files (`src/`, README, seed data), no stale references, app still runs. Oracle: [`fixtures/h11-multi-file-refactor/verify.js`](fixtures/h11-multi-file-refactor/verify.js), 12 assertions, objective exit code.

Model: `ollama_chat/qwen3-opencode:30b`, Ollama blob SHA `58574f2e94b9...`, aider 0.86.2, PL commit `9882c56`.

Methodology: first aider-vs-PL run designed to be §3a-shaped end-to-end. Committed fixture predating the run, run-manifest.json per cell, raw aider transcripts, verify-output.json per cell, combined scorecard.json.

| Cell                      | verify.js pass | Wall ms              | Notes                                                                                                                                                                                                                                                    |
| ------------------------- | -------------- | -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| solo / qwen3-opencode:30b | **2/12**       | 393,723              | Aider asked for files but made no edits — none were explicitly added to the chat context.                                                                                                                                                                |
| pl / qwen3-opencode:30b   | **3/12**       | 584,355 (1.48× solo) | `ci --runner aider` drove the full task.flow end-to-end (needed `TERM=dumb` workaround for `prompt-qtn7`). Aider edited `src/app.js` only; introduced ES-module import syntax that broke the CommonJS-app-runs oracle. Other source files never reached. |

Winner: **PL by +1**. Both cells are effectively failing the task.

§3a coverage of this single cell-pair (per [`results/h11-phase2/README.md`](results/h11-phase2/README.md)):

| Rule                                                                                       | Covered?                                     |
| ------------------------------------------------------------------------------------------ | -------------------------------------------- |
| 1. Pre-declared task fixture                                                               | yes                                          |
| 2. Blinded scorer                                                                          | **no** (same agent scored)                   |
| 3. Cross-family reviewer                                                                   | **no**                                       |
| 4. Objective oracle (verify.js exit code)                                                  | yes                                          |
| 5. Sample size k >= 3                                                                      | **no** (k=1)                                 |
| 6. Counterbalanced run order                                                               | **no**                                       |
| 7. Reproducibility manifest (model SHA, aider version, PL commit, cmdline)                 | yes                                          |
| 8. Tie semantics declared                                                                  | yes (tie = equal verify_pass within 0 tests) |
| 9. Signed attestation                                                                      | **no**                                       |
| 10. Full §3a gate (strict trace, preflight ready, verify-trace, attestation, cross-family) | **no**                                       |

4 of 10 rules satisfied. Better than Phase 1 (0 of 10). Not yet claim-eligible.

Known oracle contamination to fix before k>=3 rerun: `verify.js` scans `.aider.chat.history.md` which contains the rendered flow text ("Contact" strings), so one fail per cell is a false positive caused by the aider chat log itself, not by a missed rename. Flagged in [`results/h11-phase2/README.md`](results/h11-phase2/README.md).

### 2d. E-SMALL PL manual-decomposition arm — not yet in

The third E-SMALL agent (`a524c22f667463311`) — the PL-style manual 5-step decomposition with retry loops, not using `ci --runner aider` — is still in flight at time of writing. This arm is the one that would honestly test the user's thesis. It is not blocked by `prompt-qtn7` (the PL xterm bug) because it drives aider directly from the agent without the PL CLI.

When its results land, the matrix will fill in as follows:

| Cell                            | Expected outcome to test thesis                                                     |
| ------------------------------- | ----------------------------------------------------------------------------------- |
| pl-manual / gemma4-opencode:e2b | If score improves materially over solo 1/11, thesis validated for ~2B-active models |
| pl-manual / gemma4-opencode:e4b | If score improves materially over solo 1/11, thesis validated for ~4B-active models |
| pl-manual / qwen3-opencode:30b  | Expected parity with solo 11/11 since task is already in solo range for this model  |

This file will be updated once that arm lands.

## 3. What this means for "are local models viable with PL?"

### 3a. On this host, today, with the shipped PL `ci --runner aider` path

**Small gemma4 models are not viable** — but the immediate cause is the two P1 PL runtime defects, not the models themselves. Fix `prompt-qtn7` and `prompt-khm1`, then re-run E-SMALL real-PL, before drawing conclusions about the models.

**Qwen3 30B MoE is viable on easy one-shot tasks** (11/11 on the E-SMALL CSV task, solo or PL), **and degrades to near-failing on harder tasks** (2-3/12 on H11 multi-file refactor, even under the rigor-artifact PL run). This is the more interesting signal: even a 30B MoE local model running on a mid-range GPU struggles on a realistic multi-file task. Solo aider on frontier models (Sonnet 4, GPT-4.1 per [`phase2-design.md`](phase2-design.md)) has not been run yet on H11, so we cannot yet say whether H11 is a "PL helps frontier models too" task or a "this task is too hard for any model without a more sophisticated flow" task.

### 3b. On the PL thesis

The user's thesis is: **"PL lets smaller local models produce working software they cannot produce solo."**

Current evidence does **not** support it, but also does **not** refute it:

- Solo small-model baseline: **catastrophic** (1/11 on both gemma4 variants) — not a little worse, a lot worse. This is the right baseline to improve on.
- PL-orchestrated small-model result: **unknown** — the arm that would test this (real-PL) was blocked by PL runtime defects; the arm that might show it (manual decomposition) has not landed yet.

If the manual-decomposition arm lands with e2b/e4b scoring 8+/11 while the real-PL arm is blocked and solo is 1/11, the honest reading will be: **PL-style orchestration works on small models; PL-the-runtime does not yet reliably deliver it on Windows**. That would be simultaneously a validation of the thesis at the protocol level and an indictment of the runtime's current Windows support. The fix pathway is clear: close `prompt-qtn7` and `prompt-khm1`, re-run, and measure directly.

### 3c. Honest framing for external readers

1. The only objective oracle-backed data we have on small models today says they fail catastrophically solo (1/11) and fail for different reasons through the real PL runtime (3/11 via runtime abort, not via model failure). This should not be cited as evidence that small models are hopeless, and it should not be cited as evidence that PL is hopeless for them.
2. The only §3a-shaped cell-pair we have (H11 phase-2) is k=1, not blinded, and hits an oracle-contamination issue that costs both cells 1 point. The PL +1 win should be read as "PL did not lose" rather than "PL won decisively".
3. Phase-1 narrative claims (PL 6-0-3) are still [`SCORECARD.md`](SCORECARD.md)-level informal evidence, not thesis-eligible per [`../../docs/security/aider-vs-pl-scrutiny.md`](../../docs/security/aider-vs-pl-scrutiny.md).
4. The thesis is live, testable, and not yet tested. The path to testing it is (a) fix the two PL defects, (b) re-run E-SMALL real-PL on gemma4 e2b/e4b, (c) run Phase 2 at k>=3 across the model matrix with blinded scoring.

## 4. Decisions this evidence should drive

- **Merge-gate**: close `prompt-qtn7` and `prompt-khm1` before any further aider-vs-PL run on Windows. Without the fixes, every real-PL cell on this host will abort at the second aider invocation.
- **Oracle hygiene**: patch [`fixtures/h11-multi-file-refactor/verify.js`](fixtures/h11-multi-file-refactor/verify.js) to skip `.aider.chat.history.md` and similar transcript files when scanning for "Contact". Same check applies to any fixture that uses word-boundary regex across the workspace.
- **Phase-2 scoping**: treat the H11 rigor cell as a methodology-validation exercise (it proved the artifact pipeline works), not as a PL-capability signal. Re-run H11 at k=3 only after the oracle fix and after the two defects are closed.
- **Thesis framing**: do not cite "PL helps small models" as a conclusion until the manual-decomposition arm lands and, ideally, the real-PL arm is re-run post-defect-fix. Until then, the defensible claim is narrower: "PL decomposition+gate discipline beats monolithic solo on gate-heavy tasks for mid-size local models (30B MoE) in an informal Phase-1 sense; the small-model case is not yet measured."

## 5. Related beads and files

Bugs filed today:

- [`prompt-qtn7`](https://beads/issue/prompt-qtn7) — P1. PL runtime: second aider invocation crashes with prompt-toolkit xterm-256color on Windows.
- [`prompt-khm1`](https://beads/issue/prompt-khm1) — P1. PL runtime: prompt nodes marked completed at dispatch, no subprocess-output verification.

Artifacts:

- [`results/h11-phase2/`](results/h11-phase2/) — full H11 rigor-artifact bundle (solo + pl cells, manifests, transcripts, scorecard).
- [`EVIDENCE-CONSOLIDATION.md`](EVIDENCE-CONSOLIDATION.md) — Phase-1 + scrutiny + Phase-2 design summary. Note: that doc was written before E-SMALL results landed; sections 4 and 5 are now superseded by this document's sections 2a, 2b, 2c.
- Background agent artifact paths:
  - E-SMALL solo: `C:/Users/MQCKENC/AppData/Local/Temp/e-small/solo-{gemma4-e2b,gemma4-e4b,qwen3-30b}/`
  - E-SMALL real-PL: `C:/Users/MQCKENC/AppData/Local/Temp/e-small-real-pl/`

Pending:

- E-SMALL PL manual-decomposition arm (`a524c22f667463311`) — not yet landed. This document will be updated with an additional §2d row and §3b update when that arm completes.
