# Design: Prompt Output Parsing

## Problem

Today, `let x = prompt "text"` stores the **prompt text itself** as the variable value (the instruction sent to Claude), not Claude's **response**. There is no mechanism to capture, parse, or use structured data from Claude's replies. This limits the DSL to one-way communication: the plugin tells Claude what to do, but cannot use what Claude says back.

Users need patterns like:

```
let tasks = prompt "List failing tests as JSON"
foreach task in ${tasks}
  prompt: Fix ${task}
end
```

This design specifies how the plugin captures and parses structured output from prompt responses.

## Current Architecture

### How `let x = prompt` works today

In `src/domain/flow-node.ts`, `LetSource` has three variants:

```typescript
export type LetSource =
  | { readonly type: 'prompt'; readonly text: string }
  | { readonly type: 'run'; readonly command: string }
  | { readonly type: 'literal'; readonly value: string };
```

In `src/application/inject-context.ts`, the `autoAdvanceNodes()` function handles `let` nodes:

```typescript
case 'let': {
  let value: string;
  switch (node.source.type) {
    case 'prompt':
      value = node.source.text;  // Stores the prompt TEXT, not the response
      break;
    case 'run':
      // Executes command, stores stdout
      break;
    case 'literal':
      value = node.source.value;
      break;
  }
  current = updateVariable(current, node.variableName, value);
  // ... advance
}
```

### The fundamental constraint

The plugin runs inside Claude's hook system. It intercepts prompts **before** Claude processes them and receives control again on the **next** user prompt submission. The plugin never directly observes Claude's response text. This is the core challenge.

## Design

### Phase 1: Capture via instruction + convention (no architecture changes)

The simplest approach requires zero changes to the runtime. Instead of parsing Claude's actual response, the plugin instructs Claude to write its structured output to a file, then reads it.

```
let tasks = run "cat .prompt-language/output.json"
prompt: List failing tests. Write them as JSON array to .prompt-language/output.json
```

This works today but is verbose and fragile. It serves as the baseline.

### Phase 2: Response capture via deferred variables

Introduce a new LetSource type that marks a variable as "awaiting Claude's response." The variable is not resolved during `autoAdvanceNodes()` — instead, the prompt is emitted to Claude, and the next time control returns to the plugin, it reads Claude's response from the user prompt submission context.

#### 2a. New LetSource variant

Add a fourth LetSource type:

```typescript
export type LetSource =
  | { readonly type: 'prompt'; readonly text: string }
  | { readonly type: 'run'; readonly command: string }
  | { readonly type: 'literal'; readonly value: string }
  | { readonly type: 'prompt_capture'; readonly text: string; readonly format?: 'json' | 'text' };
```

The `prompt_capture` source tells the runtime: "emit this prompt to Claude, then capture the response on the next hook invocation."

#### 2b. DSL syntax

```
let result = capture prompt "Summarize the codebase"
let tasks = capture prompt "List failing tests as JSON" as json
```

The `capture` keyword before `prompt` signals that this is a deferred assignment. The optional `as json` suffix requests JSON extraction.

Parser changes in `src/application/parse-flow.ts` (in `parseLetLine`):

```typescript
if (rhsLower.startsWith('capture prompt ')) {
  const rest = rhs.slice('capture prompt '.length).trim();
  const jsonSuffix = / as json$/i;
  const format = jsonSuffix.test(rest) ? 'json' : 'text';
  const text = stripQuotes(rest.replace(jsonSuffix, '').trim());
  source = { type: 'prompt_capture', text, format };
}
```

#### 2c. Advancement logic

In `autoAdvanceNodes()`, when a `prompt_capture` let node is encountered:

1. Store the variable name in session state as `pendingCapture: { variableName, format }`.
2. Emit the prompt text (like a regular prompt node — return `capturedPrompt`).
3. Do **not** advance past this node yet.

On the next `injectContext` call:

1. Check if `state.pendingCapture` is set.
2. The user's prompt (which is Claude's continued output in the agent loop) contains Claude's response.
3. Extract the value based on `format`:
   - `text`: use the full response as-is.
   - `json`: extract the JSON payload (see extraction logic below).
4. Store the extracted value in `state.variables[pendingCapture.variableName]`.
5. Clear `pendingCapture`.
6. Advance past the let node.
7. Continue normal `autoAdvanceNodes()`.

#### 2d. SessionState extension

Add an optional field to `SessionState`:

```typescript
export interface PendingCapture {
  readonly variableName: string;
  readonly format: 'json' | 'text';
}

export interface SessionState {
  // ... existing fields
  readonly pendingCapture?: PendingCapture;
}
```

This is minimal and maintains immutability.

### Phase 3: JSON extraction logic

When `format` is `json`, the plugin must extract JSON from Claude's free-form response. Claude typically wraps JSON in a fenced code block:

```
Here are the failing tests:

\`\`\`json
["test-auth", "test-login", "test-signup"]
\`\`\`
```

#### Extraction strategy (ordered by priority)

1. **Fenced code block**: Match ` ```json\n...\n``` ` or ` ```\n...\n``` `. Extract the content between fences.
2. **Raw JSON detection**: If no fences, scan for the first `[` or `{` and find its matching closer. Use a simple bracket-depth counter (not a full JSON parser) to find the boundary.
3. **Entire response**: If neither works, treat the full response as the value.

#### Implementation (pure domain function)

Create `src/domain/extract-json.ts`:

