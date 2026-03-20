/**
 * renderFlow — Pure visualization of a flow program with execution state.
 *
 * Reconstructs the DSL text from FlowSpec nodes and annotates it with
 * the current execution position, loop progress, gate results, and variables.
 */

import type { FlowNode, IfNode, LetNode, TryNode } from './flow-node.js';
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

function renderLetNode(
  node: LetNode,
  state: SessionState,
  indent: string,
  prefix: string,
  suffix: string,
): string[] {
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
  }
  const resolved = state.variables[node.variableName];
  const annotation = resolved !== undefined ? `  [= ${String(resolved)}]` : '';
  return [`${prefix}${indent}let ${node.variableName} = ${sourceText}${annotation}${suffix}`];
}

function renderGates(state: SessionState): string[] {
  const gates = state.flowSpec.completionGates;
  if (gates.length === 0) return [];

  const lines: string[] = ['', 'done when:'];
  for (const gate of gates) {
    const result = state.gateResults[gate.predicate];
    const marker = result === true ? '[pass]' : result === false ? '[fail]' : '[pending]';
    lines.push(`  ${gate.predicate}  ${marker}`);
  }
  return lines;
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
