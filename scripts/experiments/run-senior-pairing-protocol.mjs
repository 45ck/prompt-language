import { createHash } from 'node:crypto';
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const EXPERIMENT_ROOT = join(ROOT, 'experiments', 'senior-pairing-protocol');
const RESULTS_ROOT = join(EXPERIMENT_ROOT, 'results');
const FIXTURES_ROOT = join(EXPERIMENT_ROOT, 'fixtures');
const FLOWS_ROOT = join(EXPERIMENT_ROOT, 'flows');
const DEFAULT_MODEL = 'ollama_chat/qwen3-opencode-big:30b';
const WALL_TIMEOUT_MS = 7_200_000;

const ARM_GROUPS = {
  primary: ['solo-local', 'persona-only-control', 'pl-senior-pairing-local'],
  full: [
    'solo-local',
    'persona-only-control',
    'pl-senior-pairing-local',
    'pl-senior-pairing-full-local',
  ],
  all: [
    'solo-local',
    'persona-only-control',
    'pl-senior-pairing-local',
    'pl-senior-pairing-full-local',
    'pl-hybrid-judge',
  ],
};

const ARMS = {
  'solo-local': 'solo-baseline.flow',
  'persona-only-control': 'persona-control.flow',
  'pl-senior-pairing-local': 'senior-pairing-v1.flow',
  'pl-senior-pairing-full-local': 'senior-pairing-full.flow',
  'pl-hybrid-judge': 'hybrid-judge-v1.flow',
};

function parseArgs(argv) {
  const options = {
    task: 'sp01-ambiguous-priority',
    repeats: 1,
    arms: 'primary',
    runner: 'aider',
    model: DEFAULT_MODEL,
    runId: timestampId(),
    dryRun: false,
  };

  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === '--dry-run') {
      options.dryRun = true;
      continue;
    }
    if (!arg.startsWith('--')) {
      throw new Error(`Unexpected argument: ${arg}`);
    }
    const value = argv[++index];
    if (value == null) {
      throw new Error(`${arg} requires a value`);
    }
    const key = arg.slice(2).replace(/-([a-z])/g, (_, char) => char.toUpperCase());
    if (!(key in options)) {
      throw new Error(`Unknown option: ${arg}`);
    }
    options[key] = value;
  }

  options.repeats = Number.parseInt(String(options.repeats), 10);
  if (!Number.isFinite(options.repeats) || options.repeats < 1) {
    throw new Error('--repeats must be a positive integer');
  }
  return options;
}

function timestampId() {
  const date = new Date();
  const pad = (value) => String(value).padStart(2, '0');
  return [
    date.getUTCFullYear(),
    pad(date.getUTCMonth() + 1),
    pad(date.getUTCDate()),
    '-',
    pad(date.getUTCHours()),
    pad(date.getUTCMinutes()),
    pad(date.getUTCSeconds()),
  ].join('');
}

function resolveArms(value) {
  if (ARM_GROUPS[value]) {
    return ARM_GROUPS[value];
  }
  const arms = value
    .split(',')
    .map((arm) => arm.trim())
    .filter(Boolean);
  for (const arm of arms) {
    if (!ARMS[arm]) {
      throw new Error(`Unknown arm: ${arm}`);
    }
  }
  return arms;
}

function seededOrder(arms, seed) {
  return [...arms].sort((left, right) =>
    hash(`${seed}:${left}`).localeCompare(hash(`${seed}:${right}`)),
  );
}

function hash(value) {
  return createHash('sha256').update(value).digest('hex');
}

function hashFile(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function hashTree(root) {
  const digest = createHash('sha256');
  for (const path of listFiles(root)) {
    digest.update(relative(root, path).replace(/\\/g, '/'));
    digest.update('\0');
    digest.update(readFileSync(path));
    digest.update('\0');
  }
  return digest.digest('hex');
}

function listFiles(root) {
  const files = [];
  function walk(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'node_modules') continue;
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(path);
      } else if (entry.isFile()) {
        files.push(path);
      }
    }
  }
  walk(root);
  return files.sort((left, right) => left.localeCompare(right));
}

function cleanCopy(source, target) {
  rmSync(target, { recursive: true, force: true });
  mkdirSync(dirname(target), { recursive: true });
  cpSync(source, target, { recursive: true });
}

