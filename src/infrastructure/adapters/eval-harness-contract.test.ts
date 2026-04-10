import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(import.meta.dirname, '..', '..', '..');
const HARNESS = join(ROOT, 'scripts', 'eval', 'harness.mjs');
const SMOKE = join(ROOT, 'scripts', 'eval', 'smoke-test.mjs');
const PACKAGE_JSON = join(ROOT, 'package.json');

describe('eval harness contracts', () => {
  it('keeps Codex and OpenCode direct prompts and flow execution as separate paths', async () => {
    const source = await readFile(HARNESS, 'utf8');

    expect(source).toContain(
      'const DEFAULT_MODEL = parseModel(process.argv, process.env.EVAL_MODEL);',
    );
    expect(source).toContain(
      "return flagValue || envModel || (HARNESS === 'codex' ? 'gpt-5.2' : undefined);",
    );
    expect(source).toContain('function execCodexFlow(');
    expect(source).toContain("'ci', '--runner', 'codex'");
    expect(source).toContain("return ['opencode', '--version'];");
    expect(source).toContain("return ['ollama', '--version'];");
    expect(source).toContain('function execOpenCode(');
    expect(source).toContain('function execOpenCodeFlow(');
    expect(source).toContain("'ci', '--runner', 'opencode'");
    expect(source).toContain('function execOllama(');
    expect(source).toContain('function execOllamaFlow(');
    expect(source).toContain("'ci', '--runner', 'ollama'");
    expect(source).toContain('export function runHarnessFlow(');
  });

  it('supports Gemini and custom AI_CMD templates in the harness adapter', async () => {
    const source = await readFile(HARNESS, 'utf8');

    expect(source).toContain("if (HARNESS === 'gemini') {");
    expect(source).toContain("return ['gemini', '--version'];");
    expect(source).toContain('function execGemini(');
    expect(source).toContain('const AI_CMD = parseAiCommand(process.env.AI_CMD);');
    expect(source).toContain('function execTemplateCommand(');
    expect(source).toContain('if (AI_CMD) {');
  });

  it('routes smoke readiness checks through the flow runner', async () => {
    const source = await readFile(SMOKE, 'utf8');

    expect(source).toContain('getFlowCommandLabel');
    expect(source).toContain('runHarnessFlow');
    expect(source).toContain('function assertHarnessReady()');
    expect(source).toContain('Goal: readiness check');
    expect(source).toContain('Starting live flow smoke tests via');
  });

  it('extends smoke timeouts for slower local Ollama models and supports an override', async () => {
    const source = await readFile(SMOKE, 'utf8');

    expect(source).toContain('const TIMEOUT = resolveTimeout();');
    expect(source).toContain(
      "const override = Number.parseInt(process.env.EVAL_TIMEOUT_MS ?? '', 10);",
    );
    expect(source).toContain("if (model.startsWith('ollama/')) {");
    expect(source).toContain('if (/(^|[:/-])(26b|27b|31b|70b)([:/-]|$)/.test(model)) {');
    expect(source).toContain('return 1_800_000;');
  });

  it('exposes npm smoke commands for the OpenCode and Ollama baselines', async () => {
    const pkg = JSON.parse(await readFile(PACKAGE_JSON, 'utf8')) as {
      scripts?: Record<string, string>;
    };

    expect(pkg.scripts?.['eval:smoke:opencode']).toContain('--harness opencode');
    expect(pkg.scripts?.['eval:smoke:opencode:quick']).toContain('--harness opencode --quick');
    expect(pkg.scripts?.['eval:smoke:ollama']).toContain('--harness ollama');
    expect(pkg.scripts?.['eval:smoke:ollama:quick']).toContain('--harness ollama --quick');
  });
});
