---
name: write-flow
description: Write a prompt-language flow for a task. Decides whether a flow is needed at all — most tasks don't need one. The DSL's value is gate enforcement for autonomous work.
argument-hint: '<task description>'
---

# Write a Flow

Given a task description, decide whether a prompt-language flow adds value. **Most tasks don't need one.** Claude Code already retries on failure, checks if files exist, and follows multi-step instructions. The DSL's narrow but powerful value: mechanically enforcing completion criteria via real command execution, so Claude can't stop early.

## Step 1: Do You Need a Flow?

Ask one question: **"Is there a command that must exit 0 before this task is done?"**

```
Task --> Has verifiable completion command (test/lint/build)?
  Yes --> Could Claude skip or shortcut verification?
    Yes --> USE A FLOW WITH GATE
    No  --> Plain prompt is fine
  No --> PLAIN PROMPT
```

**No flow needed** (just write a plain prompt):

- "Rename the User class to Account" — no verification command
- "Add a docstring to every public method" — no pass/fail gate
- "Explain how the auth module works" — informational
- "Create a new React component for the sidebar" — Claude does this fine without scaffolding

**Flow adds value**:

- "Fix the auth tests so they pass" — gate: `tests_pass`
- "Make the build pipeline green" — gate: `tests_pass` + `lint_pass`
- "Migrate the database and verify it works" — gate: tests or a custom command
- "Apply this refactoring to 8 files without breaking tests" — gate: `tests_pass`, loop: `foreach`

If the task doesn't need a flow, write a clear plain-language prompt and stop. Don't add DSL overhead for tasks that don't benefit from it.

## Step 2: Pick Your Gate(s)

Gates are the entire reason to use a flow. Always write `done when:` first.

Available predicates:

- `tests_pass` — `npm test` exits 0
- `lint_pass` — `npm run lint` exits 0
- `tests_fail` — passes when tests exit non-zero (for "break this" tasks)
- `lint_fail` — passes when lint exits non-zero
- `diff_nonempty` — passes when `git diff` has output
- `file_exists <path>` — passes when the file exists

Compound gates catch more issues:

```
done when:
  tests_pass
  lint_pass
```

## Step 3: Choose Your Loop Pattern

### The Ralph Loop (the core pattern)

This is prompt-language as an advanced custom Ralph Loop — the same concept (keep iterating until done) but with mechanical verification. Gates run actual commands; Claude can't declare victory until they pass.

```
flow:
  retry max 5
    run: npm test
    if command_failed
      prompt: Fix the failing tests. Read the errors carefully.
    end
  end

done when:
  tests_pass
```

Why this works: Claude already retries when asked — but without a gate, it can decide "close enough" and stop. The gate forces every iteration to prove the fix worked. Eval data shows this pattern consistently outperforms both plain prompts (on verification-heavy tasks) and over-engineered multi-phase flows.

Variations:

- `retry max N` for bounded retries (prefer this — it has a clear limit)
- `while command_failed` for condition-based loops
- `until command_succeeded` for inverted condition loops

### Foreach (batch operations)

For applying the same operation across a list of items:

```
flow:
  foreach file in "src/auth.ts src/db.ts src/api.ts"
    prompt: Add error handling to ${file}
    run: npm test
  end

done when:
  tests_pass
```

### Single prompt + gate (simplest)

When Claude just needs to do the work and a gate verifies it:

```
flow:
  prompt: Fix the failing tests

done when:
  tests_pass
```

## Step 4: Stop — Check for Over-engineering

Before outputting the flow, check for these anti-patterns.

### Anti-pattern: Sequential prompts

**BAD** — 3 prompts that could be 1:

```
flow:
  prompt: Read the codebase and understand the architecture
  prompt: Write a plan for the migration
  prompt: Execute the migration
```

**BETTER** — one prompt, one gate:

```
flow:
  prompt: Migrate the database schema. Read the codebase first, plan your approach, then execute.

done when:
  tests_pass
```

Claude follows multi-step instructions naturally. Sequential prompts add latency without improving quality.

### Anti-pattern: `file_exists` gates for things Claude already does

**BAD** — Claude always creates the file when asked:

```
done when:
  file_exists src/components/Sidebar.tsx
```

**BETTER** — plain prompt, no flow:

```
Create a Sidebar component at src/components/Sidebar.tsx
```

Only use `file_exists` when the file is a build artifact or side effect that proves a pipeline worked.

### Anti-pattern: Variables at short distances

**BAD** — variable used 2 lines later:

```
flow:
  let version = run "node -v"
  prompt: Check compatibility with Node ${version}
```

**BETTER** — Claude can just run the command itself:

```
flow:
  prompt: Check the Node version and ensure the code is compatible

done when:
  tests_pass
```

Only use `let` when the value must span many steps or feed into a `foreach`.

### Anti-pattern: Control flow for "organization"

**BAD** — phased structure that adds latency:

```
flow:
  run: npm run lint
  if command_failed
    retry max 3
      prompt: Fix lint errors
      run: npm run lint
    end
  end
  run: npm test
  if command_failed
    retry max 3
      prompt: Fix test failures
      run: npm test
    end
  end
```

**BETTER** — single loop, let Claude figure out the order:

```
flow:
  retry max 5
    run: npm run lint && npm test
    if command_failed
      prompt: The pipeline failed. Read the errors, fix the issues, and try again.
    end
  end

done when:
  tests_pass
  lint_pass
```

### Anti-pattern: Flows longer than 10 lines

If your flow block exceeds 10 lines, you're almost certainly over-engineering. Simplify. Combine prompts. Remove unnecessary variables. Trust Claude to handle sequencing.

## Output

Write the flow in a fenced code block, or say "no flow needed" and write a plain prompt instead.

Always explain:

- What the gate enforces and why mechanical verification matters for this task
- Why a plain prompt wouldn't be sufficient (if you chose a flow)

## Advanced (available but rarely needed)

These features exist but should be the exception, not the default:

- **Try/catch** — `try`/`catch` blocks for when a specific command might fail and needs distinct recovery. Most errors are handled fine by the Ralph Loop's `if command_failed` branch.
- **If/else branching** — `if`/`else` for conditional paths. Usually indicates the flow is trying to do too much. Consider splitting into separate tasks.
- **Variable capture** — `let x = run "cmd"` or `let x = prompt "text"` for storing values. Only useful when a value must cross many steps or drive a `foreach` loop.
- **While/until loops** — `while condition`/`until condition` for open-ended loops. `retry max N` is preferred for bounded iteration.
