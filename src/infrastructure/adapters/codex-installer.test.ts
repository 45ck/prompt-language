import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile, stat, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

import {
  disableManagedCodexHooksFile,
  enableManagedCodexHooksFile,
  inspectCodexHooksConfigFile,
} from './codex-installer.js';

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

function runCodexStatus(fakeHome: string): string {
  const env: Record<string, string> = {
    ...process.env,
    HOME: fakeHome,
    USERPROFILE: fakeHome,
  } as Record<string, string>;
  return execSync(`node "${join(ROOT, 'bin', 'cli.mjs')}" codex-status`, {
    env,
    stdio: 'pipe',
    cwd: ROOT,
    encoding: 'utf8',
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

  it('prunes stale cached Codex versions on reinstall', async () => {
    const staleDir = codexCachePath(fakeHome, '0.0.1');
    await mkdir(join(staleDir, '.codex-plugin'), { recursive: true });
    await writeFile(
      join(staleDir, '.codex-plugin', 'plugin.json'),
      JSON.stringify({ name: 'prompt-language', version: '0.0.1' }, null, 2),
      'utf8',
    );

    runCodexInstaller(fakeHome);

    expect(await dirExists(staleDir)).toBe(false);
    expect(await dirExists(codexCachePath(fakeHome, version))).toBe(true);
  });

  it('codex-status reports stale cached versions and mismatched registry versions', async () => {
    const staleVersion = '0.0.1';
    const staleDir = codexCachePath(fakeHome, staleVersion);
    await mkdir(join(staleDir, '.codex-plugin'), { recursive: true });
    await writeFile(
      join(staleDir, '.codex-plugin', 'plugin.json'),
      JSON.stringify({ name: 'prompt-language', version: staleVersion }, null, 2),
      'utf8',
    );

    await writeFile(
      join(fakeHome, '.codex', 'plugins', 'installed_plugins.json'),
      JSON.stringify(
        {
          version: 2,
          plugins: {
            'prompt-language@prompt-language-local': [
              {
                scope: 'user',
                installPath: staleDir,
                version: staleVersion,
              },
            ],
          },
        },
        null,
        2,
      ),
      'utf8',
    );

    const output = runCodexStatus(fakeHome);

    expect(output).toContain(`Stale:        ${staleVersion}`);
    expect(output).toContain(`installed_plugins.json records version ${staleVersion}`);
    expect(output).toContain(
      'Run "npx @45ck/prompt-language codex-install" to refresh the Codex scaffold.',
    );
  });

  it('codex-uninstall removes the Codex cache and plugin registration', async () => {
    runCodexUninstall(fakeHome);

    expect(await dirExists(codexCachePath(fakeHome, version))).toBe(false);

    const installed = JSON.parse(
      await readFile(join(fakeHome, '.codex', 'plugins', 'installed_plugins.json'), 'utf8'),
    ) as {
      plugins: Record<string, unknown>;
    };
    expect(installed.plugins['prompt-language@prompt-language-local']).toBeUndefined();

    const settings = JSON.parse(
      await readFile(join(fakeHome, '.codex', 'settings.json'), 'utf8'),
    ) as {
      enabledPlugins: Record<string, boolean>;
      extraKnownMarketplaces: Record<string, unknown>;
    };
    expect(settings.enabledPlugins['prompt-language@prompt-language-local']).toBeUndefined();
    expect(settings.extraKnownMarketplaces['prompt-language-local']).toBeUndefined();
  });
});

describe('Codex installer adapter', () => {
  let fakeHome: string;

  beforeEach(async () => {
    fakeHome = await createFakeHome();
  });

  afterEach(async () => {
    await rm(fakeHome, { recursive: true, force: true });
  });

  it('creates a managed codex config when the file is missing', async () => {
    const configPath = join(fakeHome, '.codex', 'config.toml');

    const result = await enableManagedCodexHooksFile(configPath);

    expect(result).toMatchObject({
      outcome: 'created',
      changed: true,
      snapshot: {
        ownership: 'managed',
        enabled: true,
      },
    });
    await expect(readFile(configPath, 'utf8')).resolves.toContain(
      'codex_hooks = true # prompt-language managed: codex_hooks',
    );
  });

  it('preserves a user-owned codex config entry when enabling managed hooks', async () => {
    const configPath = join(fakeHome, '.codex', 'config.toml');
    await mkdir(join(fakeHome, '.codex'), { recursive: true });
    await writeFile(configPath, '[features]\ncodex_hooks = false\n', 'utf8');

    const result = await enableManagedCodexHooksFile(configPath);

    expect(result).toMatchObject({
      outcome: 'user-owned',
      changed: false,
      snapshot: {
        ownership: 'user-owned',
        enabled: false,
      },
    });
    await expect(readFile(configPath, 'utf8')).resolves.toBe('[features]\ncodex_hooks = false\n');
  });

  it('removes a managed codex config entry when disabling managed hooks', async () => {
    const configPath = join(fakeHome, '.codex', 'config.toml');
    await mkdir(join(fakeHome, '.codex'), { recursive: true });
    await writeFile(
      configPath,
      '# prompt-language Codex scaffold.\n# Codex hooks are experimental; opt in explicitly before using the local install.\n\n# prompt-language managed section: codex_hooks\n[features]\ncodex_hooks = true # prompt-language managed: codex_hooks\n',
      'utf8',
    );

    const result = await disableManagedCodexHooksFile(configPath);

    expect(result).toMatchObject({
      outcome: 'removed',
      changed: true,
      snapshot: {
        ownership: 'absent',
        enabled: false,
      },
    });
    await expect(readFile(configPath, 'utf8')).resolves.toBe('');
  });

  it('returns missing when disabling managed hooks without a config file', async () => {
    const configPath = join(fakeHome, '.codex', 'config.toml');

    const result = await disableManagedCodexHooksFile(configPath);

    expect(result).toMatchObject({
      outcome: 'missing',
      changed: false,
      raw: null,
      snapshot: {
        ownership: 'absent',
        enabled: false,
      },
    });
  });
});
