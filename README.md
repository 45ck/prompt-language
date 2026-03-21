# @45ck/prompt-language

A programming language for Claude Code workflows.

Write structured programs that manage agent context, orchestrate long-horizon tasks, and enforce completion — with loops, variables, conditionals, and gates.

[![npm](https://img.shields.io/npm/v/@45ck/prompt-language)](https://www.npmjs.com/package/@45ck/prompt-language)
[![license](https://img.shields.io/npm/l/@45ck/prompt-language)](LICENSE)
[![node](https://img.shields.io/node/v/@45ck/prompt-language)](package.json)

## What is this?

Claude Code is powerful, but it sometimes declares victory too early — it trusts its own assessment of whether tests pass, skips edge cases when focused on one bug, and stops without verifying its work. prompt-language gives you structural control over what the agent does and mechanical verification that it actually finished.

It's a small language you write inside your Claude Code prompts. It gives you programming constructs — loops, conditionals, variables, retries — to orchestrate what the agent does across a long task. Instead of hoping Claude follows a multi-step plan, you write the plan as executable code.

Three pillars:

- **Completion gates** — `done when:` predicates run actual commands (like `npm test`) and block the agent from stopping until they pass. The agent can't claim "done" without proof. This is the core differentiator.
- **Structured execution** — Loops (`while`, `until`, `retry`), conditionals (`if/else`), and error handling (`try/catch`) let you write real programs that the agent follows step by step.
- **Context management** — Variables (`let`/`var`) capture command output, store context, and feed it into later prompts. The agent sees exactly what you want, when you want it.

```
Goal: diagnose and fix the auth module

flow:
  let errors = run "npm test -- auth 2>&1 | tail -20"
  prompt: Analyze these test failures and identify root causes: ${errors}
  retry max 3
    prompt: Fix the issues you identified.
    run: npm test -- auth
  end

done when:
  tests_pass
```

This captures test output into a variable, feeds it to the agent as context, then loops fix-and-test until green. The gate verifies independently — without it, Claude might fix one test and stop, missing the rest.

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

### Write a flow

Use the DSL directly in your Claude Code prompt:

```
Goal: fix failing tests

flow:
  retry max 5
    run: npm test
    if tests_fail
      prompt: Fix the failing tests based on the error output above.
    end
  end

done when:
  tests_pass
```

The agent executes step by step, unable to stop until the gate passes or the retry limit is reached.

### Or use natural language

You don't need to learn the DSL. Type your intent as a Claude Code prompt:

```
Keep running the tests and fixing failures until they all pass. Try up to 5 times.
```

prompt-language detects control-flow intent and asks Claude to convert your instructions into a structured flow. When your prompt contains phrases like "retry", "loop", "keep going", "don't stop", or "on failure", the plugin injects a meta-prompt with the full DSL reference. The agent reads your intent and writes the DSL. This works well but is less precise than writing the DSL yourself.

### Context management

Variables carry context forward across steps. Each prompt sees exactly the information it needs:

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

## How it works

### The execution model

1. You write a flow (DSL or natural language) in your prompt.
2. The plugin parses it into a program (FlowSpec) and creates a SessionState.
3. Each step is injected into Claude's context one at a time.
4. `run:` nodes auto-execute commands and capture results into variables.
5. `prompt:` nodes inject instructions for the agent to act on.
6. Loops and conditionals evaluate against runtime variable state.
7. Gates run verification commands before allowing the agent to stop.

### Lifecycle

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

### Steps and gates are independent

Steps define execution order. Gates define the exit condition. You can use flow steps without gates (structured execution only) or gates without a complex flow (verification before stopping).

## DSL quick reference

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

Primitives nest freely. `let`/`var` has three source types: literal (`let x = "hello"`), prompt (`let x = prompt "text"`), and run (`let x = run "cmd"`). Variables are interpolated via `${varName}` in prompt and run text. Conditions (`while`, `until`, `if`) resolve against runtime variables or via built-in commands — see [Built-in variables and gates](#built-in-variables-and-gates). Unknown variables are left as-is.

Full syntax, defaults, and composition rules: **[DSL Reference](docs/dsl-reference.md)**

## Built-in variables and gates

### Runtime variables

Auto-set after every `run:` node:

| Variable            | Type    | Description                                          |
| ------------------- | ------- | ---------------------------------------------------- |
| `last_exit_code`    | number  | Exit code of the last command                        |
| `command_failed`    | boolean | `true` if exit code != 0                             |
| `command_succeeded` | boolean | `true` if exit code == 0                             |
| `last_stdout`       | string  | stdout of the last command (truncated at 2000 chars) |
| `last_stderr`       | string  | stderr of the last command (truncated at 2000 chars) |

Use these in `while`, `until`, `if`, and `try/catch` conditions.

### Gate predicates

Used in `done when:` blocks and flow conditions. Each predicate runs a real command and checks the result:

| Predicate            | Runs               | Passes when                  |
| -------------------- | ------------------ | ---------------------------- |
| `tests_pass`         | `npm test`         | exit 0                       |
| `tests_fail`         | `npm test`         | exit != 0                    |
| `lint_pass`          | `npm run lint`     | exit 0                       |
| `lint_fail`          | `npm run lint`     | exit != 0                    |
| `file_exists <path>` | `test -f '<path>'` | file exists                  |
| `diff_nonempty`      | `git diff --quiet` | exit != 0 (diff has changes) |

## Slash commands

The plugin runs flows automatically via hooks. These slash commands provide manual control for debugging or interrupted sessions:

| Command        | Description                                                                            |
| -------------- | -------------------------------------------------------------------------------------- |
| `/flow:run`    | Execute the current flow step, advance state, and inject context. Main execution loop. |
| `/flow:status` | Show current flow execution progress. Read-only.                                       |
| `/flow:reset`  | Abandon the current flow and delete session state.                                     |

## Use cases

### Multi-phase pipeline

Research, plan, implement, then verify:

```
Goal: add user authentication

flow:
  let codebase = run "find src -name '*.ts' | head -20"
  prompt: Review the codebase structure (${codebase}) and plan an auth module.
  prompt: Implement the auth module following your plan.
  prompt: Write tests for the auth module.
  run: npm test

done when:
  tests_pass
  lint_pass
```

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

Diagnose multiple services, fix each, then write a postmortem citing exact errors:

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

Each error is captured in a variable when it's first observed, then re-injected into the postmortem prompt at the end. Without variables, the agent must recall exact error messages from many turns back — variables guarantee byte-exact fidelity regardless of distance.

### Schema-driven code generation

Generate consistent code across multiple files from a single source of truth:

```
Goal: generate API module from schema

flow:
  let schema = run "cat api-schema.json"
  prompt: Generate src/types.ts with TypeScript interfaces for: ${schema}
  prompt: Generate src/routes.ts with Express handlers matching: ${schema}
  prompt: Generate src/validation.ts with request validators for: ${schema}
  prompt: Generate src/tests.ts covering all endpoints from: ${schema}

done when:
  tests_pass
  lint_pass
```

The schema is captured once and re-injected at every step. Each file generation step sees the exact original schema, not a paraphrased version from earlier in the conversation.

## Evaluation

In 35 A/B hypotheses (33 tested, 2 pending): **13 plugin wins, 19 ties, 1 flaky** across 190+ `claude -p` calls with `--repeat 3` reliability. The plugin wins when prompts mislead, omit requirements, or narrow focus — gates catch what self-discipline misses. When prompts are honest and explicit, vanilla Claude performs equally well.

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
