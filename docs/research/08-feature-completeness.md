# Report 08: Feature Completeness Assessment

> The DSL is feature-complete for its intended purpose. Most proposed enhancements are already achievable with existing primitives.

## Abstract

After synthesizing findings from Reports 00-07 and 20+ external sources, we identified 15 enhancement opportunities (E1-E15) in [Report 07](07-enhancement-opportunities.md). This report re-evaluates each enhancement against the existing DSL primitives and finds that **10 of 15 are already expressible today** using combinations of the 12 node kinds, gates, and variables. Two more are handled by the host agent (Claude Code), two are integration patterns with external tools, and only one represents a genuinely hard-to-express pattern.

This finding reframes the project's forward work from "add features" to "document patterns, harden existing behavior, and expand test coverage."

## Methodology

For each enhancement, we asked:

1. Can this be expressed with existing DSL primitives (`prompt`, `run`, `while`, `until`, `retry`, `if`, `try`, `foreach`, `let`, `break`, `spawn`, `await`) plus gates?
2. If not, does the host agent (Claude Code) already handle it?
3. If not, is it an integration concern (external tools, hooks, file system)?
4. If none of the above, is it a genuine structural gap?

## [RESEARCH] Capability matrix: Claude hooks vs Codex lifecycle surfaces

Scope note: this matrix is limited to surfaces implemented, tested, or explicitly documented in this repo snapshot. It does not assume upstream Codex capabilities beyond what the local codebase currently wires.

Legend:

- `[EVIDENCE]` directly backed by checked-in code/tests/docs
- `[INFERRED]` reasoned implication from the implementation; may vary by host/runtime revisions

| Concern                                    | Claude hook loop in this repo                                                                                                   | Codex native hook scaffold in this repo                                                                                                                 | Codex supervised/headless runner in this repo                                                                                                                           | Confidence   |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| Prompt interception before model turn      | `UserPromptSubmit` is wired in `hooks/hooks.json`; `user-prompt-submit.ts` injects flow context by rewriting the prompt payload | `UserPromptSubmit` is wired in `.codex/hooks.json`; `codex-user-prompt-submit.ts` injects via `hookSpecificOutput.additionalContext`                    | `runFlowHeadless()` builds the prompt envelope itself before each Codex turn, so this path does not depend on host prompt interception timing                           | `[EVIDENCE]` |
| Premature stop blocking                    | `stop.ts` runs `evaluateStop()` and exits `2` when the flow must continue                                                       | `codex-stop.ts` runs `evaluateStop()` and exits `2` when the flow must continue                                                                         | `runFlowHeadless()` owns the loop and simply does not terminate until state, gates, or max-turn logic say it is done                                                    | `[EVIDENCE]` |
| Completion-gate enforcement timing         | Dedicated `TaskCompleted` hook runs `evaluateCompletion()` after Claude says the task is done                                   | No `TaskCompleted` hook exists; Codex contract test explicitly excludes it, so completion checks are merged into `codex-stop.ts`                        | `runFlowHeadless()` evaluates completion after advances and after final prompt turns, independent of Codex-native task-complete semantics                               | `[EVIDENCE]` |
| Tool-phase visibility available to runtime | `PostToolUse` sees `Bash`, `Write`, `Edit`, and `NotebookEdit`, which gives the runtime broader post-action visibility          | `PostToolUse` matcher is `Bash` only; `codex-post-tool-use.ts` explicitly documents Bash-only emission and treats richer tool visibility as unavailable | Headless runner does not rely on host tool callbacks; it evaluates progress from state transitions, command results, and prompt-turn results instead                    | `[EVIDENCE]` |
| Session restore / resume signal            | `SessionStart startup\|resume` restores flow context and awaiting-capture prompts                                               | `SessionStart startup\|resume` exists with equivalent restore logic in `codex-session-start.ts`                                                         | Headless runner persists and reloads `.prompt-language/session-state.json`, but there is no Codex-native resume event involved; the runner is the lifecycle owner       | `[EVIDENCE]` |
| Compaction lifecycle                       | Claude hook contract includes `PreCompact`; this repo preserves flow/capture context there                                      | Codex contract test explicitly excludes `PreCompact`; no equivalent compaction hook is wired                                                            | Headless runner has no host compaction lifecycle at all because each turn is an external supervised call                                                                | `[EVIDENCE]` |
| Spawn / await continuity                   | Claude spawn path uses child Claude processes plus file-backed child state directories                                          | Native Codex hooks do not supply a distinct spawn lifecycle; any parity would still depend on broader runtime work                                      | `HeadlessProcessSpawner` runs child flows in-process with the same prompt-turn runner, which is the current shipped Codex continuity story                              | `[EVIDENCE]` |
| Turn budget / deterministic stop condition | Primarily delegated to Claude session behavior plus prompt-language gates                                                       | Same host dependence as other native-hook flows; local scaffold does not add a distinct Codex-native max-turn surface                                   | `runFlowHeadless()` enforces `DEFAULT_MAX_TURNS = 24` unless overridden, which gives Codex an explicit deterministic bound today                                        | `[EVIDENCE]` |
| Stability posture                          | Claude hook architecture is documented as a core runtime path                                                                   | `.codex/config.toml` marks Codex hooks as explicit experimental opt-in (`codex_hooks = true`)                                                           | `bin/cli.mjs` ships `run`, `ci`, `eval`, and `validate` support for the Codex headless path; quick smoke evidence is tracked in `docs/evaluation/eval-parity-matrix.md` | `[EVIDENCE]` |
| Lowest-common-denominator abstraction      | A shared subset exists around prompt submission, stop blocking, and session-state persistence                                   | Native-hook semantics still diverge on completion timing, tool visibility, and compaction                                                               | The supervised runner is the honest cross-host baseline because it owns more of the lifecycle itself instead of pretending host parity exists                           | `[INFERRED]` |

