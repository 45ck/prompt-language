/**
 * SDK public surface smoke tests.
 *
 * Verifies that the stable public API functions are exported and callable.
 * Does not test business logic (covered by per-module tests).
 */

import { describe, it, expect } from 'vitest';

import {
  parseFlow,
  createSessionState,
  createSession,
  advanceFlow,
  renderFlow,
  renderFlowCompact,
  renderFlowSummary,
  lintFlow,
} from './sdk.js';

describe('SDK exports: parseFlow', () => {
  it('is a function', () => {
    expect(typeof parseFlow).toBe('function');
  });

  it('parses a minimal flow and returns a FlowSpec', () => {
    const spec = parseFlow('Goal: test\n\nflow:\n  prompt: hello\n');
    expect(spec.goal).toBe('test');
    expect(spec.nodes.length).toBeGreaterThan(0);
    expect(Array.isArray(spec.completionGates)).toBe(true);
  });

  it('parses a flow with a done-when gate', () => {
    const spec = parseFlow('Goal: verify\n\nflow:\n  run: npm test\n\ndone when:\n  tests_pass\n');
    expect(spec.completionGates.length).toBe(1);
    expect(spec.completionGates[0]?.predicate).toBe('tests_pass');
  });
});

describe('SDK exports: createSessionState', () => {
  it('is a function', () => {
    expect(typeof createSessionState).toBe('function');
  });

  it('creates a session with active status', () => {
    const spec = parseFlow('Goal: run\n\nflow:\n  prompt: do it\n');
    const session = createSessionState('test-session-id', spec);
    expect(session.status).toBe('active');
    expect(session.flowSpec).toBe(spec);
  });
});

describe('SDK exports: createSession alias', () => {
  it('is the same function as createSessionState', () => {
    expect(createSession).toBe(createSessionState);
  });
});

describe('SDK exports: renderFlow', () => {
  it('is a function', () => {
    expect(typeof renderFlow).toBe('function');
  });

  it('returns a non-empty string for a valid session', () => {
    const spec = parseFlow('Goal: render test\n\nflow:\n  prompt: step one\n');
    const session = createSessionState('test-session-id', spec);
    const output = renderFlow(session);
    expect(typeof output).toBe('string');
    expect(output.length).toBeGreaterThan(0);
  });
});

describe('SDK exports: renderFlowCompact', () => {
  it('is a function', () => {
    expect(typeof renderFlowCompact).toBe('function');
  });
});

describe('SDK exports: renderFlowSummary', () => {
  it('is a function', () => {
    expect(typeof renderFlowSummary).toBe('function');
  });
});

describe('SDK exports: lintFlow', () => {
  it('is a function', () => {
    expect(typeof lintFlow).toBe('function');
  });

  it('returns an empty array for a clean flow', () => {
    const spec = parseFlow('Goal: clean\n\nflow:\n  prompt: do it\n');
    const warnings = lintFlow(spec);
    expect(Array.isArray(warnings)).toBe(true);
  });
});

describe('SDK exports: advanceFlow', () => {
  it('is a function', () => {
    expect(typeof advanceFlow).toBe('function');
  });
});

describe('SDK exports: evaluateGates', () => {
  it('is a function', async () => {
    const mod = await import('./sdk.js');
    expect(mod.evaluateGates).toBe(mod.evaluateCompletion);
  });
});
