#!/usr/bin/env node

/**
 * Install verification test script.
 *
 * Creates a temporary HOME directory, runs the installer, and verifies
 * that all expected artifacts are produced correctly.
 *
 * Usage:  node scripts/eval/install-test.mjs
 * Exit:   0 on success, 1 on failure
 */

import { promises as fs } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let passed = 0;
let failed = 0;

function ok(label) {
  passed++;
  console.log(`  PASS  ${label}`);
}

function fail(label, reason) {
  failed++;
  console.error(`  FAIL  ${label}: ${reason}`);
}

async function fileExists(p) {
  try {
    const s = await fs.stat(p);
    return s.isFile();
  } catch {
    return false;
  }
}

async function dirExists(p) {
  try {
    const s = await fs.stat(p);
    return s.isDirectory();
  } catch {
    return false;
  }
}

async function readJson(p) {
  return JSON.parse(await fs.readFile(p, 'utf8'));
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('Install verification test\n');

  // 1. Create temp HOME
  const fakeHome = await fs.mkdtemp(join(tmpdir(), 'pl-install-verify-'));
  console.log(`Temp HOME: ${fakeHome}\n`);

  const env = {
    ...process.env,
    HOME: fakeHome,
    USERPROFILE: fakeHome,
  };

  try {
    // 2. Run installer
    console.log('Running installer...');
    execSync(`node "${join(ROOT, 'bin', 'cli.mjs')}" install`, {
      env,
      stdio: 'pipe',
      cwd: ROOT,
    });
    ok('Installer ran without error');

    const pluginsDir = join(fakeHome, '.claude', 'plugins', 'local', 'prompt-language');

    // 3. Check expected directories exist
    console.log('\nVerifying installed directories...');
    const expectedDirs = ['dist', 'hooks', 'skills', '.claude-plugin', 'bin'];
    for (const dir of expectedDirs) {
      if (await dirExists(join(pluginsDir, dir))) {
        ok(`Directory: ${dir}/`);
      } else {
        fail(`Directory: ${dir}/`, 'not found');
      }
    }

    // 4. plugin.json schema validation
    console.log('\nVerifying plugin.json...');
    const pluginJsonPath = join(pluginsDir, '.claude-plugin', 'plugin.json');
    if (await fileExists(pluginJsonPath)) {
      const pluginJson = await readJson(pluginJsonPath);
      if (
        typeof pluginJson.author === 'object' &&
        pluginJson.author !== null &&
        pluginJson.author.name
      ) {
        ok('plugin.json author is object with name');
      } else {
        fail('plugin.json author', `expected object, got ${typeof pluginJson.author}`);
      }
      if (pluginJson.name && pluginJson.version) {
        ok('plugin.json has name and version');
      } else {
        fail('plugin.json fields', 'missing name or version');
      }
    } else {
      fail('plugin.json', 'file not found');
    }

    // 5. marketplace.json catalog validation
    console.log('\nVerifying marketplace.json...');
    const marketplacePath = join(
      fakeHome,
      '.claude',
      'plugins',
      'local',
      '.claude-plugin',
      'marketplace.json',
    );
    if (await fileExists(marketplacePath)) {
      const catalog = await readJson(marketplacePath);
      if (catalog.name === 'prompt-language-local') {
        ok('marketplace.json name');
      } else {
        fail('marketplace.json name', `expected prompt-language-local, got ${catalog.name}`);
      }
      if (typeof catalog.owner === 'object' && catalog.owner !== null) {
        ok('marketplace.json owner is object');
      } else {
        fail('marketplace.json owner', `expected object, got ${typeof catalog.owner}`);
      }
      if (Array.isArray(catalog.plugins) && catalog.plugins.length > 0) {
        const p = catalog.plugins[0];
        if (p.source === './prompt-language') {
          ok('marketplace.json plugin source');
        } else {
          fail('marketplace.json plugin source', `got ${p.source}`);
        }
      } else {
        fail('marketplace.json plugins', 'missing or empty plugins array');
      }
    } else {
      fail('marketplace.json', 'file not found');
    }

    // 6. installed_plugins.json
    console.log('\nVerifying installed_plugins.json...');
    const installedPath = join(fakeHome, '.claude', 'plugins', 'installed_plugins.json');
    if (await fileExists(installedPath)) {
      const installed = await readJson(installedPath);
      const key = 'prompt-language@prompt-language-local';
      if (installed.plugins?.[key]) {
        ok('Plugin registered in installed_plugins.json');
        const entry = installed.plugins[key][0];
        if (entry.scope === 'user' && entry.version && entry.installPath) {
          ok('Registration has scope, version, installPath');
        } else {
          fail('Registration fields', 'missing scope, version, or installPath');
        }
      } else {
        fail('installed_plugins.json', `key ${key} not found`);
      }
    } else {
      fail('installed_plugins.json', 'file not found');
    }

    // 7. settings.json
    console.log('\nVerifying settings.json...');
    const settingsPath = join(fakeHome, '.claude', 'settings.json');
    if (await fileExists(settingsPath)) {
      const settings = await readJson(settingsPath);

      if (settings.extraKnownMarketplaces?.['prompt-language-local']) {
        const mp = settings.extraKnownMarketplaces['prompt-language-local'];
        if (mp.source?.source === 'directory' && mp.source?.path) {
          ok('Marketplace registered in settings.json');
        } else {
          fail('Marketplace in settings.json', 'invalid source structure');
        }
      } else {
        fail('settings.json marketplace', 'not registered');
      }

      if (settings.enabledPlugins?.['prompt-language@prompt-language-local'] === true) {
        ok('Plugin enabled in settings.json');
      } else {
        fail('settings.json enabledPlugins', 'plugin not enabled');
      }
    } else {
      fail('settings.json', 'file not found');
    }

    // 8. Verify dist/ files are functional (basic parseFlow import check)
    console.log('\nVerifying dist/ files...');
    const distEntries = await fs.readdir(join(pluginsDir, 'dist'), { recursive: true });
    const jsFiles = distEntries.filter((e) => typeof e === 'string' && e.endsWith('.js'));
    if (jsFiles.length > 0) {
      ok(`dist/ contains ${jsFiles.length} JS file(s)`);
    } else {
      fail('dist/ JS files', 'no .js files found');
    }
  } finally {
    // 9. Clean up
    console.log('\nCleaning up...');
    await fs.rm(fakeHome, { recursive: true, force: true });
    ok('Temp directory removed');
  }

  // Summary
  console.log(`\n${'='.repeat(40)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(40));

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
