# Design: Foreach Construct & Prompt Output Parsing

> Canonical design document. See implementation in flow-node.ts, parse-flow.ts, inject-context.ts.

## 1. Prompt Output Parsing — `let x = prompt return JSON`

### Problem

Users want to capture Claude's response to a prompt and use it in subsequent flow steps. The current `let x = prompt "text"` stores the prompt text itself as context — it does not capture what Claude responds.

### Constraint

The plugin runs in the `UserPromptSubmit` hook, which processes **input** to Claude, not Claude's **output**. The hook fires before Claude sees the prompt. There is no hook that fires after Claude responds.

### Approaches Evaluated

**A) New hook type (PostToolUse / TaskCompleted)**

Requires Claude Code to expose a new hook point. Out of scope — we cannot control the host platform's hook lifecycle. Even if available, capturing "Claude's last response" is ambiguous (tool outputs? text? which part?).

**Verdict: Rejected.** Depends on platform changes we don't control.

**B) File-based capture (already works)**

The DSL already supports this pattern:

```
flow:
  prompt: Analyze the codebase and write a JSON summary to analysis.json
  let result = run "cat analysis.json"
  prompt: Now use the analysis: ${result}
```

Claude writes to a file, `let x = run "cat file"` captures it. No new syntax needed.

**Verdict: This is the answer.** It works today, requires zero changes, and is explicit about the data flow.

**C) Well-known file convention**

A variant of (B) where the plugin auto-reads from a fixed path like `.prompt-language/prompt-output.txt`. Adds implicit magic without real benefit over explicit `run "cat file"`.

**Verdict: Rejected.** Implicit conventions are harder to debug than explicit commands.

### Recommendation

Do not implement `let x = prompt return JSON`. Document the file-based pattern as the idiomatic way to capture Claude's output. Add an example to the DSL reference showing the prompt-then-capture pattern.

The key insight: prompt-language controls the **input** side. For output capture, we delegate to the filesystem, which Claude already knows how to use.

---

## 2. Foreach Construct

### Motivation

Users need to iterate over a collection of items — files from `find`, entries in a JSON array, lines from a command. The current workaround is `while` with manual index tracking, which is verbose and error-prone.

### Syntax

```
foreach <varName> in ${listVar}
  prompt: Process ${item}
  run: lint ${item}
end
```

The `in` expression must reference a variable containing the list data. Literal lists are also supported:

```
foreach file in "src/a.ts src/b.ts src/c.ts"
  run: npx tsc --noEmit ${file}
end
```

### List Parsing

A list variable holds a string. The runtime splits it into items using this priority:

1. **JSON array** — if the string starts with `[`, parse as JSON array, stringify each element
2. **Newline-delimited** — if the string contains `\n`, split on newlines, trim empties
3. **Whitespace-delimited** — split on whitespace as fallback

This covers the common cases:

```
# Newline-delimited from find/ls
let files = run "find src -name '*.ts'"
foreach f in ${files}
  run: npx tsc --noEmit ${f}
end

# JSON array from jq
let items = run "cat config.json | jq -r '.modules[]'"
foreach mod in ${items}
  prompt: Review the ${mod} module
end

# Literal whitespace-delimited
foreach env in "dev staging prod"
  run: deploy --target ${env}
end
```

The split logic is a pure domain function: `splitIterable(raw: string): string[]`.

### Node Type

Add `ForeachNode` to `flow-node.ts`:

```typescript
export interface ForeachNode extends BaseNode {
  readonly kind: 'foreach';
  readonly variableName: string; // loop variable name
  readonly listExpression: string; // raw expression (interpolated at runtime)
  readonly maxIterations: number; // safety cap
  readonly body: readonly FlowNode[];
}
```

Add `'foreach'` to the `FlowNodeKind` union. Add a factory:

```typescript
const DEFAULT_MAX_FOREACH = 50;

export function createForeachNode(
  id: string,
  variableName: string,
  listExpression: string,
  body: readonly FlowNode[],
  maxIterations?: number,
): ForeachNode {
  return {
    kind: 'foreach',
    id,
    variableName,
    listExpression,
    maxIterations: maxIterations ?? DEFAULT_MAX_FOREACH,
    body,
  };
}
```

The default max of 50 is generous but prevents runaway iteration. Users can override with `max N`.

### Parser Changes

In `parse-flow.ts`, add a case in `parseLine()`:

```typescript
if (lower.startsWith('foreach ')) {
  return parseForeachLine(ctx, trimmed, indent);
}
```

The `parseForeachLine` function:

```typescript
function parseForeachLine(ctx: ParseContext, line: string, baseIndent: number): FlowNode {
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
  return createForeachNode(nextId(ctx), variableName, listExpression, body, max);
}
```

### Execution Semantics

In `inject-context.ts`, the `foreach` node works like an unrolled loop. The runtime tracks which item index is current via `nodeProgress`.

When `autoAdvanceNodes` encounters a `foreach` node:

```typescript
case 'foreach': {
  const rawList = interpolate(node.listExpression, current.variables);
  const items = splitIterable(rawList);

  if (items.length === 0) {
    // Empty list — skip entirely
    current = advanceNode(current, advancePath(current.currentNodePath));
    advances += 1;
    break;
  }

  const cappedItems = items.slice(0, node.maxIterations);
  const firstItem = cappedItems[0]!;

  current = updateVariable(current, node.variableName, firstItem);
  current = updateVariable(current, `${node.variableName}_index`, 0);
  current = updateVariable(current, `${node.variableName}_length`, cappedItems.length);
  current = updateNodeProgress(current, node.id, {
    iteration: 1,
    maxIterations: cappedItems.length,
    status: 'running',
  });
  current = advanceNode(current, [...current.currentNodePath, 0]);
  advances += 1;
  break;
}
```

