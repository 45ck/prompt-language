# Rescue-viability live notes

Running log of in-flight R1 runs and what we are learning as it happens. Freeze into `results/rN/*.md` when each run terminates.

## 2026-04-20 R1 qwen3:8b + PL-full

### Run A (background-task `bi9p286qt`) — INVALIDATED

- Symptom: retry loop fired indefinitely, `node verify.js` always errored.
- Root cause: fixture `verify.js` was CommonJS but sat inside `C:\Projects\prompt-language\` which declares `"type": "module"`. Node refused to load it.
- Post-mortem verification: manually copied the pre-retry `csv2json.js` to `/tmp`, ran `verify.cjs` there, scored **8/11**.
- Lesson (for experiment hygiene): fixture directories that use CommonJS oracles must either (a) use `.cjs`, (b) declare their own `package.json` with `"type":"commonjs"`, or (c) live outside any ESM-declared parent.
- Applied fix: rename oracle to `verify.cjs`, update flow references, rerun.

### Run B (background-task `bgu85oyxi`) — IN FLIGHT

- Pre-retry `csv2json.js` (written by qwen3:8b before any retry fired): **5/11** passing (this run). Note: the previous run's pre-retry was 8/11 on the same model with a different prompt variant. Inter-run variance is not small.
- Retry loop fired for the first time in the rescue-viability experiment at 13:11:33.
- Specific failures qwen3:8b must now fix: header row has literal quote characters, row-field indexing does not align with header keys after quoted-comma handling, missing-trailing-field becomes `undefined` not `null`.
- If PL rescue works as advertised, the 6 failures should drop to 0 within 3 retries.

### Observations so far (Run B still live)

- qwen3:8b can emit JS that parses and runs. The earlier pessimism from `LOCAL-MODEL-VIABILITY-FINDINGS.md` (small gemma4 variants emitting Python/prose) does not generalise to qwen3:8b. This model is _above_ the literal-code-emission threshold.
- qwen3:8b is near but not at the "one-shot correct" threshold on E-SMALL. Pre-retry score varies 5–8 of 11. This is _exactly_ the regime where PL's retry-on-gate-failure is supposed to earn its keep.
- PL-aider-runner retry event emission looks correct: one `retry` event, one `run` per attempt, one `condition:command_failed` per evaluation, one `if` + `prompt` per failed attempt. Compared with today's opencode-runner drift (section §3 of SESSION-2026-04-20-OPENCODE-NEXTJS), the aider runner's audit output matches the documented DSL semantics.

### What this run will not tell us

- Whether PL-_lite_ (decomposition only, no retry) would also get to ≥ 10/11. Need a second arm to isolate the retry contribution.
- Whether qwen3:8b solo without any PL scaffolding is above or below 5/11 pre-retry. Need the `solo-arm.sh` run.

## 2026-04-24 R1-A qwen3:8b solo-aider baseline

### Run `qwen3-8b-solo-r1a-20260424` — TERMINATED BY WALL TIME

- Command intent: solo aider, no PL, no retry, `ollama_chat/qwen3:8b`, E-SMALL CSV fixture.
- Shell portability note: the original `solo-arm.sh` could not run through Windows `bash.exe` because the WSL launcher had no `/bin/bash`; the same steps were executed in PowerShell with the same prompt, model, oracle, and artifact layout.
- Aider ran for 1800s without producing implementation code. The log shows repetitive reasoning about the CSV mapping rules and two Ollama/litellm connection drops (`wsarecv: An existing connection was forcibly closed by the remote host`); `csv2json.js` remained an empty file.
- Oracle result after timeout: **1/11** passing. The only passing assertion was `csv2json.js exists`; all functional assertions failed with empty-output/JSON parse or missing error-exit behavior.
- Artifact: `runs/r1/qwen3-8b-solo-r1a-20260424/`.
- Interpretation: this gives the missing operational solo baseline for the current qwen3:8b local setup, but it is not a clean model-capability-only measurement because transport instability contributed to the timeout. Compared with the PL-full R1v3 signal of 9/11 after retry, the single-run rescue delta is large, but the variance warning below still applies; R1-B/R1-C replications are now the next required evidence.

## 2026-04-24 R1-B/R1-C qwen3:8b PL-full replications

### Run `qwen3-8b-pl-full-r1b-20260424` — INVALIDATED

- Command intent: PL-full aider, `ollama_chat/qwen3:8b`, E-SMALL CSV fixture, rep 2.
- Fixture hygiene problem: the run directory did not declare `"type":"commonjs"`, so Node inherited the parent repo's ESM mode while the generated solution used `require(...)`.
- Oracle result after the run: **4/11** passing, but this score is not comparable to the clean arms because the CommonJS/ESM mismatch dominated the functional failures.
- Artifact: `runs/r1/qwen3-8b-pl-full-r1b-20260424/`.

### Run `qwen3-8b-pl-full-r1b-commonjs-20260424` — VALID

- Applied workarounds: per-run `git init`; local `package.json` with `"type":"commonjs"`; same `verify.cjs`, model, runner, and flow.
- PL CI result: failed completion gates with `PLO-001 Completion gates failed: file_exists "csv2json.js", verify_passes`.
- Oracle result: **5/11** passing.
- Passing assertions: file exists, runs on valid CSV, no-argument error exit, missing-file error exit, empty-file error exit.
- Failing assertions: produced 3 records instead of 4, header keys were taken from the first data row, and quoted/empty-field mappings failed.
- Root solution bug: the parser returns only data rows, then the main logic treats `data[0]` as headers.
- Artifact: `runs/r1/qwen3-8b-pl-full-r1b-commonjs-20260424/`.

### Run `qwen3-8b-pl-full-r1c-commonjs-20260424` — VALID

- Same fixture hygiene and workarounds as the corrected R1-B run.
- PL CI result: failed completion gates with `PLO-001 Completion gates failed: file_exists "csv2json.js", verify_passes`.
- Oracle result: **5/11** passing with the same failure pattern as corrected R1-B.
- Artifact: `runs/r1/qwen3-8b-pl-full-r1c-commonjs-20260424/`.

### Updated interpretation

- The original R1v3 9/11 PL-full result has not reproduced under two CommonJS-hygienic repeats.
- Current clean qwen3:8b E-SMALL band is: solo operational baseline **1/11 timeout**, PL-full repeats **5/11, 5/11**, earlier PL-full outlier **9/11**.
- The rescue effect is still positive against the observed solo timeout, but weaker and more variance-sensitive than the initial +8 assertion story. R1-D/R1-E are now needed before deciding whether to pivot to R2 ablation or retune the PL-full prompt.

## 2026-04-24 R1-D gemma4-opencode:e4b PL-full floor check

### Run `gemma4-opencode-e4b-pl-full-r1d-commonjs-20260424` — VALID

- Applied workarounds: per-run `git init`; local `package.json` with `"type":"commonjs"`; same `verify.cjs`, runner, and PL-full flow as corrected R1-B/R1-C.
- Local inference check: `ollama ps` logged `gemma4-opencode:e4b` resident throughout the run at **68%/32% CPU/GPU**, so the run used local Ollama but did not fully fit on GPU.
- PL CI result: failed after the configured 900s aider timeout; no `csv2json.js` was produced.
- Oracle result: **3/11** passing. The only passes were the no-argument, missing-file, and empty-file non-zero exit checks.
- Artifact: `runs/r1/gemma4-opencode-e4b-pl-full-r1d-commonjs-20260424/`.
- Interpretation: this confirms the expected floor for the smaller gemma4 opencode variant on E-SMALL. PL orchestration did not rescue a model that failed to emit the target implementation file.

## 2026-04-24 R1-E qwen3-opencode:30b solo ceiling remeasurement

### Run `qwen3-opencode-30b-solo-r1e-commonjs-20260424` — VALID

- Command intent: solo aider, no PL, no retry, `ollama_chat/qwen3-opencode:30b`, E-SMALL CSV fixture.
- Applied hygiene: per-run `git init`; local `package.json` with `"type":"commonjs"`; same `verify.cjs` and input as R1-A/R1-B/R1-C/R1-D.
- Local inference check: `ollama ps` logged `qwen3-opencode:30b` resident during the run at **15%/85% CPU/GPU**.
- Aider result: produced `csv2json.js` in one attempt.
- Oracle result: **11/11** passing.
- Artifact: `runs/r1/qwen3-opencode-30b-solo-r1e-commonjs-20260424/`.
- Interpretation: the E-SMALL ceiling remains intact under current fixture hygiene and runner state. The task is solvable by the stronger local model without PL orchestration, while qwen3:8b remains below that ceiling.

## 2026-04-24 R2-A qwen3:8b PL-lite H8 ablation

### Run `qwen3-8b-pl-lite-r2a-commonjs-20260424` — VALID

- Fixture note: the original H8 fixture was not checked in, so this run uses a reconstructed `fixtures/h8-foreach-copy/` based on the committed H8 result summary: four files, exported interfaces, exact defaults, and `??` instead of `||`.
- Flow: `r2-pl-lite.flow`, decomposition only; one prompt to read the contract, then one implementation prompt per file. No retry loop and no completion gate.
- Local inference check: `ollama ps` logged `qwen3:8b` resident at **100% GPU** during the run.
- PL CI result: flow completed successfully.
- Oracle result: **4/4** passing.
- Artifact: `runs/r2/qwen3-8b-pl-lite-r2a-commonjs-20260424/`.
- Interpretation: on the reconstructed H8 fixture, retry/gate machinery is not necessary once the task is decomposed into one file per prompt. The next required comparator is qwen3:8b solo on the same reconstructed fixture; if solo fails, R2 localizes the lift to decomposition.

## 2026-04-24 R2-D qwen3:8b solo H8 comparator

### Run `qwen3-8b-solo-r2d-commonjs-20260424` — VALID

- Fixture: same reconstructed `fixtures/h8-foreach-copy/` used by R2-A.
- Command intent: solo aider, no PL, no retry, one prompt that names all four required files and reads `TASK.md` plus `spec.cjs`.
- Local inference check: `ollama ps` logged `qwen3:8b` resident at **100% GPU** during the run.
- Aider result: produced all four TypeScript files in one attempt.
- Oracle result: **4/4** passing.
- Artifact: `runs/r2/qwen3-8b-solo-r2d-commonjs-20260424/`.
- Interpretation: the reconstructed H8 fixture is too easy under the current explicit TASK/spec prompt. R2-A does not show rescue because solo qwen3:8b also reaches the oracle ceiling. Do not spend cycles on R2-B/R2-C for this fixture until the original H8 fixture is recovered or the reconstruction is hardened.

## 2026-04-24 R2 hardened H8 follow-up

### Run `qwen3-8b-pl-lite-v2-r2a-commonjs-20260424` — VALID EXPLORATORY

- Fixture: `h8-foreach-copy-v2`, eight blank-file generation targets, TASK-only model context, source-regex external oracle.
- Local inference check: `ollama ps` logged `qwen3:8b` resident at **100% GPU**.
- Oracle result: **1/8** passing.
- Interpretation: v2 showed schema drift under TASK-only context, but its source-regex oracle was still not the right final R2 scorer.

### Run `qwen3-8b-pl-lite-v3-r2a-commonjs-20260424` — VALID

- Fixture: `h8-repair-v3`, pre-seeded buggy files, visible `contract.json`, semantic external oracle with 20 checks.
- Flow: PL-lite decomposition only; no retry loop and no completion gate.
- Local inference check: `ollama ps` logged `qwen3:8b` resident at **100% GPU**.
- Oracle result: **15/20** passing. The flow fixed defaults and most falsy preservation but missed exported interfaces and one `status` falsy case.

### Run `qwen3-8b-solo-v3-r2d-commonjs-20260424` — VALID

- Fixture: same `h8-repair-v3` semantic fixture.
- Command intent: solo aider, no PL, one repair prompt over all four files.
- Local inference check: `ollama ps` logged `qwen3:8b` resident at **100% GPU**.
- Oracle result: **18/20** passing. The remaining failures were missing exported interfaces for `User` and `Order`.
- Interpretation: on the semantic repair fixture, solo beat PL-lite. Decomposition alone is not the load-bearing feature for this hardened H8 path.

### Run `qwen3-8b-pl-medium-v3-r2b-commonjs-20260424` — EXCLUDED

- Fixture: same `h8-repair-v3` semantic fixture.
- Flow: PL-medium; PL-lite structure plus `retry max 3` around `node spec.cjs`.
- Local inference check: `ollama ps` logged `qwen3:8b` resident at **100% GPU**.
- `prompt-language ci` failed with `Prompt runner exited with code 1` before the arm completed cleanly.
- Descriptive oracle result after failure: **12/20** passing.
- Interpretation: excluded from aggregate R2 scoring. The retry/gate path did not produce a clean rescue result and needs runner/failure-mode investigation before more R2-B/R2-C cycles.

### Run `qwen3-8b-pl-medium-v3b-r2b-commonjs-20260424` — EXCLUDED, INFORMATIVE

- Fixture: same `h8-repair-v3` semantic fixture.
- Flow: corrected PL-medium v3b; retry writes oracle output to a file and explicitly names `src/user.ts`, `src/product.ts`, `src/order.ts`, and `src/invoice.ts` in the repair prompt.
- Local inference check: `ollama ps` logged `qwen3:8b` resident at **100% GPU** throughout the run.
- `prompt-language ci` again failed with `Prompt runner exited with code 1` before the arm completed cleanly.
- Descriptive oracle result after failure: **19/20** passing. The only remaining failure was `Order.status` falsy preservation.
- Interpretation: excluded from aggregate R2 scoring due to the hard aider exit, but informative. Making oracle feedback visible and explicitly scoping retry repairs materially improved the final workspace over PL-lite 15/20 and solo 18/20.

### Run `qwen3-8b-pl-medium-v3c-r2b-diagnostic-20260424` — VALID

- Fixture: same `h8-repair-v3` semantic fixture.
- Flow: same corrected PL-medium v3b flow, rerun after adding PLR-007 prompt-runner failure diagnostics.
- Local inference check: `ollama ps` logged `qwen3:8b` resident at **100% GPU** throughout the run.
- `prompt-language ci` completed cleanly with exit 0.
- Oracle result: **20/20** passing.
- Interpretation: this is the first clean hardened-H8 result showing retry-scoped PL beating the same semantic fixture's solo qwen3:8b comparator, which scored 18/20. Next step is repetition, not escalation to a broader claim.

### Runs `qwen3-8b-pl-medium-v3d-r2b-repeat-20260424` and `qwen3-8b-pl-medium-v3e-r2b-repeat-20260424` — VALID

- Fixture and flow: same semantic v3 fixture and corrected PL-medium v3b flow as R2-B5.
- Local inference check: both runs logged `qwen3:8b` resident at **100% GPU**.
- PL result: both runs completed cleanly with exit 0.
- Oracle result: **20/20** and **20/20**.
- Interpretation: the retry-scoped PL-medium result now has a clean N=3 band on hardened H8 v3: 20/20, 20/20, 20/20. This is stronger evidence that explicit oracle-feedback retry is load-bearing for qwen3:8b on this fixture.

## 2026-04-24 R9 review-vs-retry cost probe

### Runs `qwen3-8b-pl-review-max3-r9a-20260424`, `qwen3-8b-pl-review-max3-v2-r9b-20260424`, `qwen3-8b-pl-review-max3-v2-r9c-20260424`, and `qwen3-8b-pl-review-max3-v3-r9d-20260424` — EXCLUDED, INFORMATIVE

- Fixture: E-SMALL CSV-to-JSON fixture with `verify.cjs`.
- Purpose: replace the R1 `retry max 3` block with `review grounded-by "node verify.cjs" max 3`.
- Local inference check: runs logged `qwen3:8b` at **100% GPU** during active samples.
- R9-A/R9-B: excluded due PLR-007 prompt-runner exits after Ollama TCP resets.
- R9-C: reached **11/11** but `prompt-language ci` exited nonzero due Windows `EPERM` during state rename.
- R9-D: reached **11/11** but failed after 50 completion-gate checks because `file_exists "csv2json.js"` stayed false while `node verify.cjs` passed, reproducing the known gate evaluator cwd bug.
- Interpretation: these attempts were useful for flow hardening but are excluded from aggregate R9 scoring.

### Run `qwen3-8b-pl-review-max3-v4-r9e-20260424` — VALID

- Flow: `r9-review-max3-v4.flow`; review-grounded repair with `review max 3`, full oracle output written to `review-output.txt`, and oracle-only completion gate.
- Timeout controls: outer orchestration command timeout 3600s; aider turn timeout `PROMPT_LANGUAGE_AIDER_TIMEOUT_MS=600000`; in-flow oracle capture `[timeout 60]`; review loop bounded by `review max 3`.
- Local inference check: `ollama ps` logged `qwen3:8b` resident at **100% GPU** during active samples.
- PL result: `prompt-language ci` completed cleanly with exit 0.
- Oracle result: **11/11** passing in **482s**.
- Interpretation: review-grounded repair can rescue E-SMALL to the ceiling on qwen3:8b, but it needed three review rounds and took longer than the 30B solo ceiling. Treat as a valid cost probe, not a replacement for the R2 retry-scoped result.

## Variance warning

E-SMALL is short (one file, 11 assertions). A single run is one data point, not a measurement. For any conclusion about rescue magnitude the plan calls for at least N=3 repeats per arm after the first inter-arm comparison lands, to separate model stochasticity from PL effect.

## Open bugs discovered this session (cumulative)

- PL runner `opencode`: progress detector stale vs current JSON stream. Patched in `dist/`, unported to `src/`. [SESSION-2026-04-20-OPENCODE-NEXTJS §3.3]
- PL gate evaluator: claims `file_exists ".next/BUILD_ID"` is false 50 times in a row while the file exists on disk (v2 opencode run, `oc-nextjs-v2/.prompt-language/audit.jsonl`). Likely cwd/path-resolution issue in the gate evaluator. **New** — add to engineering-debt list in GUIDE-AND-ROADMAP §4.1.
- PL runner `aider`: two P1 defects, [EVIDENCE-CONSOLIDATION §3]. **Live repro captured in R1 Run B:**
  - **Layer 1 — ollama TCP connection drop mid-inference.** `litellm.APIConnectionError: Ollama_chatException ... wsarecv: An existing connection was forcibly closed by the remote host.` Triggers infinite litellm retry loop; aider process eventually killed by PL timeout or signal. Reproducer: any second-turn aider call via PL against `ollama_chat/qwen3:8b` on this PC. Suspected cause: concurrent opencode+aider requests to single ollama server or model-swap thrash under load.
  - **Layer 2 — aider uses parent git repo as working dir.** Even with `--no-git`, aider logs `Git working dir: C:\Projects\prompt-language` when run inside a PL checkout subdirectory, despite `--no-git` making the session gitless. Any file edit aider emits is then resolved relative to that parent dir, not the run cwd. Mitigation: `git init` the run directory before invoking PL, or move fixtures outside the PL repo entirely.
- PL's run of the E-SMALL flow produces **inter-run variance of 5–9/11 on qwen3:8b**, same prompt family, same model, same input. Measurement protocol needs N ≥ 3 repeats per arm to separate model stochasticity from PL effect.

## Workarounds applied / to apply

- For fixture hygiene: fixture dir must have its own `package.json` with `"type":"commonjs"`, OR oracle must use `.cjs` extension, OR fixture lives outside the PL repo. Applied in R1-A and corrected R1-B/R1-C runs.
- For aider path resolution: `git init` the run dir before invoking PL. Applied in corrected R1-B/R1-C runs.
- For ollama connection drops: reduce concurrent load (kill opencode before aider run), or retry the whole flow. **Not yet applied.**
