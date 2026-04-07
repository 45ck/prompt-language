# Use Cases

Honest guidance on when the runtime helps, when it doesn't, and quick recipes for common tasks.

## When it wins

Based on 45 controlled A/B experiments (300+ test runs at `--repeat 3` reliability):

**Gates won 15/45.** Every win came from enforcement — catching gaps, lies, or premature stops. The runtime didn't make Claude smarter. It made verification mandatory.

Situations where the runtime consistently helps:

- **Untrustworthy or incomplete prompts** — Gates enforce what the prompt doesn't say. "Fix the tests" + `done when: tests_pass lint_pass` catches the lint issues the prompt never mentioned.
- **Verification-heavy tasks** — The agent can claim success, but `npm test` returning exit code 1 overrides any claim.
- **Force real code changes** — `diff_nonempty` prevents Claude from reviewing code without modifying it.
- **Long autonomous runs** — Variable re-injection keeps values precise regardless of conversation length.

## When it doesn't win

**Flow control won 0/45.** Claude follows explicit multi-step instructions without scaffolding. Adding `retry` or `while` to a clear prompt adds latency without improving correctness.

**Variable capture won 0/45.** At tested distances (2-15 steps), vanilla Claude recalls values accurately from conversation context.

**Latency overhead: 2-3x.** A 30-second task takes 90+ seconds through the runtime. Every hook invocation, gate check, and state file read/write adds time.

Skip the runtime when:

- The prompt is clear and complete — vanilla Claude matches correctness at lower latency
- There's no verifiable exit condition — no command to run = no gate to add
- Speed matters and you'll verify manually
- You're adding a flow to improve correctness — write a better prompt instead

## Quick recipes

### Just enforce tests

The simplest and most valuable pattern. No flow needed:

```
Fix the auth module.

done when:
  tests_pass
```

### Enforce multiple criteria

```
Fix the test failures.

done when:
  tests_pass
  lint_pass
  file_exists dist/index.js
```

### Force real code changes

```
Review calculator.js and fix any issues.

done when:
  diff_nonempty
  tests_pass
```

### Custom verification

```
done when:
  gate typecheck: npx tsc --noEmit
  gate e2e: npx playwright test
```

### Fix-test loop

```
flow:
  retry max 5
    run: npm test
    if command_failed
      prompt: Fix the failing tests based on the error output above.
    end
  end

done when:
  tests_pass
```

### Baseline comparison

```
flow:
  let baseline = run "node bench.js"
  prompt: Optimize the hot path.
  let result = run "node bench.js"
  prompt: Compare baseline (${baseline}) vs current (${result}).

done when:
  tests_pass
```

## Anti-patterns

### Flow without gates

```
# BAD: flow structures execution but nothing enforces the result
flow:
  retry max 5
    run: npm test
    if command_failed
      prompt: Fix the failing tests.
    end
  end
```

Always pair loops with gates. The loop structures the work; the gate enforces the result.

### Over-engineered flows

```
# BAD: this flow adds latency without helping
flow:
  prompt: Fix the type errors in src/auth.ts
  run: npm test

done when:
  tests_pass
```

The simpler version works just as well:

```
Fix the type errors in src/auth.ts.

done when:
  tests_pass
```

### Using flows for correctness

Flows don't make Claude more correct. They structure execution. If Claude gets the task wrong with a flow, it'll get it wrong without one. Write a better prompt.

## Advanced patterns

Many "advanced" orchestration patterns are already expressible with existing primitives. No new syntax needed — the 12 node kinds compose well.

| Pattern                | How                                        | Example                                                |
| ---------------------- | ------------------------------------------ | ------------------------------------------------------ |
| Human approval         | `let x = prompt "..."` as checkpoint       | [Approval Checkpoint](examples/approval-checkpoint.md) |
| Retry with backoff     | `run: sleep N` + variable doubling         | [Retry with Backoff](examples/retry-with-backoff.md)   |
| Self-reflection        | Explicit analysis prompt before retry      | [Self-Reflection](examples/self-reflection.md)         |
| Parallel execution     | `spawn`/`await` per work stream            | [Parallel Tasks](examples/parallel-tasks.md)           |
| Variable transforms    | `let x = run "... \| filter"`              | [Variable Pipeline](examples/variable-pipeline.md)     |
| Cross-session memory   | `let x = run "cat file"` at flow start     | [Memory and Context](examples/memory-and-context.md)   |
| Tool gating            | Prompt instructions or `PreToolUse` hook   | —                                                      |
| Conditional completion | `if` + `break` + variable tracking in loop | —                                                      |
| Flow composition       | Copy-paste recipes or Claude Code skills   | —                                                      |

For the full analysis of why these patterns don't need new DSL syntax, see [Report 08: Feature Completeness](research/08-feature-completeness.md).

## Further reading

- [Getting Started](getting-started.md) — hands-on tutorial
- [Language Guide](language-guide.md) — all primitives, patterns, quick reference
- [Evaluation Results](eval-analysis.md) — full A/B testing methodology and results