function copyFiltered(source, target) {
  rmSync(target, { recursive: true, force: true });
  mkdirSync(target, { recursive: true });
  function walk(src, dest) {
    for (const entry of readdirSync(src, { withFileTypes: true })) {
      if (
        entry.name === '.prompt-language' ||
        entry.name === '.git' ||
        entry.name === 'node_modules' ||
        entry.name === '.aider.chat.history.md'
      ) {
        continue;
      }
      const srcPath = join(src, entry.name);
      const destPath = join(dest, entry.name);
      if (entry.isDirectory()) {
        mkdirSync(destPath, { recursive: true });
        walk(srcPath, destPath);
      } else if (entry.isFile()) {
        cpSync(srcPath, destPath);
      }
    }
  }
  walk(source, target);
}

function runProcess(command, args, options) {
  const started = new Date();
  const launch = resolveCommand(command, args);
  const result = spawnSync(launch.command, launch.args, {
    cwd: options.cwd,
    env: options.env,
    encoding: 'utf8',
    timeout: options.timeoutMs,
    maxBuffer: 16 * 1024 * 1024,
    windowsHide: true,
  });
  const completed = new Date();
  return {
    command,
    args,
    cwd: options.cwd,
    exitCode: result.status ?? (result.signal ? 124 : 1),
    signal: result.signal,
    timedOut: result.error?.code === 'ETIMEDOUT',
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? String(result.error ?? ''),
    startedAt: started.toISOString(),
    completedAt: completed.toISOString(),
    durationMs: completed.getTime() - started.getTime(),
  };
}

function resolveCommand(command, args = []) {
  if (process.platform === 'win32' && command === 'npm') {
    return { command: 'cmd.exe', args: ['/d', '/s', '/c', ['npm', ...args].join(' ')] };
  }

  return { command, args };
}

function writeProcessArtifacts(dir, name, result) {
  writeFileSync(join(dir, `${name}-stdout.txt`), result.stdout, 'utf8');
  writeFileSync(join(dir, `${name}-stderr.txt`), result.stderr, 'utf8');
  writeFileSync(join(dir, `${name}.json`), `${JSON.stringify(result, null, 2)}\n`, 'utf8');
}

function gitCommit() {
  const result = runProcess('git', ['rev-parse', 'HEAD'], { cwd: ROOT, timeoutMs: 30_000 });
  return result.exitCode === 0 ? result.stdout.trim() : 'unknown';
}

function gitStatus() {
  const result = runProcess('git', ['status', '--short'], { cwd: ROOT, timeoutMs: 30_000 });
  return result.stdout.trim();
}

function modelDigest(model) {
  const ollamaModel = model.startsWith('ollama_chat/') ? model.slice('ollama_chat/'.length) : model;
  const result = runProcess('ollama', ['show', ollamaModel], { cwd: ROOT, timeoutMs: 30_000 });
  if (result.exitCode !== 0) {
    return null;
  }
  const digestLine = result.stdout
    .split(/\r?\n/)
    .find((line) => line.trim().toLowerCase().startsWith('digest'));
  return digestLine?.replace(/^digest\s+/i, '').trim() ?? null;
}

function readHardware() {
  const nvidia = runProcess(
    'nvidia-smi',
    ['--query-gpu=name,memory.total,driver_version', '--format=csv,noheader'],
    { cwd: ROOT, timeoutMs: 10_000 },
  );
  if (nvidia.exitCode === 0) {
    const [gpu, vram, driver] = nvidia.stdout
      .trim()
      .split(',')
      .map((part) => part.trim());
    return { gpu, vram_gb: parseVramGb(vram), driver };
  }
  return { gpu: 'nvidia-smi unavailable', vram_gb: null, driver: null };
}

function parseVramGb(value) {
  const match = /(\d+)/.exec(value ?? '');
  return match ? Math.round((Number.parseInt(match[1], 10) / 1024) * 10) / 10 : null;
}

function diffFixture(fixtureDir, workspaceDir, artifactDir) {
  const original = join(artifactDir, 'original-sanitized');
  const final = join(artifactDir, 'final-sanitized');
  copyFiltered(fixtureDir, original);
  copyFiltered(workspaceDir, final);
  const diff = runProcess('git', ['diff', '--no-index', '--', original, final], {
    cwd: ROOT,
    timeoutMs: 60_000,
  });
  writeFileSync(join(artifactDir, 'final-diff.patch'), diff.stdout, 'utf8');
  rmSync(original, { recursive: true, force: true });
  rmSync(final, { recursive: true, force: true });
  return diff.stdout;
}

