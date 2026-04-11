import { interpolate } from '../domain/interpolate.js';
import type { SessionState } from '../domain/session-state.js';
import {
  stringifyVariableValue,
  type VariableStore,
  type VariableValue,
} from '../domain/variable-value.js';

export type FlowEvalTraceKind =
  | 'and'
  | 'or'
  | 'not'
  | 'comparison'
  | 'contains'
  | 'variable'
  | 'literal';

export interface FlowEvalOperandTrace {
  readonly token: string;
  readonly resolved: VariableValue | string;
  readonly source: 'variable' | 'literal';
  readonly variableName?: string | undefined;
}

export interface FlowEvalTraceStep {
  readonly kind: FlowEvalTraceKind;
  readonly expression: string;
  readonly result: boolean | null;
  readonly depth: number;
  readonly leftResult?: boolean | null;
  readonly rightResult?: boolean | null;
  readonly innerResult?: boolean | null;
  readonly left?: FlowEvalOperandTrace;
  readonly right?: FlowEvalOperandTrace;
}

export interface FlowEvalResult {
  readonly condition: string;
  readonly interpolatedCondition: string;
  readonly result: boolean | null;
  readonly trace: readonly FlowEvalTraceStep[];
  readonly undefinedVariables: readonly string[];
  readonly errors: readonly string[];
}

export interface FlowEvalVariableContext {
  readonly variables: VariableStore;
  readonly source: 'active_session' | 'last_session' | 'none';
}

const COMPARISON_RE = /^(.+?)\s+(==|!=|>=|<=|>|<)\s+(.+)$/;
const BUILTIN_DEFAULT_FALSE = new Set(['command_failed', 'command_succeeded']);

function stripQuotes(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function isNumericLiteral(token: string): boolean {
  return /^-?\d+(?:\.\d+)?$/.test(token.trim());
}

function isBareIdentifier(token: string): boolean {
  return /^[A-Za-z_][\w.]*$/.test(token.trim());
}

function formatUndefinedVariableError(names: readonly string[]): string {
  if (names.length === 1) {
    return `Undefined variable: ${names[0]}`;
  }
  return `Undefined variables: ${names.join(', ')}`;
}

function unwrapOuterParens(expression: string): string {
  const trimmed = expression.trim();
  if (!trimmed.startsWith('(') || !trimmed.endsWith(')')) {
    return trimmed;
  }

  let depth = 0;
  for (let i = 0; i < trimmed.length; i++) {
    const char = trimmed[i];
    if (char === '(') {
      depth += 1;
    } else if (char === ')') {
      depth -= 1;
      if (depth === 0 && i < trimmed.length - 1) {
        return trimmed;
      }
    }
  }

  return trimmed.slice(1, -1).trim();
}

function findRightmostOperatorOutsideParens(
  condition: string,
): { operator: 'and' | 'or'; index: number; length: number } | null {
  const depths: number[] = new Array(condition.length).fill(0);
  let depth = 0;
  for (let i = 0; i < condition.length; i++) {
    depths[i] = depth;
    if (condition[i] === '(') depth += 1;
    else if (condition[i] === ')') depth -= 1;
  }

  let orMatch: { index: number; length: number } | null = null;
  let andMatch: { index: number; length: number } | null = null;
  const re = /\s+(and|or)\s+/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(condition)) !== null) {
    if ((depths[match.index] ?? 0) !== 0) continue;
    const operator = match[1]!.toLowerCase() as 'and' | 'or';
    if (operator === 'or') {
      orMatch = { index: match.index, length: match[0].length };
    } else {
      andMatch = { index: match.index, length: match[0].length };
    }
  }

  if (orMatch) return { operator: 'or', ...orMatch };
  if (andMatch) return { operator: 'and', ...andMatch };
  return null;
}

