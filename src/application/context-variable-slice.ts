import type { FlowNode } from '../domain/flow-node.js';
import { isAskCondition, extractAskQuestion } from '../domain/judge-prompt.js';
import type { SessionState } from '../domain/session-state.js';
import type { VariableStore, VariableValue } from '../domain/variable-value.js';
import { resolveCurrentNode } from './advance-flow.js';

const INTERPOLATION_TOKEN_RE =
  /\$\{([\w.]+):-((?:[^}\\]|\\.)*)\}|\$\{(\w+)\[(-?\d+)\]\}|\$\{([\w.]+)\}/g;

const CONDITION_KEYWORDS = new Set(['and', 'or', 'not', 'contains', 'true', 'false']);

const ALWAYS_INCLUDED_VARIABLES = new Set([
  'approve_rejected',
  'command_failed',
  'command_succeeded',
  'last_exit_code',
  'last_stdout',
  'last_stderr',
  'race_winner',
  '_retry_backoff_seconds',
]);

const ALWAYS_INCLUDED_PREFIXES = ['_review_result.', '_runtime_diagnostic.'];

function collectInterpolatedVariables(text: string, required: Set<string>): void {
  INTERPOLATION_TOKEN_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = INTERPOLATION_TOKEN_RE.exec(text)) !== null) {
    const name = match[1] ?? match[3] ?? match[5];
    if (name != null && name.length > 0) {
      required.add(name);
    }
  }
}

function collectBareConditionVariables(
  condition: string,
  variables: VariableStore,
  required: Set<string>,
): void {
  const scrubbed = condition.replace(INTERPOLATION_TOKEN_RE, ' ');
  const identifiers = scrubbed.match(/\b[A-Za-z_][\w.]*\b/g) ?? [];
  for (const identifier of identifiers) {
    if (CONDITION_KEYWORDS.has(identifier.toLowerCase())) {
      continue;
    }
    if (identifier in variables) {
      required.add(identifier);
    }
  }
}

function collectConditionVariables(
  condition: string,
  variables: VariableStore,
  required: Set<string>,
): void {
  const subject = isAskCondition(condition) ? extractAskQuestion(condition) : condition;
  collectInterpolatedVariables(subject, required);
  collectBareConditionVariables(subject, variables, required);
}

function collectNodeVariables(
  node: FlowNode,
  variables: VariableStore,
  required: Set<string>,
): boolean {
  switch (node.kind) {
    case 'prompt':
      collectInterpolatedVariables(node.text, required);
      return true;
    case 'run':
      collectInterpolatedVariables(node.command, required);
      return true;
    case 'let':
      if (node.append && node.variableName in variables) {
        required.add(node.variableName);
      }
      switch (node.source.type) {
        case 'prompt':
          collectInterpolatedVariables(node.source.text, required);
          return true;
        case 'prompt_json':
          collectInterpolatedVariables(node.source.text, required);
          collectInterpolatedVariables(node.source.schema, required);
          return true;
        case 'run':
          collectInterpolatedVariables(node.source.command, required);
          return true;
        case 'literal':
          collectInterpolatedVariables(node.source.value, required);
          return true;
        case 'memory':
        case 'empty_list':
          return true;
      }
      return true;
    case 'while':
    case 'until':
    case 'if':
      collectConditionVariables(node.condition, variables, required);
      if (node.groundedBy != null) {
        collectInterpolatedVariables(node.groundedBy, required);
      }
      return true;
    case 'try':
      return true;
    case 'retry':
      if ('command_failed' in variables) {
        required.add('command_failed');
      }
      return true;
    case 'foreach':
    case 'foreach_spawn':
      if (node.variableName in variables) {
        required.add(node.variableName);
      }
      collectInterpolatedVariables(node.listExpression, required);
      collectBareConditionVariables(node.listExpression, variables, required);
      if (node.listCommand != null) {
        collectInterpolatedVariables(node.listCommand, required);
      }
      return true;
    case 'spawn':
      if (node.condition != null) {
        collectConditionVariables(node.condition, variables, required);
      }
      return true;
    case 'review':
      if (node.criteria != null) {
        collectInterpolatedVariables(node.criteria, required);
      }
      if (node.groundedBy != null) {
        collectInterpolatedVariables(node.groundedBy, required);
      }
      return true;
    case 'approve':
    case 'await':
    case 'break':
    case 'continue':
    case 'race':
    case 'receive':
      return true;
    case 'remember':
      if (node.text != null) {
        collectInterpolatedVariables(node.text, required);
      }
      if (node.key != null) {
        collectInterpolatedVariables(node.key, required);
      }
      if (node.value != null) {
        collectInterpolatedVariables(node.value, required);
      }
      return true;
    case 'send':
      collectInterpolatedVariables(node.target, required);
      collectInterpolatedVariables(node.message, required);
      return true;
    case 'swarm':
    case 'start':
    case 'return':
      return false;
    default: {
      const _exhaustive: never = node;
      return _exhaustive;
    }
  }
}

function collectPathNodes(state: SessionState): FlowNode[] | null {
  if (state.currentNodePath.length === 0) {
    return null;
  }

  const pathNodes: FlowNode[] = [];
  for (let depth = 1; depth <= state.currentNodePath.length; depth++) {
    const node = resolveCurrentNode(state.flowSpec.nodes, state.currentNodePath.slice(0, depth));
    if (node == null) {
      return null;
    }
    pathNodes.push(node);
  }
  return pathNodes;
}

function collectAlwaysIncludedVariables(state: SessionState, required: Set<string>): void {
  for (const key of ALWAYS_INCLUDED_VARIABLES) {
    if (key in state.variables) {
      required.add(key);
    }
  }

  for (const key of Object.keys(state.variables)) {
    if (ALWAYS_INCLUDED_PREFIXES.some((prefix) => key.startsWith(prefix))) {
      required.add(key);
    }
  }
}

export function createInjectionContextState(state: SessionState): SessionState {
  const pathNodes = collectPathNodes(state);
  if (pathNodes == null) {
    return state;
  }

  const required = new Set<string>();
  collectAlwaysIncludedVariables(state, required);

  for (const node of pathNodes) {
    if (!collectNodeVariables(node, state.variables, required)) {
      return state;
    }
  }

  if (required.size === 0) {
    return { ...state, variables: {} };
  }

  const filteredVariables: Record<string, VariableValue> = {};
  for (const key of required) {
    if (key in state.variables) {
      filteredVariables[key] = state.variables[key]!;
    }
  }

  return { ...state, variables: filteredVariables };
}
