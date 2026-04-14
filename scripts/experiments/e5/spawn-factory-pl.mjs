#!/usr/bin/env node
// E5 factory-pl invoker.
//
// Launches the prompt-language CLI against the e4 CRM factory's project.flow +
// phase pack inside the given workspace. Applies the 3x time budget from the
// manifest and does NOT treat budget consumption as failure (PL-slower is
// expected and intentional per program.md).

import { spawn, spawnSync } from 'node:child_process';
import { mkdir, writeFile, cp } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..', '..');
const CLI = join(repoRoot, 'bin', 'cli.mjs');
const FACTORY_ROOT = join(
  repoRoot,
  'experiments',
  'full-saas-factory',
  'e4-codex-crm-factory',
);

function resolveCodexForPL() {
  // prompt-language CLI uses --runner codex internally for agent calls; the
  // codex binary must be reachable. Delegate to same resolver approach.
  const explicit = process.env.CODEX_BIN;
  if (explicit && existsSync(explicit)) return true;
  if (process.platform === 'win32') {
    const result = spawnSync('where.exe', ['codex.cmd'], {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
      windowsHide: true,
    });
    return result.status === 0 && !!(result.stdout || '').trim();
  }
  const which = spawnSync('which', ['codex'], { encoding: 'utf-8' });
  return which.status === 0 && !!which.stdout.trim();
}

export async function spawnFactoryPl({
  workspace,
  timeBudgetMin,
  model = 'gpt-5.2',
  flowFile,
  runId,
  laneResultsRoot,
} = {}) {
  if (!workspace) throw new Error('spawnFactoryPl: workspace is required');
  if (!Number.isFinite(timeBudgetMin) || timeBudgetMin <= 0) {
    throw new Error('spawnFactoryPl: timeBudgetMin must be a positive number');
  }
  if (!existsSync(CLI)) {
    throw new Error(
      `prompt-language CLI missing at ${CLI}. Run \`npm run build\` in the repo root first.`,
    );
  }
  if (!resolveCodexForPL()) {
    throw new Error(
      'codex binary not found and CODEX_BIN is unset. The prompt-language lane ' +
        'drives codex as its runner; install codex or set CODEX_BIN.',
    );
  }

  const sourceProjectFlow = flowFile ?? join(FACTORY_ROOT, 'project.flow');
  if (!existsSync(sourceProjectFlow)) {
    throw new Error(`factory-pl flow file missing: ${sourceProjectFlow}`);
  }
  const phasesSrc = join(FACTORY_ROOT, 'phases');
  if (!existsSync(phasesSrc)) {
    throw new Error(`factory-pl phase pack missing: ${phasesSrc}`);
  }

  await mkdir(workspace, { recursive: true });
  const resultsRoot = laneResultsRoot ?? workspace;
  await mkdir(resultsRoot, { recursive: true });

  // Stage the flow pack into the workspace so the lane runs from its own tree.
  const dstFlow = join(workspace, 'project.flow');
  await cp(sourceProjectFlow, dstFlow);
  await cp(phasesSrc, join(workspace, 'phases'), { recursive: true });

  const stateDir = join(workspace, '.prompt-language');
  const effectiveRunId =
    runId ??
    `${new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 12)}-${Math.random()
      .toString(36)
      .slice(2, 6)}`;

  const cliArgs = [
    CLI,
    'run',
    '--runner',
    'codex',
    '--model',
    model,
    '--state-dir',
    stateDir,
    '--json',
    '--file',
    'project.flow',
  ];

  const timeoutMs = Math.floor(timeBudgetMin * 60_000);
  const startedAt = Date.now();
  const { exitCode, stdout, stderr, timedOut } = await runWithTimeout(
    process.execPath,
    cliArgs,
    {
      cwd: workspace,
      timeoutMs,
      env: {
        ...process.env,
        PL_TRACE: '1',
        PL_RUN_ID: effectiveRunId,
      },
    },
  );
  const wallClockSec = Math.round((Date.now() - startedAt) / 1000);

  await writeFile(join(resultsRoot, 'run-report.json'), stdout || '{}\n');
  await writeFile(join(resultsRoot, 'stderr.log'), stderr || '(no stderr)\n');

  // Budget consumption is NOT a failure for PL (per program.md).
  let failureClass = 'none';
  if (timedOut) failureClass = 'none';
  else if (exitCode !== 0) failureClass = `nonzero-exit-${exitCode}`;

  const result = {
    lane: 'prompt-language',
    workspace,
    flowFile: dstFlow,
    model,
    plRunId: effectiveRunId,
    wallClockSec,
    interventionCount: 0,
    failureClass,
    exitCode,
    timedOut,
    timeBudgetMin,
    budgetConsumptionIsFailure: false,
  };
  await writeFile(
    join(resultsRoot, 'lane-summary.json'),
    JSON.stringify(result, null, 2),
  );
  return result;
}

function runWithTimeout(command, args, { cwd, timeoutMs, env }) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      cwd,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (c) => (stdout += c));
    child.stderr.on('data', (c) => (stderr += c));
    const to = setTimeout(() => {
      timedOut = true;
      try {
        child.kill('SIGKILL');
      } catch {
        // ignore
      }
    }, timeoutMs);
    child.once('error', (err) => {
      clearTimeout(to);
      reject(err);
    });
    child.once('close', (code) => {
      clearTimeout(to);
      resolvePromise({ exitCode: code ?? (timedOut ? 124 : 1), stdout, stderr, timedOut });
    });
  });
}

if (process.argv[1]?.endsWith('spawn-factory-pl.mjs')) {
  const args = parseFlags(process.argv.slice(2));
  try {
    const out = await spawnFactoryPl({
      workspace: args.workspace,
      timeBudgetMin: Number(args.timeBudgetMin ?? 360),
      model: args.model,
      flowFile: args.flowFile,
      runId: args.runId,
      laneResultsRoot: args.laneResultsRoot,
    });
    process.stdout.write(JSON.stringify(out, null, 2) + '\n');
  } catch (err) {
    process.stderr.write(`[spawn-factory-pl] ${err.message}\n`);
    process.exit(1);
  }
}

function parseFlags(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (!argv[i].startsWith('--')) continue;
    const key = argv[i].slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) out[key] = 'true';
    else {
      out[key] = next;
      i += 1;
    }
  }
  return out;
}
