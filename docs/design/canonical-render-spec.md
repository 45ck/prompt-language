# Design: Canonical Render Spec

## Status

Accepted render contract for `prompt-language-0ovo.2.1`.

## Scope

This document defines the canonical contract for the full human-readable flow renderer implemented by `renderFlow(...)` in [`src/domain/render-flow.ts`](../../src/domain/render-flow.ts).

It does not define the compact heartbeat renderers:

- `renderFlowCompact(...)`
- `renderFlowSummary(...)`
- `renderCompletionSummary(...)`
- `renderTimingReport(...)`

Those outputs are intentionally separate surfaces with their own constraints. This spec is only for the multiline primary render shown to the host/agent loop.

## Purpose

The renderer is a domain-owned visualization of:

- the flow goal and overall status
- declarations
- executable structure
- execution position and completion state
- gate state
- visible variables
- warnings
- active capture instructions

The contract here is meant to be closure-quality for implementation and tests. If future work changes formatting, tests should be updated only alongside an intentional edit to this spec.

## Canonical Output Shape

The output is a single string built by joining logical lines with `\n`.

Guarantees:

- Line separator is newline (`\n`).
- The render does not append an extra trailing newline after the final line.
- Section order is fixed.
- Within each section, item order is deterministic relative to the input state.

Canonical top-level order:

1. Header line
2. One blank line
3. Optional declaration block section
4. Executable node render section
5. Optional `done when:` section
6. Optional `Variables:` section
7. Optional `Warnings:` section
8. Optional capture reminder line

## Header Contract

The first line is always:

```text
[prompt-language] Flow: <goal> | Status: <status>
```

If `state.status === "failed"` and `state.failureReason` is present, append:

```text
 | [FLOW FAILED: <failureReason>]
```

Examples:

```text
[prompt-language] Flow: fix auth tests | Status: active
[prompt-language] Flow: deploy release | Status: failed | [FLOW FAILED: timeout]
```

The header is always followed by exactly one blank line.

## Declaration Section

Declarations render before executable nodes.

Order guarantees:

- Rubrics render before judges.
- Rubrics preserve `spec.rubrics` order.
- Judges preserve `spec.judges` order.
- Declaration lines within a rubric or judge preserve source order.

Formatting guarantees:

- Block header indentation is two spaces.
- Declaration body indentation is four spaces.
- Each block closes with `  end`.
- A blank line separates adjacent declaration blocks.
- If at least one declaration exists, one additional blank line separates the declaration section from executable nodes.

Canonical forms:

```text
  rubric "<name>"
    <line>
  end

  judge "<name>"
    <line>
  end
```

## Executable Node Order

Top-level nodes render in `state.flowSpec.nodes` order.

Nested order guarantees:

- Loop, spawn, review, and foreach-like bodies render in body-array order.
- `if` renders `thenBranch` first, then `elseBranch`.
- `try` renders `body`, then `catchBody`, then `finallyBody`.
- `race` renders children in declared order, then each child body in declared order.

No renderer-side sorting is allowed for executable nodes.

## Line Prefix Contract

Each rendered node line begins with one of three two-character prefixes:

- `"> "` for the current node and ancestor nodes on the current path
- `"~ "` for completed nodes that are strictly before the current sibling at the same nesting frame
- `"  "` for future, inactive, or unresolved nodes

Additional guarantees:

- Only the exact current node gets the suffix `  <-- current`.
- Ancestor nodes never get the current suffix.
- Future nodes never receive the completed prefix.

This is the current execution-position contract used by render tests.

## Indentation Contract

Indentation inside executable structure uses two spaces per nesting level.

Examples:

- top-level node body text begins after the two-character prefix
- one nested level adds `  `
- two nested levels add `    `

Structural keywords such as `else`, `catch ...`, `finally`, and `end` are aligned to the indentation level of the owning block and are currently emitted with a plain `"  "` leading prefix rather than inheriting execution-state markers.

That means block-control lines are structural, not state-annotated.

## Node Rendering Contract

### Prompt

Canonical form:

```text
<prefix><indent>prompt: <text><timing?><current?>
```

### Run

Canonical form:

```text
<prefix><indent>run: <command><timeout?><timing?><current?>
```

Timeout formatting:

- Render only when `timeoutMs` is set.
- Format as ` [timeout <seconds>s]`.
- Seconds are rendered from `timeoutMs / 1000` with no extra decimal formatting in the current implementation.

### While / Until / Retry / Review / Foreach / Foreach-Spawn / Spawn

These render as block headers followed by child lines and a closing `end`.

