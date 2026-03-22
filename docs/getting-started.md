# Getting Started

See the plugin work in 2 minutes. You'll create a buggy file, add a gate, and watch Claude fix it automatically.

## Prerequisites

- [Claude Code](https://docs.anthropic.com/en/docs/claude-code/overview) installed
- Node.js >= 22

## Step 1: Install the plugin

```bash
npx @45ck/prompt-language
```

## Step 2: Create a broken project

Make a directory with a buggy calculator and a test that catches the bug:

```bash
mkdir /tmp/demo && cd /tmp/demo
```

**package.json** — so `npm test` knows what to run:

```json
{ "scripts": { "test": "node test.js" } }
```

**app.js** — the `divide` function crashes on zero:

```js
function add(a, b) {
  return a + b;
}
function divide(a, b) {
  return a / b;
} // bug: no zero check
module.exports = { add, divide };
```

**test.js** — the test catches it:

```js
const { add, divide } = require('./app');
let pass = 0,
  fail = 0;
function assert(cond, msg) {
  cond ? pass++ : (fail++, console.error('FAIL:', msg));
}

assert(add(1, 2) === 3, 'add');
assert(divide(10, 2) === 5, 'divide');

// The bug: divide(10, 0) returns Infinity instead of throwing
try {
  const result = divide(10, 0);
  if (!isFinite(result)) throw new Error('not finite');
  fail++;
  console.error('FAIL: divide by zero should throw or return non-finite');
} catch (e) {
  pass++;
}

assert(fail === 0, `${fail} test(s) failed`);

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
```

Verify the test fails before proceeding:

```bash
npm test
```

You should see `FAIL` output and a non-zero exit code.

## Step 3: Run with a gate

Add `done when: tests_pass` to enforce verification:

```bash
claude -p "Fix app.js so the code is clean.

done when:
  tests_pass"
```

Claude cannot stop until `npm test` actually exits with code 0. If it claims "done" before the tests pass, the gate blocks it and sends it back to keep working.

Without this plugin, Claude might fix the obvious issue and say "Done!" without running the tests at all. The gate makes verification mandatory.

## Step 4: Try a flow for more control

For iterative fix-test cycles, add a flow:

```bash
claude -p "Fix all bugs in app.js.

flow:
  retry max 5
    run: node test.js
    if command_failed
      prompt: Fix the test failures shown above.
    end
  end

done when:
  tests_pass"
```

The `retry` loop runs the tests, and if they fail, asks Claude to fix the errors. This repeats up to 5 times. The gate ensures the final result actually passes.

## What just happened

1. The plugin parsed your prompt and found the `flow:` block and `done when:` gate.
2. It created a session state file (`.prompt-language/session-state.json`) tracking execution progress.
3. On each turn, it injected the current step into Claude's context — showing exactly where in the flow Claude is, what variables are set, and which gates have passed or failed.
4. When Claude tried to stop, the Stop hook checked whether all gates passed. If not, it blocked the stop and injected the next step.
5. Once all tests passed, the gate let Claude stop.

## What to try next

**Gates without a flow** — the simplest and most valuable pattern:

```
Fix the auth module.

done when:
  tests_pass
  lint_pass
```

**Custom gate commands** — use any verification tool, not just npm:

```
done when:
  gate pytest: python -m pytest -x
  gate mycheck: bash validate.sh
```

**Variables** — capture command output for later use:

```
flow:
  let baseline = run "node bench.js"
  prompt: Optimize the hot path.
  let result = run "node bench.js"
  prompt: Compare ${baseline} vs ${result}.
```

## Further reading

- [Practical Guide](https://github.com/45ck/prompt-language/blob/main/docs/guide.md) — how the plugin works, variable lifecycle, gate mechanics
- [DSL Reference](https://github.com/45ck/prompt-language/blob/main/docs/dsl-reference.md) — full syntax for all primitives
- [Troubleshooting](https://github.com/45ck/prompt-language/blob/main/docs/troubleshooting.md) — debugging stuck flows, known issues
- [Evaluation Results](https://github.com/45ck/prompt-language/blob/main/docs/eval-analysis.md) — 45-hypothesis A/B comparison against vanilla Claude
