import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile, stat, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

import { inspectCodexHooksConfigFile } from './codex-installer.js';

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

function runCodexUninstall(fakeHome: string): void {
  const env: Record<string, string> = {
    ...process.env,
    HOME: fakeHome,
    USERPROFILE: fakeHome,
  } as Record<string, string>;
  execSync(`node "${join(ROOT, 'bin', 'cli.mjs')}" codex-uninstall`, {
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
    expect(config).toContain('codex_hooks = true # prompt-language managed: codex_hooks');
  });

  it('reports a missing codex config as absent before install creates it', async () => {
    const isolatedHome = await createFakeHome();

    try {
      expect(
        await inspectCodexHooksConfigFile(join(isolatedHome, '.codex', 'config.toml')),
      ).toEqual({
        ownership: 'absent',
        enabled: false,
      });
    } finally {
      await rm(isolatedHome, { recursive: true, force: true });
    }
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

  it('preserves unrelated codex config entries across install and uninstall', async () => {
    const codexDir = join(fakeHome, '.codex');
    const configPath = join(codexDir, 'config.toml');

    await mkdir(codexDir, { recursive: true });
    await writeFile(
      configPath,
      ['[features]', 'other_flag = true', '', '[profiles.default]', 'approval = "manual"', ''].join(
        '\n',
      ),
      'utf8',
    );

    runCodexInstaller(fakeHome);
    let config = await readFile(configPath, 'utf8');
    expect(config).toContain('other_flag = true');
    expect(config).toContain('[profiles.default]\napproval = "manual"');
    expect(config).toMatch(/codex_hooks\s*=\s*true/i);

    runCodexUninstall(fakeHome);
    config = await readFile(configPath, 'utf8');
    expect(config).toContain('other_flag = true');
    expect(config).toContain('[profiles.default]\napproval = "manual"');
    expect(config).not.toMatch(/codex_hooks\s*=\s*true/i);
  });

  it('preserves unrelated Codex settings entries across install and uninstall', async () => {
    const codexDir = join(fakeHome, '.codex');
    const settingsPath = join(codexDir, 'settings.json');

    await mkdir(codexDir, { recursive: true });
    await writeFile(
      settingsPath,
      JSON.stringify(
        {
          customTheme: 'amber',
          enabledPlugins: {
            'another-plugin@local': true,
          },
          extraKnownMarketplaces: {
            another: {
              source: {
                source: 'directory',
                path: '/tmp/another',
              },
            },
          },
        },
        null,
        2,
      ),
      'utf8',
    );

    runCodexInstaller(fakeHome);
    let settings = JSON.parse(await readFile(settingsPath, 'utf8')) as Record<string, unknown>;
    expect(settings['customTheme']).toBe('amber');
    expect((settings['enabledPlugins'] as Record<string, boolean>)['another-plugin@local']).toBe(
      true,
    );
    expect(
      (settings['enabledPlugins'] as Record<string, boolean>)[
        'prompt-language@prompt-language-local'
      ],
    ).toBe(true);

    runCodexUninstall(fakeHome);
    settings = JSON.parse(await readFile(settingsPath, 'utf8')) as Record<string, unknown>;
    expect(settings['customTheme']).toBe('amber');
    expect((settings['enabledPlugins'] as Record<string, boolean>)['another-plugin@local']).toBe(
      true,
    );
    expect(
      (settings['enabledPlugins'] as Record<string, boolean>)[
        'prompt-language@prompt-language-local'
      ],
    ).toBeUndefined();
    expect(settings).toMatchObject({
      extraKnownMarketplaces: {
        another: {
          source: {
            source: 'directory',
            path: '/tmp/another',
          },
        },
      },
    });
  });

  it('preserves a user-owned codex_hooks entry across install and uninstall', async () => {
    const codexDir = join(fakeHome, '.codex');
    const configPath = join(codexDir, 'config.toml');

    await mkdir(codexDir, { recursive: true });
    await writeFile(configPath, '[features]\ncodex_hooks = true\n', 'utf8');

    runCodexInstaller(fakeHome);
    let config = await readFile(configPath, 'utf8');
    expect(config).toBe('[features]\ncodex_hooks = true\n');

    runCodexUninstall(fakeHome);
    config = await readFile(configPath, 'utf8');
    expect(config).toBe('[features]\ncodex_hooks = true\n');
  });

  it('preserves a user-disabled codex_hooks entry across install and uninstall', async () => {
    const codexDir = join(fakeHome, '.codex');
    const configPath = join(codexDir, 'config.toml');

    await mkdir(codexDir, { recursive: true });
    await writeFile(configPath, '[features]\ncodex_hooks = false\n', 'utf8');

    runCodexInstaller(fakeHome);
    let config = await readFile(configPath, 'utf8');
    expect(config).toBe('[features]\ncodex_hooks = false\n');

    runCodexUninstall(fakeHome);
    config = await readFile(configPath, 'utf8');
    expect(config).toBe('[features]\ncodex_hooks = false\n');
  });

  it('re-enables a managed codex_hooks entry on reinstall refresh', async () => {
    const configPath = join(fakeHome, '.codex', 'config.toml');

    await writeFile(
      configPath,
      '[features]\ncodex_hooks = false # prompt-language managed: codex_hooks\n',
      'utf8',
    );

    runCodexInstaller(fakeHome);

    const config = await readFile(configPath, 'utf8');
    expect(config).toBe('[features]\ncodex_hooks = true # prompt-language managed: codex_hooks\n');
  });
});
