// cspell:ignore fscrud
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = resolve(__dirname, '..', '..');
const VERIFY_SCRIPT = join(
  ROOT,
  'experiments',
  'fullstack-crud-comparison',
  'verification',
  'verify-fullstack-crud-workspace.mjs',
);

function runVerifier(workspace: string) {
  return spawnSync(process.execPath, [VERIFY_SCRIPT, '--workspace', workspace, '--json'], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 30_000,
  });
}

function writeValidWorkspace(workspace: string): void {
  mkdirSync(join(workspace, 'src'), { recursive: true });
  writeFileSync(
    join(workspace, 'package.json'),
    JSON.stringify(
      {
        scripts: {
          test: 'node test.js',
          start: 'node src/server.js',
        },
      },
      null,
      2,
    ),
  );
  writeFileSync(join(workspace, 'README.md'), 'Install, test, and run the app with npm scripts.');
  writeFileSync(join(workspace, 'run-manifest.json'), '{}');
  writeFileSync(join(workspace, 'verification-report.md'), 'npm test passed.');
  writeFileSync(join(workspace, 'test.js'), 'console.log("tests pass");');
  writeFileSync(
    join(workspace, 'src', 'app.ts'),
    [
      'export const seed = true;',
      'export const customers = ["customer", "customerId"];',
      'export const assets = ["asset", "assetId"];',
      'export const workOrders = ["workOrder", "work orders"];',
      'export const crud = ["list", "create", "edit", "detail", "delete"];',
      'export const status = ["open", "scheduled", "in_progress", "completed", "cancelled"];',
      'export const priority = ["low", "normal", "urgent"];',
      'export const completedAt = "completedAt";',
      'describe("integration test", () => undefined);',
    ].join('\n'),
  );
}

describe('FSCRUD verifier script', () => {
  it('passes a workspace with required artifacts, entity terms, rules, and tests', () => {
    const workspace = mkdtempSync(join(tmpdir(), 'fscrud-valid-'));
    writeValidWorkspace(workspace);

    const result = runVerifier(workspace);
    const report = JSON.parse(result.stdout) as { passed: boolean; score: number };

    expect(result.status).toBe(0);
    expect(report.passed).toBe(true);
    expect(report.score).toBeGreaterThanOrEqual(80);
  });

  it('fails when the package and entity surface are missing', () => {
    const workspace = mkdtempSync(join(tmpdir(), 'fscrud-invalid-'));
    writeFileSync(join(workspace, 'README.md'), 'incomplete');

    const result = runVerifier(workspace);
    const report = JSON.parse(result.stdout) as { passed: boolean; hardFailures: string[] };

    expect(result.status).toBe(1);
    expect(report.passed).toBe(false);
    expect(report.hardFailures).toContain('package_json_missing_or_invalid');
  });

  it('keeps both FSCRUD flows parse-valid', () => {
    const flows = ['solo-local-crud.flow', 'pl-fullstack-crud-v1.flow'];

    for (const flow of flows) {
      const output = execFileSync(
        process.execPath,
        [
          join(ROOT, 'bin', 'cli.mjs'),
          'validate',
          '--runner',
          'aider',
          '--mode',
          'headless',
          '--file',
          join(ROOT, 'experiments', 'fullstack-crud-comparison', 'flows', flow),
        ],
        { cwd: ROOT, encoding: 'utf8' },
      );
      expect(output).toContain('Flow parsed successfully');
    }
  });

  it('keeps FSCRUD task context inline instead of binding artifact handles as the task', () => {
    const flows = ['solo-local-crud.flow', 'pl-fullstack-crud-v1.flow'];

    for (const flow of flows) {
      const source = readFileSync(
        join(ROOT, 'experiments', 'fullstack-crud-comparison', 'flows', flow),
        'utf8',
      );

      expect(source).toContain('Task contract: ${task_contract}');
      expect(source).toContain('__tests__/domain.test.js');
      expect(source).not.toContain('let task_brief = "${last_stdout}"');
    }
  });
});
