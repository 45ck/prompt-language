# Codex Parity Matrix

This note is the closure-review matrix for `prompt-language-5pej.1`.

As of `2026-04-15`, the latest executed evidence comes from:

- [2026-04-12 Codex Parity Full Run Evidence](2026-04-12-codex-parity-full-run-evidence.md)
- [2026-04-12 Cross-Platform Smoke Verification](2026-04-12-cross-platform-smoke-verification.md)
- [2026-04-11 Codex Parity Execution Evidence](2026-04-11-codex-parity-execution-evidence.md)

Earlier results remain useful context but do not override newer failures or blockers.

## Evidence Format

Use the same fields for every matrix row so closure review stays checkable.

| Field             | Required content                                                       |
| ----------------- | ---------------------------------------------------------------------- |
| `check`           | exact command or host-specific rerun path                              |
| `date`            | execution date or explicit `not rerun` marker                          |
| `host`            | OS, shell, runtime, and support posture                                |
| `result`          | exit code plus the shortest honest outcome summary                     |
| `classification`  | `pass`, `failed`, `blocked`, `not rerun`, or `historical context only` |
| `closure meaning` | whether the row blocks parity, supports parity, or is advisory only    |
| `source`          | checked-in evidence note or explicit `none in current note set`        |

## Exact Environment Constraints

| Constraint                 | Exact state                                                                                                                                         | Date         | Closure meaning                                                                 | Source                                                                                                                                                        |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Windows workspace          | Native Windows, `PowerShell`, Node `v22.22.0`, repo path `D:\Visual Studio Projects\prompt-language`                                                | `2026-04-12` | Valid for repo-local checks and evidence capture                                | [2026-04-12 Codex Parity Full Run Evidence](2026-04-12-codex-parity-full-run-evidence.md)                                                                     |
| Windows live-smoke support | Native Windows is still not the supported host for hooks or full live-smoke parity claims                                                           | `2026-04-12` | Do not treat Windows live-smoke attempts as supported-host closure proof        | [2026-04-12 Cross-Platform Smoke Verification](2026-04-12-cross-platform-smoke-verification.md), [Live Validation Evidence](eval-live-validation-evidence.md) |
| Windows auth state         | Claude CLI is installed but `npm run eval:smoke` blocked before scenarios because login/access was unavailable                                      | `2026-04-12` | External blocker for live smoke from this workspace                             | [2026-04-12 Codex Parity Full Run Evidence](2026-04-12-codex-parity-full-run-evidence.md)                                                                     |
| WSL runtime state          | WSL2 Ubuntu exists, but Node is `v18.19.1`, below repo engine floor `>=22.0.0`                                                                      | `2026-04-12` | WSL live smoke is blocked until the runtime is upgraded                         | [2026-04-12 Cross-Platform Smoke Verification](2026-04-12-cross-platform-smoke-verification.md)                                                               |
| macOS execution            | Native macOS smoke cannot be executed from this Windows host                                                                                        | `2026-04-12` | macOS evidence must come from a real macOS host or hosted CI                    | [2026-04-12 Cross-Platform Smoke Verification](2026-04-12-cross-platform-smoke-verification.md)                                                               |
| CI-safe smoke posture      | `npm run eval:smoke:ci` passed on Windows native and WSL Ubuntu; hosted CI already runs it on `ubuntu-latest`, `macos-latest`, and `windows-latest` | `2026-04-12` | Useful non-auth cross-platform evidence, but not a substitute for live smoke    | [2026-04-12 Cross-Platform Smoke Verification](2026-04-12-cross-platform-smoke-verification.md)                                                               |
| Worktree state             | Dirty worktree with changes outside this note scope as of April 12                                                                                  | `2026-04-12` | Results apply to the checked-out branch state, not a pristine baseline snapshot | [2026-04-12 Codex Parity Full Run Evidence](2026-04-12-codex-parity-full-run-evidence.md)                                                                     |

## Check Families

This is the exact required-versus-advisory split for `prompt-language-5pej.1`.

