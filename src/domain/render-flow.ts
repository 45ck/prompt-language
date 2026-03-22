/**
 * renderFlow — Pure visualization of a flow program with execution state.
 *
 * Reconstructs the DSL text from FlowSpec nodes and annotates it with
 * the current execution position, loop progress, gate results, and variables.
 */

import type { FlowNode, ForeachNode, IfNode, LetNode, TryNode } from './flow-node.js';
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

function progressAnnotation(state: SessionState, nodeId: string): string {
  const progress = state.nodeProgress[nodeId];
  if (!progress) return '';
  return ` [${progress.iteration}/${progress.maxIterations}]`;
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
  const prefix = isCurrent || isAncestor ? '> ' : '  ';
  const suffix = isCurrent ? '  <-- current' : '';

  switch (node.kind) {
    case 'prompt':
      return [`${prefix}${indent}prompt: ${node.text}${suffix}`];
    case 'run':
      return [`${prefix}${indent}run: ${node.command}${suffix}`];
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

function formatGateDiagnostic(diag: {
  readonly command?: string;
  readonly exitCode?: number;
  readonly stderr?: string;
}): string {
  const parts: string[] = [];
  if (diag.exitCode !== undefined) parts.push(`exit ${diag.exitCode}`);
  if (diag.command) parts.push(`"${diag.command}"`);
  if (diag.stderr) {
    const firstLine = diag.stderr.split('\n')[0]!.slice(0, 80);
    parts.push(firstLine);
  }
  return parts.join(': ');
}

function renderVariables(state: SessionState): string[] {
  const entries = Object.entries(state.variables);
  if (entries.length === 0) return [];

  const lines: string[] = ['', 'Variables:'];
  for (const [key, value] of entries) {
    lines.push(`  ${key} = ${String(value)}`);
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

  return lines.join('\n');
}
