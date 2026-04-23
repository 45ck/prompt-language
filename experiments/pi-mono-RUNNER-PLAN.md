# pi-mono Runner Adapter — Implementation Plan

Bead: prompt-lmas
Target: add `PiMonoPromptTurnRunner` to prompt-language so flows can execute with `--runner pi-mono`.
Date: 2026-04-20
Status: PLAN ONLY. No code, no invocations, no installs in this task.

## 0. Summary

Clone the **opencode** adapter skeleton, not aider. pi-mono's `--mode json` JSONL stream is structurally closer to opencode's `--format json` than to aider's single-shot stdout blob. Keep aider's "thin env + execFileSync" style only as a fallback for Phase 1 (ollama-only, single-shot `--print`) to de-risk the first milestone; move to the opencode-style streaming summarizer in Phase 2.

One-line invocation (Phase 1):
`pi -p "<prompt>" --mode json --tools read,bash,edit,write,grep,find,ls --provider openai-compat --base-url http://127.0.0.1:11434/v1 --model <model>`

## 1. Port conformance — field-by-field mapping

`PromptTurnInput`:
| Field | Mapping |
|---|---|
| `cwd` | `spawn(..., { cwd })`. pi-mono receives it as its working directory. See §6 on upward-walk risk. |
| `prompt` | Positional `-p <prompt>`. Wrap with the same workflow-framing preamble `buildOpenCodePrompt` uses so fixtures do not get paraphrased. |
| `model` | `--model <model>`. If unset, default to `qwen3-opencode:30b` under the ollama OAI-compat provider. See §11 for the multi-provider question. |
| `scopePrompt` | Not a pi-mono concept. Used only by aider for file inference. pi-mono has its own tool loop, so `scopePrompt` is ignored by the adapter (documented in-code). |

`PromptTurnResult`:
| Field | Source |
|---|---|
| `exitCode` | Child process exit code. |
| `assistantText` | Concatenation of `text`/`assistant_text` events in the JSONL stream, trimmed and truncated to `MAX_OUTPUT_LENGTH = 12_000`. Fallback to raw stderr when no text parts. |
| `madeProgress` | Derived from mutating tool-use events (see §4). **pi-mono does not expose a `step_start`/`step_finish` snapshot pair like opencode.** So progress is tool-use-based only — this is the "lesson learned from the opencode fix" applied from day one. |

Interface asks pi-mono does not expose natively:

- No snapshot before/after hash of the workspace. We cannot detect "text-only turn that didn't touch files" vs "assistant claimed done". Policy: if at least one mutating tool completed successfully, `madeProgress = true`. Otherwise `false` on normal exit, `undefined` on abnormal exit so the outer loop can decide.
- No explicit `scopePrompt` channel. Embed scope into the prompt preamble if needed.
- No per-step event for retry/backoff. Fine — PL's `retry`/`while` is the outer loop.

## 2. Invocation shape (Phase 1, ollama-only)

```text
pi \
  -p "<prompt>"                          # headless one-shot; no TTY, no REPL
  --mode json                            # JSONL event stream on stdout
  --tools read,bash,edit,write,grep,find,ls   # explicit allow-list; no shell escape hatches beyond bash
  --provider openai-compat               # OR --provider ollama if upstream exposes it; see open question
  --base-url http://127.0.0.1:11434/v1   # ollama's OpenAI-compatible endpoint
  --model qwen3-opencode:30b             # default; override with input.model
  --no-color                             # prevent ANSI in JSON payloads if pi respects it
```

Env vars (merged with `process.env`):

