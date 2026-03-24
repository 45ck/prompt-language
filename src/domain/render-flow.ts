/**
 * renderFlow — Pure visualization of a flow program with execution state.
 *
 * Reconstructs the DSL text from FlowSpec nodes and annotates it with
 * the current execution position, loop progress, gate results, and variables.
 */

import type { FlowNode, ForeachNode, IfNode, LetNode, SpawnNode, TryNode } from './flow-node.js';
import type { SessionState } from './session-state.js';

function arraysEqual(a: readonly number[], b: readonly number[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function isAncestorPath(ancestor: readonly number[], descendant: readonly number[]): boolean {
  if (ancestor.length >= descendant.length) return false;
  for (let i = 0; i < ancestor.length; i++) {
    if (ancestor[i] !== descendant[i]) return false;
  }
  return true;
}

// H#32: Visual progress bar for loop nodes
function progressAnnotation(state: SessionState, nodeId: string): string {
  const progress = state.nodeProgress[nodeId];
  if (!progress) return '';
  const done = progress.iteration;
  const total = progress.maxIterations;
  const barWidth = 5;
  const filled = Math.min(barWidth, Math.round((done / total) * barWidth));
  const bar = '#'.repeat(filled) + '-'.repeat(barWidth - filled);
  return ` [${bar}] ${done}/${total}`;
}

function isCompletedNode(path: readonly number[], currentPath: readonly number[]): boolean {
  if (path.length === 0 || currentPath.length < path.length) return false;
  for (let i = 0; i < path.length - 1; i++) {
    if (path[i] !== currentPath[i]) return false;
  }
  return path[path.length - 1]! < currentPath[path.length - 1]!;
}

function renderNode(
  node: FlowNode,
  state: SessionState,
  path: readonly number[],
  indentLevel: number,
): string[] {
  const indent = '  '.repeat(indentLevel);
  const currentPath = state.currentNodePath;
  const isCurrent = arraysEqual(path, currentPath);
  const isAncestor = isAncestorPath(path, currentPath);
  const completed = !isCurrent && !isAncestor && isCompletedNode(path, currentPath);
  const prefix = isCurrent || isAncestor ? '> ' : completed ? '~ ' : '  ';
  const suffix = isCurrent ? '  <-- current' : '';

  switch (node.kind) {
    case 'prompt':
      return [`${prefix}${indent}prompt: ${node.text}${suffix}`];
    case 'run': {
      const timeoutTag = node.timeoutMs ? ` [timeout ${node.timeoutMs / 1000}s]` : '';
      return [`${prefix}${indent}run: ${node.command}${timeoutTag}${suffix}`];
    }
    case 'while':
      return renderLoopNode(
        `while ${node.condition} max ${node.maxIterations}`,
        node.body,
        state,
        path,
        indentLevel,
        prefix,
        suffix,
        node.id,
      );
    case 'until':
      return renderLoopNode(
        `until ${node.condition} max ${node.maxIterations}`,
        node.body,
        state,
        path,
        indentLevel,
        prefix,
        suffix,
        node.id,
      );
    case 'retry':
      return renderLoopNode(
        `retry max ${node.maxAttempts}`,
        node.body,
        state,
        path,
        indentLevel,
        prefix,
        suffix,
        node.id,
      );
    case 'if':
      return renderIfNode(node, state, path, indentLevel, prefix, suffix);
    case 'try':
      return renderTryNode(node, state, path, indentLevel, prefix, suffix);
    case 'let':
      return renderLetNode(node, state, indent, prefix, suffix);
    case 'foreach':
      return renderForeachNode(node, state, path, indentLevel, prefix, suffix);
    case 'break':
      return [`${prefix}${indent}break${suffix}`];
    case 'continue':
      return [`${prefix}${indent}continue${suffix}`];
    case 'spawn':
      return renderSpawnNode(node, state, path, indentLevel, prefix, suffix);
    case 'await':
      return [
        `${prefix}${indent}await ${node.target === 'all' ? 'all' : `"${node.target}"`}${suffix}`,
      ];
    default: {
      const _exhaustive: never = node;
      return _exhaustive;
    }
  }
}

function renderLoopNode(
  header: string,
  body: readonly FlowNode[],
  state: SessionState,
  path: readonly number[],
  indentLevel: number,
  prefix: string,
  suffix: string,
  nodeId: string,
): string[] {
  const indent = '  '.repeat(indentLevel);
  const progress = progressAnnotation(state, nodeId);
  const lines: string[] = [`${prefix}${indent}${header}${progress}${suffix}`];

  for (let i = 0; i < body.length; i++) {
    const child = body[i]!;
    lines.push(...renderNode(child, state, [...path, i], indentLevel + 1));
  }

  lines.push(`  ${indent}end`);
  return lines;
}

function renderIfNode(
  node: IfNode,
  state: SessionState,
  path: readonly number[],
  indentLevel: number,
  prefix: string,
  suffix: string,
): string[] {
  const indent = '  '.repeat(indentLevel);
  const lines: string[] = [`${prefix}${indent}if ${node.condition}${suffix}`];

  for (let i = 0; i < node.thenBranch.length; i++) {
    const child = node.thenBranch[i]!;
    lines.push(...renderNode(child, state, [...path, i], indentLevel + 1));
  }

  if (node.elseBranch.length > 0) {
    lines.push(`  ${indent}else`);
    const offset = node.thenBranch.length;
    for (let i = 0; i < node.elseBranch.length; i++) {
      const child = node.elseBranch[i]!;
      lines.push(...renderNode(child, state, [...path, offset + i], indentLevel + 1));
    }
  }

  lines.push(`  ${indent}end`);
  return lines;
}

function renderTryNode(
  node: TryNode,
  state: SessionState,
  path: readonly number[],
  indentLevel: number,
  prefix: string,
  suffix: string,
): string[] {
  const indent = '  '.repeat(indentLevel);
  const lines: string[] = [`${prefix}${indent}try${suffix}`];

  for (let i = 0; i < node.body.length; i++) {
    const child = node.body[i]!;
    lines.push(...renderNode(child, state, [...path, i], indentLevel + 1));
  }

  if (node.catchBody.length > 0) {
    lines.push(`  ${indent}catch ${node.catchCondition}`);
    const offset = node.body.length;
    for (let i = 0; i < node.catchBody.length; i++) {
      const child = node.catchBody[i]!;
      lines.push(...renderNode(child, state, [...path, offset + i], indentLevel + 1));
    }
  }

  // H#20: Render finally block
  if (node.finallyBody.length > 0) {
    lines.push(`  ${indent}finally`);
    const finallyOffset = node.body.length + node.catchBody.length;
    for (let i = 0; i < node.finallyBody.length; i++) {
      const child = node.finallyBody[i]!;
      lines.push(...renderNode(child, state, [...path, finallyOffset + i], indentLevel + 1));
    }
  }

  lines.push(`  ${indent}end`);
  return lines;
}

// Both `let` and `var` are parsed as LetNode (they are aliases).
// Rendering always uses `let` for consistency.
function renderLetNode(
  node: LetNode,
  state: SessionState,
  indent: string,
  prefix: string,
  suffix: string,
): string[] {
  const operator = node.append ? '+=' : '=';
  let sourceText: string;
  switch (node.source.type) {
    case 'prompt':
      sourceText = `prompt "${node.source.text}"`;
      break;
    case 'run':
      sourceText = `run "${node.source.command}"`;
      break;
    case 'literal':
      sourceText = `"${node.source.value}"`;
      break;
    case 'empty_list':
      sourceText = '[]';
      break;
  }
  const progress = state.nodeProgress[node.id];
  const isAwaitingCapture = progress?.status === 'awaiting_capture';
  const resolved = state.variables[node.variableName];
  let annotation: string;
  if (isAwaitingCapture) {
    annotation = '  [awaiting response...]';
  } else if (resolved !== undefined) {
    annotation = `  [= ${String(resolved)}]`;
  } else {
    annotation = '';
  }
  return [
    `${prefix}${indent}let ${node.variableName} ${operator} ${sourceText}${annotation}${suffix}`,
  ];
}

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

function renderSpawnNode(
  node: SpawnNode,
  state: SessionState,
  path: readonly number[],
  indentLevel: number,
  prefix: string,
  suffix: string,
): string[] {
  const indent = '  '.repeat(indentLevel);
  const child = state.spawnedChildren[node.name];
  const statusTag = child ? `  [${child.status}]` : '';
  const lines: string[] = [`${prefix}${indent}spawn "${node.name}"${statusTag}${suffix}`];

  for (let i = 0; i < node.body.length; i++) {
    const bodyNode = node.body[i]!;
    lines.push(...renderNode(bodyNode, state, [...path, i], indentLevel + 1));
  }

  lines.push(`  ${indent}end`);
  return lines;
}

function renderGates(state: SessionState): string[] {
  const gates = state.flowSpec.completionGates;
  if (gates.length === 0) return [];

  const lines: string[] = ['', 'done when:'];
  for (const gate of gates) {
    const result = state.gateResults[gate.predicate];
    const diag = state.gateDiagnostics?.[gate.predicate];

    if (result === true) {
      lines.push(`  ${gate.predicate}  [pass]`);
    } else if (result === false && diag?.command) {
      const detail = formatGateDiagnostic(diag);
      lines.push(`  ${gate.predicate}  [fail — ${detail}]`);
    } else if (result === false) {
      lines.push(`  ${gate.predicate}  [fail]`);
    } else {
      lines.push(`  ${gate.predicate}  [pending]`);
    }
  }
  return lines;
}

// H#36: Show first 3 lines of stderr for more actionable gate diagnostics
// H-DX-004: Fall back to stdout (first 200 chars) when stderr is empty
function formatGateDiagnostic(diag: {
  readonly command?: string;
  readonly exitCode?: number;
  readonly stderr?: string;
  readonly stdout?: string;
}): string {
  const parts: string[] = [];
  if (diag.exitCode !== undefined) parts.push(`exit ${diag.exitCode}`);
  if (diag.command) parts.push(`"${diag.command}"`);
  if (diag.stderr) {
    const lines = diag.stderr.split('\n').filter((l) => l.trim());
    const snippet = lines
      .slice(0, 3)
      .map((l) => l.slice(0, 80))
      .join(' | ');
    parts.push(snippet);
  } else if (diag.stdout) {
    // H-DX-004: Show first 200 chars of stdout when stderr is empty
    parts.push(diag.stdout.slice(0, 200));
  }
  return parts.join(': ');
}

// H-PERF-002: Internal/auto-set variables to exclude from display
const HIDDEN_VARIABLES = new Set(['last_exit_code', 'last_stdout', 'last_stderr']);
const AUTO_SUFFIX_RE = /_(index|length)$/;

function isHiddenVariable(
  key: string,
  _value: string | number | boolean,
  variables: Readonly<Record<string, string | number | boolean>>,
): boolean {
  if (HIDDEN_VARIABLES.has(key)) return true;
  if (AUTO_SUFFIX_RE.test(key)) return true;
  // Show command_failed / command_succeeded only when command_failed is 'true'
  if (key === 'command_failed' || key === 'command_succeeded') {
    return String(variables['command_failed']) !== 'true';
  }
  return false;
}

// H-DX-008: Format JSON array values as list summaries
function formatListValue(str: string): string | null {
  try {
    const parsed: unknown = JSON.parse(str);
    if (!Array.isArray(parsed)) return null;
    const len = parsed.length;
    const preview = parsed
      .slice(0, 3)
      .map((item) => `"${String(item)}"`)
      .join(', ');
    const ellipsis = len > 3 ? ', ...' : '';
    return `[${len} items: ${preview}${ellipsis}]`;
  } catch {
    return null;
  }
}

// H#33: Truncate variable values >80 chars for readability
function renderVariables(state: SessionState): string[] {
  const entries = Object.entries(state.variables);
  if (entries.length === 0) return [];

  const filtered = entries.filter(([key, value]) => !isHiddenVariable(key, value, state.variables));
  if (filtered.length === 0) return [];

  const lines: string[] = ['', 'Variables:'];
  for (const [key, value] of filtered) {
    const str = String(value);
    const listDisplay = typeof value === 'string' ? formatListValue(str) : null;
    const display = listDisplay ?? (str.length > 80 ? str.slice(0, 77) + '...' : str);
    lines.push(`  ${key} = ${display}`);
  }
  return lines;
}

// H#51: Surface parser/advancement warnings in flow output
function renderWarnings(state: SessionState): string[] {
  if (state.warnings.length === 0) return [];
  const lines: string[] = ['', 'Warnings:'];
  for (const w of state.warnings) {
    lines.push(`  [!] ${w}`);
  }
  return lines;
}

export function renderFlow(state: SessionState): string {
  const lines: string[] = [
    `[prompt-language] Flow: ${state.flowSpec.goal} | Status: ${state.status}`,
    '',
  ];

  for (let i = 0; i < state.flowSpec.nodes.length; i++) {
    const node = state.flowSpec.nodes[i]!;
    lines.push(...renderNode(node, state, [i], 0));
  }

  lines.push(...renderGates(state));
  lines.push(...renderVariables(state));
  lines.push(...renderWarnings(state));

  return lines.join('\n');
}