function resolveOperandTrace(
  token: string,
  variables: VariableStore,
  undefinedVariables: Set<string>,
): FlowEvalOperandTrace {
  const trimmed = token.trim();
  const refMatch = /^\$\{([\w.]+)\}$/.exec(trimmed);
  if (refMatch?.[1]) {
    const name = refMatch[1];
    if (name in variables) {
      return {
        token: trimmed,
        resolved: variables[name]!,
        source: 'variable',
        variableName: name,
      };
    }
    undefinedVariables.add(name);
    return { token: trimmed, resolved: trimmed, source: 'literal', variableName: name };
  }

  if (trimmed in variables) {
    return {
      token: trimmed,
      resolved: variables[trimmed]!,
      source: 'variable',
      variableName: trimmed,
    };
  }

  if (isBareIdentifier(trimmed) && !BUILTIN_DEFAULT_FALSE.has(trimmed)) {
    undefinedVariables.add(trimmed);
  }

  if (isNumericLiteral(trimmed)) {
    return { token: trimmed, resolved: Number(trimmed), source: 'literal' };
  }

  return { token: trimmed, resolved: stripQuotes(trimmed), source: 'literal' };
}

function evaluateSimpleConditionTrace(
  expression: string,
  variables: VariableStore,
  undefinedVariables: Set<string>,
): { result: boolean | null; step: FlowEvalTraceStep } {
  const trimmed = expression.trim();
  if (trimmed in variables) {
    const value = variables[trimmed];
    if (value === undefined) {
      undefinedVariables.add(trimmed);
      return {
        result: null,
        step: { kind: 'variable', expression: trimmed, result: null, depth: 0 },
      };
    }
    const result =
      typeof value === 'boolean'
        ? value
        : typeof value === 'number'
          ? value !== 0
          : typeof value === 'string'
            ? value.length > 0
            : Array.isArray(value)
              ? value.length > 0
              : Object.keys(value).length > 0;
    return {
      result,
      step: {
        kind: 'variable',
        expression: trimmed,
        result,
        depth: 0,
        left: {
          token: trimmed,
          resolved: value,
          source: 'variable',
          variableName: trimmed,
        },
      },
    };
  }

  if (BUILTIN_DEFAULT_FALSE.has(trimmed)) {
    return {
      result: false,
      step: { kind: 'literal', expression: trimmed, result: false, depth: 0 },
    };
  }

  if (trimmed === 'true' || trimmed === 'false') {
    return {
      result: trimmed === 'true',
      step: {
        kind: 'literal',
        expression: trimmed,
        result: trimmed === 'true',
        depth: 0,
      },
    };
  }

  if (isBareIdentifier(trimmed)) {
    undefinedVariables.add(trimmed);
  }

  return {
    result: null,
    step: { kind: 'variable', expression: trimmed, result: null, depth: 0 },
  };
}

