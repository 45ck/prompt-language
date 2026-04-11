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
  | 'await'
  | 'approve'
  | 'review'
  | 'race'
  | 'foreach_spawn'
  | 'remember'
  | 'send'
  | 'receive'
  | 'swarm'
  | 'start'
  | 'return';

export type VariableDeclarationKind = 'let' | 'var' | 'const';

export interface FlowNodeSource {
  readonly line: number;
  readonly column: number;
  readonly source?: string | undefined;
  readonly text?: string | undefined;
}

interface BaseNode {
  readonly kind: FlowNodeKind;
  readonly id: string;
  readonly position?: FlowNodeSource | undefined;
}

export interface WhileNode extends BaseNode {
  readonly kind: 'while';
  readonly condition: string;
  readonly maxIterations: number;
  readonly body: readonly FlowNode[];
  readonly label?: string | undefined;
  readonly timeoutSeconds?: number | undefined;
  /** H-ASK-002: Maximum retry prompts for unresolved ask verdicts. */
  readonly askMaxRetries?: number | undefined;
  /** Shell command whose stdout is included as evidence for AI condition evaluation. */
  readonly groundedBy?: string | undefined;
  readonly askProfile?: string | undefined;
}

export interface UntilNode extends BaseNode {
  readonly kind: 'until';
  readonly condition: string;
  readonly maxIterations: number;
  readonly body: readonly FlowNode[];
  readonly label?: string | undefined;
  readonly timeoutSeconds?: number | undefined;
  /** H-ASK-002: Maximum retry prompts for unresolved ask verdicts. */
  readonly askMaxRetries?: number | undefined;
  /** Shell command whose stdout is included as evidence for AI condition evaluation. */
  readonly groundedBy?: string | undefined;
  readonly askProfile?: string | undefined;
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
  /** H-ASK-002: Maximum retry prompts for unresolved ask verdicts. */
  readonly askMaxRetries?: number | undefined;
  /** Shell command whose stdout is included as evidence for AI condition evaluation. */
  readonly groundedBy?: string | undefined;
  readonly askProfile?: string | undefined;
}

