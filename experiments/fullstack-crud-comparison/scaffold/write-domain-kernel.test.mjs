import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';

const ROOT = resolve(import.meta.dirname, '..', '..', '..');
const WRITE_SCAFFOLD = join(
  ROOT,
  'experiments',
  'fullstack-crud-comparison',
  'scaffold',
  'write-scaffold-contract.cjs',
);
const WRITE_KERNEL = join(
  ROOT,
  'experiments',
  'fullstack-crud-comparison',
  'scaffold',
  'write-domain-kernel.cjs',
);
const VERIFY = join(
  ROOT,
  'experiments',
  'fullstack-crud-comparison',
  'verification',
  'verify-fullstack-crud-workspace.mjs',
);

function run(command, args, cwd) {
  return spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    timeout: 60_000,
    windowsHide: true,
  });
}

function runResolved(command, args, cwd) {
  const resolved =
    process.platform === 'win32' && command === 'npm'
      ? { command: 'cmd.exe', args: ['/d', '/s', '/c', ['npm', ...args].join(' ')] }
      : { command, args };
  return spawnSync(resolved.command, resolved.args, {
    cwd,
    encoding: 'utf8',
    timeout: 60_000,
    windowsHide: true,
  });
}

test('writes a deterministic domain kernel that passes public and hidden domain checks', () => {
  const workspace = mkdtempSync(join(tmpdir(), 'fscrud-kernel-'));
  try {
    const scaffold = run(process.execPath, [WRITE_SCAFFOLD, workspace], ROOT);
    assert.equal(scaffold.status, 0, scaffold.stderr || scaffold.stdout);

    const kernel = run(process.execPath, [WRITE_KERNEL, workspace], ROOT);
    assert.equal(kernel.status, 0, kernel.stderr || kernel.stdout);

    for (const script of [
      'check:domain:exports',
      'check:domain:customer',
      'check:domain:assets',
      'check:domain:work-orders',
      'test',
    ]) {
      const result = runResolved('npm', ['run', script], workspace);
      assert.equal(result.status, 0, result.stderr || result.stdout);
    }

    const verifier = run(process.execPath, [VERIFY, '--workspace', workspace, '--json'], ROOT);
    assert.equal(verifier.status, 0, verifier.stderr || verifier.stdout);
    const report = JSON.parse(verifier.stdout);
    assert.equal(report.passed, true);
    assert.equal(report.checks.domainBehavior, true);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});