Practical reading for this repo: "host-neutral" is viable only for a small shared core. A strict unified lifecycle model would hide real differences in completion timing, tool visibility, and compaction.

## [RESEARCH] Boundary options for host lifecycle work

This repo currently points to three different shapes for host integration work:

| Option                                       | Shape                                                                                                             | Benefits                                                         | Main failure mode                                                     | Recommendation                                    |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------- |
| DSL syntax                                   | Add hooks, plugin management, or host lifecycle directives to the language                                        | One place to author everything                                   | Creates false parity promises and couples the language to host quirks | Reject                                            |
| Prompt-language-owned config / adapter layer | Keep flows declarative, add prompt-language config for profiles/agents/harness defaults, compile to host adapters | Clean separation between language concepts and backend mechanics | Can still drift if config starts mirroring host plugin internals      | Allow only for prompt-language-owned abstractions |
| Host-specific installers / local scaffolds   | Put plugin install, host hook wiring, and host config changes in installers and runtime adapters                  | Honest about what is host-specific today                         | More fragmented UX across hosts                                       | Current delivery path                             |

The least-confusing user-facing shape is therefore: keep host lifecycle outside the language, keep host-specific wiring in installers/adapters, and only add prompt-language-owned config when it describes prompt-language concepts rather than raw host internals.

## [RESEARCH] Codex recommendation

Recommendation for `prompt-language-pbv5.3`:

1. Treat the supervised/headless Codex runner as the initial honest Codex support story.
2. Keep native Codex hooks explicitly experimental and opt-in while the lifecycle contract remains narrower than Claude's.
3. Do not describe Codex support as "Claude parity" in public docs until completion timing, tool visibility, and supported-host smoke evidence materially close the gap.

Why this is the least misleading path in the current repo:

- the headless runner already owns prompt construction, gate evaluation, max-turn bounds, and child spawn continuity
- the native Codex scaffold is real, but it lacks Claude's `TaskCompleted` and `PreCompact` surfaces and has Bash-only `PostToolUse`
- quick Codex smoke (`27/27`) is useful evidence for the headless path, but the repo's own parity note says it does not replace supported-host live smoke

Net result:

- **ship today**: Codex as a supervised runner for `run`, `ci`, `eval`, and validation/preflight
- **document as experimental**: native Codex hook scaffold and local `codex-install`
- **do not claim**: full lifecycle parity with Claude

