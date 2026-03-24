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
  | 'break'
  | 'continue'
  | 'spawn'
  | 'await';

interface BaseNode {
  readonly kind: FlowNodeKind;
  readonly id: string;
}

export interface WhileNode extends BaseNode {
  readonly kind: 'while';
  readonly condition: string;
  readonly maxIterations: number;
  readonly body: readonly FlowNode[];
  readonly label?: string | undefined;
  readonly timeoutSeconds?: number | undefined;
}

export interface UntilNode extends BaseNode {
  readonly kind: 'until';
  readonly condition: string;
  readonly maxIterations: number;
  readonly body: readonly FlowNode[];
  readonly label?: string | undefined;
  readonly timeoutSeconds?: number | undefined;
}

export interface RetryNode extends BaseNode {
  readonly kind: 'retry';
  readonly maxAttempts: number;
  readonly backoffMs?: number;
  readonly body: readonly FlowNode[];
  readonly label?: string | undefined;
  readonly timeoutSeconds?: number | undefined;
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
  readonly transform?: string;
}

export interface ForeachNode extends BaseNode {
  readonly kind: 'foreach';
  readonly variableName: string;
  readonly listExpression: string;
  readonly listCommand?: string;
  readonly maxIterations: number;
  readonly body: readonly FlowNode[];
  readonly label?: string | undefined;
}

// H#15: Break node exits nearest enclosing loop
// H-LANG-011: Optional label targets a specific labeled loop
export interface BreakNode extends BaseNode {
  readonly kind: 'break';
  readonly label?: string | undefined;
}

// H-LANG-002: Continue node re-enters nearest enclosing loop at next iteration
// H-LANG-011: Optional label targets a specific labeled loop
export interface ContinueNode extends BaseNode {
  readonly kind: 'continue';
  readonly label?: string | undefined;
}

export interface SpawnNode extends BaseNode {
  readonly kind: 'spawn';
  readonly name: string;
  readonly body: readonly FlowNode[];
  readonly cwd?: string | undefined;
  /** H-SEC-005: Optional allowlist of variable names to pass to child. */
  readonly vars?: readonly string[] | undefined;
}

export type AwaitTarget = string | 'all';

export interface AwaitNode extends BaseNode {
  readonly kind: 'await';
  readonly target: AwaitTarget;
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
  | BreakNode
  | ContinueNode
  | SpawnNode
  | AwaitNode;

export const DEFAULT_MAX_ITERATIONS = 5;
export const DEFAULT_MAX_ATTEMPTS = 3;
export const DEFAULT_MAX_FOREACH = 50;

export function createWhileNode(
  id: string,
  condition: string,
  body: readonly FlowNode[],
  maxIterations?: number,
  label?: string,
  timeoutSeconds?: number,
): WhileNode {
  return {
    kind: 'while',
    id,
    condition,
    maxIterations: maxIterations ?? DEFAULT_MAX_ITERATIONS,
    body,
    ...(label != null ? { label } : {}),
    ...(timeoutSeconds != null ? { timeoutSeconds } : {}),
  };
}

export function createUntilNode(
  id: string,
  condition: string,
  body: readonly FlowNode[],
  maxIterations?: number,
  label?: string,
  timeoutSeconds?: number,
): UntilNode {
  return {
    kind: 'until',
    id,
    condition,
    maxIterations: maxIterations ?? DEFAULT_MAX_ITERATIONS,
    body,
    ...(label != null ? { label } : {}),
    ...(timeoutSeconds != null ? { timeoutSeconds } : {}),
  };
}

export function createRetryNode(
  id: string,
  body: readonly FlowNode[],
  maxAttempts?: number,
  label?: string,
  timeoutSeconds?: number,
  backoffMs?: number,
): RetryNode {
  return {
    kind: 'retry',
    id,
    maxAttempts: maxAttempts ?? DEFAULT_MAX_ATTEMPTS,
    body,
    ...(backoffMs != null ? { backoffMs } : {}),
    ...(label != null ? { label } : {}),
    ...(timeoutSeconds != null ? { timeoutSeconds } : {}),
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
  return timeoutMs != null ? { kind: 'run', id, command, timeoutMs } : { kind: 'run', id, command };
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
  transform?: string,
): LetNode {
  return transform != null
    ? { kind: 'let', id, variableName, source, append, transform }
    : { kind: 'let', id, variableName, source, append };
}

export function createBreakNode(id: string, label?: string): BreakNode {
  return label != null ? { kind: 'break', id, label } : { kind: 'break', id };
}

export function createContinueNode(id: string, label?: string): ContinueNode {
  return label != null ? { kind: 'continue', id, label } : { kind: 'continue', id };
}

export function createForeachNode(
  id: string,
  variableName: string,
  listExpression: string,
  body: readonly FlowNode[],
  maxIterations?: number,
  label?: string,
  listCommand?: string,
): ForeachNode {
  return {
    kind: 'foreach',
    id,
    variableName,
    listExpression,
    maxIterations: maxIterations ?? DEFAULT_MAX_FOREACH,
    body,
    ...(label != null ? { label } : {}),
    ...(listCommand != null ? { listCommand } : {}),
  };
}

export function createSpawnNode(
  id: string,
  name: string,
  body: readonly FlowNode[],
  cwd?: string,
  vars?: readonly string[],
): SpawnNode {
  return {
    kind: 'spawn',
    id,
    name,
    body,
    ...(cwd != null ? { cwd } : {}),
    ...(vars != null ? { vars } : {}),
  };
}

export function createAwaitNode(id: string, target: AwaitTarget): AwaitNode {
  return { kind: 'await', id, target };
}
