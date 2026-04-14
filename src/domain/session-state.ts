/**
 * SessionState — the authoritative runtime state.
 *
 * The runtime owns truth. Claude generates work, the plugin owns state transitions.
 * All condition evaluation reads from this state.
 */

import { flowSpecHash, type FlowSpec } from './flow-spec.js';
import type { FlowNode, LetNode, VariableDeclaredType } from './flow-node.js';
import { describeNodePosition } from './flow-node.js';
import type { RuntimeOutputArtifactRecord } from './runtime-output-artifact.js';
import type { VariableValue, VariableStore } from './variable-value.js';

export type FlowStatus = 'active' | 'completed' | 'failed' | 'cancelled';

export type SpawnedChildStatus = 'running' | 'completed' | 'failed';

export interface SpawnedChild {
  readonly name: string;
  readonly status: SpawnedChildStatus;
  readonly pid?: number | undefined;
  readonly stateDir: string;
  readonly startedAt?: string | undefined;
  readonly completedAt?: string | undefined;
  readonly returned?: string | undefined;
  readonly variables?: Readonly<Record<string, string>> | undefined;
}

export interface NodeProgress {
  readonly iteration: number;
  readonly maxIterations: number;
  readonly status: 'pending' | 'running' | 'completed' | 'failed' | 'awaiting_capture';
  readonly branchEndOffset?: number | undefined;
  readonly captureFailureReason?: string | undefined;
  /** H-ASK-002: Retry counter for ask conditions with explicit max-retries. */
  readonly askRetryCount?: number | undefined;
  // H-DX-002: Node execution timing
  readonly startedAt?: number | undefined;
  readonly completedAt?: number | undefined;
  // H-LANG-008: Wall-clock loop timeout tracking
  readonly loopStartedAt?: number | undefined;
  // beads: prompt-language-ea5a — cached successful run payload for resume-safe replay suppression
  readonly exitCode?: number | undefined;
  readonly stdout?: string | undefined;
  readonly stderr?: string | undefined;
  readonly stdoutArtifact?: RuntimeOutputArtifactRecord | undefined;
  readonly stderrArtifact?: RuntimeOutputArtifactRecord | undefined;
  readonly timedOut?: boolean | undefined;
}

export interface GateEvalResult {
  readonly passed: boolean;
  readonly command?: string;
  readonly exitCode?: number;
  readonly stderr?: string;
  readonly stdout?: string;
  readonly gateEvaluatedAt?: number;
}

export interface SessionState {
  // H#56: Version field for format migration
  readonly version: number;
  readonly sessionId: string;
  readonly flowSpec: FlowSpec;
  readonly currentNodePath: readonly number[];
  readonly nodeProgress: Readonly<Record<string, NodeProgress>>;
  readonly variables: VariableStore;
  readonly gateResults: Readonly<Record<string, boolean>>;
  readonly gateDiagnostics: Readonly<Record<string, GateEvalResult>>;
  readonly status: FlowStatus;
  readonly warnings: readonly string[];
  readonly spawnedChildren: Readonly<Record<string, SpawnedChild>>;
  /** Maps race node id → names of spawn children belonging to that race. */
  readonly raceChildren: Readonly<Record<string, readonly string[]>>;
  readonly flowSpecHash?: string | undefined;
  readonly failureReason?: string | undefined;
  readonly transitionSeq?: number | undefined;
  // H-SEC-004: Per-session nonce for capture tag anti-spoofing
  readonly captureNonce: string;
  // H-SEC-010: Consecutive gate failure count for rate limiting
  readonly gateFailureCount?: number | undefined;
  /** Merkle-style content hash of this state (excluding bookkeeping fields). */
  readonly stateHash?: string | undefined;
  /** Content hash of the state this one transitioned from, or undefined for the initial state. */
  readonly prevStateHash?: string | undefined;
}

/** Generate a 128-bit hex nonce using pure JS (no node:crypto — domain layer). */
export function generateCaptureNonce(): string {
  // 4 segments of 8 hex chars = 32 hex chars = 128 bits
  let nonce = '';
  for (let i = 0; i < 4; i++) {
    nonce += Math.floor(Math.random() * 0x100000000)
      .toString(16)
      .padStart(8, '0');
  }
  return nonce;
}

export function createSessionState(
  sessionId: string,
  flowSpec: FlowSpec,
  captureNonce?: string,
): SessionState {
  return {
    version: 1,
    sessionId,
    flowSpec,
    currentNodePath: [0],
    nodeProgress: {},
    variables: {},
    gateResults: {},
    gateDiagnostics: {},
    status: 'active',
    warnings: [...flowSpec.warnings],
    spawnedChildren: {},
    raceChildren: {},
    flowSpecHash: flowSpecHash(flowSpec),
    transitionSeq: 0,
    captureNonce: captureNonce ?? generateCaptureNonce(),
  };
}

export function advanceNode(state: SessionState, newPath: readonly number[]): SessionState {
  return { ...state, currentNodePath: newPath };
}