| Family                    | Checks                                                                               | Required now?                                                  | Why                                                                                                                                     |
| ------------------------- | ------------------------------------------------------------------------------------ | -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Repo-local regression bar | `npm run test`, `npm run ci`, `npm run eval:e2e`                                     | yes                                                            | These are the deterministic repo-local checks that must be green before any honest repo-local parity claim.                             |
| Supported-host live smoke | `npm run eval:smoke`                                                                 | yes                                                            | This is the mandatory live-loop proof for supported-host parity and for behavior touching hooks, parsing, advancement, state, or gates. |
| Fast runner regression    | `npm run eval:smoke:codex:quick`                                                     | advisory but high-signal                                       | This is the fastest Codex-specific regression signal, but it does not replace supported-host live smoke.                                |
| Broader comparative evals | `npm run eval:compare:quick`, `npm run eval:compare:v4:quick`, `npm run eval:verify` | advisory for `5pej.1`; required only for broader parity claims | These widen the claim beyond repo-local and live-smoke parity.                                                                          |

## Required Checks

These checks define the authoritative parity bar.

| Check                | Why required                            | Latest executed evidence                                                                                                     | Date         | Host                                        | Classification | Closure meaning                                                       | Source                                                                                    |
| -------------------- | --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------ | ------------------------------------------- | -------------- | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `npm run test`       | Required repo-local regression signal   | Exit `1`; Vitest reported `2635` passed and `2` failed in `inject-context.test.ts`                                           | `2026-04-12` | Windows native, Node `v22.22.0`             | `failed`       | Blocks any green repo-local parity claim for the current branch state | [2026-04-12 Codex Parity Full Run Evidence](2026-04-12-codex-parity-full-run-evidence.md) |
| `npm run ci`         | Required repo-local quality gate        | Exit `1`; passed `typecheck`, failed `lint` on `advance-flow.ts:576` with `prefer-const`                                     | `2026-04-12` | Windows native, Node `v22.22.0`             | `failed`       | Blocks any green repo-local parity claim for the current branch state | [2026-04-12 Codex Parity Full Run Evidence](2026-04-12-codex-parity-full-run-evidence.md) |
| `npm run eval:e2e`   | Required repo-local eval runner signal  | Exit `1`; build succeeded, `A1` failed with `ETIMEDOUT`, cleanup hit `EBUSY`                                                 | `2026-04-12` | Windows native, Node `v22.22.0`             | `failed`       | Blocks a green repo-local eval-runner parity claim                    | [2026-04-12 Codex Parity Full Run Evidence](2026-04-12-codex-parity-full-run-evidence.md) |
| `npm run eval:smoke` | Required for supported-host live parity | Exit `1`; build and install succeeded, then blocked before any scenarios ran because Claude CLI login/access was unavailable | `2026-04-12` | Windows native, unsupported for live parity | `blocked`      | Keeps supported-host parity open; do not convert this into a pass     | [2026-04-12 Codex Parity Full Run Evidence](2026-04-12-codex-parity-full-run-evidence.md) |

## Advisory Checks

These checks add confidence or diagnostic context, but they do not replace the required bar.

