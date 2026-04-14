/**
 * flowComplexity — Pure flow complexity scoring (1–5).
 *
 * Scores a FlowSpec based on node count, nesting depth, and control-flow usage.
 * Helps users decide when prompt-language adds value vs plain prompts.
 */

import type { FlowNode } from './flow-node.js';
import type { FlowSpec } from './flow-spec.js';

function countNodes(nodes: readonly FlowNode[]): number {
  let count = 0;
  for (const node of nodes) {
    count += 1;
    switch (node.kind) {
      case 'while':
      case 'until':
      case 'retry':
      case 'foreach':
        count += countNodes(node.body);
        break;
      case 'if':
        count += countNodes(node.thenBranch) + countNodes(node.elseBranch);
        break;
      case 'try':
        count += countNodes(node.body) + countNodes(node.catchBody) + countNodes(node.finallyBody);
        break;
      case 'spawn':
        count += countNodes(node.body);
        break;
      case 'review':
        count += countNodes(node.body);
        break;
      case 'race':
        for (const child of node.children) {
          count += 1 + countNodes(child.body);
        }
        break;
      case 'swarm':
        count += countNodes(node.flow);
        for (const role of node.roles) {
          count += countNodes(role.body);
        }
        break;
      case 'foreach_spawn':
        count += countNodes(node.body);
        break;
      case 'await':
      case 'approve':
      case 'break':
      case 'continue':
      case 'prompt':
      case 'run':
      case 'let':
      case 'remember':
      case 'send':
      case 'receive':
      case 'start':
      case 'return':
      case 'snapshot':
      case 'rollback':
        break;
      default: {
        const _exhaustive: never = node;
        return _exhaustive;
      }
    }
  }
  return count;
}

function maxDepth(nodes: readonly FlowNode[], depth: number): number {
  let max = depth;
  for (const node of nodes) {
    switch (node.kind) {
      case 'while':
      case 'until':
      case 'retry':
      case 'foreach':
        max = Math.max(max, maxDepth(node.body, depth + 1));
        break;
      case 'if':
        max = Math.max(
          max,
          maxDepth(node.thenBranch, depth + 1),
          maxDepth(node.elseBranch, depth + 1),
        );
        break;
      case 'try':
        max = Math.max(
          max,
          maxDepth(node.body, depth + 1),
          maxDepth(node.catchBody, depth + 1),
          maxDepth(node.finallyBody, depth + 1),
        );
        break;
      case 'spawn':
        max = Math.max(max, maxDepth(node.body, depth + 1));
        break;
      case 'review':
        max = Math.max(max, maxDepth(node.body, depth + 1));
        break;
      case 'race':
        for (const child of node.children) {
          max = Math.max(max, maxDepth(child.body, depth + 1));
        }
        break;
      case 'swarm': {
        max = Math.max(max, maxDepth(node.flow, depth + 1));
        for (const role of node.roles) {
          max = Math.max(max, maxDepth(role.body, depth + 1));
        }
        break;
      }
      case 'foreach_spawn':
        max = Math.max(max, maxDepth(node.body, depth + 1));
        break;
      case 'await':
      case 'approve':
      case 'break':
      case 'continue':
      case 'prompt':
      case 'run':
      case 'let':
      case 'remember':
      case 'send':
      case 'receive':
      case 'start':
      case 'return':
      case 'snapshot':
      case 'rollback':
        break;
      default: {
        const _exhaustive: never = node;
        return _exhaustive;
      }
    }
  }
  return max;
}

const CONTROL_FLOW_KINDS = new Set([
  'while',
  'until',
  'retry',
  'if',
  'try',
  'foreach',
  'spawn',
  'swarm',
]);

function countControlFlow(nodes: readonly FlowNode[]): number {
  let count = 0;
  for (const node of nodes) {
    if (CONTROL_FLOW_KINDS.has(node.kind)) count += 1;
    switch (node.kind) {
      case 'while':
      case 'until':
      case 'retry':
      case 'foreach':
        count += countControlFlow(node.body);
        break;
      case 'if':
        count += countControlFlow(node.thenBranch) + countControlFlow(node.elseBranch);
        break;
      case 'try':
        count +=
          countControlFlow(node.body) +
          countControlFlow(node.catchBody) +
          countControlFlow(node.finallyBody);
        break;
      case 'spawn':
        count += countControlFlow(node.body);
        break;
      case 'review':
        count += countControlFlow(node.body);
        break;
      case 'race':
        for (const child of node.children) {
          count += 1 + countControlFlow(child.body);
        }
        break;
      case 'swarm':
        count += countControlFlow(node.flow);
        for (const role of node.roles) {
          count += countControlFlow(role.body);
        }
        break;
      case 'foreach_spawn':
        count += countControlFlow(node.body);
        break;
      case 'await':
      case 'approve':
      case 'break':
      case 'continue':
      case 'prompt':
      case 'run':
      case 'let':
      case 'remember':
      case 'send':
      case 'receive':
      case 'start':
      case 'return':
      case 'snapshot':
      case 'rollback':
        break;
      default: {
        const _exhaustive: never = node;
        return _exhaustive;
      }
    }
  }
  return count;
}

/**
 * Rate flow complexity on a 1–5 scale.
 *
 * 1 = Trivial (linear, ≤3 nodes, no control flow)
 * 2 = Simple (≤5 nodes or 1 control flow, shallow)
 * 3 = Moderate (≤10 nodes, depth ≤2, or 2–3 control flows)
 * 4 = Complex (>10 nodes, depth 3+, or 4+ control flows)
 * 5 = Very complex (deep nesting + many control flows + gates)
 */
export function flowComplexityScore(spec: FlowSpec): number {
  const nodes = countNodes(spec.nodes);
  const depth = maxDepth(spec.nodes, 0);
  const cf = countControlFlow(spec.nodes);
  const gates = spec.completionGates.length;

  if (nodes <= 3 && cf === 0) return 1;
  if (nodes <= 5 && cf <= 1 && depth <= 1) return 2;
  if (nodes <= 10 && cf <= 3 && depth <= 2) return 3;
  if (depth >= 3 && cf >= 4 && gates >= 2) return 5;
  return 4;
}
