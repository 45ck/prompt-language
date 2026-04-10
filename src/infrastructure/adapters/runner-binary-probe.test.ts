import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { probeRunnerBinary } from './runner-binary-probe.js';

describe('probeRunnerBinary', () => {
  let tempDir = '';

  afterEach(async () => {
    if (!tempDir) return;
    await rm(tempDir, { recursive: true, force: true });
    tempDir = '';
  });

  it('returns false when PATH is empty', () => {
    expect(probeRunnerBinary('codex', { PATH: '' })).toBe(false);
  });

  it('finds runner binaries on PATH', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'pl-runner-probe-'));
    const binaryName = process.platform === 'win32' ? 'codex.CMD' : 'codex';
    await writeFile(join(tempDir, binaryName), '@echo off\r\n', 'utf8');

    expect(
      probeRunnerBinary('codex', { PATH: `${tempDir}${delimiter}/bin`, PATHEXT: '.CMD;.EXE' }),
    ).toBe(true);
  });
});
