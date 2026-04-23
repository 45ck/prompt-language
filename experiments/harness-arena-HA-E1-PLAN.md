# HA-E1 Pilot Plan — H11 Multi-file Refactor, 5 arms, 1 run each

Date: 2026-04-20. Status: plan only. No arm executed. Budget cap: $5 cumulative cloud.
Fixture: `experiments/aider-vs-pl/fixtures/h11-multi-file-refactor/` (TASK.md, src/, verify.js).
Oracle: 11 assertions in `verify.js` (7 no-"Contact" file checks, 2 Client-class checks, 2 runtime checks).

## 1. Run manifest

Per-arm working dir is a fresh copy of the fixture at `experiments/harness-arena/runs/HA-E1/<arm>/workdir/` (src + TASK.md + README.md + package.json ONLY — see section 2). `verify.js` is NOT copied into workdir.

| Arm | Command                                                                                                                 | Env                                         | Wall      | Token/cost est                   |
| --- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- | --------- | -------------------------------- |
| A1  | `claude --print --permission-mode acceptEdits --model claude-sonnet-4-5 < TASK.md` (run from workdir)                   | `ANTHROPIC_API_KEY`; `--add-dir .` implicit | 2–5 min   | ~40k in / ~15k out → $0.12–$0.40 |
| A2  | `codex exec --model gpt-5 --cd <workdir> --full-auto "$(cat TASK.md)"`                                                  | `OPENAI_API_KEY`                            | 2–5 min   | ~40k in / ~15k out → $0.05–$0.30 |
| A3  | `aider --model ollama_chat/qwen3-opencode:30b --yes-always --no-auto-commits --message-file TASK.md src/*.js README.md` | `OLLAMA_API_BASE=http://127.0.0.1:11434`    | 8–15 min  | $0 API; ~0.02 kWh                |
| A4  | `prompt-language ci --runner aider --flow task-artisan.flow` (copied from fixture)                                      | same as A3                                  | 12–25 min | $0 API                           |
| A5  | `prompt-language ci --runner opencode --flow task-artisan.flow --model qwen3-opencode-big:30b`                          | same plus `OPENCODE_*`                      | 10–20 min | $0 API                           |

Flows under test: A4 uses the existing `task-artisan.flow` from the fixture (already tuned for H11; scored 8/11 in phase2-fixed). A5 uses the same flow via the opencode runner adapter.

## 2. Oracle isolation contract

The agent MUST NOT see `verify.js` or any string that names its assertions.

Scheme:

1. Harness runner (a new `experiments/harness-arena/runner.js`) creates `runs/HA-E1/<arm>/workdir/` by copying ONLY `TASK.md`, `README.md`, `src/`, `package.json` from the fixture. `verify.js` stays in the fixture path and is invoked by the runner with `cwd=workdir` AFTER the arm terminates.
2. Flow files copied into workdir (A4, A5) must be pre-scrubbed for oracle command strings (`verify.js`, `/\bContact\b/g`, "11 passed"). Runner greps the copied flow and aborts if hit.
3. Post-run audit: runner greps each agent's transcript/chat-history (`.aider.chat.history.md`, Claude Code session log, Codex log, opencode session) for the literal strings `verify.js`, `verify(`, `No "Contact"`, and the regex `/\\bContact\\b/g`. Any hit marks the run `ORACLE_LEAK` and disqualifies it.
4. Claude Code: pass `--add-dir workdir` only; do NOT add repo root. Codex CLI: `--cd workdir`. Aider: explicit file list excludes verify.js (it is not even present). Opencode: run with `--cwd workdir`.
5. Known leak vectors documented in verify.js header itself (line 20–22): `.aider.chat.history.md` and `.prompt-language/` contain rendered flow text; these are chat artifacts not fixture leaks, but the audit grep MUST exclude these paths from the PASS-rate check (verify.js already does this via the `./src` + `./README.md` scope).

Ambiguity: the fixture has `check-seed-contract.js`, `count-contact.js`, `find-contact-stragglers.js`, `list-contact-targets.js` alongside verify.js. These are NOT part of the oracle; they are helper scripts. Runner must NOT copy them into workdir. Confirm with fixture owner before HA-E1 executes.

## 3. Cost accounting

