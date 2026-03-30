# Smoke Test Coverage Gap Analysis and New Test Design

## Summary

Analysis of the prompt-language DSL project reveals 19 node types and associated
features. The existing 26 smoke tests (A-Z) cover 12 core node kinds thoroughly.
This document designs 15 new smoke tests (AA through AO) targeting features with
zero end-to-end coverage, and documents testability risks for features that
cannot be fully tested in the automated smoke framework.

## Findings

### Testability Assessment per Gap

| Feature              | Parser exists         | Advance logic exists | Automatable via `claude -p`  | Testability |
| -------------------- | --------------------- | -------------------- | ---------------------------- | ----------- |
| continue             | YES                   | YES                  | YES                          | Full        |
| remember             | YES                   | YES                  | YES (file oracle)            | Full        |
| send/receive         | YES                   | YES                  | PARTIAL (needs spawn)        | Medium      |
| approve              | NO (not parsed)       | YES                  | NO (interactive + no parser) | Blocked     |
| review               | NO (not parsed)       | YES                  | NO (no parser)               | Blocked     |
| race                 | YES (parsed)          | YES                  | PARTIAL (needs child claude) | Low         |
| foreach_spawn        | YES (parsed)          | YES                  | PARTIAL (needs child claude) | Low         |
| memory: section      | YES (parseMemoryKeys) | YES                  | YES (file oracle)            | Full        |
| import system        | YES                   | YES                  | YES (file setup)             | Full        |
| JSON capture         | YES (prompt_json)     | YES                  | YES                          | Medium      |
| grounded-by          | YES (ask conditions)  | YES                  | SLOW (AI evaluation)         | Medium      |
| labeled loops        | YES                   | YES                  | YES                          | Full        |
| spawn with condition | YES                   | YES                  | PARTIAL (needs child claude) | Low         |
| spawn with model     | YES                   | YES                  | PARTIAL (needs child claude) | Low         |
| continue in loops    | YES                   | YES                  | YES                          | Full        |

### Critical Testability Risk: Missing Parsers

**approve** and **review** nodes have type definitions (`flow-node.ts`),
factory functions, and advancement logic (`advance-flow.ts`), but NO
parser support in `parse-flow.ts`. They cannot be written in DSL text.
This means they are dead code from the end-user perspective unless
constructed programmatically. Smoke tests cannot exercise them.

**Recommendation**: Either implement parser support for `approve` and
`review` keywords, or document them as internal-only. Any smoke test
for these features would require parser implementation first.

### Spawn-Dependent Features

`race`, `foreach_spawn`, `send/receive` (cross-agent), and conditional/
model spawn all require child `claude -p` processes. The existing
smoke test framework does not support multi-process orchestration.
These tests are marked as requiring special infrastructure and carry
higher flakiness risk due to process coordination.

---

## New Smoke Test Scenarios (AA through AO)

### AA: Continue skips iteration

**What it validates**: The `continue` node skips remaining body of
the current loop iteration and advances to the next iteration.

**Classification**: Fast

**DSL prompt**:

```
Goal: test continue

flow:
  foreach item in "alpha beta gamma delta"
    if ${item} == "beta"
      continue
    end
    run: echo ${item} >> continue-result.txt
  end
```

**Assertion**: `continue-result.txt` contains "alpha", "gamma", "delta"
but NOT "beta".

**Oracle**:

- File `continue-result.txt` exists
- Content includes "alpha"
- Content includes "gamma"
- Content includes "delta"
- Content does NOT include "beta"

**Testing challenges**: None. Pure control-flow test, no external
dependencies. Straightforward file oracle.

---

### AB: Continue with labeled loop

**What it validates**: `continue "outer"` targets a specific labeled
loop rather than the innermost loop, skipping the rest of the outer
loop's body.

**Classification**: Slow (nested loops)

**DSL prompt**:

```
Goal: test labeled continue

flow:
  outer: foreach color in "red green blue"
    foreach num in "1 2"
      if ${color} == "green"
        continue outer
      end
      run: echo ${color}-${num} >> label-continue.txt
    end
  end
```

