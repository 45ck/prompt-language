# SUPERSEDED

> This design has been superseded by `docs/design/foreach.md`, which is the canonical foreach design.
> Key difference: the canonical design uses `nodeProgress` for iteration tracking (consistent with while/until/retry)
> and `${varName}_index` / `${varName}_length` variables (namespaced per loop variable for safe nesting).

---

# Design: foreach Construct

## Problem

The DSL has `while`, `until`, and `retry` for looping, but none of them iterate over a collection. Users need to process lists of items — files, test names, tasks — with a dedicated construct:

```
let tasks = capture prompt "List failing tests as JSON array" as json
foreach task in ${tasks}
  prompt: Fix the test: ${task}
  run: npm test -- --filter ${task}
end
```

Without `foreach`, users must rely on Claude to mentally loop, losing the structured flow guarantees the DSL provides.

## Syntax

```
foreach <variable> in <expression>
  <body>
end
```

Where:

- `<variable>` is the loop variable name, bound to each element per iteration.
- `<expression>` is one of:
  - A variable reference: `${items}` (resolved at runtime, must contain JSON array).
  - A literal JSON array: `["a", "b", "c"]`.
  - A comma-separated list: `"auth, login, signup"` (split by commas).
- `<body>` is one or more flow nodes (prompt, run, let, nested control flow).

### Examples

```
# Iterate over a JSON array stored in a variable
foreach file in ${changed_files}
  prompt: Review ${file} for security issues
end

# Iterate over a literal list
foreach service in ["api", "web", "worker"]
  run: docker restart ${service}
end

# Iterate over comma-separated values
foreach module in "auth, payments, notifications"
  prompt: Write tests for the ${module} module
  run: npm test -- --filter ${module}
end
```

### Max iterations

Like `while` and `until`, `foreach` supports an optional `max N` to cap the number of iterations processed:

```
foreach task in ${tasks} max 10
  prompt: Fix ${task}
end
```

