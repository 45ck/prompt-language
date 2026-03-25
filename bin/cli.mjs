#!/usr/bin/env node

import { promises as fs, existsSync } from 'node:fs';
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

const DIRS_TO_COPY = ['dist', 'hooks', 'skills', '.claude-plugin', 'bin'];

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

  if (!existsSync(join(ROOT, 'dist'))) {
    console.error('Error: dist/ directory not found. Run "npm run build" first.');
    process.exit(1);
  }

  await ensureDir(PLUGINS_DIR);
  for (const dir of DIRS_TO_COPY) {
    const src = join(ROOT, dir);
    try {
      await fs.access(src);
      await copyDir(src, join(PLUGINS_DIR, dir));
      console.log(`  Copied ${dir}/`);
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.warn(`  Skipping ${dir}/ (not found)`);
      } else if (error.code === 'EACCES' || error.code === 'EPERM') {
        console.error(`  Permission denied copying ${dir}/`);
      } else if (error.code === 'ENOSPC') {
        console.error(`  Disk full - cannot copy ${dir}/`);
      } else {
        console.error(`  Error copying ${dir}/: ${error.message}`);
      }
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

  // Auto-configure status line if not already set
  await configureStatusLine(settings, true);

  console.log(`\nprompt-language v${version} installed successfully.\n`);
  console.log('Try it now:');
  console.log('  claude -p "Fix the failing tests. done when: tests_pass"\n');
  console.log('Or use a built-in skill:');
  console.log('  /fix-and-test\n');
  console.log('Learn more:');
  console.log('  npx @45ck/prompt-language init    (scaffold a starter flow)');
  console.log('  https://github.com/45ck/prompt-language/blob/main/docs/getting-started.md');
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
  // Remove status line config if it points to our script
  if (settings?.statusLine?.command?.includes('prompt-language')) {
    delete settings.statusLine;
    changed = true;
    console.log('  Removed status line config');
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

async function configureStatusLine(settings, autoMode = false) {
  const statuslineScript = join(PLUGINS_DIR, 'bin', 'statusline.mjs').replace(/\\/g, '/');
  const command = `node "${statuslineScript}"`;

  if (settings?.statusLine) {
    if (autoMode) {
      console.log('  Status line already configured (skipping auto-config)');
      return;
    }
  }

  settings = settings ?? {};
  settings.statusLine = { type: 'command', command };
  await writeJson(SETTINGS_PATH, settings);
  console.log('  Configured status line');
}

// H#81: Generate a starter flow from project context
async function init() {
  const cwd = process.cwd();
  const plDir = join(cwd, '.prompt-language');
  const varsDir = join(plDir, 'vars');

  await ensureDir(plDir);
  await ensureDir(varsDir);

  // Create .gitignore for state files
  const gitignorePath = join(plDir, '.gitignore');
  try {
    await fs.access(gitignorePath);
  } catch {
    await fs.writeFile(gitignorePath, 'session-state.json\nsession-state.lock\nvars/\n', 'utf8');
    console.log('  Created .prompt-language/.gitignore');
  }

  // Detect project type and generate starter flow
  const pkg = await readJsonSafe(join(cwd, 'package.json'));
  let flow = '';

  if (pkg?.scripts) {
    const hasTest = !!pkg.scripts.test;
    const hasLint = !!pkg.scripts.lint;
    const hasBuild = !!pkg.scripts.build;
    const testCmd = hasTest ? 'npm test' : '';
    const lintCmd = hasLint ? 'npm run lint' : '';

    const steps = [];
    steps.push('  prompt: Implement the requested changes.');
    if (hasBuild) steps.push('  run: npm run build');
    if (hasTest) steps.push(`  run: ${testCmd}`);
    if (hasLint) steps.push(`  run: ${lintCmd}`);

    const gates = [];
    if (hasTest) gates.push('  tests_pass');
    if (hasLint) gates.push('  lint_pass');

    flow = `Goal: <describe your goal here>\n\nflow:\n${steps.join('\n')}\n`;
    if (gates.length > 0) {
      flow += `\ndone when:\n${gates.join('\n')}\n`;
    }
  } else {
    flow = `Goal: <describe your goal here>\n\nflow:\n  prompt: Implement the requested changes.\n  run: echo "done"\n`;
  }

  const flowPath = join(cwd, 'example.flow');
  try {
    await fs.access(flowPath);
    console.log('  example.flow already exists (skipping)');
  } catch {
    await fs.writeFile(flowPath, flow, 'utf8');
    console.log('  Created example.flow');
  }

  console.log('\nprompt-language initialized. Edit example.flow and run:');
  console.log('  claude -p "$(cat example.flow)"');
}

function demo() {
  const example = `\
# prompt-language: verified task completion for Claude Code
#
# The core idea: "done when:" gates run real commands.
# Claude cannot stop until they pass.

Goal: Fix the failing tests

flow:
  retry max 5
    run: npm test
    if command_failed
      prompt: Tests failed. Read the error output, fix the code, and try again.
    end
  end

done when:
  tests_pass
  lint_pass

# Gate predicates by language:
#   JS/TS:  tests_pass, lint_pass
#   Python: pytest_pass
#   Go:     go_test_pass
#   Rust:   cargo_test_pass
#
# Install: npx @45ck/prompt-language
# Docs:    https://github.com/45ck/prompt-language`;

  console.log(example);
}

// H-INT-003: CI/CD mode — run a flow headlessly via `claude -p`
async function ci() {
  // Accept flow from --file <path> or remaining positional args
  const args = process.argv.slice(3);
  let flowText = '';

  const fileIdx = args.indexOf('--file');
  if (fileIdx >= 0 && args[fileIdx + 1]) {
    flowText = await fs.readFile(args[fileIdx + 1], 'utf8');
  } else if (args.length > 0 && !args[0].startsWith('-')) {
    // Treat remaining args as the flow file path
    flowText = await fs.readFile(args[0], 'utf8');
  } else {
    // Try reading from stdin (piped input)
    const chunks = [];
    if (!process.stdin.isTTY) {
      for await (const chunk of process.stdin) {
        chunks.push(chunk);
      }
      flowText = Buffer.concat(chunks).toString('utf8');
    }
  }

  if (!flowText.trim()) {
    console.error('Error: No flow provided. Usage:');
    console.error('  npx @45ck/prompt-language ci --file my.flow');
    console.error('  npx @45ck/prompt-language ci my.flow');
    console.error('  cat my.flow | npx @45ck/prompt-language ci');
    process.exit(1);
  }

  // Guard against null bytes that could truncate arguments in child processes
  if (flowText.includes('\0')) {
    console.error('Error: Flow text contains null bytes.');
    process.exit(1);
  }

  console.log('[prompt-language CI] Running flow headlessly...');
  try {
    const { execFileSync } = await import('node:child_process');
    // D01-fix: Use execFileSync with array args to prevent shell injection
    execFileSync('claude', ['-p', '--dangerously-skip-permissions', flowText], {
      stdio: 'inherit',
      timeout: 600_000, // 10 min max
    });
    console.log('[prompt-language CI] Flow completed.');
    process.exit(0);
  } catch (error) {
    console.error(`[prompt-language CI] Flow failed with exit code ${error.status ?? 1}`);
    process.exit(error.status ?? 1);
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
  case 'init':
    await init();
    break;
  case 'demo':
    demo();
    break;
  case 'ci':
    await ci();
    break;
  case 'statusline': {
    const settings = (await readJsonSafe(SETTINGS_PATH)) ?? {};
    await configureStatusLine(settings);
    break;
  }
  case 'watch': {
    const watchScript = join(__dirname, 'watch.mjs');
    const { execSync } = await import('node:child_process');
    execSync(`node "${watchScript}"`, { stdio: 'inherit' });
    break;
  }
  case '--help':
  case '-h':
    console.log(`Usage: npx @45ck/prompt-language [command]

Commands:
  install      Install the prompt-language plugin (default)
  uninstall    Remove the plugin and clean up settings
  status       Show installation status
  init         Scaffold a starter flow in the current directory
  demo         Print an example flow to stdout
  ci           Run a flow headlessly (CI/CD mode)
  statusline   Configure the Claude Code status line
  watch        Watch for file changes and rebuild

Options:
  --help, -h       Show this help message
  --version, -V    Show version number`);
    break;
  case '--version':
  case '-V': {
    const ver = await readPluginVersion().catch(() => 'unknown');
    console.log(ver);
    break;
  }
  default:
    console.error(`Unknown command: ${command}`);
    console.error(
      'Usage: npx @45ck/prompt-language [install|uninstall|status|init|demo|ci|statusline|watch]',
    );
    process.exit(1);
}
