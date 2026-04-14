import { describe, it, expect } from 'vitest';
import { parseFlow } from './parse-flow.js';

describe('parseFlow: snapshot + rollback (PR1)', () => {
  it('parses snapshot "name" as a SnapshotNode', () => {
    const spec = parseFlow(`Goal: g\n\nflow:\n  snapshot "cp"\n`);
    expect(spec.nodes).toHaveLength(1);
    expect(spec.nodes[0]!.kind).toBe('snapshot');
    if (spec.nodes[0]!.kind === 'snapshot') {
      expect(spec.nodes[0].name).toBe('cp');
    }
  });

  it('parses rollback to "name" as a RollbackNode', () => {
    const spec = parseFlow(`Goal: g\n\nflow:\n  rollback to "cp"\n`);
    expect(spec.nodes[0]!.kind).toBe('rollback');
    if (spec.nodes[0]!.kind === 'rollback') {
      expect(spec.nodes[0].name).toBe('cp');
    }
  });

  it('rejects rollback without "to" keyword with a helpful warning', () => {
    const spec = parseFlow(`Goal: g\n\nflow:\n  rollback "cp"\n`);
    expect(spec.warnings.some((w) => w.toLowerCase().includes('rollback'))).toBe(true);
  });

  it('warns when snapshot name is a bareword but still accepts it', () => {
    const spec = parseFlow(`Goal: g\n\nflow:\n  snapshot cp\n`);
    expect(spec.nodes[0]!.kind).toBe('snapshot');
    expect(spec.warnings.some((w) => w.toLowerCase().includes('quoted'))).toBe(true);
  });

  it('warns when snapshot has no name', () => {
    const spec = parseFlow(`Goal: g\n\nflow:\n  snapshot\n`);
    expect(spec.warnings.some((w) => w.toLowerCase().includes('snapshot'))).toBe(true);
  });

  it('warns when rollback has no target', () => {
    const spec = parseFlow(`Goal: g\n\nflow:\n  rollback\n`);
    expect(spec.warnings.some((w) => w.toLowerCase().includes('rollback'))).toBe(true);
  });

  it('accepts rollback to bareword with a warning', () => {
    const spec = parseFlow(`Goal: g\n\nflow:\n  rollback to cp\n`);
    expect(spec.nodes[0]!.kind).toBe('rollback');
    expect(spec.warnings.some((w) => w.toLowerCase().includes('quoted'))).toBe(true);
  });

  it('rejects garbage snapshot syntax', () => {
    const spec = parseFlow(`Goal: g\n\nflow:\n  snapshot !!!\n`);
    expect(spec.warnings.some((w) => w.toLowerCase().includes('invalid'))).toBe(true);
  });
});
