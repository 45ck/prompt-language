#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

const DEFAULT_HARNESS = 'claude';
const HARNESS = parseHarness(process.argv, process.env.EVAL_HARNESS);
let codexEntryPoint;

function parseHarness(argv, envHarness) {
  const flagIndex = argv.indexOf('--harness');
  const flagValue = flagIndex >= 0 ? argv[flagIndex + 1] : null;
  return (flagValue || envHarness || DEFAULT_HARNESS).toLowerCase();
}

function cleanEnv() {
  const env = { ...process.env };
  delete env.CLAUDECODE;
  return env;
}

function versionCommand() {
  if (HARNESS === 'codex') {
    return codexBinaryCommand('--version');
  }

  return ['claude', '--version'];
}

function resolveCodexEntryPoint() {
  if (codexEntryPoint) {
    return codexEntryPoint;
  }

  if (process.platform === 'win32') {
    const wrapperPath = execFileSync(
      'powershell',
      ['-NoProfile', '-Command', '(Get-Command codex).Path'],
      {
        encoding: 'utf-8',
        timeout: 5000,
        env: cleanEnv(),
      },
    ).trim();
    codexEntryPoint = join(
      dirname(wrapperPath),
      'node_modules',
      '@openai',
      'codex',
      'bin',
      'codex.js',
    );
    return codexEntryPoint;
  }

  codexEntryPoint = 'codex';
  return codexEntryPoint;
}

function codexBinaryCommand(...args) {
  if (process.platform === 'win32') {
    return ['node', resolveCodexEntryPoint(), ...args];
  }

  return ['codex', ...args];
}

function execClaude(prompt, cwd, timeout, model) {
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
    '--full-auto',
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
      input: prompt,
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

export function getHarnessName() {
  return HARNESS;
}

export function getHarnessLabel() {
  return HARNESS === 'codex' ? 'Codex CLI' : 'Claude CLI';
}

export function getCommandLabel() {
  return HARNESS === 'codex' ? 'codex exec' : 'claude -p';
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
  return HARNESS === 'codex'
    ? execCodex(prompt, cwd, timeout, model, strict)
    : execClaude(prompt, cwd, timeout, model);
}