Loop/review header guarantees:

- `while` and `until` include `max <iterations>`
- `retry` includes `max <attempts>`
- `review` includes `max <rounds>`
- optional labels render as `<label>: ` before the keyword
- optional ask retries render as ` max-retries <n>`
- optional timeout seconds render as ` timeout <seconds>`

Loop/review body contract:

- header line
- zero or more rendered child lines
- closing line: `  <indent>end`

Foreach guarantees:

- Header form: `foreach <variableName> in <listExpression>`
- If the foreach variable currently exists in `state.variables`, append `  [<variableName>=<value>]` to the header

Spawn guarantees:

- Header begins `spawn "<name>"`
- When child state exists, append `  [<child.status>]`

### If

Canonical block order:

```text
if ...
  <then children>
else
  <else children>
end
```

Guarantees:

- `else` renders only when `elseBranch.length > 0`
- `else` is omitted entirely for empty else branches
- `grounded-by "<value>"` renders only when present
- ask conditions are normalized to `ask: "<question>"`

### Try

Canonical block order:

```text
try
  <body children>
catch <condition>
  <catch children>
finally
  <finally children>
end
```

Guarantees:

- `catch <condition>` renders only when `catchBody.length > 0`
- `finally` renders only when `finallyBody.length > 0`
- If both exist, `catch` always precedes `finally`

### Let

Canonical form:

```text
<prefix><indent>let <variableName> <operator> <sourceText><annotation?><timing?><current?>
```

Operator guarantees:

- `=` for non-append lets
- `+=` for append lets

Source guarantees:

- literal: `"value"`
- prompt: `prompt "<text>"`
- prompt_json: `prompt "<text>" as json { <schemaPreview> }`
- run: `run "<command>"`
- memory: `memory "<key>"`
- empty_list: `[]`

Prompt JSON truncation guarantee:

- Schema previews longer than 40 characters are truncated to the first 40 characters plus `...`

Let annotation precedence:

1. If current progress status is `awaiting_capture` and `captureFailureReason` exists:
   `  [capture failed: <reason> — retry <iteration>/<maxIterations>]`
2. Else if current progress status is `awaiting_capture`:
   `  [awaiting response...]`
3. Else if `state.variables[variableName]` is defined:
   `  [= <value>]`
4. Else no annotation

Important boundary:

- The active-capture annotation is node-local.
- A stale `awaiting_capture` state on a non-current `let` must not produce the global capture reminder.

### Break / Continue / Await / Approve / Remember / Send / Receive / Race

Current canonical forms:

```text
break
continue
await all
await "<target>"
approve "<message>" [pending|approved|rejected]
remember "<text>"
remember key="<key>" value="<value>"
send "<target>" "<message>"
receive <variableName>
race
```

Additional guarantees:

- `approve` timeout renders as minutes: ` timeout <minutes>m`
- `receive` may include ` from "<source>"`
- `receive` may append `[waiting]` or `[received]`
- `race` may append `  [winner: <value>]`

## Timing Annotation Contract

Timing annotations are suffixes appended to node lines.

Guarantees:

- Render only when both `startedAt` and `completedAt` exist for that node
- Render only when elapsed time is strictly greater than 0.5 seconds
- Format is ` [<seconds.toFixed(1)>s]`

Examples:

- ` [1.8s]`
- ` [4.2s]`

## Progress Annotation Contract

Loop-like nodes use a visual bar:

```text
 [<bar>] <iteration>/<maxIterations>
```

Guarantees:

- Bar width is exactly 5 characters
- Filled count is `Math.min(5, Math.round((done / total) * 5))`
- Filled cells use `#`
- Empty cells use `-`

Examples:

- `[###--] 2/4`
- `[##---] 2/5`

## Gate Section Contract

If and only if `completionGates.length > 0`, append a blank line and then:

```text
done when:
  <predicate>  [pass|fail|pending]
```

Ordering guarantees:

- Gates preserve `state.flowSpec.completionGates` order
- No sorting is allowed

Formatting guarantees:

- The section label is exactly `done when:`
- Each gate line is indented by two spaces
- There are two spaces between the predicate text and the opening `[` of the status tag

Failure diagnostic guarantees:

- If gate result is `false` and a diagnostic `command` exists, format as:
  `  <predicate>  [fail — <detail>]`
- `<detail>` joins available parts with `: `
- `exitCode` renders as `exit <n>`
- `command` renders as `"<command>"`
- `stderr` uses only the first 3 non-blank lines
- each stderr line is truncated to 80 characters before joining with `|`
- if stderr is empty and stdout exists, use the first 200 characters of stdout
- successful gates do not render diagnostic detail

