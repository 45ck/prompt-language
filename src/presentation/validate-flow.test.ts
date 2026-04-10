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

  it('includes blocked preflight diagnostics when a runner is selected', () => {
    const preview = buildValidateFlowPreview('Goal: test\n\nflow:\n  prompt: hello\n', {
      cwd: '/repo',
      runner: 'codex',
      probeRunnerBinary: () => false,
    });

    expect(preview.report.status).toBe('blocked');
    expect(preview.output).toContain('[prompt-language preflight] BLOCKED');
    expect(preview.output).toContain('PLC-001');
  });

  it('includes runner-mode compatibility diagnostics when mode is selected', () => {
    const preview = buildValidateFlowPreview('Goal: test\n\nflow:\n  approve "Ship it?"\n', {
      cwd: '/repo',
      runner: 'opencode',
      mode: 'headless',
      probeRunnerBinary: () => true,
    });

    expect(preview.report.status).toBe('blocked');
    expect(preview.output).toContain('PLC-004');
    expect(preview.output).toContain('approve is unsupported for runner=opencode mode=headless');
  });

  it('renders warning-only profile diagnostics without blocking', () => {
    const preview = buildValidateFlowPreview('Goal: test\n\nflow:\n  prompt: hello\n', {
      cwd: '/repo',
      runner: 'opencode',
      mode: 'headless',
      probeRunnerBinary: () => true,
    });

    expect(preview.report.status).toBe('ok');
    expect(preview.output).toContain('[prompt-language preflight] WARN');
    expect(preview.output).toContain('PLC-007');
  });
});
