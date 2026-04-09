/**
 * SessionState — the authoritative runtime state.
 *
 * The runtime owns truth. Claude generates work, the plugin owns state transitions.
 * All condition evaluation reads from this state.
 */

import { flowSpecHash, type FlowSpec } from './flow-spec.js';

export type FlowStatus = 'active' | 'completed' | 'failed' | 'cancelled';

export type SpawnedChildStatus = 'running' | 'completed' | 'failed';

export interface SpawnedChild {
  readonly name: string;
  readonly status: SpawnedChildStatus;
  readonly pid?: number | undefined;
  readonly stateDir: string;
  readonly variables?: Readonly<Record<string, string>> | undefined;
}

export interface NodeProgress {
  readonly iteration: number;
  readonly maxIterations: number;
  readonly status: 'pending' | 'running' | 'completed' | 'failed' | 'awaiting_capture';
  readonly captureFailureReason?: string | undefined;
  /** H-ASK-002: Retry counter for ask conditions with explicit max-retries. */
  readonly askRetryCount?: number | undefined;
  // H-DX-002: Node execution timing
  readonly startedAt?: number | undefined;
  readonly completedAt?: number | undefined;
  // H-LANG-008: Wall-clock loop timeout tracking
  readonly loopStartedAt?: number | undefined;
}

export interface GateEvalResult {
  readonly passed: boolean;
  readonly command?: string;
  readonly exitCode?: number;
  readonly stderr?: string;
  readonly stdout?: string;
}

export interface SessionState {
  // H#56: Version field for format migration
  readonly version: number;
  readonly sessionId: string;
  readonly flowSpec: FlowSpec;
  readonly currentNodePath: readonly number[];
  readonly nodeProgress: Readonly<Record<string, NodeProgress>>;
  readonly variables: Readonly<Record<string, string | number | boolean>>;
  readonly gateResults: Readonly<Record<string, boolean>>;
  readonly gateDiagnostics: Readonly<Record<string, GateEvalResult>>;
  readonly status: FlowStatus;
  readonly warnings: readonly string[];
  readonly spawnedChildren: Readonly<Record<string, SpawnedChild>>;
  /** Maps race node id → names of spawn children belonging to that race. */
  readonly raceChildren: Readonly<Record<string, readonly string[]>>;
  readonly flowSpecHash?: string | undefined;
  readonly failureReason?: string | undefined;
  // H-SEC-004: Per-session nonce for capture tag anti-spoofing
  readonly captureNonce: string;
  // H-SEC-010: Consecutive gate failure count for rate limiting
  readonly gateFailureCount?: number | undefined;
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
    captureNonce: captureNonce ?? generateCaptureNonce(),
  };
}

export function advanceNode(state: SessionState, newPath: readonly number[]): SessionState {
  return { ...state, currentNodePath: newPath };
}

export function updateVariable(
  state: SessionState,
  name: string,
  value: string | number | boolean,
): SessionState {
  return {
    ...state,
    variables: { ...state.variables, [name]: value },
  };
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

export function markCompleted(state: SessionState): SessionState {
  return { ...state, status: 'completed' };
}

export function markFailed(state: SessionState, reason?: string): SessionState {
  return { ...state, status: 'failed', ...(reason !== undefined && { failureReason: reason }) };
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