If omitted, the default maximum is 50 (higher than `while`/`until`'s default of 5, since foreach operates over a finite collection). This prevents unbounded iteration if a captured variable contains a very large array.

## FlowNode type

### New node in `src/domain/flow-node.ts`

```typescript
export interface ForEachNode extends BaseNode {
  readonly kind: 'foreach';
  readonly variableName: string;
  readonly listExpression: string;
  readonly maxIterations: number;
  readonly body: readonly FlowNode[];
}
```

Update the `FlowNodeKind` union:

```typescript
export type FlowNodeKind =
  | 'while'
  | 'until'
  | 'retry'
  | 'if'
  | 'prompt'
  | 'run'
  | 'try'
  | 'let'
  | 'foreach';
```

Update the `FlowNode` discriminated union:

```typescript
export type FlowNode =
  | WhileNode
  | UntilNode
  | RetryNode
  | IfNode
  | PromptNode
  | RunNode
  | TryNode
  | LetNode
  | ForEachNode;
```

### Factory function

```typescript
const DEFAULT_FOREACH_MAX = 50;

export function createForEachNode(
  id: string,
  variableName: string,
  listExpression: string,
  body: readonly FlowNode[],
  maxIterations?: number,
): ForEachNode {
  return {
    kind: 'foreach',
    id,
    variableName,
    listExpression,
    maxIterations: maxIterations ?? DEFAULT_FOREACH_MAX,
    body,
  };
}
```

## List resolution

### Pure domain function: `src/domain/resolve-list.ts`

```typescript
/**
 * resolveList -- Resolve a list expression to an array of strings.
 *
 * Supports three formats:
 * 1. JSON array: '["a","b","c"]'
 * 2. Comma-separated: 'a, b, c'
 * 3. Newline-separated: 'a\nb\nc'
 */
export function resolveList(expression: string): string[] {
  const trimmed = expression.trim();

  // Try JSON array first
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map(String);
      }
    } catch {
      // Fall through to other strategies
    }
  }

  // Comma-separated (only if commas present)
  if (trimmed.includes(',')) {
    return trimmed
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }

  // Newline-separated (only if newlines present)
  if (trimmed.includes('\n')) {
    return trimmed
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
  }

  // Single item
  return trimmed ? [trimmed] : [];
}
```

This is a pure function with zero dependencies, following domain layer rules.

### Resolution order in `autoAdvanceNodes`

When the runtime encounters a `foreach` node:

1. Interpolate `listExpression` using `interpolate()` to resolve `${varName}` references.
2. Pass the interpolated string to `resolveList()`.
3. If the result is empty, skip the body (advance past the foreach).
4. Otherwise, enter the body with the loop variable bound to the first element.

## Advancement logic

### State tracking

`foreach` uses the existing `NodeProgress` system with an additional field to track the resolved list. Two options:

**Option A: Store list in variables (chosen)**

When entering a `foreach`, store the resolved list as a JSON string in a well-known variable (`__foreach_<nodeId>_list`), and the current index as `__foreach_<nodeId>_index`. The loop variable itself (`task`, `file`, etc.) is set to the current element.

This keeps `SessionState` unchanged and uses the existing variables mechanism.

**Option B: Extend NodeProgress**

Add a `list` field to `NodeProgress`. Rejected because it changes the state schema for a single node type and NodeProgress is currently generic across all loop types.

### Advancement steps in `autoAdvanceNodes`

```typescript
case 'foreach': {
  const listKey = `__foreach_${node.id}_list`;
  const indexKey = `__foreach_${node.id}_index`;

  // First entry: resolve the list
  if (!(listKey in current.variables)) {
    const interpolated = interpolate(node.listExpression, current.variables);
    const items = resolveList(interpolated);

    if (items.length === 0) {
      // Empty list: skip entirely
      current = advanceNode(current, advancePath(current.currentNodePath));
      advances += 1;
      break;
    }

    // Store list and initialize index
    current = updateVariable(current, listKey, JSON.stringify(items));
    current = updateVariable(current, indexKey, 0);
    current = updateVariable(current, node.variableName, items[0]);
    current = updateNodeProgress(current, node.id, {
      iteration: 1,
      maxIterations: Math.min(items.length, node.maxIterations),
      status: 'running',
    });
    current = advanceNode(current, [...current.currentNodePath, 0]);
    advances += 1;
    break;
  }

  // Should not reach here during normal flow — body exhaustion handles re-entry
  break;
}
```

### Body exhaustion in `handleBodyExhaustion`

```typescript
case 'foreach': {
  const listKey = `__foreach_${parentNode.id}_list`;
  const indexKey = `__foreach_${parentNode.id}_index`;
  const items: string[] = JSON.parse(String(current.variables[listKey] ?? '[]'));
  const currentIndex = Number(current.variables[indexKey] ?? 0);
  const nextIndex = currentIndex + 1;

  if (nextIndex < items.length && nextIndex < parentNode.maxIterations) {
    // Advance to next element
    current = updateVariable(current, indexKey, nextIndex);
    current = updateVariable(current, parentNode.variableName, items[nextIndex]);
    current = updateNodeProgress(current, parentNode.id, {
      iteration: nextIndex + 1,
      maxIterations: Math.min(items.length, parentNode.maxIterations),
      status: 'running',
    });
    current = advanceNode(current, [...parentPath, 0]);
  } else {
    // List exhausted or max reached
    current = updateNodeProgress(current, parentNode.id, {
      iteration: Math.min(nextIndex, items.length),
      maxIterations: Math.min(items.length, parentNode.maxIterations),
      status: 'completed',
    });
    current = advanceNode(current, advancePath(parentPath));
  }
  return current;
}
```

### Built-in iteration variables

Inside a `foreach` body, these variables are automatically available:

| Variable         | Description                            |
| ---------------- | -------------------------------------- |
| `<variableName>` | The current element (user-chosen name) |
| `foreach_index`  | Zero-based index of current element    |
| `foreach_length` | Total number of elements in the list   |

These are set/updated at each iteration entry point, overwriting any previous values. They use simple names (not namespaced) for ergonomics. Nested `foreach` loops will shadow the outer values, which is acceptable — users should use different variable names for nested loops.

## Parser integration

### In `src/application/parse-flow.ts`

Add `foreach` to the `parseLine` function:

```typescript
if (lower.startsWith('foreach ')) {
  return parseForEachLine(ctx, trimmed, indent);
}
```

Add parsing function:

```typescript
function parseForEachLine(ctx: ParseContext, line: string, baseIndent: number): FlowNode {
  // foreach <var> in <expr> [max <N>]
  const match = /^foreach\s+(\w+)\s+in\s+(.+?)(?:\s+max\s+(\d+))?$/i.exec(line);
  if (!match?.[1] || !match[2]) {
    ctx.warnings.push(`Invalid foreach syntax: "${line}"`);
    return createPromptNode(nextId(ctx), line);
  }
  const variableName = match[1];
  const listExpression = stripQuotes(match[2].trim());
  const max = match[3] ? parseInt(match[3], 10) : undefined;
  const body = parseBlock(ctx, baseIndent);
  consumeEnd(ctx);
  return createForEachNode(nextId(ctx), variableName, listExpression, body, max);
}
```

Note: `consumeEnd(ctx)` is called explicitly (like `parseIfLine` and `parseTryBlock`) because `parseBlock` stops at `end` but does not consume it.

### Node resolution

In `resolveCurrentNode` (in `inject-context.ts`), add `foreach`:

```typescript
case 'foreach':
  return resolveCurrentNode(node.body, rest);
```

This follows the same pattern as `while`, `until`, and `retry`.

## Rendering

### In `src/domain/render-flow.ts`

Add a case in `renderNode`:

```typescript
case 'foreach':
  return renderForEachNode(node, state, path, indentLevel, prefix, suffix);
```

```typescript
function renderForEachNode(
  node: ForEachNode,
  state: SessionState,
  path: readonly number[],
  indentLevel: number,
  prefix: string,
  suffix: string,
): string[] {
  const indent = '  '.repeat(indentLevel);
  const progress = progressAnnotation(state, node.id);
  const currentVal = state.variables[node.variableName];
  const valAnnotation =
    currentVal !== undefined ? ` [${node.variableName}=${String(currentVal)}]` : '';
  const lines: string[] = [
    `${prefix}${indent}foreach ${node.variableName} in ${node.listExpression}${progress}${valAnnotation}${suffix}`,
  ];

  for (let i = 0; i < node.body.length; i++) {
    const child = node.body[i]!;
    lines.push(...renderNode(child, state, [...path, i], indentLevel + 1));
  }

  lines.push(`  ${indent}end`);
  return lines;
}
```

Example rendered output:

```
> foreach task in ${tasks} [2/3] [task=test-login]
>   prompt: Fix the test: ${task}  <-- current
    run: npm test -- --filter ${task}
  end
```

## Dynamic list mutation

The list is **not** mutable during iteration. It is resolved once when the `foreach` node is first entered (snapshot semantics). If the source variable changes during iteration, the foreach continues with the original list.

Rationale:

- Mutable lists create complex state management and potential infinite loops.
- Snapshot semantics are predictable and match how `for...of` works in JavaScript (iterating a copy).
- Users who need dynamic behavior can use `while` with manual index management.

## Context isolation

Each iteration shares the same variable scope. Variables set in one iteration persist into the next. This is consistent with how `while`/`until`/`retry` work — there is no scope isolation between iterations.

If the user wants isolated context per iteration, they can use unique variable names with the index:

```
foreach task in ${tasks}
  let result_${foreach_index} = run "npm test -- --filter ${task}"
end
```

Full scope isolation (fresh variable state per iteration) is deferred as a future enhancement since the existing loop constructs do not have this concept.

## Interaction with existing constructs

### Nesting

`foreach` can be nested inside `while`, `until`, `retry`, `if`, `try`, and vice versa. It can also be nested inside another `foreach` (with a different variable name).

```
foreach service in ["api", "web"]
  retry max 3
    run: deploy ${service}
  end
end
```

### try/catch

If a `run` node inside a `foreach` body fails and is within a `try`, the existing `findTryCatchJump` mechanism handles the jump to catch. The foreach iteration is not automatically advanced on failure.

### Variable interpolation

`${variableName}` in prompt and run text resolves to the current element, using the existing `interpolate()` / `shellInterpolate()` functions. No changes needed.

### Gate evaluation

`foreach` has no interaction with `done when:` gates. Gates are evaluated at flow completion, not per-iteration.

## File changes summary

| File                                | Change                                                                            |
| ----------------------------------- | --------------------------------------------------------------------------------- |
| `src/domain/flow-node.ts`           | Add `ForEachNode`, `createForEachNode`, update unions                             |
| `src/domain/resolve-list.ts`        | New file: pure list resolution from JSON/CSV/newline                              |
| `src/domain/render-flow.ts`         | Add `renderForEachNode`, handle in `renderNode` switch                            |
| `src/application/parse-flow.ts`     | Add `parseForEachLine`, register in `parseLine`                                   |
| `src/application/inject-context.ts` | Add `foreach` to `autoAdvanceNodes`, `handleBodyExhaustion`, `resolveCurrentNode` |
| `cspell.json`                       | Add "foreach" to word list if not present                                         |

## Cleanup of internal variables

When a `foreach` completes (in `handleBodyExhaustion` when the list is exhausted), the internal tracking variables (`__foreach_<nodeId>_list`, `__foreach_<nodeId>_index`) should be removed from state to prevent variable pollution. The loop variable itself (`task`, `file`, etc.) retains its last value, consistent with how loop variables work in most languages.

```typescript
// After marking foreach as completed:
const {
  [`__foreach_${parentNode.id}_list`]: _,
  [`__foreach_${parentNode.id}_index`]: __,
  ...cleanedVars
} = current.variables;
current = { ...current, variables: cleanedVars };
```

## DSL reference update

Add to the DSL reference in `inject-context.ts`:

```
**foreach** -- Iterate over a list of items.
  foreach file in ${changed_files}
    prompt: Review ${file}
  end
```

## Testing strategy

1. **Unit tests** for `resolveList()`: JSON arrays, comma-separated, newline-separated, empty input, single item, mixed types in JSON.
2. **Unit tests** for parser: `foreach x in expr`, `foreach x in expr max 10`, missing `in`, missing variable name.
3. **Integration tests** in `inject-context.test.ts`:
   - Basic iteration over literal list.
   - Iteration over variable containing JSON array.
   - Empty list skips body.
   - Max iterations cap.
   - Nested foreach.
   - Variable binding updates per iteration.
   - `foreach_index` and `foreach_length` are set correctly.
4. **Render tests**: progress annotation, current value annotation, nested rendering.
5. **Smoke test**: foreach with `capture prompt` producing a list, then iterating.

## Open questions

1. **Should `foreach` support `break`/`continue`?** Deferred. These would require new keywords and advancement logic. Users can use `if` inside the body for conditional skipping.

2. **Should the loop variable be read-only?** Currently no — it can be overwritten by a `let` inside the body. This is consistent with how the DSL treats all variables. Making it read-only would require variable scoping, which is a larger change.

3. **Spread syntax for inline lists?** E.g., `foreach x in (a, b, c)` without quotes. Deferred in favor of the simpler quoted comma-separated syntax.