| Check                                                        | Why advisory                                           | Latest executed evidence                                                                       | Date         | Host                                | Classification            | Closure meaning                                                                               | Source                                                                                      |
| ------------------------------------------------------------ | ------------------------------------------------------ | ---------------------------------------------------------------------------------------------- | ------------ | ----------------------------------- | ------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `npm run eval:smoke:codex:quick`                             | Fast Codex runner regression signal                    | Local timeout expired (`604013 ms`); no closure-relevant result captured for the current run   | `2026-04-12` | Windows native, Codex CLI `0.120.0` | `blocked/inconclusive`    | No current quick-smoke closure signal; prior April 11 `27/27` pass is historical context only | [2026-04-12 Codex Parity Full Run Evidence](2026-04-12-codex-parity-full-run-evidence.md)   |
| `npm run eval:smoke:codex:quick`                             | Historical comparison point                            | Prior checked-in quick suite recorded `27/27` passing before AK was introduced                 | `2026-04-11` | Windows native                      | `historical context only` | Useful for delta analysis only; does not override the April 12 inconclusive result            | [2026-04-11 Codex Parity Execution Evidence](2026-04-11-codex-parity-execution-evidence.md) |
| `npm run eval:smoke:gemini:quick`                            | Fast Gemini regression signal over the same subset     | No fresh executed evidence found in the checked-in note set                                    | `not rerun`  | No current executed-host record     | `not rerun`               | Runnable path exists, but no closure-relevant result is recorded                              | none in current note set                                                                    |
| `node scripts/eval/smoke-test.mjs --history`                 | Summarizes stored smoke history and fail streaks       | Ran successfully and reported `31` stored smoke runs from `scripts/eval/results/history.jsonl` | `2026-04-11` | Windows native                      | `pass`                    | Trend evidence only; cannot backfill live-host proof                                          | [2026-04-11 Codex Parity Execution Evidence](2026-04-11-codex-parity-execution-evidence.md) |
| `npm run eval:compare:quick`                                 | Comparative parity signal against baseline experiments | No fresh executed evidence found in the checked-in note set                                    | `not rerun`  | No current executed-host record     | `not rerun`               | Leaves broader comparative parity unproven                                                    | none in current note set                                                                    |
| `npm run eval:compare:v4:quick`                              | Newer comparative parity signal                        | No fresh executed evidence found in the checked-in note set                                    | `not rerun`  | No current executed-host record     | `not rerun`               | Leaves broader comparative parity unproven                                                    | none in current note set                                                                    |
| `npm run eval:verify`                                        | Stronger verification benchmark                        | No fresh executed evidence found in the checked-in note set                                    | `not rerun`  | No current executed-host record     | `not rerun`               | Leaves stronger verification claims unproven                                                  | none in current note set                                                                    |
| `node scripts/eval/smoke-test.mjs --harness codex`           | Full Codex harness execution path                      | Implemented and exercised via quick subset; no full-suite closure evidence                     | `not rerun`  | No current executed-host record     | `not rerun`               | Capability exists, but no full-suite closure evidence for current test count                  | none in current note set                                                                    |
| `node scripts/eval/smoke-test.mjs --harness gemini`          | Gemini harness execution path                          | Implemented, but no fresh executed evidence found in the checked-in note set                   | `not rerun`  | No current executed-host record     | `not rerun`               | Capability exists, but no current closure evidence                                            | none in current note set                                                                    |
| `AI_CMD="gemini -p --yolo" node scripts/eval/smoke-test.mjs` | Custom command-template override                       | Supported path, but no fresh executed evidence found in the checked-in note set                | `not rerun`  | No current executed-host record     | `not rerun`               | Confirms configurability only, not parity                                                     | none in current note set                                                                    |

## Smoke Test Catalog

This is the full set of smoke tests in `scripts/eval/smoke-test.mjs` as of `2026-04-15`, with per-test Codex parity classification.

### Parity Status Definitions

| Status              | Meaning                                                                            |
| ------------------- | ---------------------------------------------------------------------------------- |
| `PARITY`            | Expected to produce the same result under Codex as under Claude                    |
| `EXPECTED_VARIANCE` | Known difference due to model behavior, prompt format, or runtime difference       |
| `NOT_APPLICABLE`    | Test relies on a Claude-specific feature not present in Codex (e.g., plugin hooks) |
| `BLOCKED`           | Cannot run due to auth, host, or runtime issue; parity status not yet determined   |
| `HISTORICAL_PASS`   | Passed in a prior run; no fresh evidence for the current branch state              |

### Quick Mode Tests (run in both `--quick` and full modes)

These tests execute in every smoke run including `npm run eval:smoke:codex:quick`.

