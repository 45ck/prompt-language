/**
 * EvaluateStop — Stop hook use case.
 *
 * Blocks the stop if a flow is active and not yet complete.
 */

import { isFlowComplete } from '../domain/session-state.js';
import type { SessionState } from '../domain/session-state.js';
import type { StateStore } from './ports/state-store.js';

export interface EvaluateStopOutput {
  readonly blocked: boolean;
  readonly reason: string;
  /** Non-null when a flow exists (blocked or not). */
  readonly state?: SessionState | undefined;
}

export async function evaluateStop(stateStore: StateStore): Promise<EvaluateStopOutput> {
  const state = await stateStore.loadCurrent();

  if (!state) {
    return { blocked: false, reason: '' };
  }

  if (isFlowComplete(state)) {
    return { blocked: false, reason: '', state };
  }

  const goal = state.flowSpec.goal;
  const path = state.currentNodePath.join('.');
  const gates = state.flowSpec.completionGates;
  let gateStatus = '';
  if (gates.length > 0) {
    const labels = gates.map((g) => {
      const result = state.gateResults[g.predicate];
      if (result === true) return `${g.predicate} [pass]`;
      if (result === false) return `${g.predicate} [fail]`;
      return `${g.predicate} [pending]`;
    });
    const passed = gates.filter((g) => state.gateResults[g.predicate] === true).length;
    gateStatus = ` Gates: ${passed}/${gates.length} passing (${labels.join(', ')}).`;
  }

  return {
    blocked: true,
    reason:
      `Flow "${goal}" is still active at step [${path}].${gateStatus} ` +
      'Complete all steps and pass completion gates before stopping.',
    state,
  };
}
