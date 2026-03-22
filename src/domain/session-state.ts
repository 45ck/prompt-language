/**
 * SessionState — the authoritative runtime state.
 *
 * The runtime owns truth. Claude generates work, the plugin owns state transitions.
 * All condition evaluation reads from this state.
 */

import type { FlowSpec } from './flow-spec.js';

// H#60: Add 'paused' status for flow pause/resume
export type FlowStatus = 'active' | 'paused' | 'completed' | 'failed' | 'cancelled';

export interface NodeProgress {
  readonly iteration: number;
  readonly maxIterations: number;
  readonly status: 'pending' | 'running' | 'completed' | 'failed' | 'awaiting_capture';
}

export interface GateEvalResult {
  readonly passed: boolean;
  readonly command?: string;
  readonly exitCode?: number;
  readonly stderr?: string;
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
}

export function createSessionState(sessionId: string, flowSpec: FlowSpec): SessionState {
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
  };
}

// H#60: Pause/resume transitions
export function pauseFlow(state: SessionState): SessionState {
  return { ...state, status: 'paused' };
}

export function resumeFlow(state: SessionState): SessionState {
  return { ...state, status: 'active' };
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

export function markCompleted(state: SessionState): SessionState {
  return { ...state, status: 'completed' };
}

export function isFlowComplete(state: SessionState): boolean {
  return state.status === 'completed' || state.status === 'failed' || state.status === 'cancelled';
}

export function allGatesPassing(state: SessionState): boolean {
  const gates = state.flowSpec.completionGates;
  if (gates.length === 0) return true;
  return gates.every((g) => state.gateResults[g.predicate] === true);
}
