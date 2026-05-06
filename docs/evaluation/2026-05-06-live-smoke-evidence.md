<!-- cspell:ignore qwen Ollama -->

# Live Smoke Evidence: 2026-05-06

This note is the committed summary of the bounded live-smoke runs performed on
2026-05-06 after the harness conformance work. The raw smoke JSON files are
operator-local artifacts under `scripts/eval/results/` and are intentionally
gitignored, so this page records the checkable claim boundary.

## Bounded Runs

| Harness | Model                    | Command shape                                                        | Report                                | Result       | Duration          |
| ------- | ------------------------ | -------------------------------------------------------------------- | ------------------------------------- | ------------ | ----------------- |
| Ollama  | `ollama/qwen3:8b`        | `node scripts/eval/smoke-test.mjs --harness ollama --quick --only E` | `smoke-2026-05-06T00-31-03-808Z.json` | `1/1` passed | bounded `E` smoke |
| Codex   | `gpt-5.2`                | `node scripts/eval/smoke-test.mjs --harness codex --quick --only E`  | `smoke-2026-05-06T00-31-22-532Z.json` | `1/1` passed | bounded `E` smoke |
| Claude  | default Claude CLI model | `node scripts/eval/smoke-test.mjs --harness claude --quick --only E` | `smoke-2026-05-06T00-48-54-771Z.json` | `1/1` passed | `5445ms` total    |

The Claude run used `EVAL_TIMEOUT_MS=120000` and
`PROMPT_LANGUAGE_CLAUDE_EFFORT=medium`. It passed only after the Windows runner
stopped hardcoding `claude.cmd` and allowed `cmd.exe` to resolve `claude` through
`PATHEXT`; this workstation has `claude.exe` and no `claude.cmd`.

## What This Proves

- The PL smoke harness can execute the same bounded `run` scenario through local
  Ollama, Codex, and Claude runner paths on this workstation.
- The previous Claude `runner-command-unavailable` blocker was a Windows command
  resolution bug, not a PL scenario failure.
- The current smoke report schema is sufficient for bounded pass/fail evidence:
  harness, runner harness, model, timeout, selected tests, duration, and
  blocked metadata when applicable.

## What This Does Not Prove

- It does not prove full quick-suite or full-suite live parity.
- It does not prove claim-grade token usage, estimated cloud cost, retry counts,
  raw provider transcript retention, or Ollama GPU residency inside the smoke
  report itself.
- It does not prove local models can autonomously build full-stack products; the
  local-model claim boundary remains the narrower selector/ranker pattern in
  [Evidence Snapshot: 2026-05-06](2026-05-06-evidence-snapshot.md).

## Next Evidence Needed

The next claim-grade step is provider telemetry, not more prose: record
token/cost fields for cloud runs, Ollama usage/GPU snapshots for local runs, and
stdout/stderr or trace artifact paths in the smoke report.
