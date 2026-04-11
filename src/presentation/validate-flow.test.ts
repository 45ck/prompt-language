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

  it('includes an expanded swarm flow preview when lowering occurs', () => {
    const preview = buildValidateFlowPreview(
      [
        'Goal: swarm test',
        '',
        'flow:',
        '  swarm checkout_fix',
        '    role frontend model "sonnet"',
        '      prompt: Fix the UI regression.',
        '      return ${summary}',
        '    end',
        '    flow:',
        '      start frontend',
        '      await all',
        '    end',
        '  end',
      ].join('\n'),
    );

    expect(preview.expandedFlow).toContain('spawn "frontend" model "sonnet"');
    expect(preview.output).toContain('Expanded flow:');
    expect(preview.output).toContain(
      'receive __checkout_fix_frontend_returned from "frontend" timeout 30',
    );
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

  it('accepts supported artifact-aware completion gates in validate preview', () => {
    const preview = buildValidateFlowPreview(
      [
        'Goal: test',
        '',
        'flow:',
        '  prompt: hello',
        '',
        'done when:',
        '  artifact_valid deploy_plan',
        '  artifact_active deploy_plan',
        '  approval_passed("review_deploy_plan")',
      ].join('\n'),
      {
        cwd: '/repo',
        runner: 'codex',
        mode: 'headless',
        probeRunnerBinary: () => true,
      },
    );

    expect(preview.report.diagnostics.some((diagnostic) => diagnostic.code === 'PLC-009')).toBe(
      false,
    );
  });

  it('blocks malformed artifact-aware gate syntax during validate preview', () => {
    const preview = buildValidateFlowPreview(
      [
        'Goal: test',
        '',
        'flow:',
        '  prompt: hello',
        '',
        'done when:',
        '  artifact_status deploy_plan',
        '  approval_passed()',
      ].join('\n'),
      {
        cwd: '/repo',
        runner: 'codex',
        mode: 'headless',
        probeRunnerBinary: () => true,
      },
    );

    expect(preview.report.status).toBe('blocked');
    expect(preview.output).toContain('PLC-009');
    expect(preview.output).toContain('Unsupported artifact gate');
    expect(preview.output).toContain('approval_passed requires exactly one approval step id.');
  });
});
