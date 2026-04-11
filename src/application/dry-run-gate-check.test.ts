import { describe, expect, it } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createCompletionGate, createFlowSpec } from '../domain/flow-spec.js';
import { InMemoryCommandRunner } from '../infrastructure/adapters/in-memory-command-runner.js';
import { formatDryRunGateCheckSection, runDryRunGateChecks } from './dry-run-gate-check.js';

describe('runDryRunGateChecks', () => {
  it('executes gate commands and records outputs', async () => {
    const runner = new InMemoryCommandRunner();
    runner.setResult('npm test', { exitCode: 1, stdout: 'suite output', stderr: 'tests failed' });

    const spec = createFlowSpec('Gate check', [], [createCompletionGate('tests_pass', 'npm test')]);
    const result = await runDryRunGateChecks(spec, { commandRunner: runner });

    expect(result.report.status).toBe('unsuccessful');
    expect(result.entries).toEqual([
      {
        predicate: 'tests_pass',
        passed: false,
        command: 'npm test',
        exitCode: 1,
        stdout: 'suite output',
        stderr: 'tests failed',
      },
    ]);
    expect(formatDryRunGateCheckSection(result)).toContain('tests_pass [FAIL');
    expect(formatDryRunGateCheckSection(result)).toContain('stdout: suite output');
    expect(formatDryRunGateCheckSection(result)).toContain('stderr: tests failed');
  });

  it('returns ok when the flow defines no completion gates', async () => {
    const result = await runDryRunGateChecks(createFlowSpec('No gates', []));

    expect(result.report.status).toBe('ok');
    expect(result.entries).toEqual([]);
    expect(formatDryRunGateCheckSection(result)).toContain('(no completion gates defined)');
  });

  it('blocks gate checks when built-in gate prerequisites are missing', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'pl-dry-run-gates-'));

    try {
      await writeFile(join(tempDir, 'package.json'), '{"name":"tmp","scripts":{}}', 'utf8');
      const runner = new InMemoryCommandRunner();
      const spec = createFlowSpec('Missing lint', [], [createCompletionGate('lint_pass')]);

      const result = await runDryRunGateChecks(spec, {
        cwd: tempDir,
        commandRunner: runner,
      });

      expect(result.report.status).toBe('blocked');
      expect(result.report.diagnostics).toEqual(
        expect.arrayContaining([expect.objectContaining({ code: 'PLC-005' })]),
      );
      expect(runner.executedCommands).toEqual([]);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('returns a runtime diagnostic when no command runner is provided for executable gates', async () => {
    const spec = createFlowSpec('No runner', [], [createCompletionGate('custom_check', 'echo ok')]);

    const result = await runDryRunGateChecks(spec);

    expect(result.report.status).toBe('failed');
    expect(result.report.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          summary: expect.stringContaining('no command runner was provided'),
        }),
      ]),
    );
    expect(result.entries).toEqual([
      {
        predicate: 'custom_check',
      },
    ]);
  });

  it('formats multiline gate output lines with indentation', () => {
    const formatted = formatDryRunGateCheckSection({
      report: {
        status: 'unsuccessful',
        diagnostics: [],
        outcomes: [],
      },
      state: {} as never,
      entries: [
        {
          predicate: 'custom_check',
          passed: false,
          command: 'echo ok',
          exitCode: 1,
          stdout: 'line1\nline2',
          stderr: 'err1\nerr2',
        },
      ],
    });

    expect(formatted).toContain('stdout: line1');
    expect(formatted).toContain('      line2');
    expect(formatted).toContain('stderr: err1');
    expect(formatted).toContain('      err2');
  });
});
