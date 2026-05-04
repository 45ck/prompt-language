import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  listModelVisibleFixtureFiles,
  parseArgs,
  runHarnessArena,
  validateManifestAgainstSchema,
} from './runner.mjs';

const FIXED_TIME = '2026-01-01T00:00:00.000Z';

function tempRoot() {
  return join(tmpdir(), `ha-runner-${process.pid}-${Date.now()}-${Math.random()}`);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function readArmArtifact(armRun, artifactRef) {
  return readFileSync(join(armRun.armDir, ...artifactRef.split('/')), 'utf8');
}

function quoteCommandArg(value) {
  return `"${String(value).replaceAll('"', '\\"')}"`;
}

test('dry run materializes all HA-HR1 arms with schema-shaped manifests', () => {
  const outputRoot = tempRoot();
  try {
    const options = parseArgs([
      '--dry-run',
      '--run-id',
      'unit-run',
      '--started-at',
      FIXED_TIME,
      '--output-root',
      outputRoot,
    ]);
    const result = runHarnessArena(options);

    assert.equal(result.armRuns.length, 4);
    assert.equal(existsSync(join(result.runRoot, 'summary.json')), true);

    for (const armRun of result.armRuns) {
      const manifest = readJson(armRun.manifestPath);
      const validation = validateManifestAgainstSchema(manifest);

      assert.equal(validation.valid, true, validation.errors.join('\n'));
      assert.equal(existsSync(join(armRun.workspace, 'TASK.md')), true);
      assert.equal(existsSync(join(armRun.armDir, 'private', 'oracle-command.txt')), true);
      assert.equal(manifest.oracle.passed, false);
      assert.equal(manifest.startedAt, FIXED_TIME);
      assert.ok(manifest.steps.every((step) => step.cwd === armRun.workspace));
    }
  } finally {
    rmSync(outputRoot, { recursive: true, force: true });
  }
});

test('fake live executes deterministic local step commands and private oracle artifacts', () => {
  const outputRoot = tempRoot();
  const oracleRoot = tempRoot();
  try {
    mkdirSync(oracleRoot, { recursive: true });
    const oracleScript = join(oracleRoot, 'oracle.mjs');
    writeFileSync(
      oracleScript,
      [
        "import { existsSync } from 'node:fs';",
        "import { join } from 'node:path';",
        'const workspace = process.argv.at(-1);',
        "if (!existsSync(join(workspace, 'TASK.md'))) {",
        "  console.error('missing task');",
        '  process.exit(1);',
        '}',
        "console.log('oracle checked workspace');",
        "console.error('oracle private stderr');",
      ].join('\n'),
    );

    const oracleCommand = `${quoteCommandArg(process.execPath)} ${quoteCommandArg(
      oracleScript,
    )} --workspace <workspace>`;
    const result = runHarnessArena(
      parseArgs([
        '--fake-live',
        '--arms',
        'local-only',
        '--oracle-command',
        oracleCommand,
        '--output-root',
        outputRoot,
        '--run-id',
        'fake-live-run',
        '--started-at',
        FIXED_TIME,
      ]),
    );
    const [armRun] = result.armRuns;
    const manifest = readJson(armRun.manifestPath);
    const [step] = manifest.steps;

    assert.equal(validateManifestAgainstSchema(manifest).valid, true);
    assert.equal(manifest.oracle.passed, true);
    assert.equal(manifest.oracle.timedOut, false);
    assert.equal(manifest.oracle.timeoutMs, 1000);
    assert.equal(step.timedOut, false);
    assert.equal(step.timeoutMs, 1000);
    assert.equal(step.stdoutArtifactRef, 'artifacts/steps/01-local-bulk/stdout.txt');
    assert.equal(step.stderrArtifactRef, 'artifacts/steps/01-local-bulk/stderr.txt');
    assert.match(
      readArmArtifact(armRun, step.stdoutArtifactRef),
      /fake-live:local-only:local-bulk:1/,
    );
    assert.match(readArmArtifact(armRun, step.stderrArtifactRef), /fake-live-stderr:local-bulk/);
    assert.match(
      readArmArtifact(armRun, manifest.oracle.stdoutArtifactRef),
      /oracle checked workspace/,
    );
    assert.match(
      readArmArtifact(armRun, manifest.oracle.stderrArtifactRef),
      /oracle private stderr/,
    );
    assert.equal(existsSync(join(armRun.workspace, 'oracle-command.txt')), false);
    assert.equal(
      readFileSync(join(armRun.workspace, 'TASK.md'), 'utf8').includes(oracleCommand),
      false,
    );
  } finally {
    rmSync(outputRoot, { recursive: true, force: true });
    rmSync(oracleRoot, { recursive: true, force: true });
  }
});

test('fake live records hard timeout metadata and still runs private oracle phase', () => {
  const outputRoot = tempRoot();
  try {
    const slowCommand = `${quoteCommandArg(process.execPath)} -e ${quoteCommandArg(
      "setTimeout(() => console.log('too late'), 1000);",
    )}`;
    const result = runHarnessArena(
      parseArgs([
        '--fake-live',
        '--arms',
        'local-only',
        '--fake-step-command',
        slowCommand,
        '--step-timeout-ms',
        '50',
        '--output-root',
        outputRoot,
        '--run-id',
        'timeout-run',
        '--started-at',
        FIXED_TIME,
      ]),
    );
    const [armRun] = result.armRuns;
    const manifest = readJson(armRun.manifestPath);
    const [step] = manifest.steps;
    const metadata = readJson(
      join(armRun.armDir, 'artifacts', 'steps', '01-local-bulk', 'metadata.json'),
    );

    assert.equal(step.timedOut, true);
    assert.equal(step.exitCode, null);
    assert.equal(step.timeoutMs, 50);
    assert.equal(metadata.timedOut, true);
    assert.equal(metadata.timeoutMs, 50);
    assert.equal(manifest.classification.harnessFailure, true);
    assert.equal(manifest.oracle.passed, true);
    assert.equal(manifest.oracle.timedOut, false);
    assert.match(readArmArtifact(armRun, manifest.oracle.stdoutArtifactRef), /fake oracle pass/);
  } finally {
    rmSync(outputRoot, { recursive: true, force: true });
  }
});

test('fixture copy excludes private verifier and oracle files', () => {
  const fixture = tempRoot();
  const outputRoot = tempRoot();
  try {
    mkdirSync(join(fixture, 'src'), { recursive: true });
    mkdirSync(join(fixture, 'verification'), { recursive: true });
    writeFileSync(join(fixture, 'TASK.md'), 'Implement the visible task.\n');
    writeFileSync(join(fixture, 'src', 'index.js'), 'export const ok = true;\n');
    writeFileSync(join(fixture, 'verification', 'verify.mjs'), 'throw new Error("hidden");\n');
    writeFileSync(join(fixture, 'oracle-notes.md'), 'hidden\n');

    assert.deepEqual(listModelVisibleFixtureFiles(fixture), ['TASK.md', 'src/index.js']);

    const result = runHarnessArena(
      parseArgs([
        '--arms',
        'local-only',
        '--fixture',
        fixture,
        '--oracle-command',
        'node verification/verify.mjs',
        '--output-root',
        outputRoot,
        '--run-id',
        'fixture-run',
        '--started-at',
        FIXED_TIME,
      ]),
    );
    const workspace = result.armRuns[0].workspace;

    assert.equal(existsSync(join(workspace, 'src', 'index.js')), true);
    assert.equal(existsSync(join(workspace, 'verification', 'verify.mjs')), false);
    assert.equal(existsSync(join(workspace, 'oracle-notes.md')), false);
  } finally {
    rmSync(fixture, { recursive: true, force: true });
    rmSync(outputRoot, { recursive: true, force: true });
  }
});

test('leak audit rejects an oracle command copied into model-visible text', () => {
  const fixture = tempRoot();
  const outputRoot = tempRoot();
  try {
    mkdirSync(fixture, { recursive: true });
    writeFileSync(join(fixture, 'TASK.md'), 'Run node verification/verify.mjs to pass.\n');

    assert.throws(
      () =>
        runHarnessArena(
          parseArgs([
            '--arms',
            'local-only',
            '--fixture',
            fixture,
            '--oracle-command',
            'node verification/verify.mjs',
            '--output-root',
            outputRoot,
            '--run-id',
            'leak-run',
          ]),
        ),
      /oracle command leaked/,
    );
  } finally {
    rmSync(fixture, { recursive: true, force: true });
    rmSync(outputRoot, { recursive: true, force: true });
  }
});

test('live mode is explicitly blocked until the real runner exists', () => {
  assert.throws(() => parseArgs(['--live']), /live HA-HR1 model execution is not implemented/);
});
