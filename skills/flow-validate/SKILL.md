---
name: flow-validate
description: "This skill should be used when the user asks to 'validate a flow', 'check my flow', 'lint this flow', 'is this flow correct', 'flow errors', 'flow warnings', or wants to analyze a prompt-language flow for issues before executing it."
disable-model-invocation: true
allowed-tools: Bash, Read, Glob
model: inherit
argument-hint: '[flow text or file path]'
---

# Flow Validate

Parse, lint, and score a prompt-language flow to find issues before execution.

## What to do

1. Determine the flow source:
   - If the user provided a file path argument, read that file
   - If the user pasted flow text inline, use that
   - Otherwise, look for `example.flow` or any `.flow` file in the current directory

2. Run the validation script:

   ```bash
   node <plugin-dir>/skills/flow-validate/validate.mjs [file-or-stdin]
   ```

   Or pipe flow text to it:

   ```bash
   echo '<flow text>' | node <plugin-dir>/skills/flow-validate/validate.mjs
   ```

   Where `<plugin-dir>` is the directory containing this skill (find it via `Glob` for `skills/flow-validate/validate.mjs`).

3. Report the results to the user:
   - **Parse warnings**: syntax issues found during parsing
   - **Lint warnings**: anti-patterns detected (empty bodies, break outside loop, unresolved variables, etc.)
   - **Complexity score**: 1-5 rating with explanation
   - **Summary**: overall pass/fail assessment

4. If there are warnings, suggest specific fixes for each one.

## Complexity Scale

- **1 (Trivial)**: Linear flow, 3 or fewer nodes, no control flow
- **2 (Simple)**: Up to 5 nodes or 1 control flow construct, shallow nesting
- **3 (Moderate)**: Up to 10 nodes, nesting depth up to 2, or 2-3 control flows
- **4 (Complex)**: More than 10 nodes, depth 3+, or 4+ control flows
- **5 (Very complex)**: Deep nesting combined with many control flows and gates

## Common Warnings

- **Empty body**: A loop, if, try, or spawn block has no nodes inside it
- **Break/continue outside loop**: `break` or `continue` used outside a while/until/retry/foreach
- **Retry without run**: `retry` block has no `run` node -- retry re-loops on command_failed
- **Unresolved variable**: `${varName}` referenced but never defined by a `let`/`var` node
- **Infinite loop risk**: Loop condition depends on a predicate (like `command_failed`) but body has no `run` node
- **Missing goal**: No `Goal:` line found
- **Empty flow**: No nodes defined in the `flow:` block
