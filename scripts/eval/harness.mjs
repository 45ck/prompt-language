#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

const DEFAULT_HARNESS = 'claude';
const AI_CMD_CONFIG = parseAiCommand(process.env.AI_CMD);
const HARNESS_SELECTION = parseHarnessSelection(
  process.argv,
  process.env.EVAL_HARNESS,
  AI_CMD_CONFIG,
);
const HARNESS = HARNESS_SELECTION.harness;
const AI_CMD = HARNESS_SELECTION.useCustomCommand ? AI_CMD_CONFIG : null;
const DEFAULT_MODEL = parseModel(process.argv, process.env.EVAL_MODEL);
const ROOT = resolve(import.meta.dirname, '..', '..');

function parseHarnessSelection(argv, envHarness, aiCmd) {
  const flagIndex = argv.indexOf('--harness');
  const flagValue = flagIndex >= 0 ? argv[flagIndex + 1] : null;
  const raw = (flagValue || envHarness || DEFAULT_HARNESS).toLowerCase();
  if (
    raw === 'claude' ||
    raw === 'codex' ||
    raw === 'gemini' ||
    raw === 'opencode' ||
    raw === 'ollama' ||
    raw === 'aider'
  ) {
    return {
      harness: raw,
      useCustomCommand: !flagValue && !envHarness && aiCmd != null,
    };
  }
  throw new Error(
    `Unsupported harness "${raw}". Supported values: claude, codex, gemini, opencode, ollama, aider.`,
  );
}

function parseModel(argv, envModel) {
  const flagIndex = argv.indexOf('--model');
  const flagValue = flagIndex >= 0 ? argv[flagIndex + 1] : null;
  return flagValue || envModel || (HARNESS === 'codex' ? 'gpt-5.2' : undefined);
}

// ── Independent-witness shim wiring ─────────────────────────────────
//
// When PL_TRACE=1, the harness prepends the agent-shim directory to PATH so
// that invocations of `claude`, `codex`, etc. by bare name are intercepted by
// the shim, which records an independent trace alongside the runtime's.
// Resolved absolute paths of the real binaries are exposed via
// PL_REAL_BIN_<NAME> so the shim stubs can forward transparently.
//
// When PL_TRACE is unset, none of this runs and the environment is unchanged.

const SHIM_DIR = resolve(import.meta.dirname, 'agent-shim');
const SHIM_BINARIES = ['claude', 'codex', 'gemini', 'ollama', 'opencode', 'aider'];
const TRACE_ENABLED = process.env.PL_TRACE === '1';
let sharedRunId = null;
const realBinCache = new Map();

function toPosixPath(p) {
  return p.replace(/\\/g, '/');
}

function resolveRealBinary(name) {
  if (realBinCache.has(name)) return realBinCache.get(name);
  const locator = process.platform === 'win32' ? 'where.exe' : 'which';
  let resolved = null;
  try {
    const out = execFileSync(locator, [name], {
      encoding: 'utf-8',
      env: process.env,
    })
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      // Skip any path under the shim directory to avoid self-loop.
      .filter((line) => !toPosixPath(resolve(line)).startsWith(toPosixPath(SHIM_DIR)));
    if (out.length > 0) {
      resolved = toPosixPath(resolve(out[0]));
    }
  } catch {
    resolved = null;
  }
  realBinCache.set(name, resolved);
  return resolved;
}

function getSharedRunId() {
  if (!TRACE_ENABLED) return null;
  if (!sharedRunId) {
    sharedRunId = process.env.PL_RUN_ID || randomUUID();
  }
  return sharedRunId;
}

function cleanEnv() {
  const env = { ...process.env };
  delete env.CLAUDECODE;

  if (TRACE_ENABLED) {
    // Prepend shim dir so intercepted bare-name invocations route through it.
    const existingPath = env.PATH || env.Path || '';
    env.PATH = `${SHIM_DIR}${delimiter}${existingPath}`;
    if (process.platform === 'win32') {
      env.Path = env.PATH;
    }

    env.PL_RUN_ID = getSharedRunId();
    // PL_TRACE_DIR is left unset so the shim defaults to `${cwd}/.prompt-language`.

    for (const bin of SHIM_BINARIES) {
      const real = resolveRealBinary(bin);
      if (real) {
        env[`PL_REAL_BIN_${bin.toUpperCase()}`] = real;
      }
    }
  }

  return env;
}

/**
 * Run verify-trace against the given test cwd. Returns { ok, message, raw }.
 *
 * Three modes based on environment variables:
 *  - PL_TRACE unset: tracing not requested; returns { ok: true, skipped: true }
 *    without touching the filesystem (legacy behavior).
 *  - PL_TRACE=1, PL_TRACE_STRICT unset/0: verify if provenance.jsonl exists,
 *    otherwise skip silently (M1 default — tolerates partial runtime emission).
 *  - PL_TRACE=1, PL_TRACE_STRICT=1: verify always; a missing provenance.jsonl
 *    is treated as a hard failure (authenticity gate for Z-series).
 */