| Test | Label                               | Quick? | Codex Parity Status | Notes                                                                                                                           |
| ---- | ----------------------------------- | ------ | ------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| A    | Context file relay                  | yes    | `PARITY`            | Pure file I/O; no hook or Claude-specific behavior. Codex `exec` mode handles file reads/writes.                                |
| B    | Context recall                      | yes    | `EXPECTED_VARIANCE` | Requires model to recall a code from a previous turn. Codex memory across turns may differ; output format sensitivity.          |
| C    | Variable interpolation              | yes    | `PARITY`            | `let`/`var` and `${var}` substitution is deterministic PL runtime; model only sees resolved text.                               |
| E    | Run auto-execution                  | yes    | `PARITY`            | `run:` node auto-executes without model involvement. File creation is deterministic.                                            |
| F    | Foreach iteration                   | yes    | `PARITY`            | Iteration logic is deterministic PL runtime. Model only sees per-item prompts.                                                  |
| G    | Let-prompt capture                  | yes    | `EXPECTED_VARIANCE` | Requires model to respond with a short captured value inside the capture tag. Codex output format affects capture reliability.  |
| H    | If/else branching                   | yes    | `PARITY`            | Branch condition is `command_succeeded` — deterministic PL variable, not model choice.                                          |
| I    | Try/catch handling                  | yes    | `PARITY`            | Catch trigger is `run:` failure — deterministic. Model sees catch-branch prompt.                                                |
| K    | Variable chain                      | yes    | `PARITY`            | `let x = run` + `if` + `${x}` is fully deterministic. Model only sees resolved interpolated text.                               |
| N    | Capture reliability                 | yes    | `EXPECTED_VARIANCE` | Same mechanism as G. Reliability depends on model following the capture-tag protocol.                                           |
| Q    | List append                         | yes    | `PARITY`            | `let x = []` and `let x += "val"` are pure PL domain operations. No model involvement.                                          |
| U    | And/or conditions                   | yes    | `PARITY`            | Condition is `command_succeeded and command_succeeded` — deterministic. Model sees a resolved if-branch prompt.                 |
| V    | Numeric comparison                  | yes    | `EXPECTED_VARIANCE` | `if ${count} > 0` is deterministic PL evaluation, but prior `let count = prompt` capture may vary.                              |
| W    | Try/finally                         | yes    | `PARITY`            | Finally always executes; deterministic PL control flow. Model only sees finally-branch prompt.                                  |
| Z    | Multi-var interpolation             | yes    | `PARITY`            | Multiple `${var}` references; all resolved by PL runtime before model sees the text.                                            |
| AA   | Approve timeout                     | yes    | `NOT_APPLICABLE`    | `approve "msg" timeout N` relies on the Claude Code hook lifecycle for auto-advance. Codex does not support approval hooks.     |
| AB   | Review block                        | yes    | `NOT_APPLICABLE`    | `review max 1` relies on the hook lifecycle for review-turn counting. Codex hook support is experimental and not confirmed.     |
| AC   | Remember + memory:                  | yes    | `NOT_APPLICABLE`    | `remember` and `memory:` rely on the Claude Code memory hook. Codex does not support this hook.                                 |
| AG   | Import anonymous flow               | yes    | `PARITY`            | Flow import is a PL parser feature. Model only sees the resolved flow prompts.                                                  |
| AH   | Import namespaced library           | yes    | `PARITY`            | Same as AG. Namespace resolution is PL parser logic.                                                                            |
| AI   | Continue skips iteration            | yes    | `PARITY`            | `continue` node is deterministic PL control flow; no model involvement in the skip logic.                                       |
| AJ   | Remember key-value storage          | yes    | `NOT_APPLICABLE`    | Same hook dependency as AC.                                                                                                     |
| AK   | Grounded-by while                   | yes    | `EXPECTED_VARIANCE` | `ask` condition requires model to return a yes/no verdict inside a capture tag. Codex output format may affect verdict parsing. |
| AL   | Continue in while                   | yes    | `PARITY`            | `continue` inside `while` is deterministic PL control flow.                                                                     |
| AM   | Spawn basic child                   | yes    | `EXPECTED_VARIANCE` | `spawn` launches a child `codex exec` process. Codex spawning behavior differs from `claude -p` child spawning.                 |
| AN   | Spawn inherits parent variables     | yes    | `EXPECTED_VARIANCE` | Same spawn mechanism as AM; variable import depends on child process completing correctly.                                      |
| AO   | Include file directive              | yes    | `PARITY`            | File include is a PL parser feature resolved before model execution.                                                            |
| AP   | Swarm manager-worker                | yes    | `EXPECTED_VARIANCE` | Swarm spawns multiple child processes. Codex child process behavior differs; model role is to coordinate, not control flow.     |
| AQ   | Swarm reviewer-after-workers        | yes    | `EXPECTED_VARIANCE` | Same as AP with an additional reviewer role.                                                                                    |
| AW   | Labeled break exits outer loop      | yes    | `PARITY`            | Labeled `break` is deterministic PL control flow; no model involvement.                                                         |
| Z1   | List-length drift in foreach+append | yes    | `PARITY`            | `${x_length}` auto-var is set by PL runtime on every append. Deterministic.                                                     |
| Z2   | Nonce propagation across runs       | yes    | `PARITY`            | Per-session UUID nonce is set by PL runtime. Deterministic trace; model does not control the nonce.                             |
| Z3   | Capture-gated branch                | yes    | `EXPECTED_VARIANCE` | Branch depends on `let coin = prompt` capture. Codex capture reliability applies.                                               |
| Z4   | Interleaved state probe             | yes    | `EXPECTED_VARIANCE` | Each iteration depends on prior capture. Codex capture reliability compounds across iterations.                                 |
| AS   | Composite all(...) gate             | yes    | `PARITY`            | Gate composition is evaluated by PL gate engine after flow completion. Deterministic command execution.                         |
| AT   | Spawn with modifiers                | yes    | `EXPECTED_VARIANCE` | Conditional spawn uses `if ... spawn "worker"`. Spawn behavior under Codex applies.                                             |
| AU   | Nested try/catch/finally            | yes    | `PARITY`            | Nested try/catch/finally propagation is deterministic PL control flow. Model sees catch-branch prompts.                         |
| AV   | foreach item in run "cmd"           | yes    | `PARITY`            | `foreach item in run "cmd"` source resolution is deterministic PL runtime.                                                      |
| AX   | Snapshot + rollback (state-only)    | yes    | `PARITY`            | `snapshot`/`rollback` is pure PL state-management; no model involvement in the checkpoint logic.                                |

