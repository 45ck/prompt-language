# Research: Claude vs Codex Lifecycle Capability Matrix

## Status

Research note for `prompt-language-pbv5.1`.

This note is intentionally grounded in checked-in repo evidence, not upstream product claims. Its main anchor is the capability-matrix section already present in [`08-feature-completeness.md`](08-feature-completeness.md). The goal here is to normalize that material around lifecycle timing, blocking authority, context injection, completion enforcement, restore and compaction behavior, and the current Claude-specific integration points in prompt-language.

## Sources used

- [`docs/research/08-feature-completeness.md`](08-feature-completeness.md)
- [`docs/design/host-extension-boundary.md`](../design/host-extension-boundary.md)
- [`docs/design/hooks-architecture.md`](../design/hooks-architecture.md)
- [`docs/evaluation/codex-parity-delta-analysis.md`](../evaluation/codex-parity-delta-analysis.md)
- [`hooks/hooks.json`](../../hooks/hooks.json)
- [`.codex/hooks.json`](../../.codex/hooks.json)
- [`.codex/config.toml`](../../.codex/config.toml)
- [`src/presentation/hooks/codex-user-prompt-submit.ts`](../../src/presentation/hooks/codex-user-prompt-submit.ts)
- [`src/presentation/hooks/codex-stop.ts`](../../src/presentation/hooks/codex-stop.ts)
- [`src/presentation/hooks/codex-post-tool-use.ts`](../../src/presentation/hooks/codex-post-tool-use.ts)
- [`src/presentation/hooks/session-start.ts`](../../src/presentation/hooks/session-start.ts)
- [`src/presentation/hooks/codex-session-start.ts`](../../src/presentation/hooks/codex-session-start.ts)
- [`src/presentation/hooks/pre-compact.ts`](../../src/presentation/hooks/pre-compact.ts)
- [`src/presentation/hooks/task-completed.ts`](../../src/presentation/hooks/task-completed.ts)
- [`src/infrastructure/adapters/claude-process-spawner.ts`](../../src/infrastructure/adapters/claude-process-spawner.ts)
- [`src/infrastructure/adapters/codex-plugin-contract.test.ts`](../../src/infrastructure/adapters/codex-plugin-contract.test.ts)
- [`bin/cli.mjs`](../../bin/cli.mjs)

## Normalized reading

The repo currently has three distinct execution stories:

1. Claude native hook loop
2. Codex native hook scaffold
3. Codex supervised or headless runner

Treating those as one unified host lifecycle would be misleading. The shared core is real, but the lifecycle contract is not equivalent across them.

## Capability matrix

Legend:

- `Stable/shipped`: the repo treats this path as a real delivered behavior, even if supported-host evidence is still incomplete in some environments
- `Experimental/partial`: the repo ships the scaffold, but the lifecycle contract is explicitly narrower or opt-in
- `Advisory`: visible or helpful, but not a first-class blocking enforcement point

