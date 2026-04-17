import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildAgentLaunchSpec,
  normalizeAiderLaunchEnv,
  selectRealBinaryCandidate,
} from './harness.mjs';

function normalizePath(value) {
  return value.replace(/\\/g, '/');
}

test('selectRealBinaryCandidate prefers .exe over .cmd on Windows', () => {
  const selected = selectRealBinaryCandidate(
    ['C:/Program Files/Claude/claude.cmd', 'C:/Program Files/Claude/claude.exe'],
    { platform: 'win32' },
  );

  assert.equal(selected, 'C:/Program Files/Claude/claude.exe');
});

test('buildAgentLaunchSpec routes traced Claude runs through the witness shim entrypoint', () => {
  const spec = buildAgentLaunchSpec('claude', ['-p', '--dangerously-skip-permissions'], {
    traceEnabled: true,
    realBinary: 'C:/Program Files/Claude/claude.exe',
    nodeBinary: 'node-test',
  });

  assert.equal(spec.command, 'node-test');
  assert.equal(
    normalizePath(spec.args[0]).endsWith('/scripts/eval/agent-shim/pl-agent-shim.mjs'),
    true,
  );
  assert.deepEqual(spec.args.slice(1), ['-p', '--dangerously-skip-permissions']);
  assert.deepEqual(spec.env, {
    PL_SHIM_NAME: 'claude',
    PL_REAL_BIN: 'C:/Program Files/Claude/claude.exe',
  });
});

test('buildAgentLaunchSpec leaves non-traced runs on the bare binary', () => {
  const spec = buildAgentLaunchSpec('claude', ['--version'], { traceEnabled: false });

  assert.deepEqual(spec, {
    command: 'claude',
    args: ['--version'],
    env: {},
  });
});

test('normalizeAiderLaunchEnv forces TERM=dumb on Windows and preserves existing vars', () => {
  const normalized = normalizeAiderLaunchEnv(
    {
      TERM: 'xterm-256color',
      PATH: 'C:/Windows/System32',
      PL_RUN_ID: 'trace-123',
    },
    { platform: 'win32' },
  );

  assert.deepEqual(normalized, {
    TERM: 'dumb',
    PATH: 'C:/Windows/System32',
    PL_RUN_ID: 'trace-123',
  });
});

test('normalizeAiderLaunchEnv leaves non-Windows environments unchanged', () => {
  const normalized = normalizeAiderLaunchEnv(
    {
      TERM: 'xterm-256color',
      PATH: '/usr/bin',
    },
    { platform: 'linux' },
  );

  assert.deepEqual(normalized, {
    TERM: 'xterm-256color',
    PATH: '/usr/bin',
  });
});
