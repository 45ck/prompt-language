import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = join(import.meta.dirname, '..', '..', '..');
const HARNESS = join(ROOT, 'scripts', 'eval', 'harness.mjs');

interface HarnessInfo {
  harness: string;
  evidenceHarness: string;
  harnessLabel: string;
  effectiveModel: string | null;
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
      getEvidenceHarnessName,
      getHarnessLabel,
      getEffectiveModel,
      getCommandLabel,
      getFlowCommandLabel,
    } from ${JSON.stringify(harnessUrl)};
    console.log(
      JSON.stringify({
        harness: getHarnessName(),
        evidenceHarness: getEvidenceHarnessName(),
        harnessLabel: getHarnessLabel(),
        effectiveModel: getEffectiveModel(),
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
    expect(info.evidenceHarness).toBe('gemini');
    expect(info.harnessLabel).toBe('Gemini CLI');
    expect(info.effectiveModel).toBeNull();
    expect(info.commandLabel).toBe('gemini -p --yolo');
    expect(info.flowCommandLabel).toBe('gemini -p --yolo');
  });

  it('supports selecting OpenCode via EVAL_HARNESS', () => {
    const info = readHarnessInfo({ env: { EVAL_HARNESS: 'opencode' } });

    expect(info.harness).toBe('opencode');
    expect(info.evidenceHarness).toBe('opencode');
    expect(info.harnessLabel).toBe('OpenCode CLI');
    expect(info.effectiveModel).toBeNull();
    expect(info.commandLabel).toBe('opencode run');
    expect(info.flowCommandLabel).toBe('prompt-language ci --runner opencode');
  });

  it('supports selecting Ollama via EVAL_HARNESS', () => {
    const info = readHarnessInfo({ env: { EVAL_HARNESS: 'ollama' } });

    expect(info.harness).toBe('ollama');
    expect(info.evidenceHarness).toBe('ollama');
    expect(info.harnessLabel).toBe('Ollama CLI');
    expect(info.effectiveModel).toBe('gemma4:31b');
    expect(info.commandLabel).toBe('ollama run');
    expect(info.flowCommandLabel).toBe('prompt-language ci --runner ollama');
  });

  it('supports selecting Aider via EVAL_HARNESS', () => {
    const info = readHarnessInfo({ env: { EVAL_HARNESS: 'aider' } });

    expect(info.harness).toBe('aider');
    expect(info.evidenceHarness).toBe('aider');
    expect(info.harnessLabel).toBe('Aider CLI');
    expect(info.effectiveModel).toBe('ollama/gemma4:31b');
    expect(info.commandLabel).toBe('python -m aider --message');
    expect(info.flowCommandLabel).toBe('prompt-language ci --runner aider');
  });

  it('lets AI_CMD override command labels for custom template runs', () => {
    const info = readHarnessInfo({
      env: {
        AI_CMD: 'gemini -p --yolo',
      },
    });

    expect(info.harness).toBe('claude');
    expect(info.evidenceHarness).toBe('AI_CMD');
    expect(info.harnessLabel).toBe('Custom AI command (gemini)');
    expect(info.effectiveModel).toBeNull();
    expect(info.commandLabel).toBe('gemini -p --yolo');
    expect(info.flowCommandLabel).toBe('gemini -p --yolo');
  });

  it('prefers an explicit --harness over AI_CMD for smoke-compatible flow runs', () => {
    const info = readHarnessInfo({
      args: ['--', '--harness', 'codex'],
      env: {
        AI_CMD: 'gemini -p --yolo',
      },
    });

    expect(info.harness).toBe('codex');
    expect(info.evidenceHarness).toBe('codex');
    expect(info.harnessLabel).toBe('Codex CLI');
    expect(info.effectiveModel).toBe('gpt-5.2');
    expect(info.commandLabel).toBe('codex exec');
    expect(info.flowCommandLabel).toBe('prompt-language ci --runner codex');
  });

  it('prefers EVAL_HARNESS over AI_CMD when the harness is selected via env', () => {
    const info = readHarnessInfo({
      env: {
        EVAL_HARNESS: 'opencode',
        AI_CMD: 'gemini -p --yolo',
      },
    });

    expect(info.harness).toBe('opencode');
    expect(info.evidenceHarness).toBe('opencode');
    expect(info.harnessLabel).toBe('OpenCode CLI');
    expect(info.effectiveModel).toBeNull();
    expect(info.commandLabel).toBe('opencode run');
    expect(info.flowCommandLabel).toBe('prompt-language ci --runner opencode');
  });
});
