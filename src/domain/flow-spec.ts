/**
 * FlowSpec — the complete static program definition.
 *
 * Contains the goal, the node graph, completion gates, and defaults.
 */

import type { FlowNode } from './flow-node.js';

export interface CompletionGate {
  readonly predicate: string;
  readonly command?: string | undefined;
}

export interface FlowDefaults {
  readonly maxIterations: number;
  readonly maxAttempts: number;
}

export interface FlowSpec {
  readonly goal: string;
  readonly nodes: readonly FlowNode[];
  readonly completionGates: readonly CompletionGate[];
  readonly defaults: FlowDefaults;
  readonly warnings: readonly string[];
}

const DEFAULT_FLOW_DEFAULTS: FlowDefaults = {
  maxIterations: 5,
  maxAttempts: 3,
};

export function createFlowSpec(
  goal: string,
  nodes: readonly FlowNode[],
  completionGates: readonly CompletionGate[] = [],
  warnings: readonly string[] = [],
  defaults?: Partial<FlowDefaults>,
): FlowSpec {
  return {
    goal,
    nodes,
    completionGates,
    defaults: { ...DEFAULT_FLOW_DEFAULTS, ...defaults },
    warnings,
  };
}

export function createCompletionGate(predicate: string, command?: string): CompletionGate {
  return { predicate, command };
}