export function verifyTraceForCwd(cwd) {
  if (!TRACE_ENABLED) return { ok: true, skipped: true };
  const strict = process.env.PL_TRACE_STRICT === '1';
  const tracePath = join(cwd, '.prompt-language', 'provenance.jsonl');
  const statePath = join(cwd, '.prompt-language', 'session-state.json');
  if (!existsSync(tracePath)) {
    if (strict) {
      preserveTraceFailure(cwd);
      const message = `PL_TRACE_STRICT: expected .prompt-language/provenance.jsonl in ${cwd} but none was written`;
      return { ok: false, message, raw: '', parsed: null };
    }
    return { ok: true, skipped: true, reason: 'no provenance.jsonl written' };
  }
  const verifyArgs = [
    resolve(ROOT, 'scripts', 'eval', 'verify-trace.mjs'),
    '--trace',
    tracePath,
    '--json',
  ];
  if (existsSync(statePath)) {
    verifyArgs.push('--state', statePath);
  }
  try {
    const raw = execFileSync('node', verifyArgs, {
      encoding: 'utf-8',
      env: process.env,
      maxBuffer: 8 * 1024 * 1024,
    });
    let parsed = null;
    try {
      parsed = JSON.parse(raw);
    } catch {
      /* non-JSON means non-OK path already handled in catch below */
    }
    return { ok: parsed?.ok !== false, raw, parsed };
  } catch (error) {
    const raw = (error.stdout ?? '') + (error.stderr ?? '');
    let parsed = null;
    try {
      parsed = JSON.parse(error.stdout ?? '');
    } catch {
      /* leave parsed null */
    }
    const msg =
      parsed?.errors?.join('; ') ||
      error.stderr?.toString().trim() ||
      error.message ||
      'verify-trace failed';
    // Preserve the failing temp dir for post-hoc inspection.
    preserveTraceFailure(cwd);
    return { ok: false, raw, parsed, message: msg };
  }
}

function preserveTraceFailure(cwd) {
  try {
    const runId = getSharedRunId() || `unknown-${Date.now()}`;
    const safeRunId = runId.replace(/[^a-zA-Z0-9_-]/g, '_');
    const dest = resolve(
      ROOT,
      'scripts',
      'eval',
      'results',
      'trace-failures',
      `${safeRunId}-${Date.now()}`,
    );
    mkdirSync(dest, { recursive: true });
    const srcDir = join(cwd, '.prompt-language');
    if (existsSync(srcDir)) {
      cpSync(srcDir, join(dest, '.prompt-language'), { recursive: true });
    }
  } catch {
    // best-effort preservation; never fail the harness on copy errors
  }
}