When `handleBodyExhaustion` encounters a `foreach` parent:

```typescript
case 'foreach': {
  const rawList = interpolate(parentNode.listExpression, current.variables);
  const items = splitIterable(rawList).slice(0, parentNode.maxIterations);
  const progress = current.nodeProgress[parentNode.id];
  const iteration = progress?.iteration ?? 1;

  if (iteration < items.length) {
    const nextItem = items[iteration]!;
    current = updateVariable(current, parentNode.variableName, nextItem);
    current = updateVariable(current, `${parentNode.variableName}_index`, iteration);
    current = updateNodeProgress(current, parentNode.id, {
      iteration: iteration + 1,
      maxIterations: items.length,
      status: 'running',
    });
    current = advanceNode(current, [...parentPath, 0]);
  } else {
    current = updateNodeProgress(current, parentNode.id, {
      iteration,
      maxIterations: items.length,
      status: 'completed',
    });
    current = advanceNode(current, advancePath(parentPath));
  }
  return current;
}
```

### Variable Scoping

The loop variable (`item` in `foreach item in ...`) is set in the session's `variables` record. It is **not** lexically scoped — it persists after the loop ends with the last item's value. This matches how `let` already works (all variables are global).

Adding true lexical scoping would require a variable stack, which is a larger change that adds complexity without clear user benefit. The simple approach: the loop variable is just a regular variable that gets overwritten each iteration.

Two helper variables are auto-set per iteration:

- `${varName}_index` — zero-based index of current item
- `${varName}_length` — total item count

### Rendering

In `render-flow.ts`, add a case for `foreach`:

```typescript
case 'foreach':
  return renderForeachNode(node, state, path, indentLevel, prefix, suffix);
```

```typescript
function renderForeachNode(
  node: ForeachNode,
  state: SessionState,
  path: readonly number[],
  indentLevel: number,
  prefix: string,
  suffix: string,
): string[] {
  const indent = '  '.repeat(indentLevel);
  const progress = progressAnnotation(state, node.id);
  const currentVal = state.variables[node.variableName];
  const valAnnotation = currentVal !== undefined ? `  [${node.variableName}=${currentVal}]` : '';
  const header = `foreach ${node.variableName} in ${node.listExpression}`;
  const lines: string[] = [`${prefix}${indent}${header}${progress}${valAnnotation}${suffix}`];

  for (let i = 0; i < node.body.length; i++) {
    const child = node.body[i]!;
    lines.push(...renderNode(child, state, [...path, i], indentLevel + 1));
  }

  lines.push(`  ${indent}end`);
  return lines;
}
```

Example rendered output during execution:

```
> foreach file in ${files} [2/5] [file=src/auth.ts]
>   run: npx tsc --noEmit ${file}  <-- current
  end
```

### Nesting

`foreach` nests naturally with all existing constructs:

```
foreach file in ${files}
  try
    run: npx tsc --noEmit ${file}
  catch command_failed
    prompt: Fix type errors in ${file}
  end
end
```

Path navigation follows the same pattern as `while`/`until`/`retry`: `foreach` has a `body` array and `getChildren` returns it directly.

In `resolveCurrentNode`, add:

```typescript
case 'foreach':
  return resolveCurrentNode(node.body, rest);
```

### DSL Reference Update

Add to the DSL reference block in `inject-context.ts`:

```
**foreach** — Iterate over a list of items.
  let files = run "find src -name '*.ts'"
  foreach file in ${files}
    run: npx tsc --noEmit ${file}
  end
```

### Natural Language Detection

Add `'\\bforeach\\b'` and `'\\bfor each\\b'` to the `NL_INTENT_WORDS` array so that natural-language prompts containing iteration intent trigger the meta-prompt.

### Security

The loop variable is interpolated via `shellInterpolate()` in `run:` nodes, so shell injection is already handled. The `maxIterations` cap prevents resource exhaustion from large lists.

### Edge Cases

| Scenario           | Behavior                                                                                    |
| ------------------ | ------------------------------------------------------------------------------------------- |
| Empty list         | Skip body entirely, advance past foreach                                                    |
| Single item        | Execute body once                                                                           |
| List exceeds max   | Truncate to max, emit warning                                                               |
| Variable not found | `interpolate` leaves `${varName}` as-is; `splitIterable` treats it as a single literal item |
| Nested foreach     | Each level uses its own variable name; inner variable shadows outer if same name            |

### Implementation Order

1. **Domain**: Add `ForeachNode` to `flow-node.ts`, add `splitIterable()` to a new `src/domain/split-iterable.ts`
2. **Parser**: Add `parseForeachLine` to `parse-flow.ts`
3. **Execution**: Add `foreach` case to `autoAdvanceNodes` and `handleBodyExhaustion` in `inject-context.ts`; add case to `resolveCurrentNode`
4. **Rendering**: Add `renderForeachNode` to `render-flow.ts`; update exhaustive switch
5. **Tests**: Unit tests for `splitIterable`, parser, execution, rendering
6. **DSL reference**: Update inline reference and docs
7. **Smoke test**: Add a foreach smoke test to `smoke-test.mjs`
8. **cspell**: Add `foreach` to `cspell.json` if needed
