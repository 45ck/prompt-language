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
      assert.equal(manifest.claimStatus, 'structure-only-not-model-evidence');
      assert.equal(manifest.evidencePolicy.manifestAuthor, 'harness');
      assert.equal(manifest.evidencePolicy.oracleVisibility, 'private-artifacts-only');
      assert.equal(manifest.budget.enforced, true);
      assert.equal(manifest.startedAt, FIXED_TIME);
      assert.ok(manifest.steps.every((step) => step.cwd === armRun.workspace));
      assert.ok(manifest.steps.every((step) => step.requestedModel === step.actualModel));
      assert.ok(manifest.steps.every((step) => step.providerSubstitution.occurred === false));
    }
  } finally {
    rmSync(outputRoot, { recursive: true, force: true });
  }
});

test('budget flags are recorded in manifests', () => {
  const outputRoot = tempRoot();
  try {
    const result = runHarnessArena(
      parseArgs([
        '--dry-run',
        '--arms',
        'local-only',
        '--frontier-call-limit',
        '0',
        '--usd-limit',
        '0.25',
        '--wall-seconds-limit',
        '1200',
        '--local-repair-attempt-limit',
        '2',
        '--retry-policy',
        'first-local-failure',
        '--run-id',
        'budgeted-run',
        '--started-at',
        FIXED_TIME,
        '--output-root',
        outputRoot,
      ]),
    );
    const [armRun] = result.armRuns;
    const manifest = readJson(armRun.manifestPath);

    assert.equal(validateManifestAgainstSchema(manifest).valid, true);
    assert.deepEqual(manifest.budget, {
      enforced: true,
      frontierCallLimit: 0,
      localRepairAttemptLimit: 2,
      retryPolicy: 'first-local-failure',
      usdLimit: 0.25,
      wallSecondsLimit: 1200,
    });
  } finally {
    rmSync(outputRoot, { recursive: true, force: true });
  }
});

