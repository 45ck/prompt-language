# Codex Parity Matrix

This note records the validation bar for Codex parity runs and the evidence collected in this workspace.

It is intentionally strict about the difference between:

- checked-in historical evidence
- commands that are runnable from this Windows workspace
- commands rerun during the current evidence-prep slice
- supported-host evidence that is still missing

## Required commands

| Command              | Expected outcome                                      | Evidence to capture                                                               |
| -------------------- | ----------------------------------------------------- | --------------------------------------------------------------------------------- |
| `npm run test`       | Pass                                                  | Exit code, test summary, date, environment                                        |
| `npm run ci`         | Pass                                                  | Exit code, CI summary, coverage summary, date, environment                        |
| `npm run eval:e2e`   | Pass                                                  | Exit code, phase summary, date, environment                                       |
| `npm run eval:smoke` | Pass on a supported host with selected harness access | Exit code, scenario summary, blocked/unsupported reason if any, date, environment |

## Advisory commands

| Command                                                      | Why it matters                                               | Status in this workspace                      |
| ------------------------------------------------------------ | ------------------------------------------------------------ | --------------------------------------------- |
| `node scripts/eval/smoke-test.mjs --history`                 | Local smoke-history summary with pass rates and fail streaks | Runnable on Windows                           |
| `npm run eval:smoke:codex:quick`                             | Fast Codex regression signal over the quick smoke subset     | Runnable, but not a supported-host substitute |
| `node scripts/eval/smoke-test.mjs --harness codex`           | Runs smoke through Codex CLI harness                         | Implemented                                   |
| `node scripts/eval/smoke-test.mjs --harness gemini`          | Runs smoke through Gemini CLI harness                        | Implemented                                   |
| `AI_CMD="gemini -p --yolo" node scripts/eval/smoke-test.mjs` | Uses a custom AI command template override                   | Implemented                                   |
| `npm run eval:compare:quick`                                 | Quick parity signal for comparative experiments              | Not rerun in this pass                        |
| `npm run eval:verify`                                        | Stronger verification benchmark when the host supports it    | Not rerun in this pass                        |
| `npm run eval:compare:v4:quick`                              | Newer comparative eval for regression deltas                 | Not rerun in this pass                        |

## Supported-host expectation

- Live smoke is mandatory for feature-level QA, but it requires a host where the selected harness command can authenticate and execute.
- Native Windows remains unsupported for hooks and live smoke parity.
- When auth is missing, the harness should fail fast with one explicit blocker instead of running empty scenarios.
- `node scripts/eval/smoke-test.mjs --history` is a local analysis tool only. It summarizes stored smoke runs, pass rates, and fail streaks, but it does not validate the live host.

## Host support matrix

| Host / path                         | What this repo can honestly claim today                                   | Evidence status                                                    |
| ----------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Native Windows workspace            | Repo-local docs, tests, and history inspection are actionable here        | Proven by direct command use in this workspace                     |
| Native Windows workspace            | Supported-host live smoke parity for hooks and real agent-loop validation | Not supported; do not claim                                        |
| Native Windows workspace            | Stored smoke-history inspection                                           | Proven, but historical only                                        |
| Native Windows workspace            | Fresh Codex quick-smoke rerun for this evidence-prep slice                | Attempted, but not completed in this slice                         |
| Linux, macOS, or WSL supported host | Fresh `npm run eval:smoke` evidence through a real authenticated harness  | Still missing                                                      |
| Linux, macOS, or WSL supported host | Supported-host Codex parity claim                                         | Still missing until live smoke and comparative reruns are recorded |

## How to read this matrix

- `npm run test`, `npm run ci`, and `npm run eval:e2e` are repo-side evidence.
- `npm run eval:smoke` is host-side evidence and is the only entry that proves the plugin works through a real agent loop.
- `node scripts/eval/smoke-test.mjs --history` is evidence about prior recorded runs, not about current host readiness.
- A historical `27/27` quick-smoke result is useful context, but it is not equivalent to a fresh rerun in the current slice.
- If smoke is blocked, unsupported, or simply not rerun to completion, the gap remains visible rather than being converted into a pass.

## Windows workspace evidence for this slice

- Date: `2026-04-11`
- Host: native Windows, PowerShell
- `node scripts/eval/smoke-test.mjs --history`: ran successfully and reported `31` stored smoke runs from `scripts/eval/results/history.jsonl`
- Smoke-history takeaway: the stored run bank is broadly flaky across many scenarios, so it is useful as trend evidence only
- `npm run eval:smoke:codex:quick`: attempted from this workspace during evidence prep, but not completed within the automation window for this slice
- `npm run eval:smoke`: still not established here as supported-host evidence; native Windows remains outside the supported parity path

## Checked-in historical evidence still referenced by the repo

- Prior checked-in notes record `npm run eval:smoke:codex:quick` passing `27/27`
- That historical quick-smoke result remains worth keeping in the matrix
- It must be read as prior recorded evidence, not as something freshly reconfirmed by every later docs-only slice

## Supported-host evidence still missing

- fresh `npm run eval:smoke` on Linux, macOS, or WSL with a real authenticated harness
- scenario-level outcome capture from that supported-host run
- fresh comparative reruns on a supported host if the repo wants to claim broader Codex parity rather than repo-local readiness only

## Notes

- This matrix is the current source of truth for the Codex parity task tracked in Beads.
- The quick Codex pass is useful evidence for the headless runner path, but it does not replace supported-host live smoke.
- Unsupported or blocked commands stay in the matrix so the gap stays visible until a supported run is available.