### Full-Mode-Only Tests (skipped in `--quick`)

These tests run only in the full suite (`npm run eval:smoke:codex` without `--quick`).

| Test | Label                         | Codex Parity Status | Notes                                                                                                                                   |
| ---- | ----------------------------- | ------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| D    | Gate evaluation               | `PARITY`            | `done when: tests_pass` is evaluated by PL gate engine after flow. Deterministic command execution; model does not control gate result. |
| J    | While loop                    | `PARITY`            | `while tests_fail max 3` condition is deterministic PL evaluation. Model only sees body prompt.                                         |
| L    | Retry on failure              | `PARITY`            | `retry max 3` re-entry on `command_failed` is deterministic PL control flow.                                                            |
| M    | Gate-only mode                | `PARITY`            | `done when: file_exists` without a flow block. Gate evaluation is deterministic.                                                        |
| O    | Until loop                    | `PARITY`            | `until tests_pass max 3` is deterministic PL evaluation.                                                                                |
| P    | Break exits loop              | `PARITY`            | `break` inside `while` is deterministic PL control flow.                                                                                |
| R    | Custom gate                   | `PARITY`            | `gate check: node verify.js` runs a command; deterministic.                                                                             |
| S    | Nested foreach                | `EXPECTED_VARIANCE` | Nested foreach is deterministic PL, but known flaky due to model response format in inner loops.                                        |
| T    | List accumulation             | `EXPECTED_VARIANCE` | `let x += run` inside `foreach` is deterministic PL, but known flaky — pre-existing.                                                    |
| X    | Break in nested               | `PARITY`            | `break` inside nested `if` within loop is deterministic PL control flow.                                                                |
| Y    | Until variable                | `EXPECTED_VARIANCE` | Variable-based `until` condition may depend on prior capture; known flaky.                                                              |
| AD   | Race block                    | `EXPECTED_VARIANCE` | Two spawns race. `race_winner` is set by PL runtime, but Codex child process timing differs.                                            |
| AE   | foreach-spawn (parallel)      | `EXPECTED_VARIANCE` | Parallel fan-out via child processes. Codex child process behavior applies.                                                             |
| AF   | Send/receive                  | `EXPECTED_VARIANCE` | Child sends to parent via `send parent`. IPC mechanism depends on child process completing correctly under Codex.                       |
| Z5   | foreach-spawn PID fingerprint | `EXPECTED_VARIANCE` | Verifies distinct child PIDs. PID assignment under Codex child processes may differ structurally.                                       |
| Z6   | Race-winner single-run oracle | `EXPECTED_VARIANCE` | Race winner consistency check. Non-deterministic by design; Codex timing may differ.                                                    |
| Z7   | send/receive content hash     | `EXPECTED_VARIANCE` | SHA-256 hash of send/receive payload. Codex output format may affect the content that gets hashed.                                      |
| AR   | Retry with backoff            | `PARITY`            | Backoff timing is deterministic PL (`backoff 1s`). The >=900ms wait is measurable regardless of model.                                  |

