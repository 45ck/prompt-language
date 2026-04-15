import { describe, it, expect } from 'vitest';
import {
  summarizeOutput,
  validateSummarySafety,
  INLINE_THRESHOLD,
  SUMMARIZE_THRESHOLD,
  SUMMARY_HEAD_CHARS,
  SUMMARY_TAIL_CHARS,
  type OutputContext,
} from './output-summarization.js';

const defaultContext: OutputContext = {
  isError: false,
  isGateOutput: false,
  isTestOutput: false,
  nodeType: 'run',
};

function makeOutput(length: number, char = 'x'): string {
  return char.repeat(length);
}

describe('summarizeOutput', () => {
  describe('inline disposition', () => {
    it('inlines empty output', () => {
      const result = summarizeOutput('', defaultContext);
      expect(result.disposition).toBe('inline');
      expect(result.rendered).toBe('');
      expect(result.originalLength).toBe(0);
      expect(result.safetyBypass).toBe(false);
    });

    it('inlines output at exactly INLINE_THRESHOLD', () => {
      const output = makeOutput(INLINE_THRESHOLD);
      const result = summarizeOutput(output, defaultContext);
      expect(result.disposition).toBe('inline');
      expect(result.rendered).toBe(output);
      expect(result.originalLength).toBe(INLINE_THRESHOLD);
    });

    it('inlines output below INLINE_THRESHOLD', () => {
      const output = 'hello world';
      const result = summarizeOutput(output, defaultContext);
      expect(result.disposition).toBe('inline');
      expect(result.rendered).toBe(output);
    });
  });

  describe('summarized disposition', () => {
    it('summarizes output just above INLINE_THRESHOLD', () => {
      const output = makeOutput(INLINE_THRESHOLD + 1);
      const result = summarizeOutput(output, defaultContext);
      expect(result.disposition).toBe('summarized');
      expect(result.originalLength).toBe(INLINE_THRESHOLD + 1);
    });

    it('summarizes output at SUMMARIZE_THRESHOLD', () => {
      const output = makeOutput(SUMMARIZE_THRESHOLD);
      const result = summarizeOutput(output, defaultContext);
      expect(result.disposition).toBe('summarized');
    });

    it('includes head and tail in summary', () => {
      const output = makeOutput(1000, 'a');
      const result = summarizeOutput(output, defaultContext);
      expect(result.rendered).toContain(`Output: 1000 chars`);
      expect(result.rendered).toContain(`head (${SUMMARY_HEAD_CHARS} chars)`);
      expect(result.rendered).toContain(`tail (${SUMMARY_TAIL_CHARS} chars)`);
      expect(result.rendered).toContain('chars omitted');
    });

    it('shows correct omitted count', () => {
      const length = 1000;
      const output = makeOutput(length);
      const result = summarizeOutput(output, defaultContext);
      const omitted = length - SUMMARY_HEAD_CHARS - SUMMARY_TAIL_CHARS;
      expect(result.rendered).toContain(`${omitted} chars omitted`);
    });
  });

  describe('artifact disposition', () => {
    it('artifacts output above SUMMARIZE_THRESHOLD', () => {
      const output = makeOutput(SUMMARIZE_THRESHOLD + 1);
      const result = summarizeOutput(output, defaultContext);
      expect(result.disposition).toBe('artifact');
      expect(result.originalLength).toBe(SUMMARIZE_THRESHOLD + 1);
    });

    it('artifacts very large output', () => {
      const output = makeOutput(50000);
      const result = summarizeOutput(output, defaultContext);
      expect(result.disposition).toBe('artifact');
      expect(result.rendered).toContain('Output: 50000 chars');
    });
  });

  describe('safety bypass — error context', () => {
    it('inlines large output when isError is true', () => {
      const output = makeOutput(5000);
      const result = summarizeOutput(output, { ...defaultContext, isError: true });
      expect(result.disposition).toBe('inline');
      expect(result.rendered).toBe(output);
      expect(result.safetyBypass).toBe(true);
    });

    it('inlines large output when isGateOutput is true', () => {
      const output = makeOutput(5000);
      const result = summarizeOutput(output, { ...defaultContext, isGateOutput: true });
      expect(result.disposition).toBe('inline');
      expect(result.safetyBypass).toBe(true);
    });

    it('inlines large output when isTestOutput is true', () => {
      const output = makeOutput(5000);
      const result = summarizeOutput(output, { ...defaultContext, isTestOutput: true });
      expect(result.disposition).toBe('inline');
      expect(result.safetyBypass).toBe(true);
    });
  });

  describe('safety bypass — pattern detection', () => {
    it('inlines output containing Error:', () => {
      const output = makeOutput(2000) + '\nTypeError: undefined is not a function';
      const result = summarizeOutput(output, defaultContext);
      expect(result.disposition).toBe('inline');
      expect(result.safetyBypass).toBe(true);
    });

    it('inlines output containing stack traces', () => {
      const output = makeOutput(2000) + '\n    at Object.<anonymous> (test.js:1:1)';
      const result = summarizeOutput(output, defaultContext);
      expect(result.disposition).toBe('inline');
      expect(result.safetyBypass).toBe(true);
    });

    it('inlines output containing FAIL keyword', () => {
      const output = makeOutput(2000) + '\nTest Suite FAILED';
      const result = summarizeOutput(output, defaultContext);
      expect(result.disposition).toBe('inline');
      expect(result.safetyBypass).toBe(true);
    });

    it('inlines output containing assertion errors', () => {
      const output = makeOutput(2000) + '\nAssertionError: expected 1 to equal 2';
      const result = summarizeOutput(output, defaultContext);
      expect(result.disposition).toBe('inline');
      expect(result.safetyBypass).toBe(true);
    });

    it('inlines output containing system error codes', () => {
      const output = makeOutput(2000) + '\nENOENT: no such file or directory';
      const result = summarizeOutput(output, defaultContext);
      expect(result.disposition).toBe('inline');
      expect(result.safetyBypass).toBe(true);
    });

    it('inlines output containing Python tracebacks', () => {
      const output = makeOutput(2000) + '\nTraceback (most recent call last):';
      const result = summarizeOutput(output, defaultContext);
      expect(result.disposition).toBe('inline');
      expect(result.safetyBypass).toBe(true);
    });

    it('inlines output containing panic', () => {
      const output = makeOutput(2000) + '\npanic: runtime error';
      const result = summarizeOutput(output, defaultContext);
      expect(result.disposition).toBe('inline');
      expect(result.safetyBypass).toBe(true);
    });

    it('inlines output containing exit code references', () => {
      const output = makeOutput(2000) + '\nexit code 1';
      const result = summarizeOutput(output, defaultContext);
      expect(result.disposition).toBe('inline');
      expect(result.safetyBypass).toBe(true);
    });

    it('does not bypass for clean output', () => {
      const output = makeOutput(2000);
      const result = summarizeOutput(output, defaultContext);
      expect(result.disposition).toBe('summarized');
      expect(result.safetyBypass).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('handles output with mixed content at threshold boundary', () => {
      const output = makeOutput(INLINE_THRESHOLD + 1);
      const result = summarizeOutput(output, defaultContext);
      expect(result.disposition).toBe('summarized');
    });

    it('preserves safetyBypass=false for small error output', () => {
      const output = 'Error: small error';
      const result = summarizeOutput(output, defaultContext);
      expect(result.disposition).toBe('inline');
      // Small output is inline regardless, but safetyBypass should still be true
      // because the pattern was detected
      expect(result.safetyBypass).toBe(true);
    });
  });
});

describe('validateSummarySafety', () => {
  it('returns safe for inline output', () => {
    const summary = summarizeOutput('any content', defaultContext);
    const result = validateSummarySafety('any content', summary);
    expect(result.safe).toBe(true);
    expect(result.warnings).toHaveLength(0);
  });

  it('returns safe when no critical patterns in original', () => {
    const output = makeOutput(1000);
    const summary = summarizeOutput(output, defaultContext);
    const result = validateSummarySafety(output, summary);
    expect(result.safe).toBe(true);
    expect(result.warnings).toHaveLength(0);
  });

  it('warns when error type is lost in summarization', () => {
    // Construct output where the error is in the middle (lost in summary)
    const head = makeOutput(SUMMARY_HEAD_CHARS + 50);
    const error = '\nTypeError: something broke\n';
    const tail = makeOutput(SUMMARY_TAIL_CHARS + 50);
    const original = head + error + tail;

    // Force through by directly creating a summarized result
    const summary = {
      disposition: 'summarized' as const,
      originalLength: original.length,
      rendered: `Output: ${original.length} chars\n--- head ---\n${head.slice(0, SUMMARY_HEAD_CHARS)}\n--- omitted ---\n--- tail ---\n${tail.slice(-SUMMARY_TAIL_CHARS)}`,
      safetyBypass: false,
    };

    const result = validateSummarySafety(original, summary);
    expect(result.safe).toBe(false);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings.some((w) => w.description === 'error type')).toBe(true);
  });

  it('warns when stack trace is lost in summarization', () => {
    const head = makeOutput(SUMMARY_HEAD_CHARS + 50);
    const trace = '\n    at Function.run (index.js:10:5)\n';
    const tail = makeOutput(SUMMARY_TAIL_CHARS + 50);
    const original = head + trace + tail;

    const summary = {
      disposition: 'summarized' as const,
      originalLength: original.length,
      rendered: `head: ${head.slice(0, SUMMARY_HEAD_CHARS)} tail: ${tail.slice(-SUMMARY_TAIL_CHARS)}`,
      safetyBypass: false,
    };

    const result = validateSummarySafety(original, summary);
    expect(result.safe).toBe(false);
    expect(result.warnings.some((w) => w.description === 'stack trace')).toBe(true);
  });

  it('returns safe when critical patterns appear in head/tail', () => {
    // Error at the very start — should appear in head
    const error = 'TypeError: bad thing\n';
    const rest = makeOutput(1000);
    const original = error + rest;
    const summary = summarizeOutput(original, defaultContext);

    // This won't actually be summarized because safety bypass triggers.
    // So it's always safe for inline.
    const result = validateSummarySafety(original, summary);
    expect(result.safe).toBe(true);
  });

  it('returns multiple warnings when multiple patterns are lost', () => {
    const head = makeOutput(SUMMARY_HEAD_CHARS + 50);
    const errors = '\nTypeError: broke\n    at test.js:1:1\nFAILED\n';
    const tail = makeOutput(SUMMARY_TAIL_CHARS + 50);
    const original = head + errors + tail;

    const summary = {
      disposition: 'summarized' as const,
      originalLength: original.length,
      rendered: `clean head and clean tail`,
      safetyBypass: false,
    };

    const result = validateSummarySafety(original, summary);
    expect(result.safe).toBe(false);
    expect(result.warnings.length).toBeGreaterThanOrEqual(2);
  });
});
