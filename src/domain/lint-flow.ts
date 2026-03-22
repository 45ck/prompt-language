/**
 * lintFlow — Pure flow linter detecting anti-patterns.
 *
 * H#75: Warns about common mistakes in flow definitions.
 * Returns an array of lint warnings.
 */

import type { FlowNode } from './flow-node.js';
import type { FlowSpec } from './flow-spec.js';

export interface LintWarning {
  readonly nodeId: string;
  readonly message: string;
}

function lintNodes(nodes: readonly FlowNode[], insideLoop: boolean, warnings: LintWarning[]): void {
  for (const node of nodes) {
    switch (node.kind) {
      case 'while':
      case 'until':
        if (node.body.length === 0) {
          warnings.push({ nodeId: node.id, message: `Empty ${node.kind} body` });
        }
        lintNodes(node.body, true, warnings);
        break;
      case 'retry':
        if (node.body.length === 0) {
          warnings.push({ nodeId: node.id, message: 'Empty retry body' });
        }
        if (!node.body.some((n) => n.kind === 'run')) {
          warnings.push({
            nodeId: node.id,
            message: 'Retry without run node — retry re-loops on command_failed',
          });
        }
        lintNodes(node.body, true, warnings);
        break;
      case 'foreach':
        if (node.body.length === 0) {
          warnings.push({ nodeId: node.id, message: 'Empty foreach body' });
        }
        lintNodes(node.body, true, warnings);
        break;
      case 'if':
        if (node.thenBranch.length === 0 && node.elseBranch.length === 0) {
          warnings.push({ nodeId: node.id, message: 'Empty if — both branches are empty' });
        }
        lintNodes(node.thenBranch, insideLoop, warnings);
        lintNodes(node.elseBranch, insideLoop, warnings);
        break;
      case 'try':
        if (node.body.length === 0) {
          warnings.push({ nodeId: node.id, message: 'Empty try body' });
        }
        lintNodes(node.body, insideLoop, warnings);
        lintNodes(node.catchBody, insideLoop, warnings);
        lintNodes(node.finallyBody, insideLoop, warnings);
        break;
      case 'break':
        if (!insideLoop) {
          warnings.push({ nodeId: node.id, message: 'Break outside of loop' });
        }
        break;
      case 'prompt':
      case 'run':
      case 'let':
        break;
    }
  }
}

export function lintFlow(spec: FlowSpec): readonly LintWarning[] {
  const warnings: LintWarning[] = [];

  if (!spec.goal) {
    warnings.push({ nodeId: '', message: 'Missing Goal' });
  }

  if (spec.nodes.length === 0) {
    warnings.push({ nodeId: '', message: 'Empty flow — no nodes defined' });
  }

  lintNodes(spec.nodes, false, warnings);
  return warnings;
}