**Assertion**: `label-continue.txt` contains "red-1", "red-2",
"blue-1", "blue-2" but NOT any "green-" entries.

**Oracle**:

- File exists
- Contains "red-1" and "red-2"
- Contains "blue-1" and "blue-2"
- Does NOT contain "green"

**Testing challenges**: Relies on labeled loop parsing
(`outer: foreach ...`) which is implemented but never smoke-tested.
Tests two features at once: labeled loops AND continue.

---

### AC: Labeled break exits outer loop

**What it validates**: `break "outer"` exits a specific labeled outer
loop, not just the innermost loop.

**Classification**: Slow (nested loops)

**DSL prompt**:

```
Goal: test labeled break

flow:
  outer: foreach letter in "a b c d"
    foreach num in "1 2 3"
      run: echo ${letter}${num} >> label-break.txt
      if ${letter} == "b" and ${num} == "2"
        break outer
      end
    end
  end
```

**Assertion**: `label-break.txt` contains "a1", "a2", "a3", "b1", "b2"
but NOT "b3", "c1", "c2", "c3", "d1", etc.

**Oracle**:

- File exists
- Contains "a1", "a2", "a3"
- Contains "b1", "b2"
- Does NOT contain "b3"
- Does NOT contain "c" or "d"

**Testing challenges**: Depends on AND condition evaluation combined
with labeled break. Test U already covers AND conditions, so this is
additive.

---

### AD: Remember free-text persists to memory.json

**What it validates**: The `remember` node writes free-form text to
`.prompt-language/memory.json` during flow execution.

**Classification**: Fast

**DSL prompt**:

```
Goal: test remember

flow:
  let val = run "echo secret-42"
  remember "The secret value is ${val}"
  run: echo done > remember-marker.txt
```

**Assertion**: `.prompt-language/memory.json` exists and contains an
entry with text that includes "secret-42".

**Oracle**:

- File `remember-marker.txt` exists (flow completed)
- File `.prompt-language/memory.json` exists
- JSON array contains at least one entry
- At least one entry has `text` field containing "secret-42"

**Testing challenges**: Must read and parse the JSON state file from
the `.prompt-language/` directory. The memory store writes to this
path automatically. Variable interpolation in remember text needs to
work.

---

### AE: Remember key-value storage

**What it validates**: The `remember key="k" value="v"` syntax stores
structured key-value pairs in memory, with last-write-wins semantics
for duplicate keys.

**Classification**: Fast

**DSL prompt**:

```
Goal: test remember key-value

flow:
  remember key="color" value="red"
  remember key="color" value="blue"
  remember key="size" value="large"
  run: echo done > kv-marker.txt
```

**Assertion**: `.prompt-language/memory.json` contains exactly one
"color" entry (value "blue", not "red") and one "size" entry (value
"large"). The last-write-wins for "color" means "red" is replaced.

**Oracle**:

- File `kv-marker.txt` exists
- `memory.json` is valid JSON array
- Exactly one entry has `key: "color"` with `value: "blue"`
- No entry has `key: "color"` with `value: "red"`
- Exactly one entry has `key: "size"` with `value: "large"`

**Testing challenges**: Requires parsing the JSON structure rather than
simple string matching. The last-write-wins replacement is an important
behavioral detail to verify.

---

### AF: Memory section prefetch

**What it validates**: The `memory:` section in DSL input specifies
keys to prefetch. When those keys exist in `memory.json`, their values
are loaded into session variables before the flow starts.

**Classification**: Fast (two-step setup)

**DSL prompt** (step 1 -- seed memory):

```
Goal: seed memory

flow:
  remember key="api_url" value="https://example.com"
  run: echo seeded > seed-marker.txt
```

**DSL prompt** (step 2 -- prefetch):

```
Goal: test memory prefetch

memory:
  api_url

flow:
  run: echo ${api_url} > prefetch-result.txt
```

**Assertion**: `prefetch-result.txt` contains "https://example.com".

