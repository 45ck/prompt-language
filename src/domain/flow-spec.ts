/**
 * FlowSpec — the complete static program definition.
 *
 * Contains the goal, the node graph, completion gates, and defaults.
 */

import type { FlowNode } from './flow-node.js';
import { DEFAULT_MAX_ITERATIONS, DEFAULT_MAX_ATTEMPTS } from './flow-node.js';

export interface CompletionGate {
  readonly predicate: string;
  readonly command?: string | undefined;
  /** H-INT-010: When set, this gate passes if ANY sub-gate passes. */
  readonly any?: readonly CompletionGate[] | undefined;
  /** H-LANG-010: When set, this gate passes if ALL sub-gates pass (explicit AND). */
  readonly all?: readonly CompletionGate[] | undefined;
  /** H-LANG-010: When set, this gate passes if at least N sub-gates pass. */
  readonly nOf?: { readonly n: number; readonly gates: readonly CompletionGate[] } | undefined;
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
  /** H-LANG-009: Environment variables to inject into command execution. */
  readonly env?: Readonly<Record<string, string>> | undefined;
  /** Resolved absolute file paths of all imported library files. */
  readonly imports?: readonly string[] | undefined;
  /** Keys to prefetch from memory store before flow starts. */
  readonly memoryKeys?: readonly string[] | undefined;
}

/** Pure JS hash of a FlowSpec for stale-state detection. */
export function flowSpecHash(spec: FlowSpec): string {
  const payload = JSON.stringify({
    goal: spec.goal,
    nodes: spec.nodes,
    completionGates: spec.completionGates,
    defaults: spec.defaults,
    env: spec.env ?? null,
    imports: spec.imports ?? null,
    memoryKeys: spec.memoryKeys ?? null,
  });
  let hash = 0x811c9dc5;
  for (let i = 0; i < payload.length; i++) {
    hash ^= payload.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

const DEFAULT_FLOW_DEFAULTS: FlowDefaults = {
  maxIterations: DEFAULT_MAX_ITERATIONS,
  maxAttempts: DEFAULT_MAX_ATTEMPTS,
};

export function createFlowSpec(
  goal: string,
  nodes: readonly FlowNode[],
  completionGates: readonly CompletionGate[] = [],
  warnings: readonly string[] = [],
  defaults?: Partial<FlowDefaults>,
  env?: Readonly<Record<string, string>>,
  imports?: readonly string[],
  memoryKeys?: readonly string[],
): FlowSpec {
  return {
    goal,
    nodes,
    completionGates,
    defaults: { ...DEFAULT_FLOW_DEFAULTS, ...defaults },
    warnings,
    ...(env != null ? { env } : {}),
    ...(imports != null && imports.length > 0 ? { imports } : {}),
    ...(memoryKeys != null && memoryKeys.length > 0 ? { memoryKeys } : {}),
  };
}

export function createCompletionGate(predicate: string, command?: string): CompletionGate {
  return { predicate, command };
}