function evaluateExpression(
  expression: string,
  variables: VariableStore,
  undefinedVariables: Set<string>,
  trace: FlowEvalTraceStep[],
  depth: number,
): boolean | null {
  const trimmed = unwrapOuterParens(expression);

  const logical = findRightmostOperatorOutsideParens(trimmed);
  if (logical) {
    const leftExpr = trimmed.slice(0, logical.index);
    const rightExpr = trimmed.slice(logical.index + logical.length);
    const leftResult = evaluateExpression(
      leftExpr,
      variables,
      undefinedVariables,
      trace,
      depth + 1,
    );
    const rightResult = evaluateExpression(
      rightExpr,
      variables,
      undefinedVariables,
      trace,
      depth + 1,
    );

    let result: boolean | null;
    if (logical.operator === 'and') {
      if (leftResult === false || rightResult === false) result = false;
      else if (leftResult === null || rightResult === null) result = null;
      else result = leftResult && rightResult;
    } else {
      if (leftResult === true || rightResult === true) result = true;
      else if (leftResult === null || rightResult === null) result = null;
      else result = leftResult || rightResult;
    }

    trace.push({
      kind: logical.operator,
      expression: trimmed,
      result,
      depth,
      leftResult,
      rightResult,
    });
    return result;
  }

  if (trimmed.startsWith('not ')) {
    const inner = evaluateExpression(
      trimmed.slice(4),
      variables,
      undefinedVariables,
      trace,
      depth + 1,
    );
    const result = inner === null ? null : !inner;
    trace.push({
      kind: 'not',
      expression: trimmed,
      result,
      depth,
      innerResult: inner,
    });
    return result;
  }

  const containsIdx = trimmed.search(/\s+contains\s+/i);
  if (containsIdx >= 0) {
    const containsMatch = /\s+contains\s+/i.exec(trimmed.slice(containsIdx));
    const left = resolveOperandTrace(trimmed.slice(0, containsIdx), variables, undefinedVariables);
    const right = resolveOperandTrace(
      trimmed.slice(containsIdx + containsMatch![0].length),
      variables,
      undefinedVariables,
    );
    const result = String(left.resolved).includes(String(right.resolved));
    trace.push({
      kind: 'contains',
      expression: trimmed,
      result,
      depth,
      left,
      right,
    });
    return result;
  }

  const comparison = COMPARISON_RE.exec(trimmed);
  if (comparison?.[1] && comparison[2] && comparison[3]) {
    const left = resolveOperandTrace(comparison[1], variables, undefinedVariables);
    const right = resolveOperandTrace(comparison[3], variables, undefinedVariables);
    const op = comparison[2];

    const leftNumber = typeof left.resolved === 'number' ? left.resolved : Number(left.resolved);
    const rightNumber =
      typeof right.resolved === 'number' ? right.resolved : Number(right.resolved);
    const numeric = !Number.isNaN(leftNumber) && !Number.isNaN(rightNumber);

    let result: boolean | null;
    switch (op) {
      case '==':
        result = numeric
          ? leftNumber === rightNumber
          : stringifyVariableValue(left.resolved) === stringifyVariableValue(right.resolved);
        break;
      case '!=':
        result = numeric
          ? leftNumber !== rightNumber
          : stringifyVariableValue(left.resolved) !== stringifyVariableValue(right.resolved);
        break;
      case '>':
        result = numeric ? leftNumber > rightNumber : null;
        break;
      case '<':
        result = numeric ? leftNumber < rightNumber : null;
        break;
      case '>=':
        result = numeric ? leftNumber >= rightNumber : null;
        break;
      case '<=':
        result = numeric ? leftNumber <= rightNumber : null;
        break;
      default:
        result = null;
    }

    trace.push({
      kind: 'comparison',
      expression: trimmed,
      result,
      depth,
      left,
      right,
    });
    return result;
  }

  const simple = evaluateSimpleConditionTrace(trimmed, variables, undefinedVariables);
  trace.push({ ...simple.step, depth });
  return simple.result;
}

export function resolveFlowEvalVariables(
  currentState: SessionState | null,
  lastSessionState: SessionState | null,
): FlowEvalVariableContext {
  if (currentState?.status === 'active') {
    return { source: 'active_session', variables: currentState.variables };
  }

  if (currentState != null) {
    return { source: 'last_session', variables: currentState.variables };
  }

  if (lastSessionState != null) {
    return { source: 'last_session', variables: lastSessionState.variables };
  }

  return { source: 'none', variables: {} };
}

export function evaluateFlowConditionWithTrace(
  condition: string,
  variables: VariableStore,
): FlowEvalResult {
  const interpolatedCondition = interpolate(condition, variables).trim();
  const undefinedVariables = new Set<string>();
  const trace: FlowEvalTraceStep[] = [];
  const result = evaluateExpression(interpolatedCondition, variables, undefinedVariables, trace, 0);

  const missing = Array.from(undefinedVariables).sort((left, right) => left.localeCompare(right));
  const errors = missing.length > 0 ? [formatUndefinedVariableError(missing)] : [];
  return {
    condition,
    interpolatedCondition,
    result,
    trace,
    undefinedVariables: missing,
    errors,
  };
}