- `PATH` — inherited; `pi` must be on PATH (preflight probe via `runner-binary-probe`).
- `OLLAMA_API_BASE=http://127.0.0.1:11434` — harmless if pi-mono ignores it, matches aider.
- `OPENAI_API_KEY=ollama-local` — dummy value so OAI-compat providers that insist on a key do not crash when pointed at ollama (same pattern as opencode's `OLLAMA_API_KEY` default).
- `ANTHROPIC_API_KEY` — passed through only if already set in the parent env; not required for ollama path.
- `TERM=dumb` on win32 (defensive, same reason as aider — pi-mono may link prompt-toolkit-like libs; costs nothing to set).
- `NO_COLOR=1` — belt-and-braces for ANSI-free JSON.

## 3. JSON event schema (INFERRED — open question)

**The research doc (`ecosystem-analysis/pi-mono.md`) does not enumerate `--mode json` event shapes.** Inferred from the fact that pi-agent-core has "tool calling + state management" and from the opencode parallel. Expected shapes (to be verified before writing `summarizeJsonOutput`):

```jsonl
{"type":"session_start","session_id":"..."}
{"type":"text","text":"I'll edit src/foo.ts"}
{"type":"tool_use","tool":"edit","input":{...},"id":"tu_1"}
{"type":"tool_result","tool":"edit","id":"tu_1","status":"completed","output":"..."}
{"type":"text","text":"Done."}
{"type":"turn_end","reason":"stop"}
```

Likely alternate shapes worth defensively parsing:

- Anthropic-style `content_block_delta` / `message_stop` if pi-mono mirrors the Anthropic streaming schema.
- opencode-style nested `part: { tool, state: { status } }`.

Event classification in the summarizer:

- **Start of turn**: `session_start` or first event. Not load-bearing.
- **Tool call**: `type === 'tool_use'`.
- **Tool output**: `type === 'tool_result'` with `status === 'completed'`.
- **Text chunk**: `type === 'text'` (concat `.text`).
- **End of turn**: `type === 'turn_end'` or `type === 'message_stop'` or close-of-stream.

**OPEN QUESTION — BLOCKS PHASE 2.** Before writing `summarizeJsonOutput`, run `pi -p "hello" --mode json` once by hand (outside this planning task) and paste a real sample into the adapter's test fixtures. Until then, Phase 1 uses single-shot `--print` (no `--mode json`) and derives `madeProgress = exitCode === 0 && stdout.trim().length > 0` — matching aider.

## 4. Progress detection heuristic (Phase 2 spec)

Replicate the opencode fix: tool-use-based progress is more reliable than output-snapshot-based.

Algorithm (in `summarizePiMonoJsonOutput`):

```text
MUTATING_TOOLS = { "write", "edit", "patch", "multi_edit", "apply_patch", "bash" (conditional) }
sawMutatingToolUse = false
sawTurnEnd = false
textParts = []

for each JSONL line:
  parse; skip on error
  if type === 'tool_result' and status === 'completed' and tool in MUTATING_TOOLS:
    sawMutatingToolUse = true
  if type === 'tool_use' and state?.status === 'completed' and tool in MUTATING_TOOLS:
    sawMutatingToolUse = true
  if type === 'text' and text: textParts.push(text)
  if type in {'turn_end','message_stop'}: sawTurnEnd = true

assistantText = join(textParts,'\n').trim() || undefined
madeProgress =
  sawMutatingToolUse ? true
  : sawTurnEnd ? false           // turn ended cleanly with no edits
  : undefined                    // stream truncated/ambiguous; let outer loop decide
```

`bash` is **conditional** on tool args: `cat`, `ls`, `pwd`, `grep`, `rg`, `which`, `echo` without redirect are read-only. Conservative default: treat `bash` as non-mutating unless the command string matches `>\|>>\|tee\|sed -i\|rm\|mv\|cp\|mkdir\|touch\|git (add|commit|checkout|reset)`. This is a heuristic; if pi-mono later emits explicit write-to-disk flags in `tool_result`, prefer those.

## 5. Timeout handling

Two independent budgets:

- **Outer exec timeout** — owned by the PL CLI / process supervisor, already in place. Do not change.
- **Inner per-turn timeout** — owned by this adapter.

Constants:

```
const DEFAULT_PI_MONO_TIMEOUT_MS = 180_000;   // 3 min; local qwen3 turns take 30-90s typically
const PI_MONO_TIMEOUT_MS_ENV = 'PROMPT_LANGUAGE_PI_MONO_TIMEOUT_MS';
```

Rationale for 180s default:

- Aider uses 600s — covers shell/lint/test; pi-mono's turn should be just the LLM turn.
- opencode uses 90s — opencode has its own step grace; pi-mono streams events so we can detect hangs earlier.
- 180s is a conservative midpoint pending real measurements.

On timeout: `terminatePiMonoProcessTree(child)` (copy opencode's Windows `taskkill /T /F` logic verbatim), return `{exitCode: 124, assistantText: "pi-mono timed out after <ms>ms.", madeProgress: false}`.

## 6. Working-dir discipline

pi-mono behavior w.r.t. upward walk is **unknown** from the research doc. Known hazards pattern-matched from aider/opencode:

- aider walks up for `.git` — we disable with `--no-git` when missing.
- opencode walks up for `opencode.json` — we scope with `--dir` and force isolated `$HOME`/`$XDG_CONFIG_HOME`.

Defensive posture for pi-mono:

- Always pass `cwd: input.cwd` to `spawn`. Do not rely on CLI to find config.
- If pi-mono reads `~/.pi/config.toml` or similar (likely, given `pi-agent-core` + extensions surface), scope with a workspace-local override: `PROMPT_LANGUAGE_PI_MONO_HOME` env var, following the `PROMPT_LANGUAGE_OPENCODE_HOME` pattern. When set, redirect `HOME`, `USERPROFILE`, `APPDATA`, `LOCALAPPDATA`, `XDG_CONFIG_HOME`, `XDG_DATA_HOME` into that root before spawning.
- **OPEN QUESTION.** Does pi-mono walk up for `.pi-mono/`, `pi.config.toml`, `.git`, or a session directory? Confirm before Phase 2. If yes, document and scope.

## 7. File structure and LOC estimate

Create:

- `C:\Projects\prompt-language\src\infrastructure\adapters\pi-mono-prompt-turn-runner.ts` — ~320 LOC. Structure mirrors `opencode-prompt-turn-runner.ts`: `buildPiMonoArgs`, `buildPiMonoEnv`, `preparePiMonoEnv`, `summarizePiMonoJsonOutput`, `buildPiMonoPrompt`, `terminatePiMonoProcessTree`, `class PiMonoPromptTurnRunner`.
- `C:\Projects\prompt-language\src\infrastructure\adapters\pi-mono-prompt-turn-runner.test.ts` — ~380 LOC. Covers buildArgs, buildEnv, summarizeJsonOutput (fixture-driven), timeout path, progress heuristic edge cases.

Edit:

- `C:\Projects\prompt-language\src\application\execution-preflight.ts` line 14:
  `export type RunnerName = 'claude' | 'codex' | 'opencode' | 'ollama' | 'aider' | 'pi-mono';` — +1 LOC.
- `C:\Projects\prompt-language\bin\cli.mjs`:
  - Line 747-760 `ensureSupportedRunner`: add `'pi-mono'` to the allow-list + update the error message. ~3 LOC.
  - `runHeadlessFlow` runner-config switch (~line 884-942): add `pi-mono` entry with `runnerModule: 'pi-mono-prompt-turn-runner.js'`, `runnerExport: 'PiMonoPromptTurnRunner'`. ~8 LOC.
  - `run` command dispatch (~line 1398-1466): add `if (runner === 'pi-mono') { ... }` branch mirroring the opencode branch. ~12 LOC.
  - `ci` command dispatch (~line 1918-1987): mirror branch. ~12 LOC.
  - Help text line 2071, 2078: append `|pi-mono`. ~2 LOC.
- `C:\Projects\prompt-language\src\infrastructure\adapters\runner-binary-probe.ts` (if it enumerates runners): add `pi-mono` -> probe for `pi` on PATH. ~3 LOC. _Verify existence before editing._
- Profile capabilities in `resolveProfileCapabilities` (execution-preflight.ts line 180-205): the default-else-branch already handles headless-non-claude runners permissively, so no change needed unless we want to flag `pi-mono` as not supporting `approve`. It currently defaults to `supportsMessagePassing: true` for all non-claude runners — confirm this is the intended behavior for pi-mono (probably yes, pi supports tool-mediated coordination).

Total new code: ~700 LOC. Total edits: ~40 LOC across 3-4 files.

## 8. Test strategy

Unit tests (no network, no `pi` on PATH required):

- `buildPiMonoArgs` — golden-file-style expected argv for (default model), (explicit ollama model), (anthropic model + Phase 2 branch), (no prompt — expect throw or empty-prompt guard).
- `buildPiMonoEnv` — asserts `OPENAI_API_KEY`, `OLLAMA_API_BASE`, `TERM=dumb` on win32, `NO_COLOR=1` are set, and `process.env` is preserved.
- `preparePiMonoEnv` — when `PROMPT_LANGUAGE_PI_MONO_HOME` is set, assert scoped HOME/APPDATA layout. Uses a `tmpdir` fixture.
- `summarizePiMonoJsonOutput` — **fixture-driven**. Create `test-fixtures/pi-mono/` with at least:
  - `text-only.jsonl` — text events + turn_end, no tool_use. Expect `madeProgress === false`.
  - `edit-flow.jsonl` — tool_use(edit) + tool_result(completed) + text + turn_end. Expect `madeProgress === true`, assistantText captured.
  - `truncated.jsonl` — stream cut mid-tool. Expect `madeProgress === undefined`.
  - `bash-readonly.jsonl` — tool_use(bash) with `ls -la` input. Expect `madeProgress === false`.
  - `bash-mutating.jsonl` — tool_use(bash) with `echo x > file`. Expect `madeProgress === true`.
  - `malformed-lines.jsonl` — mix of valid events and garbage lines. Expect garbage skipped silently.
- `PiMonoPromptTurnRunner.run` integration smoke test — stub `child_process.spawn` via a test double (same pattern as `opencode-prompt-turn-runner.test.ts`); feed canned stdout chunks; assert the promise resolves with expected `PromptTurnResult`. No `pi` binary involved.
- Timeout test — inject a spawn stub that never emits `close`; assert the adapter resolves with exit 124 within `timeoutMs + slack`.

## 9. CLI wiring

Already covered in §7. The runner string is parsed in `bin/cli.mjs` at:

- `ensureSupportedRunner` (line 747) — allow-list gate.
- `defaultModelForRunner` (line 743) — add `runner === 'pi-mono' ? 'qwen3-opencode:30b' : undefined` (Phase 1 ollama default; Phase 2 removes the default).
- `defaultValidateModeForRunner` (line 771) — pi-mono is headless, so `'headless'` (the non-claude default already does this, no change needed).
- `runHeadlessFlow` config switch — adds the module path.
- `run` / `ci` command dispatch — adds the branch.
- `ensureJsonSupportedForRunner` (line 860) — pi-mono's `--mode json` means JSON _is_ supported; confirm this shim passes through without blocking.

## 10. Cross-benefit — openclaw bridge (out of scope, follow-up)

openclaw is built on pi-mono (per the user's note; not re-verified here). Adding this adapter creates a latent path: once PL can drive pi-mono as a turn runner, a symmetric tool-facing entrypoint to PL can be exposed _to_ openclaw, enabling "PL-as-skill-under-openclaw." That bridge is deliberately **out of scope** for this adapter. Track as a follow-up bead after Phase 3 lands.

Concretely, the follow-up task is:

- Define a pi-mono-compatible tool manifest for invoking `prompt-language run --flow=... --json` as a single tool call from openclaw.
- Wire the tool output through pi-mono's `tool_result` shape so openclaw can consume it.
- This is additive; it does not modify the adapter built here.

## 11. Risk — pi-mono's multi-provider surface

Pick **ollama-default for Phase 1**, mirror `--model <provider>/<model>` in Phase 2.

Rationale:

- Local-parity with opencode, ollama, aider runners keeps the test matrix uniform (qwen3-opencode:30b is PL's proven local model).
- Phase 1 is easier to land and exercise without API keys in CI.
- Phase 2 unlocks pi-mono's main differentiator (20+ provider fan-out in one adapter) but risks surface-leakage: if we expose `--model anthropic/claude-opus-4`, we also need to thread `ANTHROPIC_API_KEY`, rate-limit handling, subscription-auth edge cases. Defer until the ollama path is green and the JSON event schema is confirmed (§3 open question).

Implementation in Phase 2:

- If `input.model` contains a `/`, split on first `/`: `provider,modelId = input.model.split('/',1)`.
- Pass `--provider <provider> --model <modelId>`. For `ollama` prefix, also inject `--base-url http://127.0.0.1:11434/v1`.
- For hosted providers, do NOT override base URL; rely on pi-ai defaults.
- Document supported provider prefixes in the adapter's JSDoc.

Alternative rejected: "mirror `--model` string verbatim to pi-mono." Rejected because PL's other runners use `ollama/<model>` and `ollama_chat/<model>` forms that pi-mono likely does not recognize. A small translation layer is safer than pushing PL's naming convention onto pi-mono.

## 12. Staged rollout

**Phase 1 — ollama-only, `--print` (no JSON).** ~2 days.

- argv: `pi -p <prompt> --provider openai-compat --base-url http://127.0.0.1:11434/v1 --model <model> --tools read,bash,edit,write,grep,find,ls`.
- madeProgress derived from exitCode + non-empty stdout (aider pattern).
- Unit tests on buildArgs / buildEnv.
- Integration smoke test on H1-H3 fixtures; skip H4-H10.
- Ship behind `--runner pi-mono` but document as experimental.

**Phase 2 — `--mode json` streaming + multi-provider.** ~3 days. Blocked on §3 open question.

- Capture a real JSONL sample; freeze the event types the summarizer recognizes.
- Add `summarizePiMonoJsonOutput` with the §4 progress heuristic.
- Add `--model <provider>/<model>` translation (§11).
- Fixture-based tests (§8).
- Run E1 from the research doc: PL+pi vs solo-pi on H1-H10 fixtures.
- Remove the experimental label if E1 matches the PL+aider 6-0-3 target.

**Phase 3 — spawn/race integration.** ~2 days.

- Verify `ProcessSpawner.spawn` + `race` work with pi-mono children (should be automatic since it implements `PromptTurnRunner`, but validate session-dir isolation and termination on the Windows path).
- Run E2 from the research doc: race across three providers.
- Add a provider-race recipe to `experiments/`.

## Open questions (must resolve before Phase 2)

1. Exact `--mode json` event schema. Run `pi -p "hello" --mode json 2>&1 | head -n 50` once and paste.
2. Does pi-mono support a native `ollama` provider, or only `openai-compat` pointed at the ollama endpoint?
3. Does pi-mono walk upward for any config (`.pi`, `pi.config.toml`, `.git`, session dirs)? If yes, which? This determines whether `PROMPT_LANGUAGE_PI_MONO_HOME` is decorative or load-bearing.
4. Does `--tools` accept comma-separated values or requires repeated flags (`--tools read --tools bash`)? README excerpt in the research doc shows comma-separated.
5. Is `--no-color` / `NO_COLOR` respected inside JSON-mode payloads? ANSI in `assistantText` would be annoying but survivable.

Each question is resolvable with one manual `pi` invocation outside PL. None block Phase 1.

## Style constraints observed

- `execFileSync`-style synchronous fallback is available (aider) but the JSONL streaming path (opencode) is the better skeleton because it allows early termination on `turn_end` and per-event progress tracking. Use opencode's `spawn` + `'data'` handler pattern.
- Env-var naming: `PROMPT_LANGUAGE_PI_MONO_*` (underscore-separated, matching existing adapters).
- No new runtime deps. Everything achievable with `node:child_process`, `node:fs/promises`, `node:path`.
- Test file mirrors the structure of `opencode-prompt-turn-runner.test.ts`: describe blocks per exported function, fixture directory under `src/infrastructure/adapters/test-fixtures/pi-mono/`.

## Files touched (absolute paths)

Create:

- C:\Projects\prompt-language\src\infrastructure\adapters\pi-mono-prompt-turn-runner.ts
- C:\Projects\prompt-language\src\infrastructure\adapters\pi-mono-prompt-turn-runner.test.ts
- C:\Projects\prompt-language\src\infrastructure\adapters\test-fixtures\pi-mono\*.jsonl (Phase 2)

Edit:

- C:\Projects\prompt-language\src\application\execution-preflight.ts
- C:\Projects\prompt-language\bin\cli.mjs
- C:\Projects\prompt-language\src\infrastructure\adapters\runner-binary-probe.ts (verify path first)
