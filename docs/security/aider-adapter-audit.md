# Aider Adapter Security Audit

Date: 2026-04-14
Auditor: security reviewer (threat-surface-mapper + trust-boundary-identifier)
Scope: commits `91c64ae` (`feat: add aider harness adapter`) and `bcb33d7`
(`fix: add aider to RunnerName type and RUNNER_BINARIES map`).
Reference: `src/infrastructure/adapters/codex-prompt-turn-runner.ts`,
`src/infrastructure/adapters/claude-process-spawner.ts`.

## Background

`AiderPromptTurnRunner` implements the `PromptTurnRunner` port so prompt-language
flows can orchestrate `aider` with local Ollama models. The runner shells out to
`python -m aider --message <prompt>` via `execFileSync` and returns stdout as
`assistantText`. Wiring in `bin/cli.mjs` (`runAiderFlow` → `runHeadlessFlow`)
wraps the raw runner with `TracedPromptTurnRunner` whenever `PL_TRACE=1`, so
the adapter participates in the shared `agent_invocation_begin` /
`agent_invocation_end` chain when tracing is active.

This audit verifies that the adapter inherits the same trace and isolation
guarantees as the peer `CodexPromptTurnRunner` and the `ClaudeProcessSpawner`
reference pattern, and flags any deviation that could weaken provenance,
leak data, or enable injection.

## Verdicts

| #       | Question                                                                            | Finding                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Severity                   | Fix                                                                                                                                                                                                    |
| ------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1       | Trace propagation (`PL_RUN_ID`, `PL_TRACE`, `PL_TRACE_DIR`)                         | PASS. `buildAiderEnv()` (`aider-prompt-turn-runner.ts:43-49`) returns `{ ...process.env, PYTHONUTF8, OLLAMA_API_BASE }`. The `...process.env` spread forwards all three trace vars plus `PL_TRACE_STRICT` by inheritance. This is a superset of the explicit allow-list in `claude-process-spawner.ts:60-62`, matching codex/ollama/opencode peers.                                                                                                                                                                                                                                                                                                                                        | 1 (low, informational)     | None required; document that adapter relies on inheritance rather than explicit allow-list.                                                                                                            |
| 2       | Shim PATH honoring                                                                  | PASS. `execFileSync('python', args, …)` (`aider-prompt-turn-runner.ts:63`) resolves `python` via `PATH`, so deliberate PATH shims (e.g., a wrapping binary for test isolation) intercept correctly. `runner-binary-probe.ts:10` also probes `python` on `PATH`. No hard-coded interpreter path.                                                                                                                                                                                                                                                                                                                                                                                            | 0                          | None.                                                                                                                                                                                                  |
| 3       | `PromptTurnRunner` contract via `TracedPromptTurnRunner`                            | PASS. `bin/cli.mjs:1021-1024` wraps the raw runner in `TracedPromptTurnRunner` when `PL_TRACE=1`. `stdinSha256 = sha256Hex(input.prompt)` accurately fingerprints what aider receives because `input.prompt` is passed verbatim as `--message`. `stdoutSha256` reflects the truncated `assistantText` (adapter truncates at 12,000 chars before returning, same pattern as codex `buildResult`).                                                                                                                                                                                                                                                                                           | 1 (low, parity with codex) | None; accepted drift documented here.                                                                                                                                                                  |
| 4       | Env isolation — secrets beyond what's needed; `PL_TRACE_STRICT` leak                | MIXED. `{ ...process.env }` forwards the full parent env to the child python process, including any ambient secrets (`GITHUB_TOKEN`, `OPENAI_API_KEY`, etc.). This matches every peer adapter's behavior (claude-process-spawner, codex, ollama, opencode) and is required for CI tokens to be visible to child runners. `PL_TRACE_STRICT` is forwarded — desirable for meta-factory runs. `OLLAMA_API_BASE` is **hardcoded** to `http://127.0.0.1:11434`, overriding any caller-supplied value. This is security-positive (keeps inference local) but functionally restrictive.                                                                                                           | 2 (medium, informational)  | Document that callers cannot redirect aider away from localhost via env; consider adding a `PROMPT_LANGUAGE_AIDER_OLLAMA_BASE` escape hatch in a follow-up.                                            |
| 5       | Error handling — swallow vs propagate                                               | PASS. `run()` catches, inspects `failure.killed`/`failure.status`/`failure.code`, and returns a well-formed `PromptTurnResult` with a real `exitCode`. Timeout path returns `exitCode: 124` and `madeProgress: false`. No silent `catch {}` swallow.                                                                                                                                                                                                                                                                                                                                                                                                                                       | 0                          | None.                                                                                                                                                                                                  |
| 6       | Command injection — user-controlled strings interpolated without `shellInterpolate` | PASS. `execFileSync` is invoked with an argv array (no `shell: true`). The `input.prompt` string lands in the `--message` argv slot and is never passed through a shell. `stdio: ['ignore', 'pipe', 'pipe']` means stdin is not used, so nothing else is composed.                                                                                                                                                                                                                                                                                                                                                                                                                         | 0                          | None.                                                                                                                                                                                                  |
| 7       | CI-rule weakening (`package.json` scripts, lint/test gates)                         | PASS. Neither commit touches `package.json`, `eslint.config.mjs`, `tsconfig.json`, nor any dependency-cruiser or knip rule. `git show 91c64ae -- package.json` and `git show bcb33d7 -- package.json` return no changes.                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | 0                          | None.                                                                                                                                                                                                  |
| 8 (new) | Prompt visible on OS-level process listing                                          | **DEVIATION**. Aider is the only `PromptTurnRunner` that places the full prompt text on `argv` via `--message <prompt>` (`aider-prompt-turn-runner.ts:37-38`). Codex feeds the prompt through `child.stdin?.end(...)` (`codex-prompt-turn-runner.ts:200`); Ollama posts via HTTP; Claude passes prompt as the final positional arg to `claude -p` (already Sev 2 territory accepted at the spawner level). Any local user on the host can read the prompt via `ps -ef`, `/proc/<pid>/cmdline`, or Process Explorer. If the prompt contains embedded secrets (interpolated `${var}` values with credentials, customer data, etc.), they are exposed for the lifetime of the python process. | 2 (medium)                 | **Follow-up fix:** send prompt via stdin using a stdin-enabled flag (aider supports `--message-file -`) or pipe via `spawn(…, { stdio: ['pipe', 'pipe', 'pipe'] })`. Tracked under `prompt-xgav.11.*`. |
| 9 (new) | `resolveFiles` hook returns empty; no sandbox boundary                              | INFORMATIONAL. `resolveFiles(cwd)` returns `[]` (line 113-115) — aider is invoked without explicit file scope, so the model's file-edit reach is bounded only by aider's own cwd discovery. In a multi-tenant workspace this is acceptable because the parent process already chose `cwd`.                                                                                                                                                                                                                                                                                                                                                                                                 | 1 (low)                    | None for now; consider a future bead to thread allow-listed file globs through.                                                                                                                        |

