#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const DEFAULT_HARNESS = 'claude';
const HARNESS = parseHarness(process.argv, process.env.EVAL_HARNESS);
const DEFAULT_MODEL = parseModel(process.argv, process.env.EVAL_MODEL);
const ROOT = resolve(import.meta.dirname, '..', '..');

function parseHarness(argv, envHarness) {
  const flagIndex = argv.indexOf('--harness');
  const flagValue = flagIndex >= 0 ? argv[flagIndex + 1] : null;
  return (flagValue || envHarness || DEFAULT_HARNESS).toLowerCase();
}

function parseModel(argv, envModel) {
  const flagIndex = argv.indexOf('--model');
  const flagValue = flagIndex >= 0 ? argv[flagIndex + 1] : null;
  return flagValue || envModel || undefined;
}

function cleanEnv() {
  const env = { ...process.env };
  delete env.CLAUDECODE;
  return env;
}

function buildCodexPrompt(prompt) {
  return [
    'You are executing a prompt-language flow, not doing open-ended coding.',
    'Treat the text below as a DSL program and follow it literally.',
    'Rules:',
    '- Execute prompt, run, let/var, while, until, retry, if/else, try/catch/finally, foreach, break, continue, spawn, await, remember, send, receive, import, and use exactly as written.',
    '- Honor variable interpolation like ${name} and conditionals like and/or, comparisons, and grounded-by commands.',
    '- Remember nodes are concrete file writes, not abstract memory: write `.prompt-language/memory.json` as a JSON array of objects with at least `timestamp`, and optionally `text`, `key`, and `value`.',
    '- For `remember key="..." value="..."`, replace any older entry with the same key so the file keeps the latest value.',
    '- let x = memory "key" reads the latest remembered value back from that file.',
    '- Imported libraries and use namespace.symbol(...) calls must be expanded before continuing.',
    '- Do not inspect the repository unless the flow explicitly tells you to.',
    '- Do not explain your reasoning.',
    '- Do not write code unless the flow commands explicitly create or modify files.',
    '',
    prompt,
  ].join('\n');
}

function versionCommand() {
  if (HARNESS === 'codex') {
    return codexBinaryCommand('--version');
  }

  if (HARNESS === 'opencode') {
    return ['opencode', '--version'];
  }

  return ['claude', '--version'];
}

