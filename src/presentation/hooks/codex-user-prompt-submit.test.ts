import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const HOOK_TEST_TIMEOUT_MS = process.platform === 'win32' ? 60_000 : 30_000;

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'cf-codex-hook-'));
});

afterEach(async () => {
  await rm(tempDir, {
    recursive: true,
    force: true,
    maxRetries: 10,
    retryDelay: 200,
  });
});

function runHook(input: string, cwd: string): string {
  const srcRoot = join(import.meta.dirname, '..', '..', '..');
  const scriptPath = join(srcRoot, 'src', 'presentation', 'hooks', 'codex-user-prompt-submit.ts');
  return execSync(`npx tsx "${scriptPath}"`, {
    input,
    encoding: 'utf-8',
    cwd,
    timeout: HOOK_TEST_TIMEOUT_MS,
  });
}

describe('codex-user-prompt-submit hook (integration)', () => {
  it('surfaces PLR-004 additionalContext when state file contains unrecoverable corrupted JSON', async () => {
    const stateDir = join(tempDir, '.prompt-language');
    await mkdir(stateDir, { recursive: true });
    await writeFile(join(stateDir, 'session-state.json'), '{{corrupted garbage');

    const input = JSON.stringify({ prompt: 'Hello world' });
    const output = runHook(input, tempDir);
    const result = JSON.parse(output) as {
      hookSpecificOutput: { additionalContext: string };
    };
    expect(result.hookSpecificOutput.additionalContext).toContain('PLR-004');
    expect(result.hookSpecificOutput.additionalContext).toContain(
      'Resume state is corrupted and could not be recovered',
    );
  });
});
