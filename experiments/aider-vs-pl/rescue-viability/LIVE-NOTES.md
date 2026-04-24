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
