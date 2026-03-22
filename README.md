# @45ck/prompt-language

Stop telling Claude to run the tests.

[![npm](https://img.shields.io/npm/v/@45ck/prompt-language)](https://www.npmjs.com/package/@45ck/prompt-language)
[![CI](https://github.com/45ck/prompt-language/actions/workflows/quality.yml/badge.svg)](https://github.com/45ck/prompt-language/actions/workflows/quality.yml)
[![license](https://img.shields.io/npm/l/@45ck/prompt-language)](LICENSE)
[![node](https://img.shields.io/node/v/@45ck/prompt-language)](package.json)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)
[![npm downloads](https://img.shields.io/npm/dm/@45ck/prompt-language)](https://www.npmjs.com/package/@45ck/prompt-language)

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

**Completion gates** are the core feature. `done when:` predicates run real commands and block the agent from stopping until they pass. In [45 A/B experiments](https://github.com/45ck/prompt-language/blob/main/docs/eval-analysis.md), gates won 15/15 tested scenarios at 100% reliability. The agent can lie about test results, skip requirements, or stop early. Gates don't care. They run the command and check the exit code.

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

### Manual install

If you prefer not to use npx, clone the repo and run the installer directly:

```bash
git clone https://github.com/45ck/prompt-language.git
cd prompt-language
npm install && npm run build
node bin/cli.mjs install
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

### Process a list of files

Iterate over command output. Each item gets its own step:

```
Goal: lint all changed TypeScript files

flow:
  let files = run "git diff --name-only -- '*.ts'"
  foreach file in ${files}
    run: npx eslint ${file} --fix
  end

done when:
  lint_pass
```

`foreach` splits the list automatically (JSON arrays, newline-delimited, or whitespace-delimited). Each iteration sets `${file}`, `${file_index}`, and `${file_length}`.

## Context management

### Why variables matter

Claude Code conversations lose context as they grow. The context window fills, earlier turns get compressed, and details drop out. Variables solve this: they store exact values in persistent state and re-inject them into every subsequent turn, regardless of conversation length.

### Three capture modes

Literal — store a string directly:

```
let greeting = "hello world"
```

Command output — run a command, store stdout:

```
let baseline = run "node bench.js"
```

Prompt capture — ask Claude a question, store its answer:

```
let summary = prompt "Summarize the test failures above"
```

Each mode stores the result in `.prompt-language/session-state.json`. Later steps reference the variable with `${varName}` — the plugin interpolates the stored value before Claude sees the prompt.

### Auto-variables

Every `run:` node and `let x = run "..."` automatically sets five variables:

| Variable            | Value                                  |
| ------------------- | -------------------------------------- |
| `last_exit_code`    | Numeric exit code                      |
| `command_succeeded` | `true` when exit code is 0             |
| `command_failed`    | `true` when exit code is non-zero      |
| `last_stdout`       | Command stdout (truncated at 2k chars) |
| `last_stderr`       | Command stderr (truncated at 2k chars) |

These are available immediately in subsequent `if`, `while`, and `prompt` nodes.

### Foreach

Iterate over a collection. The list is split automatically — JSON arrays, newline-delimited output, or whitespace-separated tokens all work:

```
let files = run "git diff --name-only -- '*.ts'"
foreach file in ${files}
  prompt: Review ${file} for type safety issues.
end
```

Each iteration sets `${file}` (current item), `${file_index}` (0-based), and `${file_length}` (total count).

### How it compares to vanilla Claude Code

| Aspect                | Vanilla Claude Code        | With plugin                           |
| --------------------- | -------------------------- | ------------------------------------- |
| Context at 2-15 steps | Perfect recall             | Perfect recall (no advantage)         |
| Context at scale      | Degrades as window fills   | Deterministic re-injection every turn |
| Variable explicitness | Implicit in conversation   | Named, inspectable, interpolated      |
| Composability         | Copy-paste between prompts | `${var}` references across steps      |
| Latency               | Baseline                   | 2-3x overhead                         |

At short distances, vanilla Claude recalls everything. The advantage appears at scale and in readability: variables make data flow explicit, and re-injection guarantees nothing is lost to token limits.

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

**Context re-injection**: On every turn, the plugin loads saved state from `.prompt-language/session-state.json`, re-renders the full flow with all variables and execution progress, and prepends it to Claude's prompt. This means Claude sees a complete, up-to-date snapshot every turn — variables, loop counters, gate results — regardless of conversation length. No information is lost to context window limits.

For a detailed walkthrough of the mechanics, see the **[Practical Guide](https://github.com/45ck/prompt-language/blob/main/docs/guide.md)**.

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
| `foreach`     | Iterate over a list                  | `foreach file in ${files} max 10`      |
| `done when:`  | Completion gate (blocks stopping)    | `done when: tests_pass`                |

Full syntax, defaults, composition rules, built-in variables, and gate predicates: **[DSL Reference](https://github.com/45ck/prompt-language/blob/main/docs/dsl-reference.md)**

## Slash commands

| Command        | Description                                                       |
| -------------- | ----------------------------------------------------------------- |
| `/flow:run`    | Execute the current flow step, advance state, and inject context. |
| `/flow:status` | Show current flow execution progress. Read-only.                  |
| `/flow:reset`  | Abandon the current flow and delete session state.                |

## Evaluation

In 45 A/B hypotheses: **15 plugin wins, 28 ties, 1 flaky, 2 both-fail** across 300+ `claude -p` calls with `--repeat 3` reliability. The plugin wins when prompts mislead, omit requirements, or narrow focus. When prompts are honest and explicit, vanilla Claude performs equally well.

| Pattern                         | Mechanism                                  | Win rate |
| ------------------------------- | ------------------------------------------ | -------- |
| Agent claims done despite fails | Gate ignores false claims, runs real tests | 100%     |
| Prompt focuses on one bug       | Gate checks broader criteria than prompt   | 100%     |
| Prompt omits a requirement      | Multiple gates enforce unstated criteria   | 100%     |
| Review without code changes     | `diff_nonempty` gate forces modifications  | 100%     |
| Inverted gate predicate         | `tests_fail`/`lint_fail` forces failure    | 100%     |
| Gaslighting + loop combo        | Deceptive prompt + while loop + gate       | 100%     |

Full analysis: **[Evaluation Results](https://github.com/45ck/prompt-language/blob/main/docs/eval-analysis.md)**

## Contributing

See [CONTRIBUTING.md](https://github.com/45ck/prompt-language/blob/main/CONTRIBUTING.md).

## License

MIT. See [LICENSE](LICENSE).