function parseAiCommand(rawValue) {
  const raw = rawValue?.trim();
  if (!raw) {
    return null;
  }

  const tokens = raw.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) ?? [];
  const unquoted = tokens
    .map((token) =>
      (token.startsWith('"') && token.endsWith('"')) ||
      (token.startsWith("'") && token.endsWith("'"))
        ? token.slice(1, -1)
        : token,
    )
    .filter((token) => token.length > 0);

  if (unquoted.length === 0) {
    return null;
  }

  const [command, ...args] = unquoted;
  return { raw, command, args };
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
  if (AI_CMD) {
    return [AI_CMD.command, '--version'];
  }

  if (HARNESS === 'codex') {
    return codexBinaryCommand('--version');
  }

  if (HARNESS === 'gemini') {
    return ['gemini', '--version'];
  }

  if (HARNESS === 'opencode') {
    return ['opencode', '--version'];
  }

  if (HARNESS === 'ollama') {
    return ['ollama', '--version'];
  }

  if (HARNESS === 'aider') {
    return ['python', '-m', 'aider', '--version'];
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

function execGemini(prompt, cwd, timeout, model, strict) {
  const args = ['-p', '--yolo'];
  if (model) {
    args.push('--model', model);
  }

  try {
    return execFileSync('gemini', args, {
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

function normalizeOllamaModel(model) {
  if (!model) {
    return 'gemma4:31b';
  }
  return model.startsWith('ollama/') ? model.slice('ollama/'.length) : model;
}

function execOllama(prompt, cwd, timeout, model, strict) {
  const resolvedModel = normalizeOllamaModel(model);
  const args = ['run', resolvedModel, prompt];

  try {
    return execFileSync('ollama', args, {
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

function execAider(prompt, cwd, timeout, model, strict) {
  const resolvedModel = model ?? 'ollama/gemma4:31b';
  const args = [
    '-m',
    'aider',
    '--model',
    resolvedModel,
    '--no-auto-commits',
    '--no-stream',
    '--yes',
    '--no-show-model-warnings',
    '--map-tokens',
    '1024',
    '--edit-format',
    'whole',
    '--message',
    prompt,
  ];

  try {
    return execFileSync('python', args, {
      encoding: 'utf-8',
      cwd,
      timeout,
      env: {
        ...cleanEnv(),
        PYTHONUTF8: '1',
        OLLAMA_API_BASE: 'http://127.0.0.1:11434',
      },
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

function execCodexFlow(flowText, cwd, timeout, model, strict) {
  const args = [join(ROOT, 'bin', 'cli.mjs'), 'ci', '--runner', 'codex'];

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

function applyTemplateValue(value, { prompt, model, cwd }) {
  if (value === '{prompt}') {
    return prompt;
  }
  if (value === '{model}') {
    return model ?? '';
  }
  if (value === '{cwd}') {
    return cwd;
  }
  return value;
}

function execTemplateCommand(prompt, cwd, timeout, model, strict) {
  if (!AI_CMD) {
    return '';
  }

  const resolved = AI_CMD.args
    .map((value) => applyTemplateValue(value, { prompt, model, cwd }))
    .filter((value) => value.length > 0);
  const useStdin = !AI_CMD.args.includes('{prompt}');

  try {
    return execFileSync(AI_CMD.command, resolved, {
      input: useStdin ? prompt : undefined,
      encoding: 'utf-8',
      cwd,
      timeout,
      env: cleanEnv(),
      maxBuffer: 20 * 1024 * 1024,
      stdio: ['pipe', 'pipe', 'pipe'],
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

function execOllamaFlow(flowText, cwd, timeout, model, strict) {
  const args = [join(ROOT, 'bin', 'cli.mjs'), 'ci', '--runner', 'ollama'];

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
function execAiderFlow(flowText, cwd, timeout, model, strict) {
  const args = [join(ROOT, 'bin', 'cli.mjs'), 'ci', '--runner', 'aider'];

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
  if (AI_CMD) {
    return `Custom AI command (${AI_CMD.command})`;
  }

  if (HARNESS === 'codex') {
    return 'Codex CLI';
  }

  if (HARNESS === 'gemini') {
    return 'Gemini CLI';
  }

  if (HARNESS === 'opencode') {
    return 'OpenCode CLI';
  }

  if (HARNESS === 'ollama') {
    return 'Ollama CLI';
  }

  if (HARNESS === 'aider') {
    return 'Aider CLI';
  }

  return 'Claude CLI';
}

export function getCommandLabel() {
  if (AI_CMD) {
    return AI_CMD.raw;
  }

  if (HARNESS === 'codex') {
    return 'codex exec';
  }

  if (HARNESS === 'gemini') {
    return 'gemini -p --yolo';
  }

  if (HARNESS === 'opencode') {
    return 'opencode run';
  }

  if (HARNESS === 'ollama') {
    return 'ollama run';
  }

  if (HARNESS === 'aider') {
    return 'python -m aider --message';
  }

  return 'claude -p';
}

export function getFlowCommandLabel() {
  return HARNESS === 'codex'
    ? 'prompt-language ci --runner codex'
    : HARNESS === 'opencode'
      ? 'prompt-language ci --runner opencode'
      : HARNESS === 'ollama'
        ? 'prompt-language ci --runner ollama'
        : HARNESS === 'aider'
          ? 'prompt-language ci --runner aider'
          : getCommandLabel();
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
  if (AI_CMD) {
    return execTemplateCommand(prompt, cwd, timeout, resolvedModel, strict);
  }

  return HARNESS === 'codex'
    ? execCodex(prompt, cwd, timeout, resolvedModel, strict)
    : HARNESS === 'gemini'
      ? execGemini(prompt, cwd, timeout, resolvedModel, strict)
      : HARNESS === 'opencode'
        ? execOpenCode(prompt, cwd, timeout, resolvedModel, strict)
        : HARNESS === 'ollama'
          ? execOllama(prompt, cwd, timeout, resolvedModel, strict)
          : HARNESS === 'aider'
            ? execAider(prompt, cwd, timeout, resolvedModel, strict)
            : execClaude(prompt, cwd, timeout, resolvedModel, strict);
}

export function runHarnessFlow(
  flowText,
  { cwd = process.cwd(), timeout = 120_000, model, strict = false } = {},
) {
  const resolvedModel = model ?? DEFAULT_MODEL;
  if (AI_CMD) {
    return execTemplateCommand(flowText, cwd, timeout, resolvedModel, strict);
  }

  return HARNESS === 'codex'
    ? execCodexFlow(flowText, cwd, timeout, resolvedModel, strict)
    : HARNESS === 'opencode'
      ? execOpenCodeFlow(flowText, cwd, timeout, resolvedModel, strict)
      : HARNESS === 'ollama'
        ? execOllamaFlow(flowText, cwd, timeout, resolvedModel, strict)
        : HARNESS === 'aider'
          ? execAiderFlow(flowText, cwd, timeout, resolvedModel, strict)
          : runHarnessPrompt(flowText, {
              cwd,
              timeout,
              model: resolvedModel,
              strict,
            });
}