### Hook-Dependent Tests (NOT_APPLICABLE under Codex)

These tests exercise PL features that depend on the Claude Code hook lifecycle. Codex CLI does not fire Claude Code lifecycle hooks, making these tests not meaningful as Codex parity signals.

| Test | Label              | Why not applicable under Codex                                                                                                        |
| ---- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| AA   | Approve timeout    | `approve` auto-advance relies on `user-prompt-submit` hook invocation. Codex does not fire Claude Code hooks.                         |
| AB   | Review block       | `review` turn counting relies on hook lifecycle. Codex hook support is experimental (`codex_hooks = true`) and not confirmed working. |
| AC   | Remember + memory: | `remember`/`memory:` relies on Claude Code memory hook. Not available in Codex.                                                       |
| AJ   | Remember key-value | Same as AC.                                                                                                                           |

Note: the `codex-hooks-config.ts` adapter exists to enable experimental `codex_hooks = true` support in the Codex config. This is a scaffolded path, not a confirmed working hook pipeline. Until Codex hook support is verified end-to-end, hook-dependent tests remain `NOT_APPLICABLE` for parity purposes.

## Integration-Level Parity

### spawn/await behavior

| Aspect                      | Claude path                                       | Codex path                                                                    | Parity status       |
| --------------------------- | ------------------------------------------------- | ----------------------------------------------------------------------------- | ------------------- |
| Child process command       | `claude -p --dangerously-skip-permissions`        | `codex exec --dangerously-bypass-approvals-and-sandbox --skip-git-repo-check` | `EXPECTED_VARIANCE` |
| Child process launch        | `claude-process-spawner.ts`                       | `codex-prompt-turn-runner.ts` (`codexBinaryCommand`)                          | `PARITY` (adapter)  |
| Windows process cleanup     | `terminateCodexProcessTree` with `taskkill /T /F` | Same in `codex-prompt-turn-runner.ts`                                         | `PARITY`            |
| Output capture              | stdout + `--output-last-message` file             | stdout + `--output-last-message` file via `codex exec`                        | `PARITY`            |
| Variable import after await | Child state polled via `advanceAwaitNode()`       | Same mechanism; Codex child writes same state file format                     | `PARITY`            |
| Capture tag protocol        | Claude honors `<capture>` tag via meta-prompt     | Codex honors it via `buildCodexPrompt()` wrapper; reliability may differ      | `EXPECTED_VARIANCE` |

### Gate evaluation

| Aspect                              | Claude path                                      | Codex path                                    | Parity status    |
| ----------------------------------- | ------------------------------------------------ | --------------------------------------------- | ---------------- |
| Built-in predicates                 | `resolveBuiltinCommand()` in evaluate-completion | Same function; no model involved              | `PARITY`         |
| Custom gate commands                | Shell execution via `execSync`                   | Same; no model involved                       | `PARITY`         |
| Gate composition `all(...)`,`any()` | PL gate engine                                   | Same; no model involved                       | `PARITY`         |
| Variable-based gates                | PL variable lookup                               | Same; no model involved                       | `PARITY`         |
| Gate blocking on failure            | `task-completed` hook exits 2                    | Not applicable; Codex does not fire this hook | `NOT_APPLICABLE` |

Note: because gates run deterministically in the PL runtime after flow completion, they should produce identical results regardless of the AI harness — **except** that the `task-completed` hook that enforces gate failure is a Claude Code-specific lifecycle event.

### Hook lifecycle

| Hook                 | Claude path                             | Codex path                                                                   | Parity status       |
| -------------------- | --------------------------------------- | ---------------------------------------------------------------------------- | ------------------- |
| `session-start`      | Fires on every new session              | Not fired by Codex (experimental opt-in only)                                | `NOT_APPLICABLE`    |
| `user-prompt-submit` | Fires on every user turn, advances flow | Not fired by Codex (experimental opt-in only)                                | `NOT_APPLICABLE`    |
| `post-tool-use`      | Fires after each tool use               | Not fired by Codex                                                           | `NOT_APPLICABLE`    |
| `task-completed`     | Fires on completion; enforces gates     | Not fired by Codex                                                           | `NOT_APPLICABLE`    |
| `stop`               | Fires on stop; blocks if flow active    | Not fired by Codex                                                           | `NOT_APPLICABLE`    |
| `pre-compact`        | Fires before context compaction         | Not fired by Codex                                                           | `NOT_APPLICABLE`    |
| Codex hook config    | N/A                                     | `codex-hooks-config.ts` can set `codex_hooks = true`; experimental, unproven | `EXPECTED_VARIANCE` |