function findVariableDeclaration(nodes: readonly FlowNode[], name: string): LetNode | undefined {
  for (const node of nodes) {
    switch (node.kind) {
      case 'let':
        if (node.variableName === name) {
          return node;
        }
        break;
      case 'while':
      case 'until':
      case 'retry':
      case 'foreach':
      case 'spawn':
      case 'review':
      case 'foreach_spawn':
        {
          const found = findVariableDeclaration(node.body, name);
          if (found != null) {
            return found;
          }
        }
        break;
      case 'if':
        {
          const found =
            findVariableDeclaration(node.thenBranch, name) ??
            findVariableDeclaration(node.elseBranch, name);
          if (found != null) {
            return found;
          }
        }
        break;
      case 'try':
        {
          const found =
            findVariableDeclaration(node.body, name) ??
            findVariableDeclaration(node.catchBody, name) ??
            findVariableDeclaration(node.finallyBody, name);
          if (found != null) {
            return found;
          }
        }
        break;
      case 'race':
        {
          const found = node.children
            .map((child) => findVariableDeclaration(child.body, name))
            .find((candidate) => candidate != null);
          if (found != null) {
            return found;
          }
        }
        break;
      case 'swarm':
        {
          const found =
            findVariableDeclaration(node.flow, name) ??
            node.roles
              .map((role) => findVariableDeclaration(role.body, name))
              .find((candidate) => candidate != null);
          if (found != null) {
            return found;
          }
        }
        break;
      case 'prompt':
      case 'run':
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
  return undefined;
}

function matchesDeclaredType(value: VariableValue, declaredType: VariableDeclaredType): boolean {
  switch (declaredType) {
    case 'string':
      return typeof value === 'string';
    case 'int':
      return (
        (typeof value === 'number' && Number.isInteger(value)) ||
        (typeof value === 'string' && /^-?\d+$/.test(value.trim()))
      );
    case 'bool':
      return (
        typeof value === 'boolean' ||
        (typeof value === 'string' && /^(true|false)$/i.test(value.trim()))
      );
    case 'list':
      if (Array.isArray(value)) return true;
      if (typeof value !== 'string') return false;
      try {
        return Array.isArray(JSON.parse(value));
      } catch {
        return false;
      }
    default: {
      const _exhaustive: never = declaredType;
      return _exhaustive;
    }
  }
}

function describeValueShape(value: VariableValue): string {
  if (Array.isArray(value)) return 'list';
  return typeof value;
}

export function updateVariable(
  state: SessionState,
  name: string,
  value: VariableValue,
): SessionState {
  const declaration = findVariableDeclaration(state.flowSpec.nodes, name);
  let nextState: SessionState = {
    ...state,
    variables: { ...state.variables, [name]: value },
  };

  if (declaration?.declaredType && !matchesDeclaredType(value, declaration.declaredType)) {
    nextState = addWarning(
      nextState,
      `Variable '${name}' is declared as ${declaration.declaredType} but received ${describeValueShape(value)} value ${JSON.stringify(value)}; keeping assigned value for backward compatibility.`,
    );
  }

  if (
    Object.prototype.hasOwnProperty.call(state.variables, name) &&
    declaration?.declarationKind === 'const'
  ) {
    return addWarning(
      nextState,
      `Const variable '${name}' was reassigned; keeping latest value for backward compatibility.`,
    );
  }

  return nextState;
}

export function removeVariable(state: SessionState, name: string): SessionState {
  if (!Object.prototype.hasOwnProperty.call(state.variables, name)) {
    return state;
  }

  const nextVariables = { ...state.variables };
  delete nextVariables[name];
  return { ...state, variables: nextVariables };
}

export function updateNodeProgress(
  state: SessionState,
  nodeId: string,
  progress: NodeProgress,
): SessionState {
  return {
    ...state,
    nodeProgress: { ...state.nodeProgress, [nodeId]: progress },
  };
}

export function updateGateResult(
  state: SessionState,
  gatePredicate: string,
  result: boolean,
): SessionState {
  return {
    ...state,
    gateResults: { ...state.gateResults, [gatePredicate]: result },
  };
}

export function updateGateDiagnostic(
  state: SessionState,
  gatePredicate: string,
  diagnostic: GateEvalResult,
): SessionState {
  return {
    ...state,
    gateDiagnostics: { ...state.gateDiagnostics, [gatePredicate]: diagnostic },
  };
}

export function updateSpawnedChild(
  state: SessionState,
  name: string,
  child: SpawnedChild,
): SessionState {
  return {
    ...state,
    spawnedChildren: { ...state.spawnedChildren, [name]: child },
  };
}

export function updateRaceChildren(
  state: SessionState,
  raceNodeId: string,
  childNames: readonly string[],
): SessionState {
  return {
    ...state,
    raceChildren: { ...state.raceChildren, [raceNodeId]: childNames },
  };
}

export function addWarning(state: SessionState, warning: string): SessionState {
  if (state.warnings.includes(warning)) return state;
  return { ...state, warnings: [...state.warnings, warning] };
}

export function withStatePosition(
  state: SessionState,
  message: string,
  path: readonly number[] = state.currentNodePath,
): string {
  const position = describeNodePosition(state.flowSpec.nodes, path);
  return position == null ? message : `${message} (${position})`;
}

export function addWarningAtPath(
  state: SessionState,
  warning: string,
  path: readonly number[] = state.currentNodePath,
): SessionState {
  return addWarning(state, withStatePosition(state, warning, path));
}

export function markCompleted(state: SessionState): SessionState {
  return { ...state, status: 'completed' };
}

export function markFailed(state: SessionState, reason?: string): SessionState {
  return { ...state, status: 'failed', ...(reason !== undefined && { failureReason: reason }) };
}

export function markFailedAtPath(
  state: SessionState,
  reason: string,
  path: readonly number[] = state.currentNodePath,
): SessionState {
  return markFailed(state, withStatePosition(state, reason, path));
}

export function markCancelled(state: SessionState): SessionState {
  return { ...state, status: 'cancelled' };
}

export function isFlowComplete(state: SessionState): boolean {
  return state.status === 'completed' || state.status === 'failed' || state.status === 'cancelled';
}

export function allGatesPassing(state: SessionState): boolean {
  const gates = state.flowSpec.completionGates;
  if (gates.length === 0) return true;
  return gates.every((g) => state.gateResults[g.predicate] === true);
}