## Variables Section Contract

If and only if at least one visible variable remains after filtering, append a blank line and then:

```text
Variables:
  <key> = <display>
```

Variable order guarantee:

- Variables render in the insertion order returned by `Object.entries(state.variables)`
- The renderer does not sort variable names alphabetically
- Hidden variables are filtered out in-place without reordering the remaining entries

Hidden-variable guarantees:

- Always hide:
  - `last_exit_code`
  - `last_stdout`
  - `last_stderr`
- Always hide keys matching `_(index|length)$`
- Hide `command_failed` and `command_succeeded` unless `String(variables["command_failed"]) === "true"`

Display guarantees:

- Array-like string values that parse as JSON arrays render as summaries:
  - `[<count> items: "<a>", "<b>", "<c>"]`
  - for more than 3 items: `[<count> items: "<a>", "<b>", "<c>", ...]`
- Non-array JSON strings are rendered as-is
- Non-JSON strings are rendered as-is
- Values longer than 80 characters render as the first 77 characters plus `...`

Examples:

```text
Variables:
  myList = [3 items: "a", "b", "c"]
  data = [5 items: "a", "b", "c", ...]
  big = xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx...
```

## Warnings Section Contract

If and only if `state.warnings.length > 0`, append a blank line and then:

```text
Warnings:
  [!] <warning>
```

Ordering guarantees:

- Warnings preserve `state.warnings` order
- No sorting or deduplication is performed by the renderer

## Capture Reminder Contract

If and only if the current node resolves to a `let` node whose node progress status is exactly `awaiting_capture`, append:

```text
[Capture active: write response to .prompt-language/vars/<variableName> using Write tool]
```

Formatting guarantees:

- The capture reminder is preceded by exactly one blank line
- The reminder is the final line in the render
- The reminder must not appear for:
  - non-`let` current nodes
  - `let` nodes whose progress is not `awaiting_capture`
  - stale `awaiting_capture` progress on non-current nodes

## Blank-Line Contract

Blank lines are structural and should be treated as part of the contract.

Current guarantees:

- One blank line always follows the header
- One blank line separates the declaration section from executable nodes when declarations exist
- One blank line precedes each optional trailing section:
  - `done when:`
  - `Variables:`
  - `Warnings:`
  - capture reminder
- No blank lines are inserted between ordinary executable siblings unless the node text itself contains embedded newlines

## Embedded Newline Behavior

The renderer does not escape variable values before interpolation into let annotations or the variables section.

Current implication:

- if a visible value contains `\n`, the rendered output contains actual line breaks inside that annotation or variable display

This is current behavior, not a cleanliness guarantee. Tests already depend on raw interpolation for some captured values.

## Determinism Rules

For a fixed `SessionState`, `renderFlow(...)` must be deterministic.

That means:

- no time-of-render timestamps are injected
- no randomized ordering is permitted
- section omission depends only on state presence and filtering rules
- visibility rules are state-derived, not host-derived

## Non-Goals

This contract does not require:

- localization
- ANSI color
- column alignment beyond the explicit fixed strings above
- width-aware wrapping
- escaping or redacting user-provided values
- stable ordering across differently-constructed but semantically equivalent JS objects

The current contract is deterministic relative to actual object insertion order, not to a sorted semantic model.

## Current Test Mapping

The implementation already has strong test anchors in [`src/domain/render-flow.test.ts`](../../src/domain/render-flow.test.ts). The most important contract areas already covered are:

- header and failed-header suffix
- declaration-before-node ordering
- current, ancestor, completed, and future prefix behavior
- loop progress bars
- `if` / `else` omission and presence
- `try` / `catch` / `finally` ordering
- `let` source formatting and capture-state annotations
- variable hiding rules
- variable truncation at 80 characters
- JSON-array summary formatting
- gate diagnostics with stderr and stdout fallback
- warnings rendering
- capture reminder emission only for the current awaiting-capture let node

Likely future tests that should exist if formatting changes are expected:

- exact top-level section ordering with all optional sections present
- exact blank-line count between each section
- explicit insertion-order variable rendering
- explicit confirmation that structural lines (`else`, `catch`, `finally`, `end`) remain unprefixed
- prompt_json schema truncation boundary at exactly 40 characters

## Change Rule

Any change to the canonical multiline renderer should be treated as a contract change when it affects:

- line order
- section presence rules
- variable visibility
- truncation thresholds
- indentation
- state markers
- capture reminder emission

Such changes should update:

- this spec
- implementation
- tests

in the same change set.
