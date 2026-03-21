# @45ck/prompt-language

Stop telling Claude to run the tests.

[![npm](https://img.shields.io/npm/v/@45ck/prompt-language)](https://www.npmjs.com/package/@45ck/prompt-language)
[![license](https://img.shields.io/npm/l/@45ck/prompt-language)](LICENSE)
[![node](https://img.shields.io/node/v/@45ck/prompt-language)](package.json)

## The problem

You ask Claude to fix a bug. It makes a change and says "Done!" You say "run the tests." They fail. You say "fix those." It fixes one. You say "run the tests again." Two more fail. You paste the output. It fixes them. You say "run the tests one more time." It finally passes. Five back-and-forth messages for something that should have been automatic.

prompt-language fixes this:

```
Goal: fix the bug

flow:
  retry max 5
    prompt: Fix the failing tests.
    run: npm test
  end

done when:
  tests_pass
```

The agent loops fix-and-test automatically. The gate runs `npm test` before allowing the agent to stop. No more babysitting.

## How it helps

**Completion gates** are the core feature. `done when:` predicates run real commands and block the agent from stopping until they pass. In [45 A/B experiments](docs/eval-analysis.md), gates won 15/15 tested scenarios at 100% reliability. The agent can lie about test results, skip requirements, or stop early. Gates don't care. They run the command and check the exit code.

**Flow control** (`retry`, `while`, `until`, `if`, `try/catch`) structures multi-step tasks. Claude already follows explicit instructions well, so flow control is mainly useful for readability and enforcing execution order rather than correctness. Where it shines is pairing with gates: a `retry` loop that re-runs tests after each fix attempt, combined with a `tests_pass` gate, creates an autonomous fix-test cycle.

**Variables** (`let`/`var`) capture command output and carry it across steps. Useful for composing context, like capturing a benchmark result early and comparing it at the end. At tested distances (2-7 steps), variables don't improve correctness over vanilla Claude, but they make flows more readable and explicit about what context each step receives.

## Install

Requires [Claude Code](https://claude.ai/download) and Node.js >= 22.

### One command (recommended)

```bash
npx @45ck/prompt-language
```

This copies the plugin files to `~/.claude/plugins/local/prompt-language/` and enables it in your Claude Code settings.

```bash
# Check installation status
npx @45ck/prompt-language status

# Uninstall
npx @45ck/prompt-language uninstall
```

### Claude Code plugin manager

```bash
claude plugin marketplace add 45ck/prompt-language
claude plugin install prompt-language
```

## Quick start

### Use a built-in skill

The fastest way to start. Type a slash command and walk away:

| Command         | What it does                                                                                       |
| --------------- | -------------------------------------------------------------------------------------------------- |
| `/fix-and-test` | Retry loop: fix failing tests, re-run, repeat up to 5 times. Gate: tests_pass                      |
| `/tdd`          | Red-green-refactor cycle. Write failing test, implement, refactor. Gate: tests_pass + lint_pass    |
| `/refactor`     | Incremental refactoring with test verification after each change. Gate: tests_pass + lint_pass     |
| `/deploy-check` | Lint, test, build pipeline. Fix failures at each stage. Gate: tests_pass + lint_pass + file_exists |

No DSL to learn. The skill handles the flow and gates for you.

### Write a flow

For custom workflows, add a flow block to any Claude Code prompt:

```
Goal: fix failing tests

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

The agent executes step by step, retrying on failure, unable to stop until the gate passes or the retry limit is reached.

### Gates without a flow

You don't need a flow to use gates. Just add `done when:` to any prompt:

```
Goal: fix the auth module and clean up the code

done when:
  tests_pass
  lint_pass
```

Claude works however it wants, but it cannot stop until both `npm test` and `npm run lint` pass. This is the simplest way to prevent premature stopping.

### Natural language

You don't need to learn the DSL. Type your intent as a Claude Code prompt:

```
Keep running the tests and fixing failures until they all pass. Try up to 5 times.
```

The plugin detects control-flow intent and asks Claude to convert your instructions into a structured flow. This works well but is less precise than writing the DSL yourself.

## When to use it

| Situation                                                                                                  | Use plugin? | Why                                        |
| ---------------------------------------------------------------------------------------------------------- | ----------- | ------------------------------------------ |
| Task has verifiable completion criteria (tests, lint, file exists) that the prompt might not fully specify | Yes         | Gates catch what prompts miss              |
| You distrust the prompt (generated, copied, or deliberately adversarial)                                   | Yes         | Gaslighting resistance                     |
| You need to force code changes, not just review                                                            | Yes         | `diff_nonempty` gate                       |
| Multiple independent criteria must all pass                                                                | Yes         | Compound gates                             |
| You need the agent to produce a specific failure state                                                     | Yes         | Inverted gates (`tests_fail`, `lint_fail`) |
| Task is simple and well-specified                                                                          | No          | Vanilla matches correctness, 2-3x faster   |
| You want phased prompts for organizational structure only                                                  | No          | 4-7x slower, no correctness gain           |
| Speed matters and you'll verify the result manually                                                        | No          | Plugin adds overhead without benefit       |

**Rule of thumb**: use gates when the agent needs to verify something it would otherwise skip. Skip the plugin when you'll check the result yourself.

## Use cases

### Fix-test loop

The most common pattern. Retry until tests pass:

```
Goal: fix the auth tests

flow:
  retry max 5
    run: npm test -- auth
    if command_failed
      prompt: Fix the failing tests based on the error output above.
    end
  end

done when:
  tests_pass
```

### Quality gate

Enforce multiple requirements the prompt doesn't mention:

```
Goal: fix the test failures

done when:
  tests_pass
  lint_pass
  file_exists dist/index.js
```

You said "fix the test failures." The gates also enforce lint and a successful build. Claude has no reason to lint on its own, but the gate makes it.

### Conditional diagnostics

Branch on error type, apply different fix strategies:

```
Goal: fix all quality issues

flow:
  run: npm test
  if tests_fail
    prompt: Fix the failing tests based on the error output.
    run: npm test
  end
  run: npm run lint
  if lint_fail
    prompt: Fix the lint errors shown above.
    run: npm run lint
  end

done when:
  tests_pass
  lint_pass
```

### Benchmark comparison

Capture a baseline, fix the problem, measure improvement:

```
Goal: investigate and fix performance regression

flow:
  let baseline = run "node bench.js"
  prompt: The current benchmark shows: ${baseline}. Find the bottleneck.
  prompt: Fix the performance issue you identified.
  let result = run "node bench.js"
  prompt: Compare before (${baseline}) and after (${result}). Summarize improvements.

done when:
  tests_pass
```

### Deploy with error recovery

Try/catch for graceful failure handling:

```
Goal: deploy to staging

flow:
  try
    run: npm run build
    run: npm run deploy:staging
  catch command_failed
    prompt: Deploy failed. Investigate the error and fix it.
    run: npm run build
    run: npm run deploy:staging
  end

done when:
  tests_pass
```

### Multi-service error forensics

Diagnose multiple services, fix each, then cite exact errors in a postmortem:

```
Goal: diagnose and fix all service errors

flow:
  let auth_err = run "node diagnose-auth.js"
  prompt: Fix the auth service based on: ${auth_err}
  let cache_err = run "node diagnose-cache.js"
  prompt: Fix the cache service based on: ${cache_err}
  let api_err = run "node diagnose-api.js"
  prompt: Fix the API service based on: ${api_err}
  prompt: Write postmortem.md citing exact errors — auth: ${auth_err}, cache: ${cache_err}, api: ${api_err}

done when:
  tests_pass
```

Each error is captured in a variable when it's first observed, then re-injected into the postmortem prompt at the end.

## How it works

1. You write a flow (DSL or natural language) in your prompt.
2. The plugin parses it into a program (FlowSpec) and creates a SessionState.
3. Each step is injected into Claude's context one at a time.
4. `run:` nodes auto-execute commands and capture results into variables.
5. `prompt:` nodes inject instructions for the agent to act on.
6. Loops and conditionals evaluate against runtime variable state.
7. Gates run verification commands before allowing the agent to stop.

```
    You submit a prompt with a flow
              |
    +---------v-----------+
    | Parse into FlowSpec |
    | Create SessionState |
    +---------+-----------+
              |
    +---------v-----------+
    | Inject current step |<-----------+
    +---------+-----------+            |
              |                        |
    +---------v-----------+     +------+------+
    | Claude executes     |     | Block stop, |
    | the step            |     | inject next |
    +---------+-----------+     +------^------+
              |                        |
    +---------v-----------+      NO    |
    | All steps done?     +------------+
    | All gates passing?  |
    +---------+-----------+
              | YES
              v
            Done
```

Steps define execution order. Gates define the exit condition. You can use flow steps without gates (structured execution only) or gates without a complex flow (verification before stopping).

## DSL reference

| Primitive     | Purpose                              | Example                                |
| ------------- | ------------------------------------ | -------------------------------------- |
| `prompt:`     | Inject an instruction for the agent  | `prompt: Fix the auth module.`         |
| `run:`        | Execute a command, capture result    | `run: npm test`                        |
| `let`/`var`   | Store a value for `${interpolation}` | `let ver = run "node -v"`              |
| `while`       | Loop while condition is true         | `while tests_fail max 5`               |
| `until`       | Loop until condition becomes true    | `until tests_pass max 5`               |
| `retry`       | Retry block on failure               | `retry max 3`                          |
| `if`/`else`   | Conditional branching                | `if lint_fail ... else ... end`        |
| `try`/`catch` | Execute with error recovery          | `try ... catch command_failed ... end` |
| `done when:`  | Completion gate (blocks stopping)    | `done when: tests_pass`                |

Full syntax, defaults, composition rules, built-in variables, and gate predicates: **[DSL Reference](docs/dsl-reference.md)**

## Slash commands

| Command        | Description                                                       |
| -------------- | ----------------------------------------------------------------- |
| `/flow:run`    | Execute the current flow step, advance state, and inject context. |
| `/flow:status` | Show current flow execution progress. Read-only.                  |
| `/flow:reset`  | Abandon the current flow and delete session state.                |

## Evaluation

In 45 A/B hypotheses (39 confirmed, 6 pending): **15 plugin wins, 21 ties, 1 flaky** across 250+ `claude -p` calls with `--repeat 3` reliability. The plugin wins when prompts mislead, omit requirements, or narrow focus. When prompts are honest and explicit, vanilla Claude performs equally well.

| Pattern                         | Mechanism                                  | Win rate |
| ------------------------------- | ------------------------------------------ | -------- |
| Agent claims done despite fails | Gate ignores false claims, runs real tests | 100%     |
| Prompt focuses on one bug       | Gate checks broader criteria than prompt   | 100%     |
| Prompt omits a requirement      | Multiple gates enforce unstated criteria   | 100%     |
| Review without code changes     | `diff_nonempty` gate forces modifications  | 100%     |
| Inverted gate predicate         | `tests_fail`/`lint_fail` forces failure    | 100%     |
| Gaslighting + loop combo        | Deceptive prompt + while loop + gate       | 100%     |

Full analysis: **[Evaluation Results](docs/eval-analysis.md)**

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT. See [LICENSE](LICENSE).