The fundamental difference: the Claude path advances the flow via hooks injected into the agent loop. The Codex path uses `prompt-language ci --runner codex` (see `harness.mjs:553`) which bypasses the hook lifecycle entirely and drives the flow from outside the agent loop. This means the Codex runner tests PL parsing, state, and advancement in a different execution model than the Claude runner.

### Execution model difference

| Dimension                  | Claude (hook-driven)                                        | Codex (ci-runner-driven)                                                     |
| -------------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Flow advancement trigger   | `user-prompt-submit` hook on every user message             | `prompt-language ci --runner codex` drives turn-by-turn externally           |
| Agent loop entry           | Claude Code native loop                                     | `codex exec` called per turn by the PL runner                                |
| Gate enforcement           | `task-completed` hook exits 2 to block Claude               | External: caller checks exit code after the runner loop ends                 |
| Context persistence        | Full Claude Code session context across turns               | Each `codex exec` call is stateless; state persisted via `.prompt-language/` |
| Hook-based state injection | `injectContext()` called inside `user-prompt-submit`        | Context injected via the prompt string passed to `codex exec`                |
| Compaction resilience      | `pre-compact` hook adds flow summary to `additionalContext` | Not applicable; each call is independent                                     |

This structural difference means Codex smoke tests exercise a **different integration surface** than Claude smoke tests. Passing Codex smoke tests proves the PL parser, state machine, and runner adapter work correctly. It does not prove the hook lifecycle works.

## Experiment Parity

The `experiments/` directory contains comparative experiments (E4, E5, meta-factory, aider-vs-pl) that run flows through real AI agents. These are separate from the smoke test matrix.

| Experiment             | Codex relevance                                                       | Required for `5pej.1`? |
| ---------------------- | --------------------------------------------------------------------- | ---------------------- |
| `aider-vs-pl` (H1-H10) | Aider comparison only; Codex not the subject                          | no                     |
| `meta-factory`         | Uses Claude as the meta-agent; Codex is not the runner                | no                     |
| E4 (patched pair)      | Claude-specific experiment harness                                    | no                     |
| E5 (HTTP probes)       | HTTP probe blinding; harness-agnostic; Codex not the specific subject | no                     |

Experiment parity is not required for the `5pej.1` matrix-definition bead. It belongs to the broader eval parity claims in `5pej.2` and `5pej.3`.

## Current Claim-Level Status

This is the current parity status implied by the repo-local evidence above as of `2026-04-15`.

| Claim level                     | Current status | Why                                                                                                                                                                                   |
| ------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Repo-local Codex parity         | not satisfied  | `npm run test`, `npm run ci`, and `npm run eval:e2e` are all failing in the latest April 12 checked-in evidence.                                                                      |
| Codex quick-smoke parity        | inconclusive   | Latest `eval:smoke:codex:quick` run timed out locally before producing a closure result; prior April 11 `27/27` pass is historical context only and predates tests AK, AW, AX, Z1-Z4. |
| Supported-host Codex live smoke | not satisfied  | `npm run eval:smoke:codex` (full suite) has no passing supported-host run. Windows is blocked by auth; WSL by runtime age; macOS is not executable from this host.                    |
| Hook-dependent feature parity   | not applicable | Tests AA, AB, AC, AJ depend on the Claude Code hook lifecycle, which Codex does not support via the standard smoke path. This is a structural difference, not a regression.           |
| Broader eval parity             | not satisfied  | Compare and verify reruns are missing from the latest checked-in evidence.                                                                                                            |

## Blocked Checks And External Reruns

These are the concrete blocked paths that still need external resolution.

