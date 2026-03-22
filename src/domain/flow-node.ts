/**
 * FlowNode — the static program graph.
 *
 * Each node represents one instruction in the control-flow DSL.
 * The graph is static; all runtime state lives in SessionState.
 */

export type FlowNodeKind =
  | 'while'
  | 'until'
  | 'retry'
  | 'if'
  | 'prompt'
  | 'run'
  | 'try'
  | 'let'
  | 'foreach'
  | 'break';

interface BaseNode {
  readonly kind: FlowNodeKind;
  readonly id: string;
}

export interface WhileNode extends BaseNode {
  readonly kind: 'while';
  readonly condition: string;
  readonly maxIterations: number;
  readonly body: readonly FlowNode[];
}

export interface UntilNode extends BaseNode {
  readonly kind: 'until';
  readonly condition: string;
  readonly maxIterations: number;
  readonly body: readonly FlowNode[];
}

export interface RetryNode extends BaseNode {
  readonly kind: 'retry';
  readonly maxAttempts: number;
  readonly body: readonly FlowNode[];
}

export interface IfNode extends BaseNode {
  readonly kind: 'if';
  readonly condition: string;
  readonly thenBranch: readonly FlowNode[];
  readonly elseBranch: readonly FlowNode[];
}

export interface PromptNode extends BaseNode {
  readonly kind: 'prompt';
  readonly text: string;
}

export interface RunNode extends BaseNode {
  readonly kind: 'run';
  readonly command: string;
  readonly timeoutMs?: number;
}

export interface TryNode extends BaseNode {
  readonly kind: 'try';
  readonly body: readonly FlowNode[];
  readonly catchCondition: string;
  readonly catchBody: readonly FlowNode[];
  readonly finallyBody: readonly FlowNode[];
}

export type LetSource =
  | { readonly type: 'prompt'; readonly text: string }
  | { readonly type: 'run'; readonly command: string }
  | { readonly type: 'literal'; readonly value: string }
  | { readonly type: 'empty_list' };

export interface LetNode extends BaseNode {
  readonly kind: 'let';
  readonly variableName: string;
  readonly source: LetSource;
  readonly append: boolean;
}

export interface ForeachNode extends BaseNode {
  readonly kind: 'foreach';
  readonly variableName: string;
  readonly listExpression: string;
  readonly maxIterations: number;
  readonly body: readonly FlowNode[];
}

// H#15: Break node exits nearest enclosing loop
export interface BreakNode extends BaseNode {
  readonly kind: 'break';
}

export type FlowNode =
  | WhileNode
  | UntilNode
  | RetryNode
  | IfNode
  | PromptNode
  | RunNode
  | TryNode
  | LetNode
  | ForeachNode
  | BreakNode;

export const DEFAULT_MAX_ITERATIONS = 5;
export const DEFAULT_MAX_ATTEMPTS = 3;
export const DEFAULT_MAX_FOREACH = 50;

export function createWhileNode(
  id: string,
  condition: string,
  body: readonly FlowNode[],
  maxIterations?: number,
): WhileNode {
  return {
    kind: 'while',
    id,
    condition,
    maxIterations: maxIterations ?? DEFAULT_MAX_ITERATIONS,
    body,
  };
}

export function createUntilNode(
  id: string,
  condition: string,
  body: readonly FlowNode[],
  maxIterations?: number,
): UntilNode {
  return {
    kind: 'until',
    id,
    condition,
    maxIterations: maxIterations ?? DEFAULT_MAX_ITERATIONS,
    body,
  };
}

export function createRetryNode(
  id: string,
  body: readonly FlowNode[],
  maxAttempts?: number,
): RetryNode {
  return {
    kind: 'retry',
    id,
    maxAttempts: maxAttempts ?? DEFAULT_MAX_ATTEMPTS,
    body,
  };
}

export function createIfNode(
  id: string,
  condition: string,
  thenBranch: readonly FlowNode[],
  elseBranch: readonly FlowNode[] = [],
): IfNode {
  return { kind: 'if', id, condition, thenBranch, elseBranch };
}

export function createPromptNode(id: string, text: string): PromptNode {
  return { kind: 'prompt', id, text };
}

export function createRunNode(id: string, command: string, timeoutMs?: number): RunNode {
  return timeoutMs ? { kind: 'run', id, command, timeoutMs } : { kind: 'run', id, command };
}

export function createTryNode(
  id: string,
  body: readonly FlowNode[],
  catchCondition: string,
  catchBody: readonly FlowNode[],
  finallyBody: readonly FlowNode[] = [],
): TryNode {
  return { kind: 'try', id, body, catchCondition, catchBody, finallyBody };
}

export function createLetNode(
  id: string,
  variableName: string,
  source: LetSource,
  append = false,
): LetNode {
  return { kind: 'let', id, variableName, source, append };
}

export function createBreakNode(id: string): BreakNode {
  return { kind: 'break', id };
}

export function createForeachNode(
  id: string,
  variableName: string,
  listExpression: string,
  body: readonly FlowNode[],
  maxIterations?: number,
): ForeachNode {
  return {
    kind: 'foreach',
    id,
    variableName,
    listExpression,
    maxIterations: maxIterations ?? DEFAULT_MAX_FOREACH,
    body,
  };
}
