import { describe, expect, it } from 'vitest';
import { parseFlow, createSession, advanceFlow, evaluateGates, renderFlow } from './index.js';

describe('package root exports', () => {
  it('re-exports the SDK surface', () => {
    expect(typeof parseFlow).toBe('function');
    expect(typeof createSession).toBe('function');
    expect(typeof advanceFlow).toBe('function');
    expect(typeof evaluateGates).toBe('function');
    expect(typeof renderFlow).toBe('function');
  });
});
