/**
 * FlowSpec — the complete static program definition.
 *
 * Contains the goal, the node graph, completion gates, and defaults.
 */

import type { FlowNode } from './flow-node.js';
import { DEFAULT_MAX_ITERATIONS, DEFAULT_MAX_ATTEMPTS } from './flow-node.js';
import type { ContextProfileRegistry } from './context-profile.js';
import type { AgentRegistry } from './agent-definition.js';

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

export interface RubricDefinition {
  readonly name: string;
  /** Normalized body lines with block indentation stripped once. */
  readonly lines: readonly string[];
}

export interface JudgeDefinition {
  readonly name: string;
  /** Normalized body lines with block indentation stripped once. */
  readonly lines: readonly string[];
  /** Optional referenced rubric extracted from `rubric: "name"` in the body. */
  readonly rubric?: string | undefined;
}

export interface FlowSpec {
  readonly goal: string;
  readonly nodes: readonly FlowNode[];
  readonly completionGates: readonly CompletionGate[];
  readonly defaults: FlowDefaults;
  readonly warnings: readonly string[];
  readonly defaultProfile?: string | undefined;
  readonly profiles?: ContextProfileRegistry | undefined;
  /** H-LANG-009: Environment variables to inject into command execution. */
  readonly env?: Readonly<Record<string, string>> | undefined;
  /** Resolved absolute file paths of all imported library files. */
  readonly imports?: readonly string[] | undefined;
  /** Keys to prefetch from memory store before flow starts. */
  readonly memoryKeys?: readonly string[] | undefined;
  /** Named reusable evaluation rubrics. */
  readonly rubrics?: readonly RubricDefinition[] | undefined;
  /** Named reusable judges. */
  readonly judges?: readonly JudgeDefinition[] | undefined;
  /** Named agent definitions for spawn references. */
  readonly agents?: AgentRegistry | undefined;
}

/** Pure JS hash of a FlowSpec for stale-state detection. */
export function flowSpecHash(spec: FlowSpec): string {
  const payload = JSON.stringify({
    goal: spec.goal,
    nodes: spec.nodes,
    completionGates: spec.completionGates,
    defaults: spec.defaults,
    defaultProfile: spec.defaultProfile ?? null,
    profiles: spec.profiles ?? null,
    env: spec.env ?? null,
    imports: spec.imports ?? null,
    memoryKeys: spec.memoryKeys ?? null,
    rubrics: spec.rubrics ?? null,
    judges: spec.judges ?? null,
    agents: spec.agents ?? null,
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
  rubrics?: readonly RubricDefinition[],
  judges?: readonly JudgeDefinition[],
  defaultProfile?: string,
  profiles?: ContextProfileRegistry,
  agents?: AgentRegistry,
): FlowSpec {
  return {
    goal,
    nodes,
    completionGates,
    defaults: { ...DEFAULT_FLOW_DEFAULTS, ...defaults },
    warnings,
    ...(defaultProfile != null ? { defaultProfile } : {}),
    ...(profiles != null && Object.keys(profiles).length > 0 ? { profiles } : {}),
    ...(env != null ? { env } : {}),
    ...(imports != null && imports.length > 0 ? { imports } : {}),
    ...(memoryKeys != null && memoryKeys.length > 0 ? { memoryKeys } : {}),
    ...(rubrics != null && rubrics.length > 0 ? { rubrics } : {}),
    ...(judges != null && judges.length > 0 ? { judges } : {}),
    ...(agents != null && Object.keys(agents).length > 0 ? { agents } : {}),
  };
}

export function createCompletionGate(predicate: string, command?: string): CompletionGate {
  return { predicate, command };
}

export function createRubricDefinition(name: string, lines: readonly string[]): RubricDefinition {
  return { name, lines };
}

export function createJudgeDefinition(
  name: string,
  lines: readonly string[],
  rubric?: string,
): JudgeDefinition {
  return {
    name,
    lines,
    ...(rubric != null ? { rubric } : {}),
  };
}