function oracleAccess(workspaceDir, fixtureDir, artifactDir) {
  const beforeHash = hashFile(join(fixtureDir, 'verify.js'));
  const afterPath = join(workspaceDir, 'verify.js');
  const modifiedVerify = !existsSync(afterPath) || hashFile(afterPath) !== beforeHash;
  const historyPath = join(workspaceDir, '.aider.chat.history.md');
  const history = existsSync(historyPath) ? readFileSync(historyPath, 'utf8') : '';
  const leakLines = history
    .split(/\r?\n/)
    .filter((line) => /Added verify\.js|Read verify\.js|verify\.js to the chat/i.test(line));
  const log = [
    `modified_verify=${modifiedVerify}`,
    `aider_history_present=${existsSync(historyPath)}`,
    `read_verify_before_failure=${leakLines.length > 0}`,
    ...leakLines.map((line) => `evidence: ${line}`),
  ].join('\n');
  writeFileSync(join(artifactDir, 'oracle-access-log.txt'), `${log}\n`, 'utf8');
  return { modifiedVerify, readVerifyBeforeFailure: leakLines.length > 0 };
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function writePlaceholderJson(path, value) {
  if (!existsSync(path)) {
    writeJson(path, value);
  }
}

function runArm({
  arm,
  options,
  repeatId,
  position,
  seed,
  runRoot,
  fixtureDir,
  fixtureHash,
  digest,
}) {
  const armDir = join(runRoot, repeatId, `${String(position).padStart(2, '0')}-${arm}`);
  const workspaceDir = join(armDir, 'workspace');
  mkdirSync(armDir, { recursive: true });
  cleanCopy(fixtureDir, workspaceDir);

  const flowPath = join(FLOWS_ROOT, ARMS[arm]);
  const stateDir = join(workspaceDir, '.prompt-language');
  const spawnRunner = arm === 'pl-hybrid-judge' ? 'codex' : options.runner;
  const env = {
    ...process.env,
    PL_SPAWN_RUNNER: spawnRunner,
    PROMPT_LANGUAGE_AIDER_TIMEOUT_MS: process.env.PROMPT_LANGUAGE_AIDER_TIMEOUT_MS ?? '900000',
    PROMPT_LANGUAGE_OLLAMA_TIMEOUT_MS: process.env.PROMPT_LANGUAGE_OLLAMA_TIMEOUT_MS ?? '900000',
    PROMPT_LANGUAGE_CODEX_TIMEOUT_MS: process.env.PROMPT_LANGUAGE_CODEX_TIMEOUT_MS ?? '900000',
    PROMPT_LANGUAGE_GATE_TIMEOUT_MS: process.env.PROMPT_LANGUAGE_GATE_TIMEOUT_MS ?? '300000',
  };

  const startedAt = new Date().toISOString();
  const commandArgs = [
    join(ROOT, 'bin', 'cli.mjs'),
    'run',
    '--runner',
    options.runner,
    '--model',
    options.model,
    '--json',
    '--state-dir',
    stateDir,
    '--file',
    flowPath,
  ];

  const runnerResult = options.dryRun
    ? {
        command: process.execPath,
        args: commandArgs,
        cwd: workspaceDir,
        exitCode: 0,
        signal: null,
        timedOut: false,
        stdout: '{"dryRun":true}\n',
        stderr: '',
        startedAt,
        completedAt: new Date().toISOString(),
        durationMs: 0,
      }
    : runProcess(process.execPath, commandArgs, {
        cwd: workspaceDir,
        env,
        timeoutMs: WALL_TIMEOUT_MS,
      });

  writeProcessArtifacts(armDir, 'runner', runnerResult);

  const testResult = runProcess('npm', ['test'], {
    cwd: workspaceDir,
    env,
    timeoutMs: 300_000,
  });
  writeProcessArtifacts(armDir, 'test', testResult);
  writeFileSync(
    join(armDir, 'test-output.txt'),
    `${testResult.stdout}${testResult.stderr}`,
    'utf8',
  );

  const verifyResult = runProcess('node', ['verify.js'], {
    cwd: workspaceDir,
    env,
    timeoutMs: 300_000,
  });
  writeProcessArtifacts(armDir, 'verify', verifyResult);
  writeFileSync(join(armDir, 'verify-stdout.txt'), verifyResult.stdout, 'utf8');
  writeFileSync(join(armDir, 'verify-stderr.txt'), verifyResult.stderr, 'utf8');

  const diff = diffFixture(fixtureDir, workspaceDir, armDir);
  const oracle = oracleAccess(workspaceDir, fixtureDir, armDir);
  const changed = diff.trim().length > 0;
  const completedAt = new Date().toISOString();

  const manifest = {
    experiment_id: 'senior-pairing-protocol',
    task_id: options.task,
    repeat_id: repeatId,
    arm,
    arm_order_seed: seed,
    arm_order_position: position,
    model: options.model,
    model_digest: digest,
    temperature: 0,
    runner: options.runner,
    judge_model: arm === 'pl-hybrid-judge' ? 'gpt-5.2' : null,
    repo_commit: gitCommit(),
    repo_status_short: gitStatus(),
    fixture_hash: fixtureHash,
    hardware: readHardware(),
    started_at: startedAt,
    completed_at: completedAt,
    workspace_changed: changed,
    exit_code: runnerResult.exitCode,
    deterministic: {
      npm_test_exit_code: testResult.exitCode,
      verify_exit_code: verifyResult.exitCode,
      oracle_passed: verifyResult.exitCode === 0,
    },
    timeouts: {
      prompt_turn_seconds: 900,
      test_command_seconds: 300,
      verify_command_seconds: 300,
      gate_command_seconds: 300,
      arm_wall_budget_seconds: 7200,
      max_prompt_turns: 24,
      max_repair_loops: 3,
    },
    oracle_access: {
      read_verify_before_failure: oracle.readVerifyBeforeFailure,
      modified_verify: oracle.modifiedVerify,
      log_path: 'oracle-access-log.txt',
    },
    runtime_is_primary_score: false,
  };
  writeJson(join(armDir, 'run-manifest.json'), manifest);
  writePlaceholderJson(join(armDir, 'senior-frame.json'), { captured_by_flow_state: true });
  writePlaceholderJson(join(armDir, 'risk-report.json'), { captured_by_flow_state: true });
  writePlaceholderJson(join(armDir, 'test-plan.json'), { captured_by_flow_state: true });
  writePlaceholderJson(join(armDir, 'final-self-review.json'), { captured_by_flow_state: true });
  writeJson(join(armDir, 'scorecard.json'), {
    experiment_id: 'senior-pairing-protocol',
    task_id: options.task,
    repeat_id: repeatId,
    arm,
    oracle_passed: verifyResult.exitCode === 0,
    oracle_access_violation: oracle.readVerifyBeforeFailure || oracle.modifiedVerify,
    runner_exit_code: runnerResult.exitCode,
    notes:
      'Pilot scorecard placeholder; senior-behavior scoring is a separate blinded review step.',
  });
  writeFileSync(
    join(armDir, 'notes.md'),
    [
      '# Run Notes',
      '',
      `Arm: ${arm}`,
      `Repeat: ${repeatId}`,
      `Runner exit: ${runnerResult.exitCode}`,
      `npm test exit: ${testResult.exitCode}`,
      `verify exit: ${verifyResult.exitCode}`,
      `Oracle access violation: ${oracle.readVerifyBeforeFailure || oracle.modifiedVerify}`,
      '',
    ].join('\n'),
    'utf8',
  );

  return manifest;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const fixtureDir = join(FIXTURES_ROOT, options.task);
  if (!existsSync(fixtureDir) || !statSync(fixtureDir).isDirectory()) {
    throw new Error(`Fixture not found: ${fixtureDir}`);
  }

  const arms = resolveArms(options.arms);
  const runRoot = join(RESULTS_ROOT, options.runId, options.task);
  mkdirSync(runRoot, { recursive: true });
  const fixtureHash = hashTree(fixtureDir);
  const digest = modelDigest(options.model);
  const summaries = [];

  for (let repeat = 1; repeat <= options.repeats; repeat++) {
    const repeatId = `r${String(repeat).padStart(2, '0')}`;
    const seed = `${options.runId}-${options.task}-${repeatId}`;
    const orderedArms = seededOrder(arms, seed);
    mkdirSync(join(runRoot, repeatId), { recursive: true });
    writeJson(join(runRoot, repeatId, 'arm-order.json'), { seed, arms: orderedArms });

    orderedArms.forEach((arm, index) => {
      console.log(`[senior-pairing] ${repeatId} ${index + 1}/${orderedArms.length} ${arm}`);
      const manifest = runArm({
        arm,
        options,
        repeatId,
        position: index + 1,
        seed,
        runRoot,
        fixtureDir,
        fixtureHash,
        digest,
      });
      summaries.push({
        repeat_id: repeatId,
        arm,
        oracle_passed: manifest.deterministic.oracle_passed,
        runner_exit_code: manifest.exit_code,
        verify_exit_code: manifest.deterministic.verify_exit_code,
        oracle_access_violation:
          manifest.oracle_access.read_verify_before_failure ||
          manifest.oracle_access.modified_verify,
      });
    });
  }

  writeJson(join(runRoot, 'summary.json'), {
    run_id: options.runId,
    task_id: options.task,
    runner: options.runner,
    model: options.model,
    arms,
    repeats: options.repeats,
    dry_run: options.dryRun,
    summaries,
  });
  console.log(`[senior-pairing] results: ${runRoot}`);
}

main();