**Oracle**:

- `seed-marker.txt` exists after step 1
- `prefetch-result.txt` exists after step 2
- Content includes "https://example.com"

**Testing challenges**: Requires two sequential `claude -p` invocations
in the same directory (shared `.prompt-language/` state). The second
invocation must parse the `memory:` section and load the previously
stored value. This is the only multi-invocation test in the suite.
The `.prompt-language/session-state.json` from step 1 must be cleaned
or the state from step 1 must not interfere. May need
`rm .prompt-language/session-state.json` between steps while keeping
`memory.json`.

---

### AG: Import anonymous flow file

**What it validates**: `import "file.flow"` inlines the imported file's
flow block into the parent flow.

**Classification**: Fast

**Setup**: Write a helper file `helpers.flow` with a simple flow block.

**DSL prompt**:

```
# helpers.flow (written to disk before test):
flow:
  let imported_value = "from-import"
  run: echo ${imported_value} > import-result.txt
```

**Main prompt**:

```
Goal: test import

import "helpers.flow"

flow:
  run: echo main-ran > main-marker.txt
```

**Assertion**: `import-result.txt` contains "from-import" AND
`main-marker.txt` exists.

**Oracle**:

- `import-result.txt` exists with content "from-import"
- `main-marker.txt` exists

**Testing challenges**: Requires writing a `.flow` file to the temp
directory before invoking `claude -p`. The import system restricts to
relative paths with `.flow`/`.prompt`/`.txt` extensions and validates
against path traversal. Must ensure the import is correctly resolved
relative to the working directory.

---

### AH: Import namespaced library with use

**What it validates**: `import "lib.flow" as mylib` registers a library,
and `use mylib.symbol()` expands the library's exported flow into the
current block.

**Classification**: Fast

**Setup**: Write `mylib.flow` with an export block.

**DSL prompt**:

```
# mylib.flow:
export flow greet(name="world"):
  run: echo hello-${name} > greet-result.txt
```

**Main prompt**:

```
Goal: test namespaced import

import "mylib.flow" as mylib

flow:
  use mylib.greet(name="smoke-test")
```

**Assertion**: `greet-result.txt` contains "hello-smoke-test".

**Oracle**:

- `greet-result.txt` exists
- Content includes "hello-smoke-test"

**Testing challenges**: Depends on the library parsing and export
resolution system. The `export flow` syntax and parameter substitution
must work correctly. If the library parser is broken, this test fails
for reasons not directly related to import resolution itself.

---

### AI: JSON capture with schema

**What it validates**: `let x = prompt "..." as json { schema }` captures
a structured JSON response from Claude, parses it, and expands top-level
fields into flat variables (`x.field`).

**Classification**: Fast (but depends on Claude response fidelity)

**DSL prompt**:

```
Goal: test JSON capture

flow:
  let info = prompt "Return a JSON object with fields name and age. Use name 'Alice' and age 30." as json {
    name: string
    age: number
  }
  run: echo ${info.name} > json-name.txt
  run: echo ${info.age} > json-age.txt
```

**Assertion**: `json-name.txt` contains "Alice" and `json-age.txt`
contains "30".

**Oracle**:

- `json-name.txt` exists and contains "Alice"
- `json-age.txt` exists and contains "30"
- The parent variable `info` contains valid JSON

**Testing challenges**: Claude must return well-formed JSON matching the
schema. The capture mechanism (tag-based extraction with retry) adds
complexity. Flaky if Claude returns unexpected JSON structure. The field
expansion (`info.name`, `info.age`) is the key behavior to validate.

---

### AJ: Grounded-by condition in if

**What it validates**: `if ask "question" grounded-by "command"` uses
the command's stdout as evidence for AI condition evaluation.

**Classification**: Slow (involves AI judgment)

**DSL prompt**:

```
Goal: test grounded-by if

flow:
  run: echo "status=healthy" > health.txt
  if ask "Is the service healthy?" grounded-by "cat health.txt"
    run: echo healthy-branch > grounded-result.txt
  else
    run: echo unhealthy-branch > grounded-result.txt
  end
```

