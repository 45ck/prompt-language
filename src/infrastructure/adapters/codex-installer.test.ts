import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

const ROOT = join(import.meta.dirname, '..', '..', '..');

async function readPluginVersion(): Promise<string> {
  const raw = await readFile(join(ROOT, '.claude-plugin', 'plugin.json'), 'utf8');
  return (JSON.parse(raw) as { version: string }).version;
}

function codexCachePath(home: string, version: string): string {
  return join(
    home,
    '.codex',
    'plugins',
    'cache',
    'prompt-language-local',
    'prompt-language',
    version,
  );
}

async function createFakeHome(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'pl-codex-install-'));
}

async function dirExists(p: string): Promise<boolean> {
  try {
    const s = await stat(p);
    return s.isDirectory();
  } catch {
    return false;
  }
}

function runCodexInstaller(fakeHome: string): void {
  const env: Record<string, string> = {
    ...process.env,
    HOME: fakeHome,
    USERPROFILE: fakeHome,
  } as Record<string, string>;
  execSync(`node "${join(ROOT, 'bin', 'cli.mjs')}" codex-install`, {
    env,
    stdio: 'pipe',
    cwd: ROOT,
  });
}

describe('Codex installer — install verification', () => {
  let fakeHome: string;
  let version: string;

  beforeEach(async () => {
    fakeHome = await createFakeHome();
    version = await readPluginVersion();
    runCodexInstaller(fakeHome);
  });

  afterEach(async () => {
    await rm(fakeHome, { recursive: true, force: true });
  });

  it('copies the Codex scaffold directories to the cache location', async () => {
    const pluginsDir = codexCachePath(fakeHome, version);
    const expectedDirs = ['dist', 'skills', 'agents', '.codex-plugin', '.agents', '.codex', 'bin'];

    for (const dir of expectedDirs) {
      expect(
        await dirExists(join(pluginsDir, dir)),
        `${dir}/ should exist in installed location`,
      ).toBe(true);
    }
  });

  it('writes a Codex config with hooks enabled', async () => {
    const config = await readFile(join(fakeHome, '.codex', 'config.toml'), 'utf8');
    expect(config).toMatch(/codex_hooks\s*=\s*true/i);
  });

  it('registers the Codex scaffold in installed_plugins.json', async () => {
    const installed = JSON.parse(
      await readFile(join(fakeHome, '.codex', 'plugins', 'installed_plugins.json'), 'utf8'),
    ) as Record<string, unknown>;
    const plugins = installed['plugins'] as Record<string, unknown>;
    expect(plugins).toHaveProperty('prompt-language@prompt-language-local');
  });

  it('registers the marketplace and enables the scaffold in settings.json', async () => {
    const settings = JSON.parse(
      await readFile(join(fakeHome, '.codex', 'settings.json'), 'utf8'),
    ) as Record<string, unknown>;
    const marketplaces = settings['extraKnownMarketplaces'] as Record<string, unknown>;
    expect(marketplaces).toHaveProperty('prompt-language-local');
    const enabled = settings['enabledPlugins'] as Record<string, boolean>;
    expect(enabled['prompt-language@prompt-language-local']).toBe(true);
  });
});
