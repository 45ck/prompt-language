import { describe, expect, it } from 'vitest';
import { buildValidateFlowPreview } from './validate-flow.js';

describe('buildValidateFlowPreview', () => {
  it('returns complexity, lint count, and rendered flow preview', () => {
    const preview = buildValidateFlowPreview('Goal: test\n\nflow:\n  prompt: hello\n');

    expect(preview.complexity).toBe(1);
    expect(preview.lintWarningCount).toBe(0);
    expect(preview.output).toContain('[prompt-language validate] Flow parsed successfully.');
    expect(preview.output).toContain('Complexity: 1/5');
    expect(preview.output).toContain('Lint warnings: 0');
    expect(preview.output).toContain('[prompt-language] Flow: test | Status: active');
    expect(preview.output).toContain('prompt: hello');
  });

  it('includes lint warnings in the rendered warning section', () => {
    const preview = buildValidateFlowPreview(
      'Goal: test\n\nflow:\n  while tests_pass max 3\n  end\n',
    );

    expect(preview.lintWarningCount).toBeGreaterThan(0);
    expect(preview.output).toContain('Warnings:');
    expect(preview.output).toContain('condition may never change');
  });
});
