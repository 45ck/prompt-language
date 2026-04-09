import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PROJECT_ROOT = join(fileURLToPath(import.meta.url), '../../../..');

function readJson(relativePath: string): unknown {
  const raw = readFileSync(join(PROJECT_ROOT, relativePath), 'utf-8');
  return JSON.parse(raw);
}

describe('Codex plugin scaffold contract', () => {
  const plugin = readJson('.codex-plugin/plugin.json') as Record<string, unknown>;
  const marketplace = readJson('.codex-plugin/marketplace.json') as Record<string, unknown>;
  const agentMarketplace = readJson('.agents/plugins/marketplace.json') as Record<string, unknown>;
  const hooksFile = readJson('.codex/hooks.json') as { hooks: Record<string, unknown[]> };

  it('ships codex plugin metadata', () => {
    expect(plugin['name']).toBe('prompt-language');
    expect(plugin['version']).toMatch(/^\d+\.\d+\.\d+$/);
    expect(typeof plugin['description']).toBe('string');
  });

  it('ships codex marketplace metadata with codex install instructions', () => {
    expect(marketplace['installInstructions']).toBe('npx @45ck/prompt-language codex-install');
    expect(agentMarketplace['installInstructions']).toBe('npx @45ck/prompt-language codex-install');
  });

  it('defines the codex hooks surface', () => {
    expect(Object.keys(hooksFile.hooks)).toEqual(
      expect.arrayContaining(['UserPromptSubmit', 'Stop', 'PostToolUse', 'SessionStart']),
    );
    expect(hooksFile.hooks).not.toHaveProperty('TaskCompleted');
    expect(hooksFile.hooks).not.toHaveProperty('PreCompact');
  });

  it('references dist files that exist', () => {
    for (const entries of Object.values(hooksFile.hooks)) {
      for (const entry of entries as { hooks: { command: string }[] }[]) {
        for (const hook of entry.hooks) {
          const match = /\$\{CODEX_PLUGIN_ROOT\}\/(.+?)(?:\s|$)/.exec(hook.command);
          expect(match).not.toBeNull();
          const fullPath = join(PROJECT_ROOT, match![1]!);
          expect(existsSync(fullPath), `Hook dist file should exist: ${match![1]}`).toBe(true);
        }
      }
    }
  });

  it('ships Codex config.toml with codex_hooks enabled', () => {
    const config = readFileSync(join(PROJECT_ROOT, '.codex/config.toml'), 'utf8');
    expect(config).toMatch(/codex_hooks\s*=\s*true/i);
  });
});
