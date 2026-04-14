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

function hasUncertainInterpolation(text: string): boolean {
  const stripped = text.replace(INTERPOLATION_TOKEN_RE, '');
  return stripped.includes('${');
}

function collectInterpolatedVariables(text: string, required: Set<string>): boolean {
  const uncertain = hasUncertainInterpolation(text);
  INTERPOLATION_TOKEN_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = INTERPOLATION_TOKEN_RE.exec(text)) !== null) {
    const name = match[1] ?? match[3] ?? match[5];
    if (name != null && name.length > 0) {
      required.add(name);
    }
  }
  return uncertain;
}

function collectBareConditionVariables(
  condition: string,
  variables: VariableStore,
  required: Set<string>,
): boolean {
  const uncertain = hasUncertainInterpolation(condition);
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
  return uncertain;
}

function collectConditionVariables(
  condition: string,
  variables: VariableStore,
  required: Set<string>,
): boolean {
  const subject = isAskCondition(condition) ? extractAskQuestion(condition) : condition;
  const interpolationUncertain = collectInterpolatedVariables(subject, required);
  const bareIdentifierUncertain = collectBareConditionVariables(subject, variables, required);
  return interpolationUncertain || bareIdentifierUncertain;
}

function collectNodeVariables(
  node: FlowNode,
  variables: VariableStore,
  required: Set<string>,
): boolean {
  switch (node.kind) {
    case 'prompt':
      return !collectInterpolatedVariables(node.text, required);
    case 'run':
      return !collectInterpolatedVariables(node.command, required);
    case 'let':
      if (node.append && node.variableName in variables) {
        required.add(node.variableName);
      }
      switch (node.source.type) {
        case 'prompt':
          return !collectInterpolatedVariables(node.source.text, required);
        case 'prompt_json':
          return !(
            collectInterpolatedVariables(node.source.text, required) ||
            collectInterpolatedVariables(node.source.schema, required)
          );
        case 'run':
          return !collectInterpolatedVariables(node.source.command, required);
        case 'literal':
          return !collectInterpolatedVariables(node.source.value, required);
        case 'memory':
        case 'empty_list':
          return true;
        default: {
          const _exhaustive: never = node.source;
          return _exhaustive;
        }
      }
    case 'while':
    case 'until':
    case 'if':
      return !(
        collectConditionVariables(node.condition, variables, required) ||
        (node.groundedBy != null && collectInterpolatedVariables(node.groundedBy, required))
      );
    case 'try':
      return !collectConditionVariables(node.catchCondition, variables, required);
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
      return !(
        collectInterpolatedVariables(node.listExpression, required) ||
        collectBareConditionVariables(node.listExpression, variables, required) ||
        (node.listCommand != null && collectInterpolatedVariables(node.listCommand, required))
      );
    case 'spawn':
      if (node.condition != null) {
        return !collectConditionVariables(node.condition, variables, required);
      }
      return true;
    case 'review':
      return !(
        (node.criteria != null && collectInterpolatedVariables(node.criteria, required)) ||
        (node.groundedBy != null && collectInterpolatedVariables(node.groundedBy, required))
      );
    case 'approve':
    case 'await':
    case 'break':
    case 'continue':
    case 'race':
    case 'receive':
      return true;
    case 'remember':
      return !(
        (node.text != null && collectInterpolatedVariables(node.text, required)) ||
        (node.key != null && collectInterpolatedVariables(node.key, required)) ||
        (node.value != null && collectInterpolatedVariables(node.value, required))
      );
    case 'send':
      return !(
        collectInterpolatedVariables(node.target, required) ||
        collectInterpolatedVariables(node.message, required)
      );
    case 'swarm':
    case 'start':
    case 'return':
    case 'snapshot':
    case 'rollback':
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
  try {
    for (let depth = 1; depth <= state.currentNodePath.length; depth++) {
      const node = resolveCurrentNode(state.flowSpec.nodes, state.currentNodePath.slice(0, depth));
      if (node == null) {
        return null;
      }
      pathNodes.push(node);
    }
  } catch {
    return null;
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
