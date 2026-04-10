import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = join(import.meta.dirname, '..', '..', '..');
const HARNESS = join(ROOT, 'scripts', 'eval', 'harness.mjs');

interface HarnessInfo {
  harness: string;
  harnessLabel: string;
  commandLabel: string;
  flowCommandLabel: string;
}

function readHarnessInfo({
  args = [],
  env = {},
}: {
  args?: string[];
  env?: Record<string, string>;
} = {}): HarnessInfo {
  const harnessUrl = pathToFileURL(HARNESS).href;
  const script = `
    import {
      getHarnessName,
      getHarnessLabel,
      getCommandLabel,
      getFlowCommandLabel,
    } from ${JSON.stringify(harnessUrl)};
    console.log(
      JSON.stringify({
        harness: getHarnessName(),
        harnessLabel: getHarnessLabel(),
        commandLabel: getCommandLabel(),
        flowCommandLabel: getFlowCommandLabel(),
      }),
    );
  `;

  const output = execFileSync(process.execPath, ['--input-type=module', '-e', script, ...args], {
    encoding: 'utf8',
    env: {
      ...process.env,
      ...env,
    },
  }).trim();

  return JSON.parse(output) as HarnessInfo;
}

describe('eval harness selection', () => {
  it('supports selecting Gemini via --harness', () => {
    const info = readHarnessInfo({ args: ['--', '--harness', 'gemini'] });

    expect(info.harness).toBe('gemini');
    expect(info.harnessLabel).toBe('Gemini CLI');
    expect(info.commandLabel).toBe('gemini -p --yolo');
  });

  it('supports selecting OpenCode via EVAL_HARNESS', () => {
    const info = readHarnessInfo({ env: { EVAL_HARNESS: 'opencode' } });

    expect(info.harness).toBe('opencode');
    expect(info.harnessLabel).toBe('OpenCode CLI');
    expect(info.commandLabel).toBe('opencode run');
    expect(info.flowCommandLabel).toBe('prompt-language ci --runner opencode');
  });

  it('lets AI_CMD override command labels for custom template runs', () => {
    const info = readHarnessInfo({
      env: {
        AI_CMD: 'gemini -p --yolo',
      },
    });

    expect(info.harness).toBe('claude');
    expect(info.harnessLabel).toBe('Custom AI command (gemini)');
    expect(info.commandLabel).toBe('gemini -p --yolo');
    expect(info.flowCommandLabel).toBe('gemini -p --yolo');
  });
});