function quotePowerShellArg(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function buildCodexPowerShellCommand(args) {
  return `& codex ${args.map(quotePowerShellArg).join(' ')}`;
}

function codexBinaryCommand(...args) {
  if (process.platform === 'win32') {
    return [
      'powershell',
      '-NoProfile',
      '-ExecutionPolicy',
      'Bypass',
      '-Command',
      buildCodexPowerShellCommand(args),
    ];
  }

  return ['codex', ...args];
}

function execClaude(prompt, cwd, timeout, model, strict) {
  const args = ['-p', '--dangerously-skip-permissions'];
  if (model) {
    args.push('--model', model);
  }

  try {
    return execFileSync('claude', args, {
      input: prompt,
      encoding: 'utf-8',
      cwd,
      timeout,
      env: cleanEnv(),
      maxBuffer: 20 * 1024 * 1024,
    });
  } catch (error) {
    if (error.stderr) {
      console.error(`  [debug] stderr: ${error.stderr.slice(0, 200)}`);
    }
    if (strict) {
      throw error;
    }
    return error.stdout ?? '';
  }
}

function execCodex(prompt, cwd, timeout, model, strict) {
  const outputFile = join(
    cwd || tmpdir(),
    `codex-last-message-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}.txt`,
  );
  const args = [
    'exec',
    '--dangerously-bypass-approvals-and-sandbox',
    '--skip-git-repo-check',
    '--output-last-message',
    outputFile,
  ];

  if (model) {
    args.push('-m', model);
  }
  if (cwd) {
    args.push('-C', cwd);
  }
  args.push('-');

  try {
    const [command, ...commandArgs] = codexBinaryCommand(...args);
    execFileSync(command, commandArgs, {
      input: buildCodexPrompt(prompt),
      encoding: 'utf-8',
      timeout,
      env: cleanEnv(),
      stdio: ['pipe', 'ignore', 'pipe'],
    });
    return readFileSync(outputFile, 'utf-8');
  } catch (error) {
    if (error.stderr) {
      console.error(`  [debug] stderr: ${error.stderr.slice(0, 200)}`);
    }
    if (strict) {
      throw error;
    }
    try {
      return readFileSync(outputFile, 'utf-8');
    } catch {
      return error.stdout ?? '';
    }
  } finally {
    try {
      rmSync(outputFile, { force: true });
    } catch {
      // ignore cleanup failures
    }
  }
}

function execOpenCode(prompt, cwd, timeout, model, strict) {
  const args = ['run', '--dangerously-skip-permissions', '--dir', cwd];

  if (model) {
    args.push('--model', model);
  }

  args.push(prompt);

  try {
    return execFileSync('opencode', args, {
      encoding: 'utf-8',
      cwd,
      timeout,
      env: cleanEnv(),
      maxBuffer: 20 * 1024 * 1024,
    });
  } catch (error) {
    if (error.stderr) {
      console.error(`  [debug] stderr: ${error.stderr.slice(0, 200)}`);
    }
    if (strict) {
      throw error;
    }
    return error.stdout ?? '';
  }
}

function execOpenCodeFlow(flowText, cwd, timeout, model, strict) {
  const args = [join(ROOT, 'bin', 'cli.mjs'), 'ci', '--runner', 'opencode'];

  if (model) {
    args.push('--model', model);
  }

  try {
    return execFileSync('node', args, {
      input: flowText,
      encoding: 'utf-8',
      cwd,
      timeout,
      env: cleanEnv(),
      maxBuffer: 20 * 1024 * 1024,
    });
  } catch (error) {
    if (error.stderr) {
      console.error(`  [debug] stderr: ${error.stderr.slice(0, 200)}`);
    }
    if (strict) {
      throw error;
    }
    return error.stdout ?? '';
  }
}

export function getHarnessName() {
  return HARNESS;
}

export function getHarnessLabel() {
  if (HARNESS === 'codex') {
    return 'Codex CLI';
  }

  if (HARNESS === 'opencode') {
    return 'OpenCode CLI';
  }

  return 'Claude CLI';
}

export function getCommandLabel() {
  if (HARNESS === 'codex') {
    return 'codex exec';
  }

  if (HARNESS === 'opencode') {
    return 'opencode run';
  }

  return 'claude -p';
}

export function getFlowCommandLabel() {
  return HARNESS === 'opencode' ? 'prompt-language ci --runner opencode' : getCommandLabel();
}

export function checkHarnessVersion(timeout = 5000) {
  const [command, ...args] = versionCommand();
  return execFileSync(command, args, {
    encoding: 'utf-8',
    timeout,
    env: cleanEnv(),
  }).trim();
}

export function runHarnessPrompt(
  prompt,
  { cwd = process.cwd(), timeout = 120_000, model, strict = false } = {},
) {
  const resolvedModel = model ?? DEFAULT_MODEL;
  return HARNESS === 'codex'
    ? execCodex(prompt, cwd, timeout, resolvedModel, strict)
    : HARNESS === 'opencode'
      ? execOpenCode(prompt, cwd, timeout, resolvedModel, strict)
      : execClaude(prompt, cwd, timeout, resolvedModel, strict);
}

export function runHarnessFlow(
  flowText,
  { cwd = process.cwd(), timeout = 120_000, model, strict = false } = {},
) {
  const resolvedModel = model ?? DEFAULT_MODEL;
  return HARNESS === 'opencode'
    ? execOpenCodeFlow(flowText, cwd, timeout, resolvedModel, strict)
    : runHarnessPrompt(flowText, {
        cwd,
        timeout,
        model: resolvedModel,
        strict,
      });
}
