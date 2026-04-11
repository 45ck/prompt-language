import type { FlowNode } from './flow-node.js';
import type { SessionState } from './session-state.js';

function flattenChildNodes(node: FlowNode): readonly FlowNode[] | null {
  switch (node.kind) {
    case 'while':
    case 'until':
    case 'retry':
    case 'foreach':
    case 'foreach_spawn':
    case 'spawn':
    case 'review':
      return node.body;
    case 'if':
      return [...node.thenBranch, ...node.elseBranch];
    case 'try':
      return [...node.body, ...node.catchBody, ...node.finallyBody];
    case 'race':
      return node.children.flatMap((child) => [child as FlowNode, ...child.body]);
    case 'swarm':
      return [...node.flow, ...node.roles.flatMap((role) => role.body)];
    case 'prompt':
    case 'run':
    case 'let':
    case 'break':
    case 'continue':
    case 'await':
    case 'approve':
    case 'remember':
    case 'send':
    case 'receive':
    case 'start':
    case 'return':
      return null;
    default: {
      const _exhaustive: never = node;
      return _exhaustive;
    }
  }
}

function isValidNodePathOrOnePastEnd(nodes: readonly FlowNode[], path: readonly number[]): boolean {
  if (path.length === 0) return false;

  let currentNodes = nodes;
  for (let depth = 0; depth < path.length; depth += 1) {
    const index = path[depth];
    if (index === undefined || Number.isInteger(index) === false || index < 0) {
      return false;
    }

    const isLast = depth === path.length - 1;
    if (index === currentNodes.length) {
      return isLast;
    }
    if (index > currentNodes.length - 1) {
      return false;
    }

    const node = currentNodes[index];
    if (node === undefined) {
      return false;
    }
    if (isLast) {
      return true;
    }

    const childNodes = flattenChildNodes(node);
    if (childNodes === null) {
      return false;
    }
    currentNodes = childNodes;
  }

  return false;
}

function hasConsistentExitVariables(state: SessionState): boolean {
  const failed = state.variables['command_failed'];
  const succeeded = state.variables['command_succeeded'];

  if (failed === undefined && succeeded === undefined) {
    return true;
  }
  if (failed === undefined || succeeded === undefined) {
    return true;
  }

  return typeof failed === 'boolean' && typeof succeeded === 'boolean' && failed !== succeeded;
}

export class StateInvariantError extends Error {
  readonly violations: readonly string[];

  constructor(violations: readonly string[]) {
    super(`SessionState invariant violation: ${violations.join('; ')}`);
    this.name = 'StateInvariantError';
    this.violations = violations;
  }
}

export function assertStateInvariants(state: SessionState): void {
  const violations: string[] = [];

  if (isValidNodePathOrOnePastEnd(state.flowSpec.nodes, state.currentNodePath) === false) {
    violations.push(
      `currentNodePath is invalid or not one-past-end: [${state.currentNodePath.join(', ')}]`,
    );
  }

  for (const [nodeId, progress] of Object.entries(state.nodeProgress)) {
    if (progress.iteration > progress.maxIterations) {
      violations.push(
        `nodeProgress["${nodeId}"] iteration ${progress.iteration} exceeds maxIterations ${progress.maxIterations}`,
      );
    }
  }

  if (state.status === 'active' && state.currentNodePath.length < 1) {
    violations.push('active state must have currentNodePath length >= 1');
  }

  if (hasConsistentExitVariables(state) === false) {
    violations.push(
      'command_failed and command_succeeded must both be booleans and logical opposites',
    );
  }

  if (
    typeof state.transitionSeq !== 'number' ||
    Number.isInteger(state.transitionSeq) === false ||
    state.transitionSeq < 0
  ) {
    violations.push('transitionSeq must be present and non-negative');
  }

  for (const variableName of Object.keys(state.variables)) {
    if (variableName.includes(state.captureNonce)) {
      violations.push(`variable name "${variableName}" must not contain the capture nonce`);
    }
  }

  if (violations.length > 0) {
    throw new StateInvariantError(violations);
  }
}