## Assessment

### Already achievable with existing primitives (10/15)

#### E1: Approval / Human-in-the-Loop Nodes

**Existing pattern**: `let approval = prompt "..."` pauses flow execution and waits for the agent to relay a question to the user. The agent mediates the interaction.

```
flow:
  prompt: Generate the database migration.
  let approval = prompt "Review the migration output above. Type PROCEED to continue or describe what needs to change."
  run: npx prisma migrate deploy
```

The `let x = prompt` node inherently pauses flow advancement until a response is captured. The prompt text instructs the agent to relay the approval request. This is functionally equivalent to a dedicated `approval` node — the agent becomes the mediator.

See [approval-checkpoint.md](../examples/approval-checkpoint.md) for the full pattern.

---

#### E2: Retry with Configurable Backoff

**Existing pattern**: `run: sleep N` inside a `retry` body introduces delay between attempts. Variable tracking enables exponential backoff.

```
flow:
  let delay = "1"
  retry max 5
    run: curl -sf https://api.example.com/deploy
    if command_failed
      run: sleep ${delay}
      let delay = run "echo $((${delay} * 2))"
      prompt: The request failed. Analyze the error and adjust the request.
    end
  end
```

Shell arithmetic doubles the delay each iteration: 1s, 2s, 4s, 8s, 16s. No new syntax needed.

See [retry-with-backoff.md](../examples/retry-with-backoff.md) for the full pattern.

---

#### E6: Self-Reflection on Failure

**Existing pattern**: `if command_failed` + explicit reflection prompt inside `retry`.

```
flow:
  retry max 3
    run: npm test
    if command_failed
      prompt: Before fixing, analyze what went wrong. What was the root cause? What approaches have you already tried? What should you try differently?
      prompt: Now fix the failing tests based on your analysis.
    end
  end
```

The reflection prompt is just a `prompt` node with instructions to analyze before acting. The `${last_stderr}` variable provides the failure context. This is exactly what Reflexion does — verbal self-reflection before retry — without requiring a `reflect` keyword.

See [self-reflection.md](../examples/self-reflection.md) for the full pattern.

---

#### E7: Tool Gating Per Node

**Existing pattern**: Prompt instruction or `PreToolUse` hook.

The DSL can include tool restrictions directly in prompt text:

```
flow:
  prompt: Fix the code. Do NOT modify any files in tests/ or __tests__/. Only change source files.
  run: npm test
```

For structural enforcement, Claude Code's `PreToolUse` hook can block writes to specific paths — this is a plugin hook concern, not a DSL concern. The prompt-language plugin already uses `PreToolUse` hooks; adding path-based blocking is a configuration task, not a language feature.

---

#### E8: Parallel Map with Merge

**Existing pattern**: `spawn`/`await` already implements parallel execution with variable import.

```
flow:
  spawn "auth"
    prompt: Fix failing tests in the auth module.
    run: npm test -- --filter auth
  end
  spawn "api"
    prompt: Fix failing tests in the api module.
    run: npm test -- --filter api
  end
  spawn "billing"
    prompt: Fix failing tests in the billing module.
    run: npm test -- --filter billing
  end
  await all
```

Each `spawn` launches a child `claude -p` process. `await all` blocks until all children complete and imports their variables with name prefixes (`auth.last_exit_code`, `api.last_exit_code`, etc.). This is the map-reduce pattern.

See [parallel-tasks.md](../examples/parallel-tasks.md) for the full pattern.

---

#### E9: Conditional Done-When Gates

**Existing pattern**: `if` + `break` + variable tracking inside a loop.

```
flow:
  let attempts = "0"
  while not tests_pass max 10
    run: npm test
    let attempts = run "echo $((${attempts} + 1))"
    if command_failed
      if ${attempts} >= 3
        run: npm test -- --grep "critical"
        if command_succeeded
          break
        end
      end
      prompt: Fix the failing tests.
    end
  end
```

After 3 failed attempts, the flow falls back to checking only critical tests. `break` exits the loop if the critical subset passes. This expresses conditional completion criteria without new gate syntax.

---

