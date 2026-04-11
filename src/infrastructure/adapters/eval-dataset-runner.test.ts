import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

import {
  buildCandidateInput,
  compareEvalReports,
  parseEvalDatasetJsonl,
  readEvalArtifactBundle,
  readEvalReport,
  resolveEvalRunById,
  runEvalDataset,
  runEvalDatasetFromFile,
  type EvalDatasetCase,
  type EvalRunReport,
} from './eval-dataset-runner.js';

describe('eval-dataset-runner', () => {
  it('parses JSONL datasets with prompt and flow cases', () => {
    const cases = parseEvalDatasetJsonl(
      [
        JSON.stringify({
          id: 'broken-math',
          fixture: '../../scripts/eval/fixtures/broken-math',
          input_type: 'prompt',
          input_file: 'task.txt',
          verify: 'node test.js',
          gates: ['tests_pass'],
        }),
        JSON.stringify({
          id: 'flow-case',
          fixture: './fixtures/flow-case',
          input_type: 'flow',
          input_file: 'case.flow',
          verify: 'node verify.js',
        }),
      ].join('\n'),
    );

    expect(cases).toEqual([
      {
        id: 'broken-math',
        fixture: '../../scripts/eval/fixtures/broken-math',
        inputType: 'prompt',
        inputFile: 'task.txt',
        verify: 'node test.js',
        gates: ['tests_pass'],
      },
      {
        id: 'flow-case',
        fixture: './fixtures/flow-case',
        inputType: 'flow',
        inputFile: 'case.flow',
        verify: 'node verify.js',
      },
    ]);
  });

  it('rejects duplicate dataset ids', () => {
    expect(() =>
      parseEvalDatasetJsonl(
        [
          JSON.stringify({
            id: 'duplicate-case',
            fixture: './fixtures/a',
            input_type: 'prompt',
            input_file: 'task.txt',
            verify: 'node test.js',
          }),
          JSON.stringify({
            id: 'duplicate-case',
            fixture: './fixtures/b',
            input_type: 'prompt',
            input_file: 'task.txt',
            verify: 'node test.js',
          }),
        ].join('\n'),
      ),
    ).toThrow('duplicate id "duplicate-case"');
  });

  it('wraps gated prompt candidates as a real flow with done-when gates', () => {
    const caseSpec: EvalDatasetCase = {
      id: 'broken-math',
      fixture: './fixtures/broken-math',
      inputType: 'prompt',
      inputFile: 'task.txt',
      verify: 'node test.js',
      gates: ['tests_pass', 'lint_pass'],
    };

    expect(buildCandidateInput(caseSpec, 'Fix the bug', 'vanilla')).toBe('Fix the bug');
    expect(buildCandidateInput(caseSpec, 'Fix the bug', 'gated')).toContain(
      'Goal: eval broken-math',
    );
    expect(buildCandidateInput(caseSpec, 'Fix the bug', 'gated')).toContain('flow:');
    expect(buildCandidateInput(caseSpec, 'Fix the bug', 'gated')).toContain('prompt: Fix the bug');
    expect(buildCandidateInput(caseSpec, 'Fix the bug', 'gated')).toContain('done when:');
    expect(buildCandidateInput(caseSpec, 'Fix the bug', 'gated')).toContain('tests_pass');
    expect(buildCandidateInput(caseSpec, 'Goal: check', 'gated')).toContain('lint_pass');
  });

  it('does not append gates for flow candidates', () => {
    const caseSpec: EvalDatasetCase = {
      id: 'flow-case',
      fixture: './fixtures/flow-case',
      inputType: 'flow',
      inputFile: 'case.flow',
      verify: 'node verify.js',
      gates: ['tests_pass'],
    };

    expect(
      buildCandidateInput(caseSpec, 'Goal: check\n\nflow:\n  run: node test.js\n', 'gated'),
    ).toBe('Goal: check\n\nflow:\n  run: node test.js\n');
  });

  it('runs repeats, aggregates metrics, and records baseline comparison', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'pl-eval-repeat-report-'));
    const writeReport = vi.fn().mockResolvedValue(undefined);
    try {
      const report = await runEvalDataset(
        [
          {
            id: 'case-a',
            fixture: './fixtures/a',
            inputType: 'prompt',
            inputFile: 'task.txt',
            verify: 'node test.js',
            gates: ['tests_pass'],
          },
        ],
        {
          datasetPath: '/tmp/datasets/e1.jsonl',
          candidate: 'gated',
          repeat: 2,
          outputPath: join(tempDir, 'report.json'),
          baselineReport: {
            schemaVersion: 1,
            kind: 'prompt-language-eval-report',
            generatedAt: '2026-04-10T00:00:00.000Z',
            datasetPath: '/tmp/datasets/e1.jsonl',
            datasetName: 'e1.jsonl',
            harness: 'claude',
            candidate: 'vanilla',
            repeat: 2,
            summary: {
              totalRuns: 2,
              passedRuns: 1,
              failedRuns: 1,
              passRate: 0.5,
              averageDurationMs: 10,
            },
            cases: [
              {
                caseId: 'case-a',
                repeat: 1,
                candidate: 'vanilla',
                passed: false,
                durationMs: 10,
              },
              {
                caseId: 'case-a',
                repeat: 2,
                candidate: 'vanilla',
                passed: true,
                durationMs: 10,
              },
            ],
          },
        },
        {
          now: vi
            .fn()
            .mockReturnValueOnce(0)
            .mockReturnValueOnce(20)
            .mockReturnValueOnce(30)
            .mockReturnValueOnce(60),
          getHarnessName: vi.fn().mockResolvedValue('claude'),
          prepareWorkspace: vi.fn().mockResolvedValue({
            cwd: '/tmp/work',
            cleanup: vi.fn().mockResolvedValue(undefined),
          }),
          loadInputText: vi.fn().mockResolvedValue('Fix the failing tests'),
          runPrompt: vi.fn().mockResolvedValue('done'),
          runFlow: vi.fn().mockResolvedValue('unused'),
          verifyWorkspace: vi
            .fn()
            .mockResolvedValueOnce({ passed: true, stdout: 'ok', stderr: '' })
            .mockResolvedValueOnce({ passed: false, stdout: '', stderr: 'failed' }),
          writeReport,
        },
      );

      expect(report.summary).toEqual({
        totalRuns: 2,
        passedRuns: 1,
        failedRuns: 1,
        passRate: 0.5,
        averageDurationMs: 25,
      });
      expect(report.comparison).toEqual({
        baselineCandidate: 'vanilla',
        candidatePassRate: 0.5,
        baselinePassRate: 0.5,
        passRateDelta: 0,
        candidateWins: 0,
        baselineWins: 0,
        ties: 1,
        winner: 'tie',
      });
      expect(writeReport).toHaveBeenCalledTimes(1);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('rejects non-positive repeat counts', async () => {
    await expect(
      runEvalDataset(
        [
          {
            id: 'case-a',
            fixture: './fixtures/a',
            inputType: 'prompt',
            inputFile: 'task.txt',
            verify: 'node test.js',
          },
        ],
        {
          datasetPath: '/tmp/datasets/e1.jsonl',
          repeat: 0,
        },
      ),
    ).rejects.toThrow('Eval repeat must be a positive integer.');
  });

  it('uses runFlow for flow cases loaded from a real dataset file', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'pl-eval-dataset-file-'));
    try {
      const datasetPath = join(tempDir, 'suite.jsonl');
      await writeFile(
        datasetPath,
        `${JSON.stringify({
          id: 'flow-case',
          fixture: '../fixtures/flow-case',
          input_type: 'flow',
          input_file: 'case.flow',
          verify: 'node verify.js',
        })}\n`,
        'utf8',
      );

      const report = await runEvalDatasetFromFile(datasetPath, undefined, {
        now: vi.fn().mockReturnValueOnce(0).mockReturnValueOnce(25),
        getHarnessName: vi.fn().mockResolvedValue('claude'),
        prepareWorkspace: vi.fn().mockResolvedValue({
          cwd: '/tmp/work',
          cleanup: vi.fn().mockResolvedValue(undefined),
        }),
        loadInputText: vi.fn().mockResolvedValue('Goal: flow\n\nflow:\n  run: node verify.js\n'),
        runPrompt: vi.fn().mockResolvedValue('unused'),
        runFlow: vi.fn().mockResolvedValue('flow run'),
        verifyWorkspace: vi.fn().mockResolvedValue({ passed: true, stdout: 'ok', stderr: '' }),
      });

      expect(report.summary.passedRuns).toBe(1);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('routes gated prompt candidates through runFlow instead of runPrompt', async () => {
    const runPrompt = vi.fn().mockResolvedValue('prompt run');
    const runFlow = vi.fn().mockResolvedValue('flow run');

    const report = await runEvalDataset(
      [
        {
          id: 'case-a',
          fixture: './fixtures/a',
          inputType: 'prompt',
          inputFile: 'task.txt',
          verify: 'node test.js',
          gates: ['tests_pass'],
        },
      ],
      {
        datasetPath: '/tmp/datasets/e1.jsonl',
        candidate: 'gated',
      },
      {
        now: vi.fn().mockReturnValueOnce(0).mockReturnValueOnce(12),
        getHarnessName: vi.fn().mockResolvedValue('claude'),
        prepareWorkspace: vi.fn().mockResolvedValue({
          cwd: '/tmp/work',
          cleanup: vi.fn().mockResolvedValue(undefined),
        }),
        loadInputText: vi.fn().mockResolvedValue('Fix the failing tests'),
        runPrompt,
        runFlow,
        verifyWorkspace: vi.fn().mockResolvedValue({ passed: true, stdout: 'ok', stderr: '' }),
      },
    );

    expect(runPrompt).not.toHaveBeenCalled();
    expect(runFlow).toHaveBeenCalledTimes(1);
    expect(runFlow.mock.calls[0]?.[0]).toContain('done when:');
    expect(report.summary.passedRuns).toBe(1);
  });

  it('writes reports into nested output directories with the default writer', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'pl-eval-report-'));
    try {
      const outputPath = join(tempDir, 'nested', 'reports', 'eval.json');

      const report = await runEvalDataset(
        [
          {
            id: 'case-a',
            fixture: './fixtures/a',
            inputType: 'prompt',
            inputFile: 'task.txt',
            verify: 'node test.js',
          },
        ],
        {
          datasetPath: '/tmp/datasets/e1.jsonl',
          outputPath,
        },
        {
          now: vi.fn().mockReturnValueOnce(0).mockReturnValueOnce(15),
          getHarnessName: vi.fn().mockResolvedValue('claude'),
          prepareWorkspace: vi.fn().mockResolvedValue({
            cwd: '/tmp/work',
            cleanup: vi.fn().mockResolvedValue(undefined),
          }),
          loadInputText: vi.fn().mockResolvedValue('Fix the failing tests'),
          runPrompt: vi.fn().mockResolvedValue('done'),
          runFlow: vi.fn().mockResolvedValue('unused'),
          verifyWorkspace: vi.fn().mockResolvedValue({ passed: true, stdout: 'ok', stderr: '' }),
        },
      );

      const written = JSON.parse(await readFile(outputPath, 'utf8')) as EvalRunReport;
      expect(written.summary).toEqual(report.summary);
      expect(written.cases).toEqual(report.cases);
      await expect(readEvalReport(outputPath)).resolves.toEqual(written);

      const firstCase = report.cases[0];
      expect(firstCase?.runId).toMatch(/^eval\.e1\.case-a\.claude\.gated\.r1\./);
      expect(firstCase?.artifacts?.bundlePath).toContain('\\runs\\');
      expect(firstCase?.artifacts?.annotationPath).toBeNull();

      const bundlePath = firstCase?.artifacts?.bundlePath;
      expect(bundlePath).toBeDefined();
      const bundle = await readEvalArtifactBundle(bundlePath!);
      expect(bundle.kind).toBe('prompt-language-eval-artifact-bundle');
      expect(bundle.dataset.caseId).toBe('case-a');
      expect(bundle.summary.verifyExitCode).toBe(0);
      expect(bundle.replay.runId).toBe(firstCase?.runId);
      await expect(readFile(bundle.artifacts.transcriptPath!, 'utf8')).resolves.toBe('unused');
      await expect(readFile(bundle.artifacts.verifyStdoutPath!, 'utf8')).resolves.toBe('ok');

      expect(resolveEvalRunById(report, firstCase?.runId ?? '')).toEqual({
        runId: firstCase?.runId,
        datasetPath: report.datasetPath,
        datasetName: report.datasetName,
        caseId: 'case-a',
        candidate: 'gated',
        harness: 'claude',
        repeat: 1,
        replay: firstCase?.replay,
        artifacts: firstCase?.artifacts,
      });
      expect(resolveEvalRunById(report, 'missing-run-id')).toBeUndefined();
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('does not fail the eval report when temp workspace cleanup is busy on Windows', async () => {
    const report = await runEvalDataset(
      [
        {
          id: 'case-a',
          fixture: './fixtures/a',
          inputType: 'prompt',
          inputFile: 'task.txt',
          verify: 'node test.js',
        },
      ],
      {
        datasetPath: '/tmp/datasets/e1.jsonl',
      },
      {
        now: vi.fn().mockReturnValueOnce(0).mockReturnValueOnce(15),
        getHarnessName: vi.fn().mockResolvedValue('codex'),
        prepareWorkspace: vi.fn().mockResolvedValue({
          cwd: '/tmp/work',
          cleanup: vi.fn().mockRejectedValue(new Error('EBUSY')),
        }),
        loadInputText: vi.fn().mockResolvedValue('Fix the failing tests'),
        runPrompt: vi.fn().mockResolvedValue('done'),
        runFlow: vi.fn().mockResolvedValue('unused'),
        verifyWorkspace: vi.fn().mockResolvedValue({ passed: true, stdout: 'ok', stderr: '' }),
      },
    );

    expect(report.summary.passedRuns).toBe(1);
  });

  it('compares reports by case-level pass rates', () => {
    const candidate: EvalRunReport = {
      schemaVersion: 1,
      kind: 'prompt-language-eval-report',
      generatedAt: '2026-04-10T00:00:00.000Z',
      datasetPath: '/tmp/e1.jsonl',
      datasetName: 'e1.jsonl',
      harness: 'claude',
      candidate: 'gated',
      repeat: 2,
      summary: {
        totalRuns: 4,
        passedRuns: 3,
        failedRuns: 1,
        passRate: 0.75,
        averageDurationMs: 20,
      },
      cases: [
        { caseId: 'a', repeat: 1, candidate: 'gated', passed: true, durationMs: 10 },
        { caseId: 'a', repeat: 2, candidate: 'gated', passed: true, durationMs: 10 },
        { caseId: 'b', repeat: 1, candidate: 'gated', passed: true, durationMs: 10 },
        { caseId: 'b', repeat: 2, candidate: 'gated', passed: false, durationMs: 10 },
      ],
    };
    const baseline: EvalRunReport = {
      ...candidate,
      candidate: 'vanilla',
      summary: {
        totalRuns: 4,
        passedRuns: 1,
        failedRuns: 3,
        passRate: 0.25,
        averageDurationMs: 20,
      },
      cases: [
        { caseId: 'a', repeat: 1, candidate: 'vanilla', passed: false, durationMs: 10 },
        { caseId: 'a', repeat: 2, candidate: 'vanilla', passed: false, durationMs: 10 },
        { caseId: 'b', repeat: 1, candidate: 'vanilla', passed: true, durationMs: 10 },
        { caseId: 'b', repeat: 2, candidate: 'vanilla', passed: false, durationMs: 10 },
      ],
    };

    expect(compareEvalReports(candidate, baseline)).toEqual({
      baselineCandidate: 'vanilla',
      candidatePassRate: 0.75,
      baselinePassRate: 0.25,
      passRateDelta: 0.5,
      candidateWins: 1,
      baselineWins: 0,
      ties: 1,
      winner: 'candidate',
    });
  });

  it('rejects baseline reports from a different dataset bank', async () => {
    await expect(
      runEvalDataset(
        [
          {
            id: 'case-a',
            fixture: './fixtures/a',
            inputType: 'prompt',
            inputFile: 'task.txt',
            verify: 'node test.js',
          },
        ],
        {
          datasetPath: '/tmp/datasets/e1.jsonl',
          baselineReport: {
            schemaVersion: 1,
            kind: 'prompt-language-eval-report',
            generatedAt: '2026-04-10T00:00:00.000Z',
            datasetPath: '/tmp/datasets/e2.jsonl',
            datasetName: 'e2.jsonl',
            harness: 'codex',
            candidate: 'vanilla',
            repeat: 1,
            summary: {
              totalRuns: 1,
              passedRuns: 1,
              failedRuns: 0,
              passRate: 1,
              averageDurationMs: 10,
            },
            cases: [
              { caseId: 'case-a', repeat: 1, candidate: 'vanilla', passed: true, durationMs: 10 },
            ],
          },
        },
        {
          now: vi.fn().mockReturnValueOnce(0).mockReturnValueOnce(15),
          getHarnessName: vi.fn().mockResolvedValue('codex'),
          prepareWorkspace: vi.fn().mockResolvedValue({
            cwd: '/tmp/work',
            cleanup: vi.fn().mockResolvedValue(undefined),
          }),
          loadInputText: vi.fn().mockResolvedValue('Fix the failing tests'),
          runPrompt: vi.fn().mockResolvedValue('done'),
          runFlow: vi.fn().mockResolvedValue('unused'),
          verifyWorkspace: vi.fn().mockResolvedValue({ passed: true, stdout: 'ok', stderr: '' }),
        },
      ),
    ).rejects.toThrow('Baseline dataset "e2.jsonl" does not match candidate dataset "e1.jsonl".');
  });

  it('records baseline lineage and classifies case regressions under the saved run bundle', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'pl-eval-baseline-lineage-'));
    try {
      const outputPath = join(tempDir, 'reports', 'candidate.json');
      const report = await runEvalDataset(
        [
          {
            id: 'case-a',
            fixture: './fixtures/a',
            inputType: 'prompt',
            inputFile: 'task.txt',
            verify: 'node test.js',
          },
        ],
        {
          datasetPath: '/tmp/datasets/e1.jsonl',
          outputPath,
          baselineReport: {
            schemaVersion: 1,
            kind: 'prompt-language-eval-report',
            generatedAt: '2026-04-10T00:00:00.000Z',
            datasetPath: '/tmp/datasets/e1.jsonl',
            datasetName: 'e1.jsonl',
            harness: 'codex',
            candidate: 'vanilla',
            repeat: 1,
            summary: {
              totalRuns: 1,
              passedRuns: 1,
              failedRuns: 0,
              passRate: 1,
              averageDurationMs: 10,
            },
            cases: [
              {
                caseId: 'case-a',
                repeat: 1,
                candidate: 'vanilla',
                passed: true,
                durationMs: 10,
                runId: 'baseline.case-a.r1',
              },
            ],
          },
        },
        {
          now: vi.fn().mockReturnValueOnce(0).mockReturnValueOnce(15),
          getHarnessName: vi.fn().mockResolvedValue('codex'),
          prepareWorkspace: vi.fn().mockResolvedValue({
            cwd: '/tmp/work',
            cleanup: vi.fn().mockResolvedValue(undefined),
          }),
          loadInputText: vi.fn().mockResolvedValue('Fix the failing tests'),
          runPrompt: vi.fn().mockResolvedValue('done'),
          runFlow: vi.fn().mockResolvedValue('unused'),
          verifyWorkspace: vi.fn().mockResolvedValue({
            passed: false,
            stdout: '',
            stderr: 'failed',
            exitCode: 1,
          }),
        },
      );

      const caseResult = report.cases[0];
      expect(caseResult?.baselineRunId).toBe('baseline.case-a.r1');
      expect(caseResult?.regressionClassification).toBe('product_regression');
      expect(caseResult?.verifyExitCode).toBe(1);

      const bundle = await readEvalArtifactBundle(caseResult?.artifacts?.bundlePath ?? '');
      expect(bundle.execution.regressionClassification).toBe('product_regression');
      expect(bundle.summary.verifyExitCode).toBe(1);
      expect(bundle.replay.mode).toBe('rerun_from_dataset');
      await expect(readFile(bundle.artifacts.verifyStderrPath!, 'utf8')).resolves.toBe('failed');
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});