test('live budget validation rejects frontier arms above the call cap', () => {
  assert.throws(
    () =>
      parseArgs([
        '--live',
        '--arms',
        'frontier-only',
        '--live-frontier-command',
        'node -e "process.exit(0)"',
        '--oracle-command',
        'node -e "process.exit(0)" <workspace>',
        '--frontier-call-limit',
        '0',
      ]),
    /planned frontier step count 1/,
  );
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
    assert.equal(manifest.claimStatus, 'fake-live-deterministic-not-model-evidence');
    assert.equal(manifest.oracle.passed, true);
    assert.equal(manifest.oracle.visibility, 'private-artifacts-only');
    assert.match(manifest.oracle.commandSha256, /^[a-f0-9]{64}$/);
    assert.equal(manifest.oracle.timedOut, false);
    assert.equal(manifest.oracle.timeoutMs, 1000);
    assert.equal(step.timedOut, false);
    assert.equal(step.timeoutMs, 1000);
    assert.equal(step.provider, 'harness-arena');
    assert.equal(step.requestedModel, 'fake-live-local-command');
    assert.equal(step.actualModel, 'fake-live-local-command');
    assert.equal(step.cost.basis, 'none');
    assert.equal(step.frontierCallKind, 'none');
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

test('live mode requires explicit lane command and private oracle templates', () => {
  assert.throws(
    () => parseArgs(['--live', '--arms', 'local-only']),
    /--live requires --oracle-command/,
  );
  assert.throws(
    () =>
      parseArgs([
        '--live',
        '--arms',
        'local-only',
        '--oracle-command',
        'node private/oracle.mjs --workspace <workspace>',
      ]),
    /--live requires command templates for selected routes: local/,
  );
});

test('H11 qwen3-coder profile maps multi-file refactor to promoted local defaults', () => {
  const outputRoot = tempRoot();
  try {
    const options = parseArgs([
      '--dry-run',
      '--h11-qwen-coder-task',
      'multi-file-refactor',
      '--output-root',
      outputRoot,
      '--run-id',
      'h11-refactor-local-promoted',
      '--started-at',
      FIXED_TIME,
    ]);
    const result = runHarnessArena(options);
    const [armRun] = result.armRuns;
    const manifest = readJson(armRun.manifestPath);
    const [step] = manifest.steps;

    assert.deepEqual(options.arms, ['local-only']);
    assert.equal(options.taskId, 'h11-multi-file-refactor');
    assert.equal(options.h11QwenCoderRoute.shouldRunLocal, true);
    assert.equal(options.h11QwenCoderRoute.shouldRunLocalScreen, false);
    assert.equal(options.localModel, 'qwen3-coder:30b');
    assert.equal(options.policyVersion, 'h11-qwen3-coder-multi-file-refactor-routing-v1');
    assert.match(options.oracleCommand, /h11-multi-file-refactor-oracle\.mjs/);
    assert.equal(existsSync(join(armRun.workspace, 'src', 'contact.js')), true);
    assert.equal(step.stepId, 'local-bulk');
    assert.equal(step.routeDecision, 'local');
    assert.match(step.routeTrigger, /h11-qwen3-coder:h11-multi-file-refactor:local-promoted/);
    assert.equal(step.promptProgram.kind, 'flow');
    assert.match(step.promptProgram.path, /h11-multi-file-refactor-worker\.flow$/);
    assert.match(step.notes, /H11 qwen3-coder policy local-promoted/);
  } finally {
    rmSync(outputRoot, { recursive: true, force: true });
  }
});

test('H14 qwen3-coder profile maps promoted subroles to local harness defaults', () => {
  const outputRoot = tempRoot();
  try {
    const options = parseArgs([
      '--dry-run',
      '--h14-qwen-coder-subrole',
      'api-preservation',
      '--output-root',
      outputRoot,
      '--run-id',
      'h14-local-route',
      '--started-at',
      FIXED_TIME,
    ]);
    const result = runHarnessArena(options);
    const [armRun] = result.armRuns;
    const manifest = readJson(armRun.manifestPath);
    const [step] = manifest.steps;

    assert.deepEqual(options.arms, ['local-only']);
    assert.equal(options.taskId, 'h14-api-preserving-implementation');
    assert.equal(options.localModel, 'qwen3-coder:30b');
    assert.equal(options.policyVersion, 'h14-qwen3-coder-subrole-routing-v1');
    assert.match(options.oracleCommand, /h14-api-preservation-oracle\.mjs/);
    assert.equal(existsSync(join(armRun.workspace, 'src', 'contacts.js')), true);
    assert.equal(step.routeDecision, 'local');
    assert.match(
      step.routeTrigger,
      /h14-qwen3-coder:h14-api-preserving-implementation:local-promoted/,
    );
    assert.equal(step.promptProgram.kind, 'flow');
    assert.match(step.promptProgram.path, /h14-api-preservation-worker\.flow$/);
    assert.match(step.promptProgram.sha256, /^[a-f0-9]{64}$/);
    assert.match(step.notes, /H14 qwen3-coder policy local-promoted/);
  } finally {
    rmSync(outputRoot, { recursive: true, force: true });
  }
});

test('H14 local portfolio profile maps promoted subroles to selected local defaults', () => {
  const outputRoot = tempRoot();
  try {
    const options = parseArgs([
      '--dry-run',
      '--h14-local-subrole',
      'api-preservation',
      '--output-root',
      outputRoot,
      '--run-id',
      'h14-local-portfolio-route',
      '--started-at',
      FIXED_TIME,
    ]);
    const result = runHarnessArena(options);
    const [armRun] = result.armRuns;
    const manifest = readJson(armRun.manifestPath);
    const [step] = manifest.steps;

    assert.deepEqual(options.arms, ['local-only']);
    assert.equal(options.taskId, 'h14-api-preserving-implementation');
    assert.equal(options.localModel, 'qwen3-coder:30b');
    assert.equal(options.policyVersion, 'h14-local-subrole-routing-v1');
    assert.match(options.oracleCommand, /h14-api-preservation-oracle\.mjs/);
    assert.equal(step.routeDecision, 'local');
    assert.match(
      step.routeTrigger,
      /h14-local-portfolio:h14-api-preserving-implementation:local-promoted/,
    );
    assert.match(step.notes, /H14 local-portfolio policy local-promoted/);
  } finally {
    rmSync(outputRoot, { recursive: true, force: true });
  }
});

test('H14 qwen3-coder profile maps full TDD to local route defaults', () => {
  const options = parseArgs(['--h14-qwen-coder-subrole', 'full-tdd']);

  assert.deepEqual(options.arms, ['local-only']);
  assert.equal(options.taskId, 'h14-full-tdd');
  assert.equal(options.h14QwenCoderRoute.shouldRunLocal, true);
  assert.equal(options.localModel, 'qwen3-coder:30b');
  assert.match(options.oracleCommand, /h14-tdd-red-green-oracle\.mjs/);
});

test('H15 qwen3-coder profile maps endpoint work to frontier baseline defaults', () => {
  const outputRoot = tempRoot();
  try {
    const options = parseArgs([
      '--dry-run',
      '--h15-qwen-coder-task',
      'api-endpoint',
      '--output-root',
      outputRoot,
      '--run-id',
      'h15-frontier-route',
      '--started-at',
      FIXED_TIME,
    ]);
    const result = runHarnessArena(options);
    const [armRun] = result.armRuns;
    const manifest = readJson(armRun.manifestPath);
    const steps = manifest.steps;

    assert.deepEqual(options.arms, ['frontier-only']);
    assert.equal(options.taskId, 'h15-api-endpoint');
    assert.equal(options.h15QwenCoderRoute.shouldRunLocal, false);
    assert.equal(options.h15QwenCoderRoute.shouldRunHybrid, false);
    assert.equal(options.h15QwenCoderRoute.shouldRunFrontier, true);
    assert.equal(options.localModel, 'qwen3-coder:30b');
    assert.equal(options.policyVersion, 'h15-qwen3-coder-endpoint-routing-v2');
    assert.match(options.oracleCommand, /h15-api-endpoint-oracle\.mjs/);
    assert.equal(existsSync(join(armRun.workspace, 'src', 'app.js')), true);
    assert.deepEqual(
      steps.map((step) => step.stepId),
      ['frontier-full'],
    );
    assert.ok(
      steps.every((step) =>
        step.routeTrigger.includes('h15-qwen3-coder:h15-api-endpoint:frontier-baseline'),
      ),
    );
    assert.equal(steps[0].routeDecision, 'frontier');
    assert.equal(steps[0].promptProgram.kind, 'flow');
    assert.match(steps[0].promptProgram.path, /h15-api-endpoint-worker\.flow$/);
    assert.match(steps[0].escalationReason, /H15 qwen3-coder policy route frontier-baseline/);
    assert.match(steps[0].notes, /H15 qwen3-coder policy frontier-baseline/);
  } finally {
    rmSync(outputRoot, { recursive: true, force: true });
  }
});

test('H15 qwen3-coder profile maps validation micro-flow to local screen defaults', () => {
  const outputRoot = tempRoot();
  try {
    const options = parseArgs([
      '--dry-run',
      '--h15-qwen-coder-task',
      'validation-only',
      '--output-root',
      outputRoot,
      '--run-id',
      'h15-validation-local-screen',
      '--started-at',
      FIXED_TIME,
    ]);
    const result = runHarnessArena(options);
    const [armRun] = result.armRuns;
    const manifest = readJson(armRun.manifestPath);
    const [step] = manifest.steps;

    assert.deepEqual(options.arms, ['local-only']);
    assert.equal(options.taskId, 'h15-validation-only');
    assert.equal(options.h15QwenCoderRoute.shouldRunLocal, false);
    assert.equal(options.h15QwenCoderRoute.shouldRunLocalScreen, true);
    assert.equal(options.localModel, 'qwen3-coder:30b');
    assert.equal(options.policyVersion, 'h15-qwen3-coder-endpoint-routing-v2');
    assert.match(options.oracleCommand, /h15-validation-only-oracle\.mjs/);
    assert.equal(existsSync(join(armRun.workspace, 'src', 'app.js')), true);
    assert.equal(step.stepId, 'local-bulk');
    assert.equal(step.routeDecision, 'local');
    assert.match(step.routeTrigger, /h15-qwen3-coder:h15-validation-only:local-screen/);
    assert.equal(step.promptProgram.kind, 'flow');
    assert.match(step.promptProgram.path, /h15-validation-only-worker\.flow$/);
    assert.match(step.notes, /H15 qwen3-coder policy local-screen/);
  } finally {
    rmSync(outputRoot, { recursive: true, force: true });
  }
});

test('H15 qwen3-coder profile maps PATCH test-authoring micro-flow to promoted local defaults', () => {
  const outputRoot = tempRoot();
  try {
    const options = parseArgs([
      '--dry-run',
      '--h15-qwen-coder-task',
      'test-authoring',
      '--output-root',
      outputRoot,
      '--run-id',
      'h15-patch-test-authoring-local-promoted',
      '--started-at',
      FIXED_TIME,
    ]);
    const result = runHarnessArena(options);
    const [armRun] = result.armRuns;
    const manifest = readJson(armRun.manifestPath);
    const [step] = manifest.steps;

    assert.deepEqual(options.arms, ['local-only']);
    assert.equal(options.taskId, 'h15-patch-test-authoring');
    assert.equal(options.h15QwenCoderRoute.shouldRunLocal, true);
    assert.equal(options.h15QwenCoderRoute.shouldRunLocalScreen, false);
    assert.equal(options.localModel, 'qwen3-coder:30b');
    assert.equal(options.policyVersion, 'h15-qwen3-coder-endpoint-routing-v2');
    assert.match(options.oracleCommand, /h15-patch-test-authoring-oracle\.mjs/);
    assert.equal(existsSync(join(armRun.workspace, 'src', 'app.js')), true);
    assert.equal(step.stepId, 'local-bulk');
    assert.equal(step.routeDecision, 'local');
    assert.match(step.routeTrigger, /h15-qwen3-coder:h15-patch-test-authoring:local-promoted/);
    assert.equal(step.promptProgram.kind, 'flow');
    assert.match(step.promptProgram.path, /h15-patch-test-authoring-worker\.flow$/);
    assert.match(step.notes, /H15 qwen3-coder policy local-promoted/);
  } finally {
    rmSync(outputRoot, { recursive: true, force: true });
  }
});

test('H15 qwen3-coder profile allows the promoted PATCH test-authoring fallback model', () => {
  const outputRoot = tempRoot();
  try {
    const options = parseArgs([
      '--dry-run',
      '--h15-qwen-coder-task',
      'test-authoring',
      '--local-model',
      'devstral-small-2:24b',
      '--output-root',
      outputRoot,
      '--run-id',
      'h15-patch-test-authoring-devstral-fallback',
      '--started-at',
      FIXED_TIME,
    ]);
    const result = runHarnessArena(options);
    const [armRun] = result.armRuns;
    const manifest = readJson(armRun.manifestPath);
    const [step] = manifest.steps;

    assert.deepEqual(options.arms, ['local-only']);
    assert.equal(options.localModel, 'devstral-small-2:24b');
    assert.deepEqual(
      options.h15QwenCoderRoute.localCandidateModels.map((model) => model.name),
      ['qwen3-coder:30b', 'devstral-small-2:24b'],
    );
    assert.match(step.routeTrigger, /h15-qwen3-coder:h15-patch-test-authoring:local-promoted/);
  } finally {
    rmSync(outputRoot, { recursive: true, force: true });
  }
});

test('H15 qwen3-coder profile rejects route and model overrides outside evidence', () => {
  assert.throws(
    () => parseArgs(['--h15-qwen-coder-task', 'api-endpoint', '--arms', 'local-only']),
    /H15 route h15-api-endpoint is frontier-baseline and must run arms frontier-only/,
  );
  assert.throws(
    () =>
      parseArgs([
        '--h15-qwen-coder-task',
        'validation-only',
        '--local-model',
        'devstral-small-2:24b',
      ]),
    /H15 route h15-validation-only permits local models qwen3-coder:30b not devstral-small-2:24b/,
  );
});

test('route profiles are mutually exclusive', () => {
  assert.throws(
    () =>
      parseArgs([
        '--h14-local-subrole',
        'api-preservation',
        '--h14-qwen-coder-subrole',
        'api-preservation',
      ]),
    /Use only one route profile/,
  );
  assert.throws(
    () =>
      parseArgs([
        '--h11-qwen-coder-task',
        'multi-file-refactor',
        '--h14-qwen-coder-subrole',
        'api-preservation',
      ]),
    /Use only one route profile/,
  );
  assert.throws(
    () =>
      parseArgs([
        '--h14-qwen-coder-subrole',
        'api-preservation',
        '--h15-qwen-coder-task',
        'api-endpoint',
      ]),
    /Use only one route profile/,
  );
});

test('H11 qwen3-coder live profile requires only the routed lane command', () => {
  assert.throws(
    () => parseArgs(['--live', '--h11-qwen-coder-task', 'multi-file-refactor']),
    /--live requires command templates for selected routes: local/,
  );
});

test('H14 qwen3-coder live profile requires only the routed lane command', () => {
  assert.throws(
    () => parseArgs(['--live', '--h14-qwen-coder-subrole', 'api-preservation']),
    /--live requires command templates for selected routes: local/,
  );
  assert.throws(
    () => parseArgs(['--live', '--h14-qwen-coder-subrole', 'full-tdd']),
    /--live requires command templates for selected routes: local/,
  );
});

test('H15 qwen3-coder live profile requires only the frontier lane command', () => {
  assert.throws(
    () => parseArgs(['--live', '--h15-qwen-coder-task', 'api-endpoint']),
    /--live requires command templates for selected routes: frontier/,
  );
});

test('H11 qwen3-coder live profile interpolates the routed flow path into lane commands', () => {
  const outputRoot = tempRoot();
  const scriptRoot = tempRoot();
  try {
    mkdirSync(scriptRoot, { recursive: true });
    const liveScript = join(scriptRoot, 'h11-live-step.mjs');
    const oracleScript = join(scriptRoot, 'oracle.mjs');
    writeFileSync(
      liveScript,
      [
        "import { existsSync, writeFileSync } from 'node:fs';",
        "import { join } from 'node:path';",
        'const [workspace, h11Flow, h11FlowRelative] = process.argv.slice(2);',
        'if (!existsSync(h11Flow)) {',
        '  console.error(`missing h11 flow: ${h11Flow}`);',
        '  process.exit(1);',
        '}',
        "writeFileSync(join(workspace, 'h11-flow.json'), JSON.stringify({",
        '  h11Flow,',
        '  h11FlowRelative,',
        '}));',
        'console.log(`h11-flow:${h11FlowRelative}`);',
      ].join('\n'),
    );
    writeFileSync(
      oracleScript,
      [
        "import { existsSync } from 'node:fs';",
        "import { join } from 'node:path';",
        'const workspace = process.argv.at(-1);',
        "if (!existsSync(join(workspace, 'h11-flow.json'))) process.exit(1);",
        "console.log('h11 route command oracle pass');",
      ].join('\n'),
    );

    const liveCommand = [
      quoteCommandArg(process.execPath),
      quoteCommandArg(liveScript),
      '<workspace>',
      '<h11Flow>',
      '<h11FlowRelative>',
    ].join(' ');
    const oracleCommand = `${quoteCommandArg(process.execPath)} ${quoteCommandArg(
      oracleScript,
    )} --workspace <workspace>`;
    const result = runHarnessArena(
      parseArgs([
        '--live',
        '--h11-qwen-coder-task',
        'multi-file-refactor',
        '--live-local-command',
        liveCommand,
        '--oracle-command',
        oracleCommand,
        '--output-root',
        outputRoot,
        '--run-id',
        'h11-flow-placeholder-run',
        '--started-at',
        FIXED_TIME,
      ]),
    );
    const [armRun] = result.armRuns;
    const manifest = readJson(armRun.manifestPath);
    const [step] = manifest.steps;
    const h11Flow = readJson(join(armRun.workspace, 'h11-flow.json'));

    assert.equal(manifest.oracle.passed, true);
    assert.equal(step.exitCode, 0);
    assert.match(h11Flow.h11Flow, /h11-multi-file-refactor-worker\.flow$/);
    assert.equal(
      h11Flow.h11FlowRelative,
      'experiments/harness-arena/flows/h11-multi-file-refactor-worker.flow',
    );
    assert.match(
      readArmArtifact(armRun, step.stdoutArtifactRef),
      /h11-flow:experiments\/harness-arena\/flows\/h11-multi-file-refactor-worker\.flow/,
    );
  } finally {
    rmSync(outputRoot, { recursive: true, force: true });
    rmSync(scriptRoot, { recursive: true, force: true });
  }
});

test('H14 qwen3-coder live profile interpolates the routed flow path into lane commands', () => {
  const outputRoot = tempRoot();
  const scriptRoot = tempRoot();
  try {
    mkdirSync(scriptRoot, { recursive: true });
    const liveScript = join(scriptRoot, 'h14-live-step.mjs');
    const oracleScript = join(scriptRoot, 'oracle.mjs');
    writeFileSync(
      liveScript,
      [
        "import { existsSync, writeFileSync } from 'node:fs';",
        "import { join } from 'node:path';",
        'const [workspace, h14Flow, h14FlowRelative] = process.argv.slice(2);',
        'if (!existsSync(h14Flow)) {',
        '  console.error(`missing h14 flow: ${h14Flow}`);',
        '  process.exit(1);',
        '}',
        "writeFileSync(join(workspace, 'h14-flow.json'), JSON.stringify({",
        '  h14Flow,',
        '  h14FlowRelative,',
        '}));',
        'console.log(`h14-flow:${h14FlowRelative}`);',
      ].join('\n'),
    );
    writeFileSync(
      oracleScript,
      [
        "import { existsSync } from 'node:fs';",
        "import { join } from 'node:path';",
        'const workspace = process.argv.at(-1);',
        "if (!existsSync(join(workspace, 'h14-flow.json'))) process.exit(1);",
        "console.log('h14 route command oracle pass');",
      ].join('\n'),
    );

    const liveCommand = [
      quoteCommandArg(process.execPath),
      quoteCommandArg(liveScript),
      '<workspace>',
      '<h14Flow>',
      '<h14FlowRelative>',
    ].join(' ');
    const oracleCommand = `${quoteCommandArg(process.execPath)} ${quoteCommandArg(
      oracleScript,
    )} --workspace <workspace>`;
    const result = runHarnessArena(
      parseArgs([
        '--live',
        '--h14-qwen-coder-subrole',
        'api-preservation',
        '--live-local-command',
        liveCommand,
        '--oracle-command',
        oracleCommand,
        '--output-root',
        outputRoot,
        '--run-id',
        'h14-flow-placeholder-run',
        '--started-at',
        FIXED_TIME,
      ]),
    );
    const [armRun] = result.armRuns;
    const manifest = readJson(armRun.manifestPath);
    const [step] = manifest.steps;
    const h14Flow = readJson(join(armRun.workspace, 'h14-flow.json'));

    assert.equal(manifest.oracle.passed, true);
    assert.equal(step.exitCode, 0);
    assert.match(h14Flow.h14Flow, /h14-api-preservation-worker\.flow$/);
    assert.equal(
      h14Flow.h14FlowRelative,
      'experiments/harness-arena/flows/h14-api-preservation-worker.flow',
    );
    assert.match(
      readArmArtifact(armRun, step.stdoutArtifactRef),
      /h14-flow:experiments\/harness-arena\/flows\/h14-api-preservation-worker\.flow/,
    );
  } finally {
    rmSync(outputRoot, { recursive: true, force: true });
    rmSync(scriptRoot, { recursive: true, force: true });
  }
});

test('H15 qwen3-coder live profile interpolates the routed flow path into frontier command', () => {
  const outputRoot = tempRoot();
  const scriptRoot = tempRoot();
  try {
    mkdirSync(scriptRoot, { recursive: true });
    const liveScript = join(scriptRoot, 'h15-live-step.mjs');
    const oracleScript = join(scriptRoot, 'oracle.mjs');
    writeFileSync(
      liveScript,
      [
        "import { appendFileSync, existsSync } from 'node:fs';",
        "import { join } from 'node:path';",
        'const [workspace, routeFlow, routeFlowRelative, stepId, routeDecision] = process.argv.slice(2);',
        'if (!existsSync(routeFlow)) {',
        '  console.error(`missing route flow: ${routeFlow}`);',
        '  process.exit(1);',
        '}',
        "appendFileSync(join(workspace, 'h15-flow.jsonl'), JSON.stringify({",
        '  routeFlow,',
        '  routeFlowRelative,',
        '  routeDecision,',
        '  stepId,',
        "}) + '\\n');",
        'console.log(`h15-flow:${routeFlowRelative}:${stepId}:${routeDecision}`);',
      ].join('\n'),
    );
    writeFileSync(
      oracleScript,
      [
        "import { existsSync } from 'node:fs';",
        "import { join } from 'node:path';",
        'const workspace = process.argv.at(-1);',
        "if (!existsSync(join(workspace, 'h15-flow.jsonl'))) process.exit(1);",
        "console.log('h15 route command oracle pass');",
      ].join('\n'),
    );

    const liveCommand = [
      quoteCommandArg(process.execPath),
      quoteCommandArg(liveScript),
      '<workspace>',
      '<routeFlow>',
      '<routeFlowRelative>',
      '<stepId>',
      '<routeDecision>',
    ].join(' ');
    const oracleCommand = `${quoteCommandArg(process.execPath)} ${quoteCommandArg(
      oracleScript,
    )} --workspace <workspace>`;
    const result = runHarnessArena(
      parseArgs([
        '--live',
        '--h15-qwen-coder-task',
        'api-endpoint',
        '--live-frontier-command',
        liveCommand,
        '--oracle-command',
        oracleCommand,
        '--output-root',
        outputRoot,
        '--run-id',
        'h15-flow-placeholder-run',
        '--started-at',
        FIXED_TIME,
      ]),
    );
    const [armRun] = result.armRuns;
    const manifest = readJson(armRun.manifestPath);
    const flowLog = readFileSync(join(armRun.workspace, 'h15-flow.jsonl'), 'utf8');

    assert.equal(manifest.oracle.passed, true);
    assert.deepEqual(
      manifest.steps.map((step) => step.exitCode),
      [0],
    );
    assert.ok(
      manifest.steps.every((step) =>
        step.promptProgram.path.endsWith('h15-api-endpoint-worker.flow'),
      ),
    );
    assert.match(flowLog, /experiments\/harness-arena\/flows\/h15-api-endpoint-worker\.flow/);
    assert.match(flowLog, /frontier-full/);
    assert.doesNotMatch(flowLog, /local-bulk/);
  } finally {
    rmSync(outputRoot, { recursive: true, force: true });
    rmSync(scriptRoot, { recursive: true, force: true });
  }
});

test('H14 qwen3-coder live profile rejects lane commands that omit the routed flow', () => {
  const outputRoot = tempRoot();
  try {
    const liveCommand = `${quoteCommandArg(process.execPath)} -e ${quoteCommandArg(
      "console.log('wrong command')",
    )}`;

    assert.throws(
      () =>
        runHarnessArena(
          parseArgs([
            '--live',
            '--h14-qwen-coder-subrole',
            'api-preservation',
            '--live-local-command',
            liveCommand,
            '--output-root',
            outputRoot,
            '--run-id',
            'h14-missing-flow-run',
          ]),
        ),
      /must reference the routed flow experiments\/harness-arena\/flows\/h14-api-preservation-worker\.flow/,
    );
  } finally {
    rmSync(outputRoot, { recursive: true, force: true });
  }
});

test('live local runtime resource failures classify as harness failures, not model failures', () => {
  const outputRoot = tempRoot();
  const scriptRoot = tempRoot();
  try {
    mkdirSync(scriptRoot, { recursive: true });
    const localScript = join(scriptRoot, 'local-resource-fail.mjs');
    const oracleScript = join(scriptRoot, 'oracle-fail.mjs');
    writeFileSync(
      localScript,
      [
        "console.log('Prompt runner exited with code 1. Ollama runner failed: model requires more system memory (16.3 GiB) than is available (15.5 GiB)');",
        'process.exit(3);',
      ].join('\n'),
    );
    writeFileSync(
      oracleScript,
      ["console.log('oracle sees unchanged red fixture');", 'process.exit(1);'].join('\n'),
    );

    const localCommand = [
      quoteCommandArg(process.execPath),
      quoteCommandArg(localScript),
      '<h14Flow>',
    ].join(' ');
    const oracleCommand = `${quoteCommandArg(process.execPath)} ${quoteCommandArg(
      oracleScript,
    )} --workspace <workspace>`;
    const result = runHarnessArena(
      parseArgs([
        '--live',
        '--h14-qwen-coder-subrole',
        'api-preservation',
        '--live-local-command',
        localCommand,
        '--oracle-command',
        oracleCommand,
        '--output-root',
        outputRoot,
        '--run-id',
        'local-resource-failure-run',
        '--started-at',
        FIXED_TIME,
      ]),
    );
    const manifest = readJson(result.armRuns[0].manifestPath);

    assert.equal(manifest.steps[0].exitCode, 3);
    assert.equal(manifest.oracle.passed, false);
    assert.equal(manifest.classification.harnessFailure, true);
    assert.equal(manifest.classification.modelFailure, false);
    assert.equal(manifest.classification.resourceFailure, true);
    assert.match(manifest.classification.notes, /resource limit/);
  } finally {
    rmSync(outputRoot, { recursive: true, force: true });
    rmSync(scriptRoot, { recursive: true, force: true });
  }
});

test('live mode executes operator-supplied lane commands and private oracle artifacts', () => {
  const outputRoot = tempRoot();
  const scriptRoot = tempRoot();
  try {
    mkdirSync(scriptRoot, { recursive: true });
    const liveScript = join(scriptRoot, 'live-step.mjs');
    const snapshotScript = join(scriptRoot, 'resource-snapshot.mjs');
    const oracleScript = join(scriptRoot, 'oracle.mjs');
    writeFileSync(
      liveScript,
      [
        "import { writeFileSync } from 'node:fs';",
        "import { join } from 'node:path';",
        'const [workspace, arm, stepId, routeDecision, taskId] = process.argv.slice(2);',
        'await new Promise((resolve) => setTimeout(resolve, 350));',
        "writeFileSync(join(workspace, 'live-step.json'), JSON.stringify({",
        '  arm,',
        '  routeDecision,',
        '  stepId,',
        '  taskId,',
        '}));',
        'console.log(`live:${arm}:${stepId}:${routeDecision}:${taskId}`);',
      ].join('\n'),
    );
    writeFileSync(
      snapshotScript,
      [
        'const [, , label, model, endpoint] = process.argv;',
        'console.log(`resource:${label}:${model}:${endpoint}`);',
        "console.error('resource snapshot stderr');",
      ].join('\n'),
    );
    writeFileSync(
      oracleScript,
      [
        "import { existsSync } from 'node:fs';",
        "import { join } from 'node:path';",
        'const workspace = process.argv.at(-1);',
        "if (!existsSync(join(workspace, 'live-step.json'))) {",
        "  console.error('missing live-step artifact');",
        '  process.exit(1);',
        '}',
        "console.log('live oracle pass');",
      ].join('\n'),
    );

    const liveCommand = [
      quoteCommandArg(process.execPath),
      quoteCommandArg(liveScript),
      '<workspace>',
      '<arm>',
      '<stepId>',
      '<routeDecision>',
      '<taskId>',
    ].join(' ');
    const oracleCommand = `${quoteCommandArg(process.execPath)} ${quoteCommandArg(
      oracleScript,
    )} --workspace <workspace>`;
    const snapshotCommand = [
      quoteCommandArg(process.execPath),
      quoteCommandArg(snapshotScript),
      '<label>',
      '<localModel>',
      '<localEndpoint>',
    ].join(' ');
    const result = runHarnessArena(
      parseArgs([
        '--live',
        '--arms',
        'local-only',
        '--live-local-command',
        liveCommand,
        '--oracle-command',
        oracleCommand,
        '--local-model',
        'qwen3:8b',
        '--local-endpoint',
        'http://127.0.0.1:11434',
        '--local-resource-snapshot-command',
        snapshotCommand,
        '--local-resource-snapshot-interval-ms',
        '100',
        '--output-root',
        outputRoot,
        '--run-id',
        'live-run',
        '--started-at',
        FIXED_TIME,
      ]),
    );
    const [armRun] = result.armRuns;
    const manifest = readJson(armRun.manifestPath);
    const [step] = manifest.steps;

    assert.equal(validateManifestAgainstSchema(manifest).valid, true);
    assert.equal(manifest.claimStatus, 'live-model-evidence');
    assert.equal(manifest.oracle.passed, true);
    assert.equal(step.runner, 'ollama');
    assert.equal(step.provider, 'ollama');
    assert.equal(step.providerClass, 'local');
    assert.equal(step.requestedModel, 'qwen3:8b');
    assert.equal(step.endpoint, 'http://127.0.0.1:11434');
    assert.equal(step.timedOut, false);
    assert.ok(step.resourceSnapshotArtifactRefs.length >= 9);
    assert.equal(
      step.resourceSnapshotSummary.totalArtifactRefCount,
      step.resourceSnapshotArtifactRefs.length,
    );
    assert.equal(step.resourceSnapshotSummary.beforeAfterArtifactRefCount, 6);
    assert.equal(
      step.resourceSnapshotSummary.sampleArtifactRefCount,
      step.resourceSnapshotArtifactRefs.length - 6,
    );
    assert.ok(step.resourceSnapshotSummary.sampleCount >= 1);
    assert.equal(step.resourceSnapshotSummary.sampleNonzeroExitCount, 0);
    assert.equal(step.resourceSnapshotSummary.sampleMetadataParseFailureCount, 0);
    assert.ok(
      step.resourceSnapshotSummary.sampleStdoutNonEmptyCount >=
        step.resourceSnapshotSummary.sampleCount,
    );
    assert.ok(
      step.resourceSnapshotSummary.sampleStderrNonEmptyCount >=
        step.resourceSnapshotSummary.sampleCount,
    );
    assert.ok(
      step.resourceSnapshotArtifactRefs.every((artifactRef) =>
        step.outputArtifactRefs.includes(artifactRef),
      ),
    );
    assert.match(readArmArtifact(armRun, step.stdoutArtifactRef), /live:local-only:local-bulk/);
    const beforeSnapshotRef = step.resourceSnapshotArtifactRefs.find((artifactRef) =>
      artifactRef.includes('resources-before/stdout.txt'),
    );
    const afterSnapshotRef = step.resourceSnapshotArtifactRefs.find((artifactRef) =>
      artifactRef.includes('resources-after/stdout.txt'),
    );
    const sampleSnapshotRef = step.resourceSnapshotArtifactRefs.find((artifactRef) =>
      artifactRef.includes('resource-samples/sample-001-stdout.txt'),
    );
    assert.ok(beforeSnapshotRef);
    assert.ok(afterSnapshotRef);
    assert.ok(sampleSnapshotRef);
    assert.match(
      readArmArtifact(armRun, beforeSnapshotRef),
      /resource:before:qwen3:8b:http:\/\/127\.0\.0\.1:11434/,
    );
    assert.match(
      readArmArtifact(armRun, afterSnapshotRef),
      /resource:after:qwen3:8b:http:\/\/127\.0\.0\.1:11434/,
    );
    assert.match(
      readArmArtifact(armRun, sampleSnapshotRef),
      /resource:sample:qwen3:8b:http:\/\/127\.0\.0\.1:11434/,
    );
    assert.match(readArmArtifact(armRun, manifest.oracle.stdoutArtifactRef), /live oracle pass/);
    assert.equal(existsSync(join(armRun.workspace, 'HARNESS-ARENA-LIVE.md')), true);
  } finally {
    rmSync(outputRoot, { recursive: true, force: true });
    rmSync(scriptRoot, { recursive: true, force: true });
  }
});

test('sampled live run preserves shell variables inside nested command templates', () => {
  const outputRoot = tempRoot();
  const scriptRoot = tempRoot();
  try {
    mkdirSync(scriptRoot, { recursive: true });
    const liveScript = join(scriptRoot, 'write-live.mjs');
    const snapshotScript = join(scriptRoot, 'snapshot.mjs');
    const oracleScript = join(scriptRoot, 'oracle.mjs');
    writeFileSync(
      liveScript,
      [
        "import { writeFileSync } from 'node:fs';",
        "import { join } from 'node:path';",
        'const [workspace] = process.argv.slice(2);',
        "writeFileSync(join(workspace, 'live-step.json'), JSON.stringify({ ok: true }));",
        "console.log('nested shell variable preserved');",
      ].join('\n'),
    );
    writeFileSync(snapshotScript, "console.log('sample ok');\n");
    writeFileSync(
      oracleScript,
      [
        "import { existsSync } from 'node:fs';",
        "import { join } from 'node:path';",
        'const workspace = process.argv.at(-1);',
        "if (!existsSync(join(workspace, 'live-step.json'))) process.exit(1);",
        "console.log('nested oracle pass');",
      ].join('\n'),
    );

    const liveCommand = `bash -lc "repo=${scriptRoot}; node \\"$repo/write-live.mjs\\" <workspace>"`;
    const oracleCommand = `${quoteCommandArg(process.execPath)} ${quoteCommandArg(
      oracleScript,
    )} --workspace <workspace>`;
    const snapshotCommand = `${quoteCommandArg(process.execPath)} ${quoteCommandArg(
      snapshotScript,
    )}`;
    const result = runHarnessArena(
      parseArgs([
        '--live',
        '--arms',
        'local-only',
        '--live-local-command',
        liveCommand,
        '--oracle-command',
        oracleCommand,
        '--local-resource-snapshot-command',
        snapshotCommand,
        '--local-resource-snapshot-interval-ms',
        '100',
        '--output-root',
        outputRoot,
        '--run-id',
        'nested-shell-live-run',
        '--started-at',
        FIXED_TIME,
      ]),
    );
    const [armRun] = result.armRuns;
    const manifest = readJson(armRun.manifestPath);
    const [step] = manifest.steps;
    const wrapperPath = join(
      armRun.armDir,
      'artifacts',
      'steps',
      '01-local-bulk',
      'run-with-resource-sampling.sh',
    );

    assert.equal(validateManifestAgainstSchema(manifest).valid, true);
    assert.equal(step.exitCode, 0);
    assert.equal(manifest.oracle.passed, true);
    assert.match(
      readArmArtifact(armRun, step.stdoutArtifactRef),
      /nested shell variable preserved/,
    );
    assert.match(readFileSync(wrapperPath, 'utf8'), /step_command=\('bash' '-lc'/);
  } finally {
    rmSync(outputRoot, { recursive: true, force: true });
    rmSync(scriptRoot, { recursive: true, force: true });
  }
});

test('live hybrid-router inserts frontier repair after local lane failure', () => {
  const outputRoot = tempRoot();
  const noRepairOutputRoot = tempRoot();
  const cappedRepairOutputRoot = tempRoot();
  const scriptRoot = tempRoot();
  try {
    mkdirSync(scriptRoot, { recursive: true });
    const frontierScript = join(scriptRoot, 'frontier-step.mjs');
    const localScript = join(scriptRoot, 'local-fail.mjs');
    const repairScript = join(scriptRoot, 'frontier-repair.mjs');
    const oracleScript = join(scriptRoot, 'oracle.mjs');
    writeFileSync(
      frontierScript,
      [
        'const [, , workspace, stepId] = process.argv;',
        'console.log(`frontier:${stepId}:${workspace.length}`);',
      ].join('\n'),
    );
    writeFileSync(
      localScript,
      [
        'const [, , workspace, stepId] = process.argv;',
        'console.log(\'Prompt runner exited with code 1. Ollama runner failed: Ollama PowerShell bridge failed: Invoke-RestMethod : {"error":"model runner has unexpectedly stopped, this may be due to resource limitations"}\');',
        'console.log(`local-resource-failed:${stepId}:${workspace.length}`);',
        'process.exit(3);',
      ].join('\n'),
    );
    writeFileSync(
      repairScript,
      [
        "import { writeFileSync } from 'node:fs';",
        "import { join } from 'node:path';",
        'const [, , workspace, stepId] = process.argv;',
        "writeFileSync(join(workspace, 'frontier-repair.txt'), stepId);",
        'console.log(`repair:${stepId}`);',
      ].join('\n'),
    );
    writeFileSync(
      oracleScript,
      [
        "import { existsSync } from 'node:fs';",
        "import { join } from 'node:path';",
        'const workspace = process.argv.at(-1);',
        "if (!existsSync(join(workspace, 'frontier-repair.txt'))) process.exit(1);",
        "console.log('repair oracle pass');",
      ].join('\n'),
    );

    const frontierCommand = `${quoteCommandArg(process.execPath)} ${quoteCommandArg(
      frontierScript,
    )} <workspace> <stepId>`;
    const localCommand = `${quoteCommandArg(process.execPath)} ${quoteCommandArg(
      localScript,
    )} <workspace> <stepId>`;
    const repairCommand = `${quoteCommandArg(process.execPath)} ${quoteCommandArg(
      repairScript,
    )} <workspace> <stepId>`;
    const oracleCommand = `${quoteCommandArg(process.execPath)} ${quoteCommandArg(
      oracleScript,
    )} --workspace <workspace>`;

    const result = runHarnessArena(
      parseArgs([
        '--live',
        '--arms',
        'hybrid-router',
        '--live-local-command',
        localCommand,
        '--live-frontier-command',
        frontierCommand,
        '--live-frontier-repair-command',
        repairCommand,
        '--oracle-command',
        oracleCommand,
        '--output-root',
        outputRoot,
        '--run-id',
        'hybrid-repair-run',
        '--started-at',
        FIXED_TIME,
      ]),
    );
    const [armRun] = result.armRuns;
    const manifest = readJson(armRun.manifestPath);

    assert.deepEqual(
      manifest.steps.map((step) => step.stepId),
      ['frontier-classify', 'local-bulk', 'frontier-repair', 'frontier-review'],
    );
    assert.equal(validateManifestAgainstSchema(manifest).valid, true);
    assert.equal(manifest.steps[1].exitCode, 3);
    assert.equal(manifest.steps[2].frontierCallKind, 'repair');
    assert.equal(manifest.steps[2].providerClass, 'frontier');
    assert.equal(manifest.oracle.passed, true);
    assert.equal(manifest.classification.harnessFailure, true);
    assert.equal(manifest.classification.modelFailure, false);
    assert.equal(manifest.classification.resourceFailure, true);
    assert.match(readArmArtifact(armRun, manifest.oracle.stdoutArtifactRef), /repair oracle pass/);

    const noRepairResult = runHarnessArena(
      parseArgs([
        '--live',
        '--arms',
        'hybrid-router',
        '--live-local-command',
        localCommand,
        '--live-frontier-command',
        frontierCommand,
        '--live-frontier-repair-command',
        repairCommand,
        '--oracle-command',
        oracleCommand,
        '--local-repair-attempt-limit',
        '0',
        '--output-root',
        noRepairOutputRoot,
        '--run-id',
        'hybrid-no-repair-run',
        '--started-at',
        FIXED_TIME,
      ]),
    );
    const [noRepairArmRun] = noRepairResult.armRuns;
    const noRepairManifest = readJson(noRepairArmRun.manifestPath);

    assert.deepEqual(
      noRepairManifest.steps.map((step) => step.stepId),
      ['frontier-classify', 'local-bulk', 'frontier-review'],
    );
    assert.equal(validateManifestAgainstSchema(noRepairManifest).valid, true);
    assert.equal(noRepairManifest.budget.localRepairAttemptLimit, 0);
    assert.equal(noRepairManifest.oracle.passed, false);

    const cappedRepairResult = runHarnessArena(
      parseArgs([
        '--live',
        '--arms',
        'hybrid-router',
        '--live-local-command',
        localCommand,
        '--live-frontier-command',
        frontierCommand,
        '--live-frontier-repair-command',
        repairCommand,
        '--oracle-command',
        oracleCommand,
        '--frontier-call-limit',
        '2',
        '--local-repair-attempt-limit',
        '1',
        '--output-root',
        cappedRepairOutputRoot,
        '--run-id',
        'hybrid-capped-repair-run',
        '--started-at',
        FIXED_TIME,
      ]),
    );
    const [cappedRepairArmRun] = cappedRepairResult.armRuns;
    const cappedRepairManifest = readJson(cappedRepairArmRun.manifestPath);

    assert.deepEqual(
      cappedRepairManifest.steps.map((step) => step.stepId),
      ['frontier-classify', 'local-bulk', 'frontier-review'],
    );
    assert.equal(validateManifestAgainstSchema(cappedRepairManifest).valid, true);
    assert.equal(cappedRepairManifest.budget.frontierCallLimit, 2);
    assert.equal(cappedRepairManifest.oracle.passed, false);
  } finally {
    rmSync(outputRoot, { recursive: true, force: true });
    rmSync(noRepairOutputRoot, { recursive: true, force: true });
    rmSync(cappedRepairOutputRoot, { recursive: true, force: true });
    rmSync(scriptRoot, { recursive: true, force: true });
  }
});