## Code citations

- `src/infrastructure/adapters/aider-prompt-turn-runner.ts:22-41` — `buildAiderArgs` places `input.prompt` on argv as `--message <prompt>`.
- `src/infrastructure/adapters/aider-prompt-turn-runner.ts:43-49` — `buildAiderEnv` spreads `process.env` (trace chain inherited), overrides `OLLAMA_API_BASE`.
- `src/infrastructure/adapters/aider-prompt-turn-runner.ts:63-70` — `execFileSync('python', args, { env, stdio: ['ignore','pipe','pipe'] })` — no shell, stdin closed.
- `src/infrastructure/adapters/aider-prompt-turn-runner.ts:77-110` — structured error handling: timeout → 124, status → passthrough, fallback → 1.
- `src/infrastructure/adapters/codex-prompt-turn-runner.ts:200` — reference: prompt via `child.stdin?.end(...)`, argv carries only flags.
- `src/infrastructure/adapters/claude-process-spawner.ts:60-62` — reference: explicit trace-var allow-list forwarded to children.
- `bin/cli.mjs:1021-1024` — `TracedPromptTurnRunner` wraps the raw aider runner when `PL_TRACE=1`.
- `src/infrastructure/adapters/runner-binary-probe.ts:10` — aider maps to `python` binary probe.
- `src/infrastructure/adapters/traced-prompt-turn-runner.ts:74-128` — stdin/stdout sha256 envelope the adapter participates in.

## Trust & threat surface summary

- **Primary trust boundary**: user's prompt-language process → `python -m aider` subprocess → local Ollama daemon on `127.0.0.1:11434`. All three run under the same uid/user context.
- **Data flow in**: prompt text (possibly containing interpolated `${var}` values), model name, cwd, parent env.
- **Data flow out**: stdout (truncated 12,000 chars) → `assistantText`; no capture envelope consumption beyond that.
- **Attackers considered**: (a) local unprivileged user reading `ps`/`/proc` (finding 8), (b) malicious `python` shim on PATH (mitigated by PATH being user-owned), (c) malicious `OLLAMA_API_BASE` override attempt (blocked — hardcoded), (d) adversarial prompt content (no shell, no fs write beyond aider's own).
- **Not exploitable bypass**: no evidence the adapter disables tracing, rebinds `PL_TRACE`, or short-circuits the traced runner wrapper.

## Disposition

**Safe to ship for internal/single-user use.** No Severity ≥ 3 finding.

The adapter correctly honors the `PromptTurnRunner` contract, does not introduce
command injection, does not weaken CI gates, and inherits the trace chain
through its host wiring. The sole medium-severity deviation — passing the
prompt on argv rather than stdin — is visible to same-host local users only
and matches the risk profile already accepted for the claude direct-cli
invocation elsewhere in the codebase.

**Needs fix before next meta-run with secrets in prompts?** If a meta-factory
experiment interpolates secret material into `${var}` and then emits it to the
aider runner, the `ps`-visibility issue (finding 8) becomes actively exploitable
in shared-host scenarios. Recommend scheduling the stdin-migration fix under
`prompt-xgav.11.1` before running aider on any host where untrusted local users
exist.

## Follow-up tests landed

`aider-prompt-turn-runner.test.ts` extended with three new assertions covering:

1. Env-forwarding parity with `claude-process-spawner` — `PL_RUN_ID`, `PL_TRACE`,
   `PL_TRACE_DIR`, `PL_TRACE_STRICT` visible in the child env.
2. Shim-PATH honoring — binary resolved as literal `"python"` so PATH shims
   intercept.
3. `TracedPromptTurnRunner` stdin/stdout sha256 produces non-empty hex when
   wrapping this adapter.

Finding-8 (`ps`-visibility) is landed as a `.skip`'d test with
`TODO(bead-followup)` pointing at the stdin-migration bead.