**Assertion**: `grounded-result.txt` contains "healthy-branch".

**Oracle**:

- `grounded-result.txt` exists
- Content includes "healthy-branch" (not "unhealthy-branch")

**Testing challenges**: This relies on Claude's AI judgment interpreting
the command output ("status=healthy") as evidence for the "Is the
service healthy?" question. The AI must correctly reason that the
grounded-by evidence supports a "yes" answer. This is inherently
non-deterministic. The test can be made more robust by using very
obvious evidence strings.

---

### AK: Grounded-by condition in while loop

**What it validates**: `while ask "question" grounded-by "command" max N`
uses command evidence to decide whether to continue looping. The loop
re-evaluates the grounded-by command each iteration.

**Classification**: Slow (AI judgment + loop)

**DSL prompt**:

```
Goal: test grounded-by while

flow:
  run: echo "count=0" > counter.txt
  while ask "Is count less than 2?" grounded-by "cat counter.txt" max 5
    let c = run "cat counter.txt | grep -o '[0-9]*'"
    let next = run "node -e \"console.log(Number('${c}') + 1)\""
    run: echo "count=${next}" > counter.txt
  end
  run: echo loop-done > while-grounded.txt
```

**Assertion**: `while-grounded.txt` exists (loop completed).
`counter.txt` contains "count=2" or higher.

**Oracle**:

- `while-grounded.txt` exists
- `counter.txt` exists and the numeric value is >= 2

**Testing challenges**: Requires Claude to correctly interpret command
evidence across multiple iterations. Very high flakiness risk because
the AI must consistently answer "yes, count is less than 2" when
evidence shows count=0 or count=1, and "no" when count=2 or higher.
Consider marking as optional/experimental.

---

### AL: Continue in while loop

**What it validates**: `continue` inside a `while` loop skips the
remaining body and re-evaluates the loop condition.

**Classification**: Slow (loop with condition)

**DSL prompt**:

```
Goal: test continue in while

flow:
  let counter = "0"
  until ${counter} == "5" max 10
    let counter = run "node -e \"console.log(Number('${counter}') + 1)\""
    if ${counter} == "3"
      continue
    end
    run: echo iter-${counter} >> while-continue.txt
  end
  run: echo final-${counter} > while-continue-final.txt
```

**Assertion**: `while-continue.txt` does NOT contain "iter-3" but does
contain "iter-1", "iter-2", "iter-4", "iter-5" (or at least several).
`while-continue-final.txt` contains "final-5".

**Oracle**:

- `while-continue.txt` exists
- Does NOT contain "iter-3"
- Contains "iter-1" or "iter-2" (proves loop ran)
- Contains "iter-4" or "iter-5" (proves iteration continued past skip)
- `while-continue-final.txt` contains "final-5"

**Testing challenges**: Uses `until` loop with variable condition
(already covered by test Y). The `continue` inside the loop body
triggers `handleBodyExhaustion` through the continue path. The
test is meaningful because `continue` in while/until has different
semantics than in foreach (re-evaluates condition vs. next item).

---

### AM: Spawn basic child process

**What it validates**: The `spawn "name"` node launches a child
`claude -p` process that executes independently, and `await "name"`
blocks until the child completes.

**Classification**: Slow (requires child claude process)

**DSL prompt**:

```
Goal: test spawn and await

flow:
  spawn "worker"
    run: echo child-output > worker-result.txt
  end
  await "worker"
  run: echo parent-done > parent-marker.txt
```

**Assertion**: Both `worker-result.txt` and `parent-marker.txt` exist.
The child process created the file before the parent advanced past await.

**Oracle**:

- `worker-result.txt` exists with content "child-output"
- `parent-marker.txt` exists with content "parent-done"
- `.prompt-language-worker/` directory was created (child state dir)

