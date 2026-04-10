import { describe, expect, it } from 'vitest';
import { renderCompletionResult } from './render-completion-result.js';

describe('renderCompletionResult', () => {
  it('renders runtime diagnostics with code and fix action', () => {
    expect(
      renderCompletionResult({
        blocked: true,
        reason: 'Gate evaluation crashed: network error',
        gateResults: {},
        diagnostics: [
          {
            code: 'PLR-006',
            kind: 'runtime',
            phase: 'gate-eval',
            severity: 'error',
            blocksExecution: true,
            retryable: true,
            summary: 'Gate evaluation crashed: network error',
            action: 'Fix the failing gate command.',
          },
        ],
        outcomes: [],
      }),
    ).toBe('PLR-006 Gate evaluation crashed: network error\nFix: Fix the failing gate command.');
  });

  it('renders outcomes with code and summary', () => {
    expect(
      renderCompletionResult({
        blocked: true,
        reason: 'Completion gates failed: tests_pass.',
        gateResults: {},
        diagnostics: [],
        outcomes: [{ code: 'PLO-001', summary: 'Completion gates failed: tests_pass.' }],
      }),
    ).toBe('PLO-001 Completion gates failed: tests_pass.');
  });

  it('falls back to the raw reason when no classification is present', () => {
    expect(
      renderCompletionResult({
        blocked: true,
        reason: 'Completion remained blocked.',
        gateResults: {},
        diagnostics: [],
        outcomes: [],
      }),
    ).toBe('Completion remained blocked.');
  });
});