````typescript
/**
 * extractJson -- Extract JSON from free-form text.
 *
 * Tries fenced code blocks first, then raw JSON detection.
 * Returns the extracted string (unparsed) or null.
 */

const FENCED_JSON_RE = /```(?:json)?\s*\n([\s\S]*?)\n\s*```/;

export function extractJson(text: string): string | null {
  // Strategy 1: fenced code block
  const fenceMatch = FENCED_JSON_RE.exec(text);
  if (fenceMatch?.[1]) {
    const candidate = fenceMatch[1].trim();
    if (isValidJson(candidate)) return candidate;
  }

  // Strategy 2: raw JSON detection
  const rawMatch = findRawJson(text);
  if (rawMatch !== null) return rawMatch;

  return null;
}

function isValidJson(text: string): boolean {
  try {
    JSON.parse(text);
    return true;
  } catch {
    return false;
  }
}

function findRawJson(text: string): string | null {
  const openers: Record<string, string> = { '{': '}', '[': ']' };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    const closer = openers[ch];
    if (!closer) continue;

    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let j = i; j < text.length; j++) {
      const c = text[j]!;
      if (escaped) {
        escaped = false;
        continue;
      }
      if (c === '\\' && inString) {
        escaped = true;
        continue;
      }
      if (c === '"') {
        inString = !inString;
        continue;
      }
      if (inString) continue;
      if (c === ch) depth++;
      if (c === closer) depth--;
      if (depth === 0) {
        const candidate = text.slice(i, j + 1);
        if (isValidJson(candidate)) return candidate;
        break;
      }
    }
  }
  return null;
}
````

This is a pure domain function with zero external dependencies, consistent with the architecture rules.

#### Validation

The plugin does **not** validate against a user-defined schema. JSON is stored as a string in the variables map (which uses `string | number | boolean`). If the extracted JSON is valid, it is stored as-is. If extraction fails:

1. Store the raw response text as the variable value.
2. Add a warning to `state.warnings`: `"Failed to extract JSON from response for variable '${name}'"`.

This is a soft failure — the flow continues, and the user can inspect the raw text.

### Phase 4: Variable type considerations

Today, `variables` holds `Record<string, string | number | boolean>`. Storing a JSON string (e.g., `'["a","b","c"]'`) fits within `string`. When `foreach` (see `foreach-construct.md`) needs to iterate, it will `JSON.parse()` the string at iteration time.

There is no need to change the variable type system. JSON stays serialized as a string in state and is parsed on demand by consumers.

## Rendering

In `src/domain/render-flow.ts`, `prompt_capture` nodes render as:

```
  let tasks = capture prompt "List failing tests"  [= ["test-auth","test-login"]]
```

The `[= ...]` annotation shows the resolved value after capture (same pattern as existing let nodes).

## File changes summary

| File                                | Change                                                                      |
| ----------------------------------- | --------------------------------------------------------------------------- |
| `src/domain/flow-node.ts`           | Add `prompt_capture` to `LetSource` union                                   |
| `src/domain/extract-json.ts`        | New file: pure JSON extraction                                              |
| `src/domain/session-state.ts`       | Add optional `pendingCapture` to `SessionState`                             |
| `src/domain/render-flow.ts`         | Render `prompt_capture` source type                                         |
| `src/application/parse-flow.ts`     | Parse `capture prompt` syntax in `parseLetLine`                             |
| `src/application/inject-context.ts` | Handle `prompt_capture` in `autoAdvanceNodes`, capture response on re-entry |

## Interaction with existing features

- **Variable interpolation**: Works unchanged. `${tasks}` interpolates the stored string.
- **Shell interpolation**: `shellInterpolate()` will single-quote the JSON string, which is correct for passing to shell commands.
- **Control flow conditions**: `evaluateCondition()` treats non-empty strings as truthy, so captured variables work in `if`/`while` conditions.
- **Gate evaluation**: No interaction. Capture is orthogonal to gates.

## Risks and mitigations

| Risk                                                | Mitigation                                                                 |
| --------------------------------------------------- | -------------------------------------------------------------------------- |
| Claude's response doesn't contain JSON              | Soft failure: store raw text + warning                                     |
| Response too large                                  | Truncate at `MAX_OUTPUT_LENGTH` (2000 chars), same as `run` output         |
| `pendingCapture` left dangling if flow is cancelled | Clear on `markCancelled`/`markFailed`                                      |
| Multiple captures in sequence                       | Each capture blocks advancement until resolved; only one pending at a time |

## Testing strategy

1. **Unit tests** for `extractJson()`: fenced blocks, raw JSON, mixed text, malformed JSON, nested objects.
2. **Unit tests** for `parseLetLine()`: `capture prompt` syntax, `as json` suffix.
3. **Integration tests** in `inject-context.test.ts`: verify `prompt_capture` emits prompt and defers, then captures on re-entry.
4. **Smoke test**: end-to-end test where Claude writes JSON and the next prompt uses it.

## Alternative considered: Hook-based response capture

Claude Code's hook system includes `PostToolUse` hooks that fire after tool execution. In theory, the plugin could register a hook that captures Claude's text output. However:

- The hook API does not expose Claude's generated text, only tool inputs/outputs.
- This would create a dependency on undocumented hook behavior.
- The deferred-variable approach is simpler and works within the existing `UserPromptSubmit` hook model.

The deferred-variable design was chosen for its simplicity and compatibility.
