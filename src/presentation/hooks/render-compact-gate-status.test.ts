import { describe, expect, it } from 'vitest';
import { createPromptNode } from '../../domain/flow-node.js';
import { createCompletionGate, createFlowSpec } from '../../domain/flow-spec.js';
import { createSessionState, type SessionState } from '../../domain/session-state.js';
import {
  buildCompactGateStatusLine,
  renderCompactGateStatus,
} from './render-compact-gate-status.js';

function makeState(predicates: readonly string[] = []): SessionState {
  return createSessionState(
    'compact-gates',
    createFlowSpec(
      'Compact gate view',
      [createPromptNode('p1', 'do work')],
      predicates.map((predicate) => createCompletionGate(predicate)),
    ),
  );
}

describe('buildCompactGateStatusLine', () => {
  it('renders gate markers in deterministic predicate order', () => {
    const state = {
      ...makeState(['zeta_gate', 'alpha_gate', 'mid_gate']),
      gateResults: {
        zeta_gate: false,
        alpha_gate: true,
      },
    };

    expect(buildCompactGateStatusLine(state)).toBe('gates: +alpha_gate ?mid_gate -zeta_gate');
  });

  it('deduplicates repeated predicates and ignores blank ones', () => {
    const state = {
      ...makeState(['tests_pass', ' ', 'tests_pass', 'lint_pass']),
      gateResults: {
        lint_pass: false,
        tests_pass: true,
      },
    };

    expect(buildCompactGateStatusLine(state)).toBe('gates: -lint_pass +tests_pass');
  });

  it('returns null when there are no usable completion gates', () => {
    const state = makeState(['   ']);

    expect(buildCompactGateStatusLine(state)).toBeNull();
  });
});

describe('renderCompactGateStatus', () => {
  it('replaces an existing gates line with the canonical ordered view', () => {
    const state = {
      ...makeState(['tests_pass', 'lint_pass']),
      gateResults: {
        lint_pass: false,
        tests_pass: true,
      },
    };

    const compact = '[pl] Compact gate view | active\n>P: do work\ngates: +tests_pass -lint_pass';

    expect(renderCompactGateStatus(compact, state)).toBe(
      '[pl] Compact gate view | active\n>P: do work\ngates: -lint_pass +tests_pass',
    );
  });

  it('appends the canonical gates line when compact output has no gate section', () => {
    const state = {
      ...makeState(['tests_pass']),
      gateResults: {
        tests_pass: true,
      },
    };

    expect(renderCompactGateStatus('[pl] Compact gate view | active', state)).toBe(
      '[pl] Compact gate view | active\ngates: +tests_pass',
    );
  });

  it('falls back safely to the original compact text when no canonical gate line can be built', () => {
    const state = makeState(['   ']);

    const compact = '[pl] Compact gate view | active\n>P: do work';
    expect(renderCompactGateStatus(compact, state)).toBe(compact);
  });

  it('collapses duplicate compact gate lines to a single canonical line', () => {
    const state = {
      ...makeState(['tests_pass', 'lint_pass']),
      gateResults: {
        lint_pass: false,
        tests_pass: true,
      },
    };

    const compact =
      '[pl] Compact gate view | active\n' +
      'gates: +tests_pass -lint_pass\n' +
      '>P: do work\n' +
      'gates: ?stale_gate';

    expect(renderCompactGateStatus(compact, state)).toBe(
      '[pl] Compact gate view | active\ngates: -lint_pass +tests_pass\n>P: do work',
    );
  });
});
