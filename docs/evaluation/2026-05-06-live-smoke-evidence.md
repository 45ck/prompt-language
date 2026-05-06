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

## Telemetry Probe

After the bounded `E` passes, the Ollama telemetry path was exercised with
`node scripts/eval/smoke-test.mjs --harness ollama --quick --only A` using
`EVAL_MODEL=ollama/qwen3:8b` and `EVAL_TIMEOUT_MS=180000`.

That `A` scenario failed behaviorally (`0/1` passed; `answer.txt` was not
created), so it is not success evidence. It is telemetry evidence: the smoke
report `smoke-2026-05-06T01-12-14-491Z.json` recorded two Ollama provider
records, `496` input tokens, `716` output tokens, `1212` total tokens, `0`
retries, `estimatedCostUsd: null`, before/after `ollama ps`, and `100% GPU`
residency for `qwen3:8b`. `nvidia-smi` was unavailable on this workstation, and
that failure was recorded without failing the smoke harness.

After Codex/Claude telemetry wiring, the prompt-backed `A` slice was rerun:

| Harness | Model                    | Report                                | Result       | Provider records | Usage summary                                                                                                                                  |
| ------- | ------------------------ | ------------------------------------- | ------------ | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Codex   | `gpt-5.2`                | `smoke-2026-05-06T01-37-42-108Z.json` | `1/1` passed | 2                | `112399` input, `502` output, `112901` total, `110336` cached input, `251` reasoning output; cost `null` because no pricing basis was attached |
| Claude  | `claude-opus-4-7` actual | `smoke-2026-05-06T01-38-27-270Z.json` | `1/1` passed | 2                | `23` input, `796` output, `819` total, `308988` cache read, `62602` cache creation; provider-reported `estimatedCostUsd` total `0.5657715`     |

These are bounded smoke probes, not comparative thesis runs. The Codex report
shows token accounting is captured but cost remains intentionally unclaimed
without a versioned pricing basis. The Claude report includes provider-reported
cost and cache-token splits, so it is suitable for accounting within this smoke
scope.

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
- Prompt turns can now emit provider telemetry into smoke reports. Ollama
  records token/duration/retry/zero-API-cost and best-effort runtime evidence.
  Codex records JSONL token/timing events where the CLI exposes them. Claude
  records structured JSON usage/cost where available plus metadata-only
  session-log fallback.

## What This Does Not Prove

- It does not prove full quick-suite or full-suite live parity.
- It does not prove claim-grade cloud cost, raw provider transcript retention, or
  telemetry-backed full-suite parity. Cloud cost remains unclaimed unless it is
  provider-reported or computed from a versioned pricing basis.
- It does not prove local models can autonomously build full-stack products; the
  local-model claim boundary remains the narrower selector/ranker pattern in
  [Evidence Snapshot: 2026-05-06](2026-05-06-evidence-snapshot.md).

## Next Evidence Needed

The next claim-grade step is telemetry-backed repetition: rerun the relevant
quick/full smoke slices and comparative experiments with provider metrics
captured, then add stdout/stderr or trace artifact paths for cloud/frontier runs.