| Lifecycle concern                                        | Claude hook loop in this repo                                                                                                              | Codex native hook scaffold in this repo                                                                                                                                                               | Codex supervised/headless runner in this repo                                                                                                     | Blocking authority                                                                                    | Stability read                                                                                                                                 |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Prompt interception before a model turn                  | `UserPromptSubmit` is wired in `hooks/hooks.json`; the Claude path injects flow context before the turn                                    | `UserPromptSubmit` is wired in `.codex/hooks.json`; `codex-user-prompt-submit.ts` emits `hookSpecificOutput.additionalContext` instead of rewriting the prompt                                        | The runner constructs the prompt envelope itself before each turn, so it does not depend on host interception timing                              | First-class for Claude and Codex native; runner-owned in headless mode                                | Claude: stable/shipped. Codex native: experimental/partial. Codex headless: stable/shipped for runner mode                                     |
| Stop-time blocking                                       | `Stop` runs `evaluateStop()` and blocks unfinished flows                                                                                   | `codex-stop.ts` also runs `evaluateStop()` and exits `2` when the flow must continue                                                                                                                  | The runner owns the loop and simply keeps going until stop conditions are met                                                                     | First-class blocking in all three, but by different owners                                            | Claude: stable/shipped. Codex native: experimental/partial. Codex headless: stable/shipped                                                     |
| Completion enforcement timing                            | Dedicated `TaskCompleted` hook runs `evaluateCompletion()` after Claude says the task is done                                              | No `TaskCompleted` exists; `src/infrastructure/adapters/codex-plugin-contract.test.ts` explicitly asserts that `.codex/hooks.json` excludes it, and `codex-stop.ts` merges stop and completion checks | The runner evaluates completion as part of its own execution loop                                                                                 | Claude has a distinct completion event; Codex native does not                                         | Claude: stable/shipped. Codex native: partial and meaningfully different. Codex headless: stable/shipped for runner mode                       |
| Context injection shape                                  | Claude path is documented as returning injected task context through the hook loop                                                         | Codex native uses `hookSpecificOutput.additionalContext` in `codex-user-prompt-submit.ts` and `additionalContext` in `codex-session-start.ts`                                                         | Headless mode owns prompt construction directly in the CLI and runtime                                                                            | First-class in all three, but transport shape differs                                                 | Shared capability exists, but not one identical lifecycle surface                                                                              |
| Post-tool visibility                                     | `hooks/hooks.json` wires `PostToolUse` for `Bash                                                                                           | Write                                                                                                                                                                                                 | Edit                                                                                                                                              | NotebookEdit`                                                                                         | `.codex/hooks.json` wires `PostToolUse` only for `Bash`; `codex-post-tool-use.ts` explicitly documents Bash-only emission                      | Headless mode does not rely on host tool callbacks                          | Claude has broader observability; Codex native is narrower                                                          | Claude: stable/shipped. Codex native: partial. Codex headless: not applicable by design |
| Session restore and startup resume                       | `SessionStart` with `startup                                                                                                               | resume` re-emits active-flow context and awaiting-capture prompts                                                                                                                                     | `codex-session-start.ts` mirrors the same `startup                                                                                                | resume` restore pattern                                                                               | Headless mode persists and reloads `.prompt-language/session-state.json`, but there is no host resume event; the runner owns lifecycle restore | Restore is first-class in Claude and Codex native; runner-owned in headless | Claude: stable/shipped. Codex native: experimental/partial but real. Codex headless: stable/shipped for runner mode |
| Compaction hook and compaction-safe handoff              | Claude wires `PreCompact`; `pre-compact.ts` explicitly preserves compact flow summary plus awaiting-capture context across host compaction | No `PreCompact` surface is wired, and Codex contract tests assert that `.codex/hooks.json` excludes it                                                                                                | Headless mode has no host compaction lifecycle because it is an external supervised loop, not a long-lived host thread                            | Claude has first-class compaction preservation; Codex native does not                                 | Claude: stable/shipped. Codex native: missing surface. Codex headless: not applicable                                                          |
| Child session continuity for interactive `spawn`/`await` | Interactive spawn uses `ClaudeProcessSpawner`, which shells out to `claude -p` and polls child state files                                 | `codex-user-prompt-submit.ts` still constructs `new ClaudeProcessSpawner(process.cwd())`, so native Codex interactive flow setup still depends on Claude child execution for this continuity story    | The headless runner uses a separate runner-owned path and does not depend on Claude hooks for its own turn loop                                   | Claude interactive path is first-class; Codex native interactive continuity is not host-neutral today | Claude: stable/shipped. Codex native: partial and Claude-coupled. Codex headless: stable/shipped for runner mode                               |
| Lifecycle ownership                                      | Claude host events plus prompt-language state file jointly drive the runtime                                                               | Codex native hook scaffold participates in lifecycle, but with fewer hook phases and explicit opt-in                                                                                                  | `bin/cli.mjs` exposes `run`, `ci`, `eval`, and `validate` for headless runners, so the supervised runner owns much more of the lifecycle directly | Claude and Codex native depend on host event model; headless depends on runner contract               | Headless is the most honest cross-host baseline in this repo                                                                                   |
| Stability posture                                        | `docs/design/hooks-architecture.md` treats Claude hooks as the enforcement engine                                                          | `.codex/config.toml` says Codex hooks are experimental and require explicit opt-in                                                                                                                    | `bin/cli.mjs` ships Codex runner commands and repo docs track quick-smoke evidence for that path                                                  | Claude is the established runtime core; native Codex is narrower                                      | Claude: stable/shipped. Codex native: experimental/partial. Codex headless: shipped, but not full Claude-lifecycle parity                      |

