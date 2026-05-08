import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

const FIXTURE = join(import.meta.dirname, '..', 'fixtures', 'h15-validation-repair-short-name');
const ORACLE = join(import.meta.dirname, 'h15-validation-repair-short-name-oracle.mjs');

function tempWorkspace() {
  return join(
    tmpdir(),
    `ha-h15-validation-repair-oracle-${process.pid}-${Date.now()}-${Math.random()}`,
  );
}

function copyFixture(workspace) {
  mkdirSync(workspace, { recursive: true });
  cpSync(FIXTURE, workspace, { recursive: true });
}

function runOracle(workspace) {
  return spawnSync(process.execPath, [ORACLE, '--workspace', workspace], {
    encoding: 'utf8',
    timeout: 15_000,
    windowsHide: true,
  });
}

function writePassingRepair(workspace) {
  const appPath = join(workspace, 'src', 'app.js');
  const source = readFileSync(appPath, 'utf8');
  writeFileSync(
    appPath,
    source.replace(
      'if (data.name.length < 2) return { status: 400, body: null };',
      "if (data.name.length < 2) return invalid('Invalid name');",
    ),
  );
  writeFileSync(
    join(workspace, 'local-worker-summary.md'),
    [
      '# Local Worker Summary',
      '',
      '- changed files: src/app.js',
      '- checks run: node src/test.js',
      '- failures: none',
      '- timeout/no-edit status: completed',
      '- inputArtifactRefs: TASK.md, src/app.js, src/test.js',
      '- outputArtifactRefs: src/app.js, local-worker-summary.md',
      '- diffSummary: short-name validation now returns an error body',
    ].join('\n'),
  );
}

test('H15 validation repair oracle passes the intended short-name body repair', () => {
  const workspace = tempWorkspace();
  try {
    copyFixture(workspace);
    writePassingRepair(workspace);
    const result = runOracle(workspace);
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.match(result.stdout, /VERDICT: PASS/);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('H15 validation repair oracle rejects unchanged short-name response body', () => {
  const workspace = tempWorkspace();
  try {
    copyFixture(workspace);
    writeFileSync(
      join(workspace, 'local-worker-summary.md'),
      'changed files: none\nchecks run: none\ndiff',
    );
    const result = runOracle(workspace);
    assert.equal(result.status, 1, `${result.stdout}\n${result.stderr}`);
    assert.match(result.stdout, /short name missing error body|node src\/test\.js failed/);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('H15 validation repair oracle rejects public test edits', () => {
  const workspace = tempWorkspace();
  try {
    copyFixture(workspace);
    writePassingRepair(workspace);
    writeFileSync(join(workspace, 'src', 'test.js'), "console.log('rewritten tests');\n");
    const result = runOracle(workspace);
    assert.equal(result.status, 1, `${result.stdout}\n${result.stderr}`);
    assert.match(result.stdout, /src\/test\.js changed/);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('H15 validation repair oracle ignores harness-owned runtime files', () => {
  const workspace = tempWorkspace();
  try {
    copyFixture(workspace);
    writePassingRepair(workspace);
    mkdirSync(join(workspace, '.prompt-language'), { recursive: true });
    writeFileSync(join(workspace, '.prompt-language', 'session-state.json'), '{}\n');
    writeFileSync(join(workspace, 'HARNESS-ARENA-LIVE.md'), '# Live\n');
    const result = runOracle(workspace);
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('H15 validation repair oracle rejects hidden validation regressions', () => {
  const workspace = tempWorkspace();
  try {
    copyFixture(workspace);
    writePassingRepair(workspace);
    const appPath = join(workspace, 'src', 'app.js');
    const source = readFileSync(appPath, 'utf8');
    writeFileSync(appPath, source.replace('data.company.length < 1 || ', ''));
    const result = runOracle(workspace);
    assert.equal(result.status, 1, `${result.stdout}\n${result.stderr}`);
    assert.match(result.stdout, /empty company expected 400/);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('H15 validation repair oracle rejects broad seed and 404 rewrites', () => {
  const workspace = tempWorkspace();
  try {
    copyFixture(workspace);
    writePassingRepair(workspace);
    const appPath = join(workspace, 'src', 'app.js');
    const source = readFileSync(appPath, 'utf8');
    writeFileSync(
      appPath,
      source
        .replace('Carol Davis', 'Carol Brown')
        .replace(
          "return { status: 404, body: { error: 'Contact not found' } };",
          'return { status: 404, body: null };',
        ),
    );
    const result = runOracle(workspace);
    assert.equal(result.status, 1, `${result.stdout}\n${result.stderr}`);
    assert.match(result.stdout, /seed contact 3 changed|GET missing ID behavior changed/);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});
