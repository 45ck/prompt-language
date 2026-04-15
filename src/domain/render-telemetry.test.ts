import { describe, it, expect } from 'vitest';
import {
  createRenderTelemetry,
  computeTelemetry,
  measureByteComposition,
} from './render-telemetry.js';
import type { RenderTelemetry } from './render-telemetry.js';

describe('createRenderTelemetry', () => {
  it('returns defaults when called with no arguments', () => {
    const t = createRenderTelemetry();
    expect(t.promptBytes).toBe(0);
    expect(t.stableBytes).toBe(0);
    expect(t.dynamicBytes).toBe(0);
    expect(t.variableCount).toBe(0);
    expect(t.variableBytes).toBe(0);
    expect(t.commandOutputBytes).toBe(0);
    expect(t.gateCount).toBe(0);
    expect(t.turnCount).toBe(0);
    expect(t.fallbackCount).toBe(0);
    expect(t.recoveryIncidents).toBe(0);
    expect(t.hookTimingMs).toBeUndefined();
  });

  it('accepts partial overrides', () => {
    const t = createRenderTelemetry({
      promptBytes: 500,
      turnCount: 3,
      hookTimingMs: { 'user-prompt-submit': 12 },
    });
    expect(t.promptBytes).toBe(500);
    expect(t.turnCount).toBe(3);
    expect(t.hookTimingMs).toEqual({ 'user-prompt-submit': 12 });
    expect(t.stableBytes).toBe(0);
  });

  it('is JSON-serializable', () => {
    const t = createRenderTelemetry({ promptBytes: 100, turnCount: 1 });
    const roundTripped = JSON.parse(JSON.stringify(t)) as RenderTelemetry;
    expect(roundTripped).toEqual(t);
  });
});

describe('computeTelemetry', () => {
  it('marks all bytes as dynamic when no previous render', () => {
    const result = computeTelemetry('hello world');
    expect(result.promptBytes).toBe(11);
    expect(result.stableBytes).toBe(0);
    expect(result.dynamicBytes).toBe(11);
  });

  it('marks all bytes as stable when renders are identical', () => {
    const rendered = 'line one\nline two\nline three';
    const result = computeTelemetry(rendered, rendered);
    expect(result.promptBytes).toBe(rendered.length);
    expect(result.stableBytes).toBe(rendered.length);
    expect(result.dynamicBytes).toBe(0);
  });

  it('detects stable and dynamic portions', () => {
    const prev = 'header\nstable line\nold dynamic';
    const curr = 'header\nstable line\nnew dynamic';
    const result = computeTelemetry(curr, prev);
    expect(result.promptBytes).toBe(curr.length);
    // "header" and "stable line" are stable, plus newline between them
    expect(result.stableBytes).toBe('header'.length + 'stable line'.length + 1);
    expect(result.dynamicBytes).toBe(result.promptBytes - result.stableBytes);
  });

  it('handles empty strings', () => {
    const result = computeTelemetry('', '');
    expect(result.promptBytes).toBe(0);
    expect(result.stableBytes).toBe(0);
    expect(result.dynamicBytes).toBe(0);
  });

  it('handles multi-byte UTF-8 characters', () => {
    const rendered = 'hello \u00e9'; // e-acute = 2 UTF-8 bytes
    const result = computeTelemetry(rendered);
    expect(result.promptBytes).toBe(8); // 6 ASCII + 2 for \u00e9
    expect(result.dynamicBytes).toBe(8);
  });

  it('handles duplicate lines correctly', () => {
    const prev = 'a\na\nb';
    const curr = 'a\na\nc';
    const result = computeTelemetry(curr, prev);
    // Both "a" lines match, with newline between them
    expect(result.stableBytes).toBe('a'.length + 'a'.length + 1);
  });

  it('handles completely different renders', () => {
    const prev = 'alpha\nbeta\ngamma';
    const curr = 'one\ntwo\nthree';
    const result = computeTelemetry(curr, prev);
    expect(result.stableBytes).toBe(0);
    expect(result.dynamicBytes).toBe(curr.length);
  });
});

describe('measureByteComposition', () => {
  it('measures an empty string', () => {
    const comp = measureByteComposition('');
    expect(comp.totalBytes).toBe(0);
    expect(comp.headerBytes).toBe(0);
  });

  it('measures header-only render', () => {
    const rendered = '[prompt-language] Flow: test | Status: running\n';
    const comp = measureByteComposition(rendered);
    expect(comp.headerBytes).toBeGreaterThan(0);
    expect(comp.totalBytes).toBe(rendered.length);
  });

  it('measures a full render with all sections', () => {
    const rendered = [
      '[prompt-language] Flow: goal | Status: running',
      '',
      '> prompt: Do something  <-- current',
      '  run: echo hi',
      '',
      'done when:',
      '  tests_pass  [pending]',
      '',
      'Variables:',
      '  count = 3',
      '',
      'Warnings:',
      '  [!] Empty body',
      '',
      '[Capture active: write response to .prompt-language/vars/x using Write tool]',
    ].join('\n');

    const comp = measureByteComposition(rendered);
    expect(comp.totalBytes).toBe(rendered.length);
    expect(comp.headerBytes).toBeGreaterThan(0);
    expect(comp.nodeTreeBytes).toBeGreaterThan(0);
    expect(comp.gateBytes).toBeGreaterThan(0);
    expect(comp.variableBytes).toBeGreaterThan(0);
    expect(comp.warningBytes).toBeGreaterThan(0);
    expect(comp.captureReminderBytes).toBeGreaterThan(0);
  });

  it('measures gate section correctly', () => {
    const rendered = [
      '[prompt-language] Flow: g | Status: completed',
      '',
      '~ prompt: done',
      '',
      'done when:',
      '  tests_pass  [pass]',
      '  lint_pass  [fail]',
    ].join('\n');

    const comp = measureByteComposition(rendered);
    expect(comp.gateBytes).toBe('done when:\n  tests_pass  [pass]\n  lint_pass  [fail]'.length);
  });

  it('measures variable section correctly', () => {
    const rendered = [
      '[prompt-language] Flow: g | Status: running',
      '',
      '> prompt: hi',
      '',
      'Variables:',
      '  name = Alice',
      '  age = 30',
    ].join('\n');

    const comp = measureByteComposition(rendered);
    expect(comp.variableBytes).toBe('Variables:\n  name = Alice\n  age = 30'.length);
  });

  it('handles render with declarations', () => {
    const rendered = [
      '[prompt-language] Flow: g | Status: running',
      '',
      '  rubric: be helpful',
      '',
      '> prompt: hi  <-- current',
    ].join('\n');

    const comp = measureByteComposition(rendered);
    expect(comp.declarationBytes).toBeGreaterThan(0);
    expect(comp.nodeTreeBytes).toBeGreaterThan(0);
  });

  it('returns zero for missing sections', () => {
    const rendered = [
      '[prompt-language] Flow: g | Status: running',
      '',
      '> prompt: hi  <-- current',
    ].join('\n');

    const comp = measureByteComposition(rendered);
    expect(comp.gateBytes).toBe(0);
    expect(comp.variableBytes).toBe(0);
    expect(comp.warningBytes).toBe(0);
    expect(comp.captureReminderBytes).toBe(0);
    expect(comp.declarationBytes).toBe(0);
  });
});