#### E10: Variable Transforms and Filters

**Existing pattern**: `let x = run "..."` with shell pipes.

```
flow:
  let output = run "npm test 2>&1"
  let first_line = run "echo '${output}' | head -1"
  let error_count = run "echo '${output}' | grep -c 'FAIL' || true"
  let config_value = run "cat config.json | jq -r '.database.host'"
```

Shell pipes provide all common transforms: `head`, `tail`, `grep -c`, `wc -l`, `jq`, `cut`, `tr`, `sed`. These are universally available and more powerful than any built-in filter set. The `run` node is the escape hatch to the full Unix toolkit.

See [variable-pipeline.md](../examples/variable-pipeline.md) for the full pattern.

---

#### E11: Flow Composition and Includes

**Existing pattern**: Prompt instruction referencing shared patterns.

Since flows are embedded in natural-language prompts, composition happens at the prompt level:

```
Fix the auth module. Use the standard fix-test loop:

flow:
  retry max 5
    run: npm test
    if command_failed
      prompt: Fix the failing tests.
    end
  end

done when:
  tests_pass
```

Reusable patterns are documented as recipes (like this examples directory). Users copy-paste the patterns they need. For automated composition, Claude Code skills (`/fix-and-test`, `/deploy-check`) wrap common flow patterns with a single command.

---

#### E12: Typed Captures with Schema Validation

**Existing pattern**: Prompt instruction specifying format.

```
flow:
  let count = prompt "How many failing tests are there? Respond with ONLY a number, nothing else."
  let config = prompt "Output the database configuration as valid JSON. Respond with ONLY the JSON object."
```

The capture prompt builder (`buildCapturePrompt()`) already instructs the agent to respond with only the value. Adding format instructions to the prompt text achieves the same result. The agent follows instructions — that's the whole point.

---

#### E14: Cost Budget Per Flow

**Existing pattern**: Claude Code handles this externally.

Claude Code has its own session cost tracking and budget limits. These are host-level concerns:

- `--max-turns N` limits total agent turns
- Session cost is displayed in the Claude Code UI
- API key rate limits provide a hard ceiling

Adding cost tracking to the DSL would duplicate host-level functionality. The DSL's `max N` on loops already bounds iteration count.

---

### Handled by host agent (2/15)

#### E3: Flow-Level Budget and Timeout

Claude Code provides `--max-turns` for turn limits. Session timeout is a shell/OS concern. The DSL's `max N` on loops bounds iteration count within the flow. Adding flow-level budget would duplicate what the host already provides.

#### E4: Compact Flow Rendering

Claude Code's context compaction handles long conversations automatically. The flow rendering (`renderFlow()`) is already reasonably compact — it shows the tree with execution markers. Context management is a host responsibility, not a DSL concern.

That said, compact rendering could improve context efficiency for very long flows. If pursued, it belongs in `render-flow.ts` as an optimization, not as a new language feature.

---

### Integration patterns with external tools (2/15)

#### E5: Persistent Memory Across Sessions

**Existing pattern**: Read from files at flow start.

```
flow:
  let conventions = run "cat CLAUDE.md"
  let history = run "cat .project-notes"
  prompt: Follow the project conventions. Context from previous work: ${history}. Implement feature X.
```

Cross-session memory is a file system concern. CLAUDE.md files, beads issues, and project notes files all persist across sessions. The `let x = run "cat ..."` pattern loads any file into a variable. This is not a DSL gap — it's a documentation gap.

See [memory-and-context.md](../examples/memory-and-context.md) for the full pattern.

#### E15: Event-Driven Flow Triggers

Claude Code skills and hooks already provide event-triggered execution. Skills are invoked by the user (`/fix-and-test`), hooks fire on agent events (`UserPromptSubmit`, `PreToolUse`, `Stop`). External triggers (GitHub webhooks, CI events) can invoke `claude -p` with a flow-containing prompt.

Event-driven orchestration is an integration concern — connecting external events to `claude -p` invocations. The DSL doesn't need an `on:` directive because the trigger mechanism is external.

---

### Genuine gap — hard to express (1/15)

#### E13: Watchdog / Health-Check Nodes

