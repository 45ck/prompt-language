#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..', '..');
const TEMPLATE_DIR = join(ROOT, 'experiments', 'factory-runtime-proof', 'template');
const RESULTS_ROOT = join(ROOT, 'experiments', 'results', 'factory-runtime-proof');
const VALID_RUNNERS = new Set(['claude', 'codex']);
const DEFAULT_CLAUDE_TIMEOUT_MS = 1_800_000;
const DEFAULT_CODEX_TIMEOUT_MS = 1_800_000;

function parseArgs(argv) {
  const options = {
    runners: ['claude', 'codex'],
    label: timestampLabel(new Date()),
    claudeTimeoutMs: DEFAULT_CLAUDE_TIMEOUT_MS,
    codexTimeoutMs: DEFAULT_CODEX_TIMEOUT_MS,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--runner') {
      const value = argv[index + 1];
      index += 1;
      if (value == null) {
        throw new Error('--runner requires a value');
      }
      if (value === 'all') {
        options.runners = ['claude', 'codex'];
        continue;
      }
      if (!VALID_RUNNERS.has(value)) {
        throw new Error(`Unsupported runner "${value}". Use claude, codex, or all.`);
      }
      options.runners = [value];
      continue;
    }
    if (arg === '--label') {
      const value = argv[index + 1];
      index += 1;
      if (value == null || value.trim().length === 0) {
        throw new Error('--label requires a non-empty value');
      }
      options.label = value.trim();
      continue;
    }
    if (arg === '--claude-timeout-ms') {
      const value = Number.parseInt(argv[index + 1] ?? '', 10);
      index += 1;
      if (!Number.isFinite(value) || value <= 0) {
        throw new Error('--claude-timeout-ms must be a positive integer');
      }
      options.claudeTimeoutMs = value;
      continue;
    }
    if (arg === '--codex-timeout-ms') {
      const value = Number.parseInt(argv[index + 1] ?? '', 10);
      index += 1;
      if (!Number.isFinite(value) || value <= 0) {
        throw new Error('--codex-timeout-ms must be a positive integer');
      }
      options.codexTimeoutMs = value;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function timestampLabel(date) {
  const yyyy = String(date.getFullYear());
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mi = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  return `${yyyy}${mm}${dd}-${hh}${mi}${ss}`;
}

function ensureTemplate() {
  if (!existsSync(TEMPLATE_DIR)) {
    throw new Error(`Factory proof template not found at ${TEMPLATE_DIR}`);
  }
}

function createWorkspace(runDir) {
  const workspace = join(runDir, 'workspace', 'crm-app');
  mkdirSync(workspace, { recursive: true });
  cpSync(TEMPLATE_DIR, workspace, { recursive: true });
  return workspace;
}

function spawnAndCapture(command, args, { cwd, env, logPath, input }) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, {
      cwd,
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    });

    let combined = '';

    const append = (chunk) => {
      const text = chunk.toString();
      combined += text;
    };

    child.stdout.on('data', append);
    child.stderr.on('data', append);
    child.once('error', rejectPromise);
    child.once('close', (code) => {
      writeFileSync(logPath, combined, 'utf8');
      resolvePromise({ code: code ?? 1, output: combined });
    });

    if (input != null) {
      child.stdin.end(input);
    } else {
      child.stdin.end();
    }
  });
}

function readJsonSafe(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

function summarizeLane(runner, runDir, workspace, code) {
  const statePath = join(workspace, '.prompt-language', 'session-state.json');
  const state = readJsonSafe(statePath);
  const summary = {
    runner,
    runDir: relativeToRoot(runDir),
    workspace: relativeToRoot(workspace),
    exitCode: code,
    statePath: existsSync(statePath) ? relativeToRoot(statePath) : null,
    status: state?.status ?? null,
    currentNodePath: state?.currentNodePath ?? null,
    failureReason: state?.failureReason ?? null,
    spawnedChildren: Object.fromEntries(
      Object.entries(state?.spawnedChildren ?? {}).map(([name, child]) => [
        name,
        {
          status: child?.status ?? null,
          stateDir: child?.stateDir ?? null,
        },
      ]),
    ),
  };
  writeFileSync(join(runDir, 'summary.json'), JSON.stringify(summary, null, 2) + '\n', 'utf8');
  return summary;
}

function relativeToRoot(path) {
  return path.startsWith(ROOT) ? path.slice(ROOT.length + 1).replaceAll('\\', '/') : path;
}

async function runLane(runner, label, claudeTimeoutMs, codexTimeoutMs) {
  const laneDir = join(RESULTS_ROOT, label, `${runner}-medium`);
  rmSync(laneDir, { recursive: true, force: true });
  mkdirSync(laneDir, { recursive: true });
  const workspace = createWorkspace(laneDir);
  const flowPath = join(workspace, 'factory-probe.flow');
  const flowText = readFileSync(flowPath, 'utf8');
  const logPath = join(laneDir, 'pl-run.log');
  const env = {
    ...process.env,
    PL_TRACE: '1',
    PROMPT_LANGUAGE_CLAUDE_EFFORT: process.env.PROMPT_LANGUAGE_CLAUDE_EFFORT ?? 'medium',
    PROMPT_LANGUAGE_CODEX_REASONING_EFFORT:
      process.env.PROMPT_LANGUAGE_CODEX_REASONING_EFFORT ?? 'medium',
  };

  if (runner === 'claude') {
    env.PROMPT_LANGUAGE_CLAUDE_TIMEOUT_MS = String(claudeTimeoutMs);
  }
  if (runner === 'codex') {
    env.PROMPT_LANGUAGE_CODEX_TIMEOUT_MS = String(codexTimeoutMs);
  }

  const { code } = await spawnAndCapture(
    'node',
    [join(ROOT, 'bin', 'cli.mjs'), 'ci', '--runner', runner],
    {
      cwd: workspace,
      env,
      logPath,
      input: flowText,
    },
  );

  return summarizeLane(runner, laneDir, workspace, code);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  ensureTemplate();

  const summaries = [];
  for (const runner of options.runners) {
    console.log(`[factory-runtime-proof] running ${runner}-medium -> ${options.label}`);
    summaries.push(
      await runLane(runner, options.label, options.claudeTimeoutMs, options.codexTimeoutMs),
    );
  }

  const summaryPath = join(RESULTS_ROOT, options.label, 'report.json');
  mkdirSync(join(RESULTS_ROOT, options.label), { recursive: true });
  writeFileSync(summaryPath, JSON.stringify({ label: options.label, summaries }, null, 2) + '\n');

  for (const summary of summaries) {
    console.log(
      `[factory-runtime-proof] ${summary.runner}-medium exit=${summary.exitCode} status=${summary.status ?? 'none'} current=${JSON.stringify(summary.currentNodePath)}`,
    );
    if (summary.failureReason) {
      console.log(
        `[factory-runtime-proof] ${summary.runner}-medium reason=${summary.failureReason}`,
      );
    }
  }
}

await main();