export interface PromptNode extends BaseNode {
  readonly kind: 'prompt';
  readonly text: string;
  readonly profile?: string | undefined;
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
  | { readonly type: 'prompt'; readonly text: string; readonly profile?: string | undefined }
  | {
      readonly type: 'prompt_json';
      readonly text: string;
      readonly schema: string;
      readonly profile?: string | undefined;
    }
  | { readonly type: 'run'; readonly command: string }
  | { readonly type: 'memory'; readonly key: string }
  | { readonly type: 'literal'; readonly value: string }
  | { readonly type: 'empty_list' };

export interface LetNode extends BaseNode {
  readonly kind: 'let';
  readonly declarationKind: VariableDeclarationKind;
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
  /** beads: prompt-language-2j9v — model to use for the child claude process. */
  readonly model?: string | undefined;
  /** beads: prompt-language-lmep — condition guard; spawn is skipped when false. */
  readonly condition?: string | undefined;
}

export type AwaitTarget = string | 'all' | readonly string[];

export interface AwaitNode extends BaseNode {
  readonly kind: 'await';
  readonly target: AwaitTarget;
}

/**
 * ApproveNode — interactive human-approval gate.
 * The agent waits for a yes/no response before advancing.
 * On rejection, sets session variable `approve_rejected = "true"`.
 */
export interface ApproveNode extends BaseNode {
  readonly kind: 'approve';
  readonly message: string;
  readonly timeoutSeconds?: number | undefined;
}

/**
 * ReviewNode — iterative AI review loop.
 * Enters body, then evaluates against criteria (optionally grounded by a command).
 * Re-loops up to maxRounds until the grounded-by command exits 0 or rounds are exhausted.
 */
export interface ReviewNode extends BaseNode {
  readonly kind: 'review';
  readonly maxRounds: number;
  readonly strict?: boolean | undefined;
  readonly judgeName?: string | undefined;
  readonly criteria?: string | undefined;
  readonly groundedBy?: string | undefined;
  readonly body: readonly FlowNode[];
}

/**
 * RaceNode — launches multiple spawn children in parallel; the first to succeed wins.
 * The winner's variables are imported with a name prefix and race_winner is set.
 */
export interface RaceNode extends BaseNode {
  readonly kind: 'race';
  readonly children: readonly SpawnNode[];
  readonly timeoutSeconds?: number | undefined;
}

/**
 * ForeachSpawnNode — for each item in a list, launches a separate spawn child in parallel.
 * Use `await all` after this node to synchronize.
 */
export interface ForeachSpawnNode extends BaseNode {
  readonly kind: 'foreach_spawn';
  readonly variableName: string;
  readonly listExpression: string;
  readonly listCommand?: string | undefined;
  readonly maxItems: number;
  readonly body: readonly FlowNode[];
  readonly label?: string | undefined;
}

/**
 * RememberNode — stores a fact in the persistent memory store.
 * If `key`+`value` are both set, stores key/value. Otherwise stores free-form `text`.
 */
export interface RememberNode extends BaseNode {
  readonly kind: 'remember';
  readonly text?: string | undefined;
  readonly key?: string | undefined;
  readonly value?: string | undefined;
}

/**
 * SendNode — sends a message to a named channel (inter-agent messaging).
 */
export interface SendNode extends BaseNode {
  readonly kind: 'send';
  readonly target: string;
  readonly message: string;
}

/**
 * ReceiveNode — reads a message from a named channel into a variable.
 * Blocks until a message arrives or `timeoutSeconds` elapses.
 */
export interface ReceiveNode extends BaseNode {
  readonly kind: 'receive';
  readonly variableName: string;
  readonly from?: string | undefined;
  readonly timeoutSeconds?: number | undefined;
}

export interface SwarmRoleDefinition {
  readonly id: string;
  readonly name: string;
  readonly body: readonly FlowNode[];
  readonly cwd?: string | undefined;
  readonly vars?: readonly string[] | undefined;
  readonly model?: string | undefined;
}

export interface SwarmNode extends BaseNode {
  readonly kind: 'swarm';
  readonly name: string;
  readonly roles: readonly SwarmRoleDefinition[];
  readonly flow: readonly FlowNode[];
}

export interface StartNode extends BaseNode {
  readonly kind: 'start';
  readonly targets: readonly string[];
}

export interface ReturnNode extends BaseNode {
  readonly kind: 'return';
  readonly expression: string;
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
  | AwaitNode
  | ApproveNode
  | ReviewNode
  | RaceNode
  | ForeachSpawnNode
  | RememberNode
  | SendNode
  | ReceiveNode
  | SwarmNode
  | StartNode
  | ReturnNode;

export const DEFAULT_MAX_ITERATIONS = 5;
export const DEFAULT_MAX_ATTEMPTS = 3;
export const DEFAULT_MAX_FOREACH = 50;

export function withNodeSource<T extends FlowNode>(node: T, source?: FlowNodeSource): T {
  return source == null ? node : ({ ...node, position: source } satisfies T);
}

export function createWhileNode(
  id: string,
  condition: string,
  body: readonly FlowNode[],
  maxIterations?: number,
  label?: string,
  timeoutSeconds?: number,
  groundedBy?: string,
  askMaxRetries?: number,
  askProfile?: string,
): WhileNode {
  return {
    kind: 'while',
    id,
    condition,
    maxIterations: maxIterations ?? DEFAULT_MAX_ITERATIONS,
    body,
    ...(label != null ? { label } : {}),
    ...(timeoutSeconds != null ? { timeoutSeconds } : {}),
    ...(askMaxRetries != null ? { askMaxRetries } : {}),
    ...(groundedBy != null ? { groundedBy } : {}),
    ...(askProfile != null ? { askProfile } : {}),
  };
}

export function createUntilNode(
  id: string,
  condition: string,
  body: readonly FlowNode[],
  maxIterations?: number,
  label?: string,
  timeoutSeconds?: number,
  groundedBy?: string,
  askMaxRetries?: number,
  askProfile?: string,
): UntilNode {
  return {
    kind: 'until',
    id,
    condition,
    maxIterations: maxIterations ?? DEFAULT_MAX_ITERATIONS,
    body,
    ...(label != null ? { label } : {}),
    ...(timeoutSeconds != null ? { timeoutSeconds } : {}),
    ...(askMaxRetries != null ? { askMaxRetries } : {}),
    ...(groundedBy != null ? { groundedBy } : {}),
    ...(askProfile != null ? { askProfile } : {}),
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
  groundedBy?: string,
  askMaxRetries?: number,
  askProfile?: string,
): IfNode {
  return {
    kind: 'if',
    id,
    condition,
    thenBranch,
    elseBranch,
    ...(askMaxRetries != null ? { askMaxRetries } : {}),
    ...(groundedBy != null ? { groundedBy } : {}),
    ...(askProfile != null ? { askProfile } : {}),
  };
}

export function createPromptNode(id: string, text: string, profile?: string): PromptNode {
  return profile != null ? { kind: 'prompt', id, text, profile } : { kind: 'prompt', id, text };
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
  declarationKind: VariableDeclarationKind = 'let',
): LetNode {
  return transform != null
    ? { kind: 'let', id, declarationKind, variableName, source, append, transform }
    : { kind: 'let', id, declarationKind, variableName, source, append };
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
  model?: string,
  condition?: string,
): SpawnNode {
  return {
    kind: 'spawn',
    id,
    name,
    body,
    ...(cwd != null ? { cwd } : {}),
    ...(vars != null ? { vars } : {}),
    ...(model != null ? { model } : {}),
    ...(condition != null ? { condition } : {}),
  };
}

export function createAwaitNode(id: string, target: AwaitTarget): AwaitNode {
  return { kind: 'await', id, target };
}

export function createApproveNode(
  id: string,
  message: string,
  timeoutSeconds?: number,
): ApproveNode {
  return timeoutSeconds != null
    ? { kind: 'approve', id, message, timeoutSeconds }
    : { kind: 'approve', id, message };
}

export function createReviewNode(
  id: string,
  body: readonly FlowNode[],
  maxRounds: number,
  criteria?: string,
  groundedBy?: string,
  strict?: boolean,
  judgeName?: string,
): ReviewNode {
  return {
    kind: 'review',
    id,
    maxRounds,
    body,
    ...(strict === true ? { strict: true } : {}),
    ...(judgeName != null ? { judgeName } : {}),
    ...(criteria != null ? { criteria } : {}),
    ...(groundedBy != null ? { groundedBy } : {}),
  };
}

export function createRaceNode(
  id: string,
  children: readonly SpawnNode[],
  timeoutSeconds?: number,
): RaceNode {
  return {
    kind: 'race',
    id,
    children,
    ...(timeoutSeconds != null ? { timeoutSeconds } : {}),
  };
}

export function createForeachSpawnNode(
  id: string,
  variableName: string,
  listExpression: string,
  body: readonly FlowNode[],
  maxItems?: number,
  label?: string,
  listCommand?: string,
): ForeachSpawnNode {
  return {
    kind: 'foreach_spawn',
    id,
    variableName,
    listExpression,
    maxItems: maxItems ?? DEFAULT_MAX_FOREACH,
    body,
    ...(label != null ? { label } : {}),
    ...(listCommand != null ? { listCommand } : {}),
  };
}

export function createRememberNode(
  id: string,
  text?: string,
  key?: string,
  value?: string,
): RememberNode {
  return {
    kind: 'remember',
    id,
    ...(text != null ? { text } : {}),
    ...(key != null ? { key } : {}),
    ...(value != null ? { value } : {}),
  };
}

export function createSendNode(id: string, target: string, message: string): SendNode {
  return { kind: 'send', id, target, message };
}

export function createReceiveNode(
  id: string,
  variableName: string,
  from?: string,
  timeoutSeconds?: number,
): ReceiveNode {
  return {
    kind: 'receive',
    id,
    variableName,
    ...(from != null ? { from } : {}),
    ...(timeoutSeconds != null ? { timeoutSeconds } : {}),
  };
}

export function createSwarmRoleDefinition(
  id: string,
  name: string,
  body: readonly FlowNode[],
  cwd?: string,
  vars?: readonly string[],
  model?: string,
): SwarmRoleDefinition {
  return {
    id,
    name,
    body,
    ...(cwd != null ? { cwd } : {}),
    ...(vars != null ? { vars } : {}),
    ...(model != null ? { model } : {}),
  };
}

export function createSwarmNode(
  id: string,
  name: string,
  roles: readonly SwarmRoleDefinition[],
  flow: readonly FlowNode[],
): SwarmNode {
  return { kind: 'swarm', id, name, roles, flow };
}

export function createStartNode(id: string, targets: readonly string[]): StartNode {
  return { kind: 'start', id, targets };
}

export function createReturnNode(id: string, expression: string): ReturnNode {
  return { kind: 'return', id, expression };
}

type FlowNodeChildScope =
  | { readonly label: string; readonly nodes: readonly FlowNode[] }
  | {
      readonly label: string;
      readonly nodes: readonly FlowNode[];
      readonly nestedPrefix: string;
      readonly nestedNodes: readonly FlowNode[];
    };

function getChildScopes(node: FlowNode): readonly FlowNodeChildScope[] {
  switch (node.kind) {
    case 'while':
    case 'until':
    case 'retry':
    case 'foreach':
    case 'spawn':
    case 'review':
    case 'foreach_spawn':
      return [{ label: 'body', nodes: node.body }];
    case 'if':
      return [
        { label: 'then', nodes: node.thenBranch },
        { label: 'else', nodes: node.elseBranch },
      ];
    case 'try':
      return [
        { label: 'body', nodes: node.body },
        { label: 'catch', nodes: node.catchBody },
        { label: 'finally', nodes: node.finallyBody },
      ];
    case 'race':
      return node.children.map((child, index) => ({
        label: `child[${index + 1}]`,
        nodes: [child],
        nestedPrefix: `child[${index + 1}].body`,
        nestedNodes: child.body,
      }));
    case 'swarm':
      return [
        ...node.roles.map((role, index) => ({
          label: `role[${index + 1}]`,
          nodes: role.body,
        })),
        { label: 'flow', nodes: node.flow },
      ];
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
      return [];
    default: {
      const _exhaustive: never = node;
      return _exhaustive;
    }
  }
}

function resolveChildPathSegment(
  node: FlowNode,
  index: number,
): {
  readonly label: string;
  readonly node: FlowNode;
  readonly nestedPrefix?: string | undefined;
} | null {
  for (const scope of getChildScopes(node)) {
    if (index < scope.nodes.length) {
      return {
        label: `${scope.label}[${index + 1}]`,
        node: scope.nodes[index]!,
      };
    }

    index -= scope.nodes.length;
    if ('nestedNodes' in scope) {
      if (index < scope.nestedNodes.length) {
        return {
          label: `${scope.nestedPrefix}[${index + 1}]`,
          node: scope.nestedNodes[index]!,
        };
      }

      index -= scope.nestedNodes.length;
    }
  }

  return null;
}

export function resolveNodeByPath(
  nodes: readonly FlowNode[],
  path: readonly number[],
): FlowNode | null {
  if (path.length === 0) return null;

  let node = nodes[path[0]!] ?? null;
  if (node == null) return null;
  if (path.length === 1) return node;

  for (let depth = 1; depth < path.length; depth += 1) {
    const child = resolveChildPathSegment(node, path[depth]!);
    if (child == null) {
      return null;
    }
    node = child.node;
  }

  return node;
}

export function formatFlowNodeSource(source?: FlowNodeSource): string | null {
  if (source?.line == null || source?.column == null) return null;

  const location = `line ${source.line}, col ${source.column}`;
  return source.source?.length ? `${source.source}:${location}` : location;
}

export function describeNodePosition(
  nodes: readonly FlowNode[],
  path: readonly number[],
): string | null {
  if (path.length === 0) {
    return 'flow root';
  }

  const firstNode = nodes[path[0]!] ?? null;
  if (firstNode == null) {
    return `flow[${path[0]! + 1}]`;
  }

  const labels = [`flow[${path[0]! + 1}]`];
  let node = firstNode;

  for (let depth = 1; depth < path.length; depth += 1) {
    const child = resolveChildPathSegment(node, path[depth]!);
    if (child == null) {
      labels.push(`[missing ${path[depth]! + 1}]`);
      break;
    }
    labels.push(child.label);
    node = child.node;
  }

  const source = formatFlowNodeSource(node.position);
  return source == null ? labels.join(' > ') : `${labels.join(' > ')} at ${source}`;
}

/** Recursively search a flow tree for a node by its id. Early-exit on match. */
export function findNodeById(nodes: readonly FlowNode[], id: string): FlowNode | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    switch (node.kind) {
      case 'while':
      case 'until':
      case 'retry':
      case 'foreach':
      case 'spawn': {
        const found = findNodeById(node.body, id);
        if (found) return found;
        break;
      }
      case 'review':
      case 'foreach_spawn': {
        const found = findNodeById(node.body, id);
        if (found) return found;
        break;
      }
      case 'race': {
        const found = findNodeById([...node.children], id);
        if (found) return found;
        break;
      }
      case 'if': {
        const found = findNodeById(node.thenBranch, id) ?? findNodeById(node.elseBranch, id);
        if (found) return found;
        break;
      }
      case 'try': {
        const found =
          findNodeById(node.body, id) ??
          findNodeById(node.catchBody, id) ??
          findNodeById(node.finallyBody, id);
        if (found) return found;
        break;
      }
      case 'swarm': {
        for (const role of node.roles) {
          const found = findNodeById(role.body, id);
          if (found) return found;
        }
        const found = findNodeById(node.flow, id);
        if (found) return found;
        break;
      }
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
        break;
      default: {
        const _exhaustive: never = node;
        return _exhaustive;
      }
    }
  }
  return null;
}