## Stable versus experimental read

### Stable or shipped today

- Claude native hook loop is the repo's established runtime core.
- Codex supervised or headless execution is a real shipped path for `run`, `ci`, `eval`, and `validate`.
- The shared lowest-common-denominator model is small but real: prompt submission, state persistence, stop enforcement, and runner-driven completion can be shared.

### Experimental or partial today

- Native Codex hooks are explicitly opt-in via `.codex/config.toml`.
- Native Codex hooks do not have a dedicated `TaskCompleted` event.
- Native Codex hooks do not have a `PreCompact` event.
- Native Codex `PostToolUse` visibility is Bash-only in this repo.
- Native Codex interactive continuity is still not cleanly host-neutral because `codex-user-prompt-submit.ts` instantiates `ClaudeProcessSpawner`.

## Session restore and compaction differences

The restore story is similar enough to share vocabulary, but not similar enough to claim one lifecycle:

- Claude has both `SessionStart startup|resume` and `PreCompact`.
- Codex native has `SessionStart startup|resume`, but no `PreCompact`.
- Codex headless has persistence and reload, but no host lifecycle events for resume or compaction because the runner owns the turn loop.

That means prompt-language can describe a shared idea of "restore active flow state," but it should not describe a shared compaction contract across Claude and Codex native hooks.

## Claude-specific prompt-language integration points today

These are the clearest current repo-backed Claude-specific integration points:

1. Dedicated completion enforcement event.
   Claude has `TaskCompleted`; Codex native does not.

2. Compaction preservation.
   Claude has `PreCompact`; Codex native does not.

3. Richer post-tool visibility.
   Claude sees `Bash`, `Write`, `Edit`, and `NotebookEdit`; Codex native sees `Bash` only.

4. Interactive child spawning.
   `ClaudeProcessSpawner` shells out to `claude -p`, and native Codex interactive prompt injection still constructs that spawner today.

5. Runtime documentation center of gravity.
   `docs/design/hooks-architecture.md` describes the three-hook Claude loop as the enforcement engine.

6. Install and operator posture.
   `bin/cli.mjs` makes Claude install the default path, while Codex uses a separate `codex-install` scaffold.

7. Smoke-test authority.
   Repo guidance still treats the Claude real-agent smoke loop as the authoritative host-level proof, while Codex quick smoke is useful but not equivalent supported-host lifecycle evidence.

## Lowest-common-denominator model

The honest shared model in this repo is narrow:

- a prompt can be intercepted or wrapped before a turn
- active flow state can be persisted and restored
- unfinished work can block termination
- completion can be enforced somewhere in the control loop

The following should not be normalized away:

- when completion is checked
- whether compaction gets its own hook
- how much tool-phase visibility exists
- whether interactive child continuity is genuinely host-native or delegated to Claude

## Recommendation

Use the normalized matrix from `08-feature-completeness.md` as the primary truth source for cross-host lifecycle claims, and keep the product line explicit:

- Claude native hooks are the stable first-class lifecycle surface today.
- Codex supervised or headless runner support is the credible shipped Codex story today.
- Native Codex hooks should remain documented as experimental or partial until they close the gaps around completion timing, compaction, richer tool visibility, and Claude-coupled interactive spawning.

The main architecture recommendation is unchanged from the adjacent design notes: do not flatten Claude and Codex into one generic lifecycle abstraction in the DSL or public product story. The shared core is real, but the lifecycle differences are also real and should stay visible in adapters, docs, and support claims.
