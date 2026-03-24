/**
 * renderStatusLine — Compact one-line summary of flow execution state.
 *
 * Designed for Claude Code's status line (always-visible footer).
 * Pure domain function: takes SessionState, returns a plain string.
 *
 * Format: [PL] <goal> | <loop-context> > <current-node> | <gate-results>
 */

import type { FlowNode } from './flow-node.js';
import type { SessionState } from './session-state.js';

const MAX_WIDTH = 120;
const PREFIX = '[PL] ';

/**
 * Resolve a node from the flow tree by following a path of indices.
 * Duplicated from advance-flow.ts as a pure domain function
 * (advance-flow is application layer; this keeps domain pure).
 */
function resolveNode(nodes: readonly FlowNode[], path: readonly number[]): FlowNode | null {
  if (path.length === 0) return null;
  const idx = path[0]!;
  const node = nodes[idx];
  if (!node) return null;
  if (path.length === 1) return node;
  const rest = path.slice(1);
  switch (node.kind) {
    case 'while':
    case 'until':
    case 'retry':
    case 'foreach':
    case 'spawn':
      return resolveNode(node.body, rest);
    case 'if':
      return resolveNode([...node.thenBranch, ...node.elseBranch], rest);
    case 'try':
      return resolveNode([...node.body, ...node.catchBody, ...node.finallyBody], rest);
    default:
      return null;
  }
}

/** Collect ancestor nodes along the path (excludes the leaf node itself). */
function collectAncestors(nodes: readonly FlowNode[], path: readonly number[]): FlowNode[] {
  const ancestors: FlowNode[] = [];
  let currentNodes: readonly FlowNode[] = nodes;
  for (let depth = 0; depth < path.length - 1; depth++) {
    const idx = path[depth]!;
    const node = currentNodes[idx];
    if (!node) break;
    ancestors.push(node);
    switch (node.kind) {
      case 'while':
      case 'until':
      case 'retry':
      case 'foreach':
      case 'spawn':
        currentNodes = node.body;
        break;
      case 'if':
        currentNodes = [...node.thenBranch, ...node.elseBranch];
        break;
      case 'try':
        currentNodes = [...node.body, ...node.catchBody, ...node.finallyBody];
        break;
      default:
        currentNodes = [];
    }
  }
  return ancestors;
}

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max - 1) + '\u2026' : text;
}

function summarizeNode(node: FlowNode): string {
  switch (node.kind) {
    case 'prompt':
      return `prompt: ${truncate(node.text, 30)}`;
    case 'run':
      return `run: ${truncate(node.command, 30)}`;
    case 'let':
      return `let ${node.variableName}`;
    case 'while':
      return `while ${node.condition}`;
    case 'until':
      return `until ${node.condition}`;
    case 'retry':
      return 'retry';
    case 'if':
      return `if ${node.condition}`;
    case 'try':
      return 'try';
    case 'foreach':
      return `foreach ${node.variableName}`;
    case 'break':
      return 'break';
    case 'spawn':
      return `spawn "${node.name}"`;
    case 'await':
      return `await ${node.target === 'all' ? 'all' : `"${node.target}"`}`;
    default: {
      const _exhaustive: never = node;
      return _exhaustive;
    }
  }
}

/** Find the innermost enclosing loop and return its progress string. */
function loopProgress(ancestors: FlowNode[], state: SessionState): string {
  for (let i = ancestors.length - 1; i >= 0; i--) {
    const anc = ancestors[i]!;
    if (
      anc.kind === 'retry' ||
      anc.kind === 'while' ||
      anc.kind === 'until' ||
      anc.kind === 'foreach'
    ) {
      const progress = state.nodeProgress[anc.id];
      if (progress) {
        return `${anc.kind} ${progress.iteration}/${progress.maxIterations}`;
      }
    }
  }
  return '';
}

function gatesSummary(state: SessionState): string {
  const gates = state.flowSpec.completionGates;
  if (gates.length === 0) return '';
  return gates
    .map((g) => {
      const result = state.gateResults[g.predicate];
      if (result === true) return `${g.predicate}:✓`;
      if (result === false) return `${g.predicate}:✗`;
      return `${g.predicate}:○`;
    })
    .join(' ');
}

export function renderStatusLine(state: SessionState): string {
  if (state.flowSpec.nodes.length === 0) {
    return `${PREFIX}No active flow`;
  }

  const goal = truncate(state.flowSpec.goal, 30);
  const gates = gatesSummary(state);

  // Terminal states: show status + gate summary
  if (state.status === 'completed' || state.status === 'failed' || state.status === 'cancelled') {
    const parts = [`${PREFIX}${goal}`, `Status: ${state.status}`];
    if (gates) parts.push(gates);
    return truncate(parts.join(' | '), MAX_WIDTH);
  }

  // Active flow: show current node + loop context + gates
  const currentNode = resolveNode(state.flowSpec.nodes, state.currentNodePath);
  const ancestors = collectAncestors(state.flowSpec.nodes, state.currentNodePath);
  const loop = loopProgress(ancestors, state);
  const nodeSummary = currentNode ? summarizeNode(currentNode) : 'advancing\u2026';

  const parts = [`${PREFIX}${goal}`];
  const middle = loop ? `${loop} ▶ ${nodeSummary}` : nodeSummary;
  parts.push(middle);
  if (gates) parts.push(gates);

  return truncate(parts.join(' | '), MAX_WIDTH);
}