A background monitor that periodically checks for stalls is genuinely hard to express with sequential primitives. The DSL's execution model is strictly sequential (or parallel via `spawn`), with no mechanism for background tasks that run concurrently with the main flow.

However, this is a niche use case. The `max N` parameter on loops already prevents infinite loops. The host agent's turn limits prevent unbounded execution. A watchdog would detect subtle stalls (agent is responding but not making progress), which is valuable but rare.

**Recommendation**: Monitor as a potential future enhancement. Could be implemented as a host-level concern (Claude Code hook that checks `git diff --stat` periodically) rather than a DSL primitive.

---

## Summary Table

| #   | Enhancement         | Status              | How                                     |
| --- | ------------------- | ------------------- | --------------------------------------- |
| E1  | Approval nodes      | Already achievable  | `let x = prompt "..."` as checkpoint    |
| E2  | Retry backoff       | Already achievable  | `run: sleep N` + variable doubling      |
| E3  | Flow budget/timeout | Host handles        | Claude Code `--max-turns`, loop `max N` |
| E4  | Compact rendering   | Host handles        | Claude Code context compaction          |
| E5  | Persistent memory   | Integration pattern | `let x = run "cat file"` at flow start  |
| E6  | Self-reflection     | Already achievable  | Reflection `prompt` in `retry`/`if`     |
| E7  | Tool gating         | Already achievable  | Prompt instruction or `PreToolUse` hook |
| E8  | Parallel foreach    | Already achievable  | `spawn`/`await` per item                |
| E9  | Conditional gates   | Already achievable  | `if` + `break` + variable tracking      |
| E10 | Variable transforms | Already achievable  | `let x = run "... \| filter"`           |
| E11 | Flow composition    | Already achievable  | Prompt copy-paste or Claude Code skills |
| E12 | Typed captures      | Already achievable  | Format instructions in prompt text      |
| E13 | Watchdog nodes      | Genuine gap (niche) | Could be host-level hook, not DSL       |
| E14 | Cost budget         | Host handles        | Claude Code session limits              |
| E15 | Event triggers      | Integration pattern | External invocation of `claude -p`      |

## Implications

### The DSL is feature-complete

The 12 node kinds (`prompt`, `run`, `while`, `until`, `retry`, `if`, `try`, `foreach`, `let`, `break`, `spawn`, `await`) plus gates and variables cover all the orchestration patterns identified in the research. The primitives compose well — approval checkpoints, exponential backoff, self-reflection, parallel execution, and variable transforms are all expressible without new syntax.

### Forward work is documentation and hardening

Instead of adding features, the project should:

1. **Document patterns** — Show users how to express these patterns with existing primitives. The [examples directory](../examples/) should grow with recipes for each pattern.
2. **Harden existing behavior** — Edge cases in advance-flow, state corruption recovery, Windows path handling, error messages.
3. **Expand eval coverage** — Test the patterns documented here. Ensure the smoke tests cover approval checkpoints, backoff, and reflection patterns.
4. **Improve distribution** — Make `npx @45ck/prompt-language` installation more robust. Better error messages on failure.

### When to add new syntax

New syntax is warranted only when:

- A pattern is **common enough** that verbosity hurts adoption
- The pattern is **error-prone** to express with existing primitives
- The new syntax is **significantly more readable** than the primitive composition

None of the 15 enhancements currently meet all three criteria. The closest is E2 (retry backoff) — the shell arithmetic pattern works but is verbose. If user demand materializes, `retry max 5 backoff 2s` would be a reasonable syntactic sugar addition.

## Sources

- [Report 07: Enhancement Opportunities](07-enhancement-opportunities.md) — the full wishlist this report evaluates
- [Report 00: Architecture Position](00-architecture-position.md) — why prompt-language is a meta-orchestration layer, not a framework
- [Report 01: Agent Workflow Patterns](01-agent-workflow-patterns.md) — the eight orchestration patterns
- [Report 03: Verification and Gates](03-verification-and-gates.md) — gate enforcement model
- [Report 05: Developer Trust](05-developer-trust.md) — trust gap and how structure addresses it
