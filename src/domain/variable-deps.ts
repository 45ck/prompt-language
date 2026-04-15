/**
 * variable-deps — Variable dependency extraction and slicing for rendering.
 *
 * Contains the canonical `extractReferencedVariables()` function and the
 * compact-mode `sliceVariablesForCompact()` which adds transitive resolution
 * and mandatory runtime variable injection.
 *
 * Pure domain function: zero external dependencies beyond sibling domain modules.
 */

import type { FlowNode } from './flow-node.js';
import type { FlowSpec } from './flow-spec.js';
import type { SessionState } from './session-state.js';
import type { VariableStore, VariableValue } from './variable-value.js';
import { isAskCondition, extractAskQuestion } from './judge-prompt.js';

/**
 * Mandatory runtime variables always included in the sliced set.
 * These are auto-set after every `run:` node and are essential
 * for condition evaluation and control flow.
 */
export const MANDATORY_VARS = new Set([
  'last_exit_code',
  'command_failed',
  'command_succeeded',
  'last_stdout',
  'last_stderr',
]);

// ── Variable reference extraction ────────────────────────────────────────────

/** Regex for ${varName} interpolation syntax (matches default, array-index, and plain forms). */
const INTERPOLATION_RE = /\$\{([\w.]+):-((?:[^}\\]|\\.)*)\}|\$\{(\w+)\[(-?\d+)\]\}|\$\{([\w.]+)\}/g;
const BARE_IDENTIFIER_RE = /\b[A-Za-z_][\w.]*\b/g;
const CONDITION_IDENTIFIER_EXCLUSIONS = new Set([
  'and',
  'ask',
  'false',
  'grounded',
  'by',
  'in',
  'max',
  'max_retries',
  'not',
  'null',
  'or',
  'timeout',
  'true',
]);
const NESTED_INTERPOLATION_RE = /\$\{[^}]*\$\{/;
const OPEN_INTERPOLATION_RE = /\$\{/g;

function extractInterpolatedVariableNames(template: string): readonly string[] {
  const names = new Set<string>();
  for (const match of template.matchAll(INTERPOLATION_RE)) {
    const name = match[1] ?? match[3] ?? match[5];
    if (name) {
      names.add(name);
    }
  }
  return [...names];
}

export function hasUncertainInterpolationSyntax(template: string | undefined): boolean {
  if (template == null || template.length === 0) {
    return false;
  }
  if (NESTED_INTERPOLATION_RE.test(template)) {
    return true;
  }

  const opens = template.match(OPEN_INTERPOLATION_RE)?.length ?? 0;
  const closes = (template.match(/\}/g) ?? []).length;
  return opens > closes;
}

function extractConditionVariableNames(condition: string): readonly string[] {
  const names = new Set(extractInterpolatedVariableNames(condition));
  const inspectable = isAskCondition(condition) ? extractAskQuestion(condition) : condition;

  for (const match of inspectable.matchAll(BARE_IDENTIFIER_RE)) {
    const token = match[0];
    if (token == null) {
      continue;
    }

    const normalized = token.toLowerCase();
    if (CONDITION_IDENTIFIER_EXCLUSIONS.has(normalized)) {
      continue;
    }

    names.add(token);
  }

  return [...names];
}

function addReferencesFromString(target: Set<string>, value: string | undefined): void {
  if (value == null || value.length === 0) {
    return;
  }

  for (const name of extractInterpolatedVariableNames(value)) {
    target.add(name);
  }
}

function addConditionReferences(target: Set<string>, condition: string | undefined): void {
  if (condition == null || condition.length === 0) {
    return;
  }

  for (const name of extractConditionVariableNames(condition)) {
    target.add(name);
  }
}

/**
 * Extract variable names referenced by a single FlowNode.
 *
 * Returns variable names that appear in the node's text, command, condition,
 * or other string fields via `${varName}` interpolation syntax. For container
 * nodes (while, if, try, etc.) only the node's own fields are inspected — not
 * the children. For `let` nodes the assigned variable name is included.
 *
 * Pure domain function: zero external dependencies.
 */
export function extractReferencedVariables(node: FlowNode): readonly string[] {
  const names = new Set<string>();

  switch (node.kind) {
    case 'prompt':
      addReferencesFromString(names, node.text);
      break;
    case 'run':
      addReferencesFromString(names, node.command);
      break;
    case 'while':
    case 'until':
      addConditionReferences(names, node.condition);
      addReferencesFromString(names, node.groundedBy);
      break;
    case 'retry':
      break;
    case 'if':
      addConditionReferences(names, node.condition);
      addReferencesFromString(names, node.groundedBy);
      break;
    case 'try':
      addConditionReferences(names, node.catchCondition);
      break;
    case 'let':
      names.add(node.variableName);
      switch (node.source.type) {
        case 'prompt':
          addReferencesFromString(names, node.source.text);
          break;
        case 'prompt_json':
          addReferencesFromString(names, node.source.text);
          addReferencesFromString(names, node.source.schema);
          break;
        case 'run':
          addReferencesFromString(names, node.source.command);
          break;
        case 'memory':
          addReferencesFromString(names, node.source.key);
          break;
        case 'literal':
          break;
        case 'empty_list':
          break;
      }
      break;
    case 'foreach':
    case 'foreach_spawn':
      names.add(node.variableName);
      addConditionReferences(names, node.listExpression);
      addReferencesFromString(names, node.listCommand);
      break;
    case 'break':
    case 'continue':
      break;
    case 'spawn':
      addConditionReferences(names, node.condition);
      for (const variableName of node.vars ?? []) {
        names.add(variableName);
      }
      break;
    case 'await':
      break;
    case 'approve':
      names.add('approve_rejected');
      addReferencesFromString(names, node.message);
      break;
    case 'review':
      addReferencesFromString(names, node.criteria);
      addReferencesFromString(names, node.groundedBy);
      break;
    case 'race':
      names.add('race_winner');
      break;
    case 'remember':
      addReferencesFromString(names, node.text);
      addReferencesFromString(names, node.key);
      addReferencesFromString(names, node.value);
      break;
    case 'send':
      addReferencesFromString(names, node.target);
      addReferencesFromString(names, node.message);
      break;
    case 'receive':
      names.add(node.variableName);
      addReferencesFromString(names, node.from);
      break;
    case 'swarm':
      break;
    case 'start':
      break;
    case 'return':
      addConditionReferences(names, node.expression);
      break;
    case 'snapshot':
    case 'rollback':
      break;
    default: {
      const _exhaustive: never = node;
      return _exhaustive;
    }
  }

  return [...names];
}

export function nodeHasUncertainInterpolation(node: FlowNode): boolean {
  switch (node.kind) {
    case 'prompt':
      return hasUncertainInterpolationSyntax(node.text);
    case 'run':
      return hasUncertainInterpolationSyntax(node.command);
    case 'while':
    case 'until':
      return (
        hasUncertainInterpolationSyntax(node.condition) ||
        hasUncertainInterpolationSyntax(node.groundedBy)
      );
    case 'retry':
      return false;
    case 'if':
      return (
        hasUncertainInterpolationSyntax(node.condition) ||
        hasUncertainInterpolationSyntax(node.groundedBy)
      );
    case 'try':
      return hasUncertainInterpolationSyntax(node.catchCondition);
    case 'let':
      if (node.source.type === 'prompt' || node.source.type === 'prompt_json') {
        return (
          hasUncertainInterpolationSyntax(node.source.text) ||
          (node.source.type === 'prompt_json' &&
            hasUncertainInterpolationSyntax(node.source.schema))
        );
      }
      if (node.source.type === 'run') {
        return hasUncertainInterpolationSyntax(node.source.command);
      }
      if (node.source.type === 'memory') {
        return hasUncertainInterpolationSyntax(node.source.key);
      }
      return false;
    case 'foreach':
    case 'foreach_spawn':
      return (
        hasUncertainInterpolationSyntax(node.listExpression) ||
        hasUncertainInterpolationSyntax(node.listCommand)
      );
    case 'break':
    case 'continue':
      return false;
    case 'spawn':
      return hasUncertainInterpolationSyntax(node.condition);
    case 'await':
      return false;
    case 'approve':
      return hasUncertainInterpolationSyntax(node.message);
    case 'review':
      return (
        hasUncertainInterpolationSyntax(node.criteria) ||
        hasUncertainInterpolationSyntax(node.groundedBy)
      );
    case 'race':
      return false;
    case 'remember':
      return (
        hasUncertainInterpolationSyntax(node.text) ||
        hasUncertainInterpolationSyntax(node.key) ||
        hasUncertainInterpolationSyntax(node.value)
      );
    case 'send':
      return (
        hasUncertainInterpolationSyntax(node.target) ||
        hasUncertainInterpolationSyntax(node.message)
      );
    case 'receive':
      return hasUncertainInterpolationSyntax(node.from);
    case 'swarm':
    case 'start':
      return false;
    case 'return':
      return hasUncertainInterpolationSyntax(node.expression);
    case 'snapshot':
    case 'rollback':
      return false;
    default: {
      const _exhaustive: never = node;
      return _exhaustive;
    }
  }
}

// ── Execution path traversal ─────────────────────────────────────────────────

export function collectExecutionPathNodes(
  nodes: readonly FlowNode[],
  path: readonly number[],
): readonly FlowNode[] {
  const chain: FlowNode[] = [];
  let currentNodes = nodes;
  let remainingPath = [...path];

  while (remainingPath.length > 0) {
    const index = remainingPath[0]!;
    const node = currentNodes[index];
    if (node == null) {
      break;
    }

    chain.push(node);
    remainingPath = remainingPath.slice(1);
    if (remainingPath.length === 0) {
      break;
    }

    switch (node.kind) {
      case 'while':
      case 'until':
      case 'retry':
      case 'foreach':
      case 'foreach_spawn':
      case 'review':
      case 'spawn':
        currentNodes = node.body;
        break;
      case 'if':
        currentNodes = [...node.thenBranch, ...node.elseBranch];
        break;
      case 'try':
        currentNodes = [...node.body, ...node.catchBody, ...node.finallyBody];
        break;
      case 'race':
        currentNodes = node.children.flatMap((child) => [child, ...child.body]);
        break;
      case 'swarm':
        currentNodes = [...node.flow];
        break;
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
      case 'snapshot':
      case 'rollback':
        remainingPath = [];
        break;
      default: {
        const _exhaustive: never = node;
        return _exhaustive;
      }
    }
  }

  return chain;
}

// ── Relevant variable collection (shared by full and compact renderers) ──────

export function collectRelevantVariableNames(state: SessionState): ReadonlySet<string> {
  const names = new Set<string>();

  const executionPathNodes = collectExecutionPathNodes(state.flowSpec.nodes, state.currentNodePath);
  if (
    executionPathNodes.some((node) => nodeHasUncertainInterpolation(node)) ||
    state.flowSpec.completionGates.some((gate) => hasUncertainInterpolationSyntax(gate.predicate))
  ) {
    return new Set<string>();
  }

  for (const node of executionPathNodes) {
    for (const name of extractReferencedVariables(node)) {
      names.add(name);
    }
  }

  for (const gate of state.flowSpec.completionGates) {
    for (const name of extractConditionVariableNames(gate.predicate)) {
      names.add(name);
    }
  }

  return names;
}

// ── Transitive dependency resolution ─────────────────────────────────────────

/**
 * Build a map from variable name to the set of variables it transitively
 * depends on. A variable X depends on Y when X was assigned via a `let`
 * node whose source expression contains ${Y}.
 */
function buildTransitiveDeps(nodes: readonly FlowNode[]): ReadonlyMap<string, ReadonlySet<string>> {
  const directDeps = new Map<string, Set<string>>();

  function walkNodes(nodeList: readonly FlowNode[]): void {
    for (const node of nodeList) {
      if (node.kind === 'let') {
        const deps = new Set<string>();
        switch (node.source.type) {
          case 'prompt':
          case 'prompt_json':
            for (const ref of extractInterpolatedVariableNames(node.source.text)) {
              deps.add(ref);
            }
            if (node.source.type === 'prompt_json') {
              for (const ref of extractInterpolatedVariableNames(node.source.schema)) {
                deps.add(ref);
              }
            }
            break;
          case 'run':
            for (const ref of extractInterpolatedVariableNames(node.source.command)) {
              deps.add(ref);
            }
            break;
          case 'literal':
            for (const ref of extractInterpolatedVariableNames(node.source.value)) {
              deps.add(ref);
            }
            break;
          case 'memory':
            for (const ref of extractInterpolatedVariableNames(node.source.key)) {
              deps.add(ref);
            }
            break;
          case 'empty_list':
            break;
        }
        const existing = directDeps.get(node.variableName);
        if (existing) {
          for (const d of deps) existing.add(d);
        } else {
          directDeps.set(node.variableName, deps);
        }
      }

      switch (node.kind) {
        case 'while':
        case 'until':
        case 'retry':
        case 'foreach':
        case 'foreach_spawn':
        case 'spawn':
        case 'review':
          walkNodes(node.body);
          break;
        case 'if':
          walkNodes(node.thenBranch);
          walkNodes(node.elseBranch);
          break;
        case 'try':
          walkNodes(node.body);
          walkNodes(node.catchBody);
          walkNodes(node.finallyBody);
          break;
        case 'race':
          for (const child of node.children) {
            walkNodes(child.body);
          }
          break;
        case 'swarm':
          walkNodes(node.flow);
          for (const role of node.roles) {
            walkNodes(role.body);
          }
          break;
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
        case 'snapshot':
        case 'rollback':
          break;
      }
    }
  }

  walkNodes(nodes);
  return directDeps;
}

function resolveTransitiveDeps(
  names: ReadonlySet<string>,
  directDeps: ReadonlyMap<string, ReadonlySet<string>>,
): ReadonlySet<string> {
  const resolved = new Set<string>(names);
  const stack = [...names];
  const visited = new Set<string>();

  while (stack.length > 0) {
    const name = stack.pop()!;
    if (visited.has(name)) continue;
    visited.add(name);

    const deps = directDeps.get(name);
    if (deps) {
      for (const dep of deps) {
        if (!resolved.has(dep)) {
          resolved.add(dep);
          stack.push(dep);
        }
      }
    }
  }

  return resolved;
}

// ── Variable display filtering ───────────────────────────────────────────────

/** Hidden auto-variables that are excluded from compact display. */
const HIDDEN_VARIABLES = new Set(['last_exit_code', 'last_stdout', 'last_stderr']);
const AUTO_SUFFIX_RE = /_(index|length)$/;

function isHiddenVariable(key: string, _value: VariableValue, variables: VariableStore): boolean {
  if (HIDDEN_VARIABLES.has(key)) return true;
  if (AUTO_SUFFIX_RE.test(key)) return true;
  if (key === 'command_failed' || key === 'command_succeeded') {
    return String(variables['command_failed']) !== 'true';
  }
  return false;
}

// ── Public API ───────────────────────────────────────────────────────────────

export interface VariableSliceResult {
  /** The sliced variable set (subset of full store), or the full store on fallback. */
  readonly variables: readonly (readonly [string, VariableValue])[];
  /** True when dependency analysis was uncertain and fell back to the full variable set. */
  readonly fallback: boolean;
}

/**
 * Extract the set of variable names that a node references, including
 * transitive dependencies and mandatory runtime variables.
 *
 * Returns `null` when the node contains uncertain interpolation syntax
 * (e.g., nested `${...${...}}`), signaling the caller should fall back
 * to the full variable set.
 */
export function extractVariableDeps(node: FlowNode, flow: FlowSpec): ReadonlySet<string> | null {
  if (nodeHasUncertainInterpolation(node)) {
    return null;
  }

  const directRefs = new Set(extractReferencedVariables(node));

  for (const v of MANDATORY_VARS) {
    directRefs.add(v);
  }

  const transitiveDeps = buildTransitiveDeps(flow.nodes);
  return resolveTransitiveDeps(directRefs, transitiveDeps);
}

/**
 * Slice the session's variable store to only those referenced by the
 * current execution path. Falls back to the full visible set when
 * dependency analysis is uncertain or produces an empty result.
 *
 * This is the primary integration point for the compact renderer.
 */
export function sliceVariablesForCompact(state: SessionState): VariableSliceResult {
  const entries = Object.entries(state.variables);
  if (entries.length === 0) {
    return { variables: [], fallback: false };
  }

  const visible = entries
    .filter(([key, value]) => !isHiddenVariable(key, value, state.variables))
    .sort(([a], [b]) => a.localeCompare(b));

  if (visible.length === 0) {
    return { variables: [], fallback: false };
  }

  const relevant = collectRelevantVariableNames(state);

  // Empty relevant set means uncertain analysis — fall back
  if (relevant.size === 0) {
    return { variables: visible, fallback: true };
  }

  // Add mandatory vars and resolve transitive deps
  const referencedNames = new Set(relevant);
  for (const v of MANDATORY_VARS) {
    referencedNames.add(v);
  }

  const transitiveDeps = buildTransitiveDeps(state.flowSpec.nodes);
  const allDeps = resolveTransitiveDeps(referencedNames, transitiveDeps);

  const sliced = visible.filter(([key]) => allDeps.has(key));

  if (sliced.length === 0 && visible.length > 0) {
    return { variables: visible, fallback: true };
  }

  return { variables: sliced, fallback: false };
}