Source: Anthropic public pricing page (Sonnet 4.5 $3/MTok in, $15/MTok out, 2026-04); OpenAI GPT-5 pricing ($1.25/MTok in, $10/MTok out as of 2026-04). Estimates assume 2 turns avg, 20k prompt tokens (TASK.md + src/ ~1200 LOC), 15k completion.

Hard stop: runner writes `cumulative_cost_usd` to `runs/HA-E1/cost.jsonl` after each cloud arm. If cumulative ≥ $5 before A2 completes, HALT. Cloud arms run A1 first, then A2. Local arms (A3/A4/A5) logged as `cost_usd: 0` with `electricity_kwh` and `wall_seconds` recorded separately; amortisation deferred (see EXPERIMENT-AREAS §3.8).

## 4. Grader calibration

Oracle score: `passed / 11` from verify.js. Prior H11 baseline=2/11, artisan=8/11. Report pass_rate as a fraction, not boolean. For N=1 per arm no CI is meaningful; record raw 0–11 and flag "pilot, N=1, not inferential." HA-E2 will use Wilson interval on N=3 per arm. Human-review rubric (EXPERIMENT-AREAS §3.7) deferred to HA-E2; HA-E1 captures only the oracle number plus wall-time and cost.

## 5. Expected outcome + stop conditions

Predicted ranking (oracle score): A1 ≈ A2 (10–11/11) > A5 ≈ A4 (7–9/11) > A3 (2–5/11). Stop before HA-E2 if ANY of:

- Any run flagged `ORACLE_LEAK` by the section-2 audit.
- Cumulative cloud cost > $5.
- All three local arms score < 3/11 (indicates local stack broken, not a PL question).

## 6. Artifacts

Per run: `runs/HA-E1/<arm>/{workdir/, transcript.log, verify.txt, summary.json, leak-audit.txt, cost.json}`. Cross-arm rollup: `runs/HA-E1/SCORECARD.md` with columns arm | oracle | wall_s | cost_usd | leak. Mirror format of `aider-vs-pl/results/h11-phase2-fixed/`.

## 7. Dependencies and blockers

- Harness-arena directory does not yet exist (EXPERIMENT-AREAS §6 step 3). Create `experiments/harness-arena/` first.
- Opencode runner adapter for `prompt-language ci --runner opencode` — unclear if shipped. Confirm before A5.
- Claude Code CLI installed and `ANTHROPIC_API_KEY` set. Codex CLI installed and `OPENAI_API_KEY` set.
- Ollama serving qwen3-opencode:30b AND qwen3-opencode-big:30b. Do not touch ollama per constraints — confirm both models already pulled.
- aider P1 defect B (if open in bead tracker) — confirm A3/A4 not blocked.
- Leak-audit grep script (section 2 item 3) — new, must be written.

## 8. Clean-failure modes (still useful even if numbers are bad)

- Oracle leak detected: produces the first verified leak-audit artifact, validates the audit tool, blocks HA-E2 correctly.
- All local arms fail: isolates "local stack broken" from "PL doesn't help" — directs effort to runner/model triage before burning cloud budget on HA-E2.
- Cloud budget overrun on A1 alone: calibrates the $5 cap as too low and yields a real per-arm cost number for re-planning.
- Opencode adapter missing: falsifies the A5 assumption cheaply, before HA-E2 commits 9 A5 runs.

---

## Report-back summary

- **Biggest oracle-isolation risk**: the fixture directory contains four helper scripts (`count-contact.js`, `list-contact-targets.js`, etc.) alongside `verify.js`. A naive "copy fixture to workdir" will drag those in and they name the oracle's target string ("Contact") and its intent. The runner must whitelist copies (TASK.md, README.md, src/, package.json) rather than blacklist verify.js.
- **Most likely-to-fail arm**: A5 (opencode + PL + qwen3-opencode-big:30b). The opencode runner adapter is the newest, least-exercised path; EXPERIMENT-AREAS §1.8 already flagged runtime-activation failures under `claude -p`, and the opencode session evidence is a single session log, not a locked run. A3 is second-riskiest on score but its plumbing is proven.
- **One pre-HA-E1 fix to ship first**: write and land the whitelist-copy + post-run leak-audit script (`experiments/harness-arena/runner.js` with a `--audit-only` mode). It is the load-bearing piece of section 2, it is cheap, it produces the evidence HA-E1 needs regardless of arm outcomes, and without it HA-E1 cannot be trusted even if every arm passes.