| Check or path                            | Blocker class            | Exact reason                                                                                                                                      | Date         | Required rerun path                                                                        | Source                                                                                          |
| ---------------------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| `npm run eval:smoke` on Windows native   | `BLOCKED_AUTH`           | Claude CLI login/access unavailable before scenario execution; `0` scenarios ran                                                                  | `2026-04-12` | Rerun on a supported Linux, macOS, or upgraded WSL host with authenticated harness access  | [2026-04-12 Codex Parity Full Run Evidence](2026-04-12-codex-parity-full-run-evidence.md)       |
| `npm run eval:smoke:codex:quick` locally | `BLOCKED_TIMEOUT`        | Command did not complete within the local `604013 ms` timeout window; Codex CLI version `0.120.0`; no closure result captured                     | `2026-04-12` | Rerun on a machine with faster network/auth or increase `PROMPT_LANGUAGE_CODEX_TIMEOUT_MS` | [2026-04-12 Codex Parity Full Run Evidence](2026-04-12-codex-parity-full-run-evidence.md)       |
| Live smoke from WSL Ubuntu               | `BLOCKED_RUNTIME`        | WSL Node `v18.19.1` is below the repo engine floor `>=22.0.0`; smoke start failed with `ERR_INVALID_ARG_TYPE` before live auth could be validated | `2026-04-12` | Upgrade WSL Node to `22` or newer, then rerun limited live smoke                           | [2026-04-12 Cross-Platform Smoke Verification](2026-04-12-cross-platform-smoke-verification.md) |
| Native macOS smoke from this workstation | `NOT_EXECUTABLE_ON_HOST` | This Windows machine cannot execute native macOS smoke                                                                                            | `2026-04-12` | Run on a real macOS host or archive hosted CI/macOS evidence separately                    | [2026-04-12 Cross-Platform Smoke Verification](2026-04-12-cross-platform-smoke-verification.md) |

## Known Blockers by Category

### Model behavior blockers

Tests classified `EXPECTED_VARIANCE` that involve capture (G, N, AK, Z3, Z4) depend on the Codex model returning responses that contain the `<capture>` tag protocol. The `buildCodexPrompt()` wrapper in `codex-prompt-turn-runner.ts` primes the model with instructions, but capture reliability remains a model-behavior variable.

### Hook architecture blockers

Tests classified `NOT_APPLICABLE` (AA, AB, AC, AJ) require the Claude Code hook lifecycle. The Codex integration has an experimental `codex_hooks = true` config path (`codex-hooks-config.ts`), but this is not confirmed working end-to-end. Until Codex hook support is verified, these tests cannot be used as Codex parity signals.

### Spawn architecture blockers

Tests classified `EXPECTED_VARIANCE` that involve `spawn`/`await` (AM, AN, AD, AE, AF, Z5, Z6, Z7, AT) spawn child processes. On the Codex path, these spawn child `codex exec` calls. The spawning logic in `codex-prompt-turn-runner.ts` handles Windows-specific process tree termination (`taskkill /T /F`) but child process behavior, PID assignment, and timing differ from the Claude path.

### Windows-specific blockers

- PowerShell quoting: `buildCodexPowerShellCommand()` wraps args in single quotes. Non-ASCII or quote-containing values may behave differently.
- Process tree cleanup: `terminateCodexProcessTree()` uses `taskkill /T /F` on Windows. If this races with process exit, child state files may not be written.
- Path spaces: repo path contains spaces (`D:\Visual Studio Projects\...`). All exec calls must quote paths correctly.

## Closure Review Reading

- `prompt-language-5pej.1` owns the matrix definition, required-versus-advisory split, and evidence format.
- The tables above are based on repo-local checked-in evidence only; they do not infer unsupported-host passes or carry forward stale green runs as current truth.
- The matrix is explicit about April 12 failures, stale evidence, and external blockers.
- The smoke test catalog section is authoritative for which tests are `PARITY`, `EXPECTED_VARIANCE`, `NOT_APPLICABLE`, or `BLOCKED` under Codex.
- This matrix refresh does not claim `prompt-language-5pej.2` is green. It records that full execution parity remains open.
- The only closure blocker still external to this docs task is the dependency on `prompt-language-72a5.6` for supported-host smoke/support-matrix evidence.
- The structural difference between Claude (hook-driven) and Codex (ci-runner-driven) execution models means smoke test parity does not imply hook lifecycle parity. Both must be stated separately.
