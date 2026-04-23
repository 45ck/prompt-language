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

## Variance warning

E-SMALL is short (one file, 11 assertions). A single run is one data point, not a measurement. For any conclusion about rescue magnitude the plan calls for at least N=3 repeats per arm after the first inter-arm comparison lands, to separate model stochasticity from PL effect.

## Open bugs discovered this session (cumulative)

- PL runner `opencode`: progress detector stale vs current JSON stream. Patched in `dist/`, unported to `src/`. [SESSION-2026-04-20-OPENCODE-NEXTJS §3.3]
- PL gate evaluator: claims `file_exists ".next/BUILD_ID"` is false 50 times in a row while the file exists on disk (v2 opencode run, `oc-nextjs-v2/.prompt-language/audit.jsonl`). Likely cwd/path-resolution issue in the gate evaluator. **New** — add to engineering-debt list in GUIDE-AND-ROADMAP §4.1.
- PL runner `aider`: two P1 defects, [EVIDENCE-CONSOLIDATION §3]. **Live repro captured in R1 Run B:**
  - **Layer 1 — ollama TCP connection drop mid-inference.** `litellm.APIConnectionError: Ollama_chatException ... wsarecv: An existing connection was forcibly closed by the remote host.` Triggers infinite litellm retry loop; aider process eventually killed by PL timeout or signal. Reproducer: any second-turn aider call via PL against `ollama_chat/qwen3:8b` on this PC. Suspected cause: concurrent opencode+aider requests to single ollama server or model-swap thrash under load.
  - **Layer 2 — aider uses parent git repo as working dir.** Even with `--no-git`, aider logs `Git working dir: C:\Projects\prompt-language` when run inside a PL checkout subdirectory, despite `--no-git` making the session gitless. Any file edit aider emits is then resolved relative to that parent dir, not the run cwd. Mitigation: `git init` the run directory before invoking PL, or move fixtures outside the PL repo entirely.
- PL's run of the E-SMALL flow produces **inter-run variance of 5–8/11 on qwen3:8b pre-retry**, same prompt, same model, same input. Measurement protocol needs N ≥ 3 repeats per arm to separate model stochasticity from PL effect.

## Workarounds applied / to apply

- For fixture hygiene: fixture dir must have its own `package.json` with `"type":"commonjs"`, OR oracle must use `.cjs` extension, OR fixture lives outside the PL repo. Applied in R1 Run B (renamed `verify.js` → `verify.cjs`).
- For aider path resolution: `git init` the run dir before invoking PL. **Not yet applied.**
- For ollama connection drops: reduce concurrent load (kill opencode before aider run), or retry the whole flow. **Not yet applied.**
