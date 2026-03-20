#!/usr/bin/env node

import { promises as fs } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const MARKETPLACE_NAME = 'prompt-language-local';
const PLUGIN_KEY = `prompt-language@${MARKETPLACE_NAME}`;
const CLAUDE_DIR = join(homedir(), '.claude');
const MARKETPLACE_DIR = join(CLAUDE_DIR, 'plugins', 'local');
const PLUGINS_DIR = join(MARKETPLACE_DIR, 'prompt-language');
const INSTALLED_PLUGINS_PATH = join(CLAUDE_DIR, 'plugins', 'installed_plugins.json');
const SETTINGS_PATH = join(CLAUDE_DIR, 'settings.json');

const DIRS_TO_COPY = ['dist', 'hooks', 'skills', '.claude-plugin'];

async function readPluginVersion() {
  const raw = await fs.readFile(join(ROOT, '.claude-plugin', 'plugin.json'), 'utf8');
  return JSON.parse(raw).version;
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function copyDir(src, dest) {
  await ensureDir(dest);
  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);
    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath);
    } else {
      await fs.copyFile(srcPath, destPath);
    }
  }
}

async function readJsonSafe(filePath) {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8'));
  } catch {
    return null;
  }
}

async function writeJson(filePath, data) {
  await ensureDir(dirname(filePath));
  await fs.writeFile(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

async function install() {
  const version = await readPluginVersion();
  const now = new Date().toISOString();
  console.log(`Installing prompt-language v${version}...`);

  await ensureDir(PLUGINS_DIR);
  for (const dir of DIRS_TO_COPY) {
    const src = join(ROOT, dir);
    try {
      await fs.access(src);
      await copyDir(src, join(PLUGINS_DIR, dir));
      console.log(`  Copied ${dir}/`);
    } catch {
      console.warn(`  Skipping ${dir}/ (not found)`);
    }
  }

  // Write marketplace catalog to parent directory for Claude Code discovery
  const pluginJson = JSON.parse(
    await fs.readFile(join(PLUGINS_DIR, '.claude-plugin', 'plugin.json'), 'utf8'),
  );
  const marketplaceCatalog = {
    $schema: 'https://anthropic.com/claude-code/marketplace.schema.json',
    name: MARKETPLACE_NAME,
    description: pluginJson.description,
    owner: pluginJson.author,
    plugins: [
      {
        name: 'prompt-language',
        description: pluginJson.description,
        version: pluginJson.version,
        author: pluginJson.author,
        source: './prompt-language',
        category: 'development',
      },
    ],
  };
  await writeJson(join(MARKETPLACE_DIR, '.claude-plugin', 'marketplace.json'), marketplaceCatalog);
  console.log('  Generated marketplace catalog');

  // Register in installed_plugins.json
  const installed = (await readJsonSafe(INSTALLED_PLUGINS_PATH)) ?? { version: 2, plugins: {} };
  installed.plugins = installed.plugins ?? {};
  installed.plugins[PLUGIN_KEY] = [
    {
      scope: 'user',
      installPath: PLUGINS_DIR,
      version,
      installedAt: now,
      lastUpdated: now,
    },
  ];
  await writeJson(INSTALLED_PLUGINS_PATH, installed);
  console.log('  Registered in installed_plugins.json');

  // Register marketplace + enable in settings.json
  const settings = (await readJsonSafe(SETTINGS_PATH)) ?? {};
  settings.extraKnownMarketplaces = settings.extraKnownMarketplaces ?? {};
  settings.extraKnownMarketplaces[MARKETPLACE_NAME] = {
    source: {
      source: 'directory',
      path: MARKETPLACE_DIR,
    },
  };
  settings.enabledPlugins = settings.enabledPlugins ?? {};
  settings.enabledPlugins[PLUGIN_KEY] = true;
  await writeJson(SETTINGS_PATH, settings);
  console.log('  Registered marketplace in settings.json');
  console.log('  Enabled in settings.json');

  console.log(`\nprompt-language v${version} installed successfully.`);
}

async function uninstall() {
  console.log('Uninstalling prompt-language...');

  try {
    await fs.rm(PLUGINS_DIR, { recursive: true, force: true });
    console.log(`  Removed ${PLUGINS_DIR}`);
  } catch {
    console.log('  Plugin directory not found (already removed)');
  }

  try {
    await fs.rm(join(MARKETPLACE_DIR, '.claude-plugin'), { recursive: true, force: true });
  } catch {
    // ignore
  }

  const installed = await readJsonSafe(INSTALLED_PLUGINS_PATH);
  if (installed?.plugins?.[PLUGIN_KEY]) {
    delete installed.plugins[PLUGIN_KEY];
    await writeJson(INSTALLED_PLUGINS_PATH, installed);
    console.log('  Removed from installed_plugins.json');
  }

  const settings = await readJsonSafe(SETTINGS_PATH);
  let changed = false;
  if (settings?.enabledPlugins?.[PLUGIN_KEY]) {
    delete settings.enabledPlugins[PLUGIN_KEY];
    changed = true;
  }
  if (settings?.extraKnownMarketplaces?.[MARKETPLACE_NAME]) {
    delete settings.extraKnownMarketplaces[MARKETPLACE_NAME];
    changed = true;
  }
  if (changed) {
    await writeJson(SETTINGS_PATH, settings);
    console.log('  Removed from settings.json');
  }

  console.log('\nprompt-language uninstalled successfully.');
}

async function status() {
  const version = await readPluginVersion().catch(() => 'unknown');

  let installed = false;
  try {
    await fs.access(PLUGINS_DIR);
    installed = true;
  } catch {
    // not installed
  }

  const registry = await readJsonSafe(INSTALLED_PLUGINS_PATH);
  const registered = !!registry?.plugins?.[PLUGIN_KEY];

  const settings = await readJsonSafe(SETTINGS_PATH);
  const enabled = !!settings?.enabledPlugins?.[PLUGIN_KEY];
  const marketplace = !!settings?.extraKnownMarketplaces?.[MARKETPLACE_NAME];

  console.log(`prompt-language v${version}`);
  console.log(`  Installed:    ${installed ? 'yes' : 'no'}${installed ? ` (${PLUGINS_DIR})` : ''}`);
  console.log(`  Registered:   ${registered ? 'yes' : 'no'}`);
  console.log(`  Marketplace:  ${marketplace ? 'yes' : 'no'}`);
  console.log(`  Enabled:      ${enabled ? 'yes' : 'no'}`);

  if (!installed || !registered || !enabled || !marketplace) {
    console.log('\nRun "npx @45ck/prompt-language" to install.');
  }
}

const command = process.argv[2] ?? 'install';

switch (command) {
  case 'install':
    await install();
    break;
  case 'uninstall':
    await uninstall();
    break;
  case 'status':
    await status();
    break;
  default:
    console.error(`Unknown command: ${command}`);
    console.error('Usage: npx @45ck/prompt-language [install|uninstall|status]');
    process.exit(1);
}
