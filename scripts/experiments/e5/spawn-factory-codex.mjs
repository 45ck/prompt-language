#!/usr/bin/env node
// E5 factory-codex invoker.
//
// Spawns a codex-alone session against the frozen baseline prompt, inside the
// given workspace, with a time budget. Returns structured metrics the pair
// runner writes to the scorecard. Fails loudly if CODEX_BIN (or `codex` on
// PATH) is unavailable — does NOT fake success.

import { spawn, spawnSync } from 'node:child_process';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..', '..');

const DEFAULT_PROMPT = join(
  repoRoot,
  'experiments',
  'full-saas-factory',
  'e4-codex-crm-factory',
  'codex-alone-baseline.md',
);

function resolveCodexCommand() {
  const explicit = process.env.CODEX_BIN;
  if (explicit && explicit.trim().length > 0) {
    if (!existsSync(explicit)) {
      throw new Error(
        `CODEX_BIN is set to "${explicit}" but that path does not exist. Fix the env var or unset it.`,
      );
    }
    return { command: explicit, args: [] };
  }

  if (process.platform === 'win32') {
    const result = spawnSync('where.exe', ['codex.cmd'], {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
      windowsHide: true,
    });
    const shimPath = (result.stdout || '')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean);
    if (result.status === 0 && shimPath) {
      const shimDir = dirname(shimPath);
      const entrypoint = join(shimDir, 'node_modules', '@openai', 'codex', 'bin', 'codex.js');
      const bundledNode = join(shimDir, 'node.exe');
      if (existsSync(entrypoint)) {
        return {
          command: existsSync(bundledNode) ? bundledNode : process.execPath,
          args: [entrypoint],
        };
      }
    }
    throw new Error(
      'codex binary not found. Install the codex CLI (`npm i -g @openai/codex`), ' +
        'set CODEX_BIN to an absolute path, or ensure `codex.cmd` is on PATH.',
    );
  }

  const which = spawnSync('which', ['codex'], { encoding: 'utf-8' });
  if (which.status === 0 && which.stdout.trim()) {
    return { command: which.stdout.trim(), args: [] };
  }
  throw new Error(
    'codex binary not found on PATH. Install codex or set CODEX_BIN.',
  );
}

export async function spawnFactoryCodex({
  workspace,
  timeBudgetMin,
  model = 'gpt-5.2',
  promptFile = DEFAULT_PROMPT,
  laneResultsRoot,
} = {}) {
  if (!workspace) throw new Error('spawnFactoryCodex: workspace is required');
  if (!Number.isFinite(timeBudgetMin) || timeBudgetMin <= 0) {
    throw new Error('spawnFactoryCodex: timeBudgetMin must be a positive number');
  }
  if (!existsSync(promptFile)) {
    throw new Error(`factory-codex prompt file missing: ${promptFile}`);
  }
  await mkdir(workspace, { recursive: true });
  const resultsRoot = laneResultsRoot ?? workspace;
  await mkdir(resultsRoot, { recursive: true });

  const promptText = await readFile(promptFile, 'utf8');
  const { command, args: prefixArgs } = resolveCodexCommand();
  const lastMessagePath = join(resultsRoot, 'last-message.txt');
  const codexArgs = [
    ...prefixArgs,
    'exec',
    '--dangerously-bypass-approvals-and-sandbox',
    '--skip-git-repo-check',
    '--json',
    '--output-last-message',
    lastMessagePath,
    '-C',
    workspace,
    '--model',
    model,
    '-',
  ];

  const timeoutMs = Math.floor(timeBudgetMin * 60_000);
  const startedAt = Date.now();
  const { exitCode, stdout, stderr, timedOut } = await runWithTimeout(
    command,
    codexArgs,
    {
      cwd: workspace,
      input: promptText,
      timeoutMs,
    },
  );
  const wallClockSec = Math.round((Date.now() - startedAt) / 1000);

  await writeFile(join(resultsRoot, 'events.jsonl'), stdout || '(no stdout)\n');
  await writeFile(join(resultsRoot, 'stderr.log'), stderr || '(no stderr)\n');

  let failureClass = 'none';
  if (timedOut) failureClass = 'time-budget-exceeded';
  else if (exitCode !== 0) failureClass = `nonzero-exit-${exitCode}`;

  const result = {
    lane: 'codex-alone',
    workspace,
    promptFile,
    model,
    wallClockSec,
    interventionCount: 0,
    failureClass,
    exitCode,
    timedOut,
    timeBudgetMin,
  };
  await writeFile(
    join(resultsRoot, 'lane-summary.json'),
    JSON.stringify(result, null, 2),
  );
  return result;
}

function runWithTimeout(command, args, { cwd, input, timeoutMs }) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: process.env,
      windowsHide: true,
    });
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (c) => (stdout += c));
    child.stderr.on('data', (c) => (stderr += c));
    if (typeof input === 'string' && child.stdin.writable) {
      child.stdin.write(input);
    }
    if (child.stdin.writable) child.stdin.end();
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

// CLI entry: `node spawn-factory-codex.mjs --workspace ... --timeBudgetMin 120`
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('spawn-factory-codex.mjs')) {
  const args = parseFlags(process.argv.slice(2));
  try {
    const out = await spawnFactoryCodex({
      workspace: args.workspace,
      timeBudgetMin: Number(args.timeBudgetMin ?? 120),
      model: args.model,
      promptFile: args.promptFile,
      laneResultsRoot: args.laneResultsRoot,
    });
    process.stdout.write(JSON.stringify(out, null, 2) + '\n');
  } catch (err) {
    process.stderr.write(`[spawn-factory-codex] ${err.message}\n`);
    process.exit(1);
  }
}

function parseFlags(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (!argv[i].startsWith('--')) continue;
    const key = argv[i].slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) {
      out[key] = 'true';
    } else {
      out[key] = next;
      i += 1;
    }
  }
  return out;
}