**Testing challenges**: This is the first test that exercises child
process spawning. Requires that `claude -p` is available and that the
process spawner infrastructure works. The `await` node polls the child
state directory until the child completes. Flakiness risk from process
timing, and potential failures if the child claude process cannot start.
The timeout (120s default) should be sufficient for a simple `run:` node,
but this test should be marked as requiring special infrastructure.

---

### AN: Spawn inherits parent variables

**What it validates**: Parent variables are copied into the child
spawn's flow as `let` declarations, and `await` imports child variables
back with a name prefix.

**Classification**: Slow (requires child claude process)

**DSL prompt**:

```
Goal: test spawn variable passing

flow:
  let color = "purple"
  spawn "painter"
    run: echo ${color} > painted.txt
    let result = run "echo painted-${color}"
  end
  await "painter"
  run: echo ${painter.result} > spawn-var.txt
```

**Assertion**: `painted.txt` contains "purple". `spawn-var.txt` contains
"painted-purple" (the child's `result` variable imported with prefix).

**Oracle**:

- `painted.txt` contains "purple"
- `spawn-var.txt` contains "painted-purple"

**Testing challenges**: Same child-process challenges as AM. Additionally
tests variable import with the `childName.varName` convention. If the
child process completes successfully but variable import fails, the test
isolates the import mechanism.

---

### AO: Include file directive

**What it validates**: `include "path"` inlines file content into the
flow block (distinct from `import` which registers libraries).

**Classification**: Fast

**Setup**: Write a shared snippet file.

**DSL prompt**:

```
# shared.prompt (written to disk before test):
prompt: Create include-result.txt containing exactly "included-ok"
```

**Main prompt**:

```
Goal: test include directive

flow:
  include "shared.prompt"
```

**Assertion**: `include-result.txt` contains "included-ok".

**Oracle**:

- `include-result.txt` exists
- Content includes "included-ok"

**Testing challenges**: The include system resolves relative paths,
validates extensions (`.flow`, `.prompt`, `.txt`), and detects circular
includes. The test uses a `.prompt` extension which is in the allowlist.
Path traversal protection (`..`) should be tested separately at the
unit level.

---

## Coverage Strategy

### Priority tiers

**Tier 1 -- Implement immediately (high value, low risk):**

- AA: Continue skips iteration
- AD: Remember free-text
- AE: Remember key-value
- AG: Import anonymous flow
- AO: Include file directive

These test features with full parser and advancement support, use simple
file oracles, and have no external dependencies beyond `claude -p`.

**Tier 2 -- Implement next (medium risk):**

- AB: Continue with labeled loop
- AC: Labeled break exits outer
- AF: Memory section prefetch
- AH: Import namespaced library
- AI: JSON capture with schema
- AL: Continue in while loop

These combine multiple features or require multi-step setup. JSON capture
carries AI response fidelity risk.

**Tier 3 -- Implement with infrastructure (high risk):**

- AM: Spawn basic child process
- AN: Spawn inherits parent variables

These require child `claude -p` processes and carry timing/flakiness risk.

**Tier 4 -- Defer or mark experimental:**

- AJ: Grounded-by if condition
- AK: Grounded-by while loop

These depend on AI judgment of command evidence. Non-deterministic by nature.

### Features that CANNOT be smoke-tested currently

| Feature                    | Reason                                       | Mitigation                                  |
| -------------------------- | -------------------------------------------- | ------------------------------------------- |
| approve                    | No DSL parser support -- dead code           | Implement parser or test at unit level only |
| review                     | No DSL parser support -- dead code           | Implement parser or test at unit level only |
| race                       | Requires multi-child spawning + polling      | Unit tests exist; defer smoke test          |
| foreach_spawn              | Requires multi-child spawning                | Unit tests exist; defer smoke test          |
| send/receive (cross-agent) | Requires parent+child messaging files        | Could test with mock file setup             |
| spawn with condition       | Parser exists but needs child claude         | Defer to infrastructure tier                |
| spawn with model           | Parser exists but needs child claude + model | Defer to infrastructure tier                |

---

## Oracles

All tests use file-based oracles (checking files created in the temp
directory). Additional oracle types used:

| Oracle type            | Tests using it | How it works                                           |
| ---------------------- | -------------- | ------------------------------------------------------ |
| File content match     | All tests      | Read file, check string inclusion                      |
| File absence           | AA, AB, AC, AL | Verify certain content is NOT present                  |
| JSON structure         | AD, AE, AF     | Parse `.prompt-language/memory.json`, validate entries |
| Directory existence    | AM             | Check `.prompt-language-worker/` created               |
| Multi-file consistency | AN             | Cross-reference parent and child output files          |
| Two-invocation state   | AF             | Second `claude -p` reads state from first run          |

---

## Non-Functional Checks

| Concern                    | Test                            | Threshold                                        | Evidence                            |
| -------------------------- | ------------------------------- | ------------------------------------------------ | ----------------------------------- |
| Timeout safety             | All loop tests (AB, AC, AK, AL) | < 120s wall clock                                | Test runner timeout enforcement     |
| Memory leak (state growth) | AE (multiple remember writes)   | memory.json < 10KB                               | File size check                     |
| Path traversal prevention  | AG, AO                          | Reject `../` paths                               | Unit test coverage (not smoke)      |
| Circular import detection  | AG                              | No infinite loop                                 | Parser warning + completion         |
| Shell injection safety     | AD, AE                          | `${val}` in remember uses interpolate, not shell | Code review (not testable in smoke) |

---

## Testability Risks

1. **approve/review have no parser**: These node types cannot be exercised
   through DSL text. They exist as types and advancement logic only.
   Risk: dead code that may silently break without detection.

2. **Spawn tests depend on child claude availability**: Tests AM and AN
   require a working `claude` CLI that can be spawned as a child process.
   If the CLI has rate limits or authentication issues in CI, these tests
   will flake.

3. **Grounded-by tests are AI-dependent**: Tests AJ and AK rely on Claude
   correctly interpreting command output as evidence. There is no
   deterministic oracle for "did the AI correctly reason about this
   evidence?" Mitigation: use extremely obvious evidence strings.

4. **JSON capture depends on response format**: Test AI requires Claude
   to return well-formed JSON. The retry mechanism (up to 3 attempts)
   helps, but flakiness is inherent.

5. **Memory prefetch requires two invocations**: Test AF must run two
   `claude -p` sessions sequentially in the same directory. The second
   session must find the memory.json from the first session. State
   file cleanup between sessions is delicate.

6. **Import/include path resolution**: Tests AG, AH, AO depend on
   correct file path resolution relative to `cwd`. The smoke test
   framework uses temp directories, so paths must be relative.

---

## Assumptions

- The `claude` CLI is available and authenticated in the test environment.
- The plugin is installed (`npm run build && node bin/cli.mjs install`).
- Temp directories are writable and can contain `.prompt-language/` state.
- The smoke test timeout of 120 seconds is sufficient for all non-loop tests.
- Loop tests (AB, AC, AK, AL) may need the extended timeout used by
  existing slow tests.
- Child claude processes (AM, AN) will start within 30 seconds.

---

## Open Questions

1. Should `approve` and `review` parser support be implemented before
   or after writing smoke tests for them? Currently they are untestable
   at the smoke level.

2. Should `race` and `foreach_spawn` smoke tests be deferred entirely,
   or should a mock-based integration test be written instead?

3. Is there a way to test `send`/`receive` without actual child processes?
   The message store writes to files that could theoretically be
   pre-populated, but the receive node blocks (pauses) when no message
   is available.

4. Should grounded-by tests (AJ, AK) be included in the main suite or
   kept as optional/experimental due to AI non-determinism?

5. What is the maximum acceptable total run time for the full smoke
   suite? Adding 15 tests at ~30s each would add ~7.5 minutes.

---

## Recommended Next Skill

Hand off to **qa-automation-engineer** to implement tests AA through AO
in `scripts/eval/smoke-test.mjs`, starting with Tier 1 (AA, AD, AE, AG, AO).
