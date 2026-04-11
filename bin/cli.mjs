#!/usr/bin/env node

import { promises as fs, existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { join, dirname, resolve } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const MARKETPLACE_NAME = 'prompt-language-local';
const PLUGIN_KEY = `prompt-language@${MARKETPLACE_NAME}`;
const CLAUDE_DIR = join(homedir(), '.claude');
const CACHE_DIR = join(CLAUDE_DIR, 'plugins', 'cache', MARKETPLACE_NAME);
// PLUGINS_DIR is set dynamically per version in install() — see pluginsDir()
const INSTALLED_PLUGINS_PATH = join(CLAUDE_DIR, 'plugins', 'installed_plugins.json');
const SETTINGS_PATH = join(CLAUDE_DIR, 'settings.json');
const CODEX_DIR = join(homedir(), '.codex');
const CODEX_CACHE_DIR = join(CODEX_DIR, 'plugins', 'cache', MARKETPLACE_NAME);
const CODEX_INSTALLED_PLUGINS_PATH = join(CODEX_DIR, 'plugins', 'installed_plugins.json');
const CODEX_SETTINGS_PATH = join(CODEX_DIR, 'settings.json');
const CODEX_CONFIG_PATH = join(CODEX_DIR, 'config.toml');

// Old install location (pre-cache migration) — cleaned up during install/uninstall
const OLD_LOCAL_DIR = join(CLAUDE_DIR, 'plugins', 'local', 'prompt-language');
const OLD_MARKETPLACE_DIR = join(CLAUDE_DIR, 'plugins', 'local');
const OLD_CODEX_LOCAL_DIR = join(CODEX_DIR, 'plugins', 'local', 'prompt-language');
const OLD_CODEX_MARKETPLACE_DIR = join(CODEX_DIR, 'plugins', 'local');

function pluginsDir(version) {
  return join(CACHE_DIR, 'prompt-language', version);
}

const DIRS_TO_COPY = ['dist', 'hooks', 'skills', 'commands', 'agents', '.claude-plugin', 'bin'];
const DIRS_TO_COPY_CODEX = [
  'dist',
  'skills',
  'agents',
  '.codex-plugin',
  '.agents',
  '.codex',
  'bin',
];

async function readPluginVersion() {
  const raw = await fs.readFile(join(ROOT, '.claude-plugin', 'plugin.json'), 'utf8');
  return JSON.parse(raw).version;
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
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

class InstallCommandError extends Error {
  constructor(message, actions = []) {
    super(message);
    this.name = 'InstallCommandError';
    this.actions = actions;
  }
}

async function inspectJsonFile(filePath) {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return {
      kind: 'ok',
      raw,
      value: JSON.parse(raw),
    };
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return { kind: 'missing' };
    }
    if (error instanceof SyntaxError) {
      return { kind: 'invalid', error };
    }
    return { kind: 'error', error };
  }
}

function formatSystemError(error) {
  if (error?.code === 'EACCES' || error?.code === 'EPERM') {
    return 'permission denied';
  }
  if (error?.code === 'ENOSPC') {
    return 'disk is full';
  }
  if (error?.code === 'ENOENT') {
    return 'path not found';
  }
  return error?.message ?? String(error);
}

function buildInstallCommand(commandName) {
  return commandName === 'install'
    ? 'npx @45ck/prompt-language install'
    : `npx @45ck/prompt-language ${commandName}`;
}

function buildStatusCommand(commandName) {
  return commandName === 'install'
    ? 'npx @45ck/prompt-language status'
    : 'npx @45ck/prompt-language codex-status';
}

function printInstallFailure(commandName, error) {
  const installCommand = buildInstallCommand(commandName);
  const statusCommand = buildStatusCommand(commandName);

  if (error instanceof InstallCommandError) {
    console.error(`Error: ${error.message}`);
    if (error.actions.length > 0) {
      console.error('Actions:');
      for (const action of error.actions) {
        console.error(`  - ${action}`);
      }
    }
    console.error(`  - Run "${statusCommand}" after fixing the issue to verify the install state.`);
    process.exit(1);
  }

  console.error(`Error: ${formatSystemError(error)}.`);
  console.error('Actions:');
  console.error(`  - Retry "${installCommand}".`);
  console.error('  - Confirm the destination home directory is writable.');
  console.error(`  - Run "${statusCommand}" after retrying to verify the install state.`);
  process.exit(1);
}

async function readJsonForMutation(filePath, label, commandName) {
  const state = await inspectJsonFile(filePath);

  if (state.kind === 'missing') {
    return null;
  }

  if (state.kind === 'invalid') {
    throw new InstallCommandError(`${label} at ${filePath} contains invalid JSON.`, [
      `Repair or delete ${filePath}, then rerun "${buildInstallCommand(commandName)}".`,
    ]);
  }

  if (state.kind === 'error') {
    throw new InstallCommandError(
      `Could not read ${label} at ${filePath}: ${formatSystemError(state.error)}.`,
      [
        `Check permissions for ${filePath} and its parent directory.`,
        `Retry "${buildInstallCommand(commandName)}" once the file is readable.`,
      ],
    );
  }

  return state.value;
}

async function collectInstalledVersions(installsRoot) {
  try {
    const entries = await fs.readdir(installsRoot, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort((left, right) => left.localeCompare(right));
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

async function pruneStaleInstallVersions(installsRoot, currentVersion) {
  const versions = await collectInstalledVersions(installsRoot);
  const staleVersions = versions.filter((version) => version !== currentVersion);

  for (const version of staleVersions) {
    await fs.rm(join(installsRoot, version), { recursive: true, force: true });
  }

  return staleVersions;
}

async function copyInstallDirectories(directories, installDir, commandName) {
  for (const directory of directories) {
    const src = join(ROOT, directory);
    const dest = join(installDir, directory);

    if (!(await pathExists(src))) {
      throw new InstallCommandError(`Required install source is missing: ${src}`, [
        directory === 'dist'
          ? 'Run "npm run build" from the repository root before installing.'
          : `Reinstall the package contents so ${directory}/ is present, then rerun "${buildInstallCommand(commandName)}".`,
      ]);
    }

    try {
      await copyDir(src, dest);
      await fs.access(dest);
      console.log(`  Copied ${directory}/`);
    } catch (error) {
      throw new InstallCommandError(
        `Could not copy ${directory}/ to ${dest}: ${formatSystemError(error)}.`,
        [
          'Confirm the install destination is writable and has free space.',
          `Delete the partial install at ${installDir} if the problem persists, then rerun "${buildInstallCommand(commandName)}".`,
        ],
      );
    }
  }
}

function readRegistryEntry(registry, pluginKey) {
  const entry = registry?.plugins?.[pluginKey];
  if (!Array.isArray(entry) || entry.length === 0) {
    return null;
  }

  const [first] = entry;
  return first && typeof first === 'object' ? first : null;
}

async function collectInstallStatus({
  currentVersion,
  currentInstallPath,
  installsRoot,
  registryPath,
  settingsPath,
  pluginManifestRelativePath,
}) {
  const installed = await pathExists(currentInstallPath);
  const staleVersions = (await collectInstalledVersions(installsRoot)).filter(
    (version) => version !== currentVersion,
  );
  const issues = [];

  const registryState = await inspectJsonFile(registryPath);
  let registered = false;
  let registryEntry = null;

  if (registryState.kind === 'invalid') {
    issues.push(`${registryPath} contains invalid JSON.`);
  } else if (registryState.kind === 'error') {
    issues.push(`Could not read ${registryPath}: ${formatSystemError(registryState.error)}.`);
  } else if (registryState.kind === 'ok') {
    registryEntry = readRegistryEntry(registryState.value, PLUGIN_KEY);
    registered = registryEntry != null;
  }

  const registryInstallPath =
    registryEntry && typeof registryEntry.installPath === 'string'
      ? registryEntry.installPath
      : null;
  const registryVersion =
    registryEntry && typeof registryEntry.version === 'string' ? registryEntry.version : null;
  const registryInstallExists = registryInstallPath ? await pathExists(registryInstallPath) : false;
  const registryManifestPath = registryInstallPath
    ? join(registryInstallPath, pluginManifestRelativePath)
    : null;
  const registryManifestState = registryManifestPath
    ? await inspectJsonFile(registryManifestPath)
    : { kind: 'missing' };

  if (registered) {
    if (!registryInstallPath) {
      issues.push('installed_plugins.json is missing installPath for prompt-language.');
    } else if (registryInstallPath !== currentInstallPath) {
      issues.push(
        `installed_plugins.json points to ${registryInstallPath}, but this build expects ${currentInstallPath}.`,
      );
    }

    if (!registryVersion) {
      issues.push('installed_plugins.json is missing the prompt-language version.');
    } else if (registryVersion !== currentVersion) {
      issues.push(
        `installed_plugins.json records version ${registryVersion}, but this build is ${currentVersion}.`,
      );
    }

    if (registryInstallPath && !registryInstallExists) {
      issues.push(
        `installed_plugins.json points to ${registryInstallPath}, but that directory is missing.`,
      );
    } else if (registryManifestState.kind === 'missing' && registryInstallPath) {
      issues.push(
        `Install at ${registryInstallPath} is partial: missing ${pluginManifestRelativePath}.`,
      );
    } else if (registryManifestState.kind === 'invalid' && registryInstallPath) {
      issues.push(
        `Install at ${registryInstallPath} has invalid JSON in ${pluginManifestRelativePath}.`,
      );
    } else if (registryManifestState.kind === 'error' && registryInstallPath) {
      issues.push(
        `Could not read ${registryManifestPath}: ${formatSystemError(registryManifestState.error)}.`,
      );
    } else if (
      registryManifestState.kind === 'ok' &&
      typeof registryManifestState.value?.version === 'string' &&
      registryManifestState.value.version !== currentVersion
    ) {
      issues.push(
        `Install at ${registryInstallPath} contains plugin version ${registryManifestState.value.version}, expected ${currentVersion}.`,
      );
    }
  } else if (!installed) {
    issues.push('prompt-language is not installed.');
  }

  const settingsState = await inspectJsonFile(settingsPath);
  let enabled = false;
  let marketplace = false;

  if (settingsState.kind === 'invalid') {
    issues.push(`${settingsPath} contains invalid JSON.`);
  } else if (settingsState.kind === 'error') {
    issues.push(`Could not read ${settingsPath}: ${formatSystemError(settingsState.error)}.`);
  } else if (settingsState.kind === 'ok') {
    enabled = !!settingsState.value?.enabledPlugins?.[PLUGIN_KEY];
    marketplace = !!settingsState.value?.extraKnownMarketplaces?.[MARKETPLACE_NAME];
  }

  return {
    installed,
    registered,
    enabled,
    marketplace,
    issues,
    staleVersions,
  };
}

async function loadCodexInstallerAdapter() {
  return import(
    pathToFileURL(join(ROOT, 'dist', 'infrastructure', 'adapters', 'codex-installer.js')).href
  );
}

async function loadRenderWorkflow() {
  return import(pathToFileURL(join(ROOT, 'dist', 'presentation', 'render-workflow.js')).href);
}

async function loadArtifactInspection() {
  return import(pathToFileURL(join(ROOT, 'dist', 'presentation', 'inspect-artifacts.js')).href);
}

async function install() {
  try {
    const version = await readPluginVersion();
    const now = new Date().toISOString();
    const PLUGINS_DIR = pluginsDir(version);
    const installsRoot = join(CACHE_DIR, 'prompt-language');
    console.log(`Installing prompt-language v${version}...`);

    if (!existsSync(join(ROOT, 'dist'))) {
      throw new InstallCommandError('dist/ directory not found.', [
        'Run "npm run build" from the repository root before installing.',
      ]);
    }

    try {
      await fs.rm(OLD_LOCAL_DIR, { recursive: true, force: true });
      await fs.rm(join(OLD_MARKETPLACE_DIR, '.claude-plugin'), { recursive: true, force: true });
    } catch {
      // ignore — old location may not exist
    }

    await fs.rm(PLUGINS_DIR, { recursive: true, force: true });
    await ensureDir(PLUGINS_DIR);
    await copyInstallDirectories(DIRS_TO_COPY, PLUGINS_DIR, 'install');

    const pluginJsonState = await inspectJsonFile(
      join(PLUGINS_DIR, '.claude-plugin', 'plugin.json'),
    );
    if (pluginJsonState.kind !== 'ok') {
      throw new InstallCommandError(
        `Installed plugin manifest is unreadable at ${join(PLUGINS_DIR, '.claude-plugin', 'plugin.json')}.`,
        ['Delete the partial install and rerun "npx @45ck/prompt-language install".'],
      );
    }

    const pluginJson = pluginJsonState.value;
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
          source: `./prompt-language/${version}`,
          category: 'development',
        },
      ],
    };
    await writeJson(join(CACHE_DIR, '.claude-plugin', 'marketplace.json'), marketplaceCatalog);
    console.log('  Generated marketplace catalog');

    const installed = (await readJsonForMutation(
      INSTALLED_PLUGINS_PATH,
      'installed_plugins.json',
      'install',
    )) ?? { version: 2, plugins: {} };
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

    const settings = (await readJsonForMutation(SETTINGS_PATH, 'settings.json', 'install')) ?? {};
    settings.extraKnownMarketplaces = settings.extraKnownMarketplaces ?? {};
    settings.extraKnownMarketplaces[MARKETPLACE_NAME] = {
      source: {
        source: 'directory',
        path: CACHE_DIR,
      },
    };
    settings.enabledPlugins = settings.enabledPlugins ?? {};
    settings.enabledPlugins[PLUGIN_KEY] = true;
    await writeJson(SETTINGS_PATH, settings);
    console.log('  Registered marketplace in settings.json');
    console.log('  Enabled in settings.json');

    await configureStatusLine(settings, PLUGINS_DIR, true);

    const removedVersions = await pruneStaleInstallVersions(installsRoot, version);
    if (removedVersions.length > 0) {
      console.log(`  Removed stale versions: ${removedVersions.join(', ')}`);
    }

    console.log(`\nprompt-language runtime v${version} installed successfully.\n`);
    console.log('Try it now:');
    console.log('  claude -p "Fix the failing tests. done when: tests_pass"\n');
    console.log('Or use a built-in skill:');
    console.log('  /fix-and-test\n');
    console.log('Learn more:');
    console.log('  npx @45ck/prompt-language init    (scaffold a starter flow)');
    console.log('  https://github.com/45ck/prompt-language/blob/main/docs/getting-started.md');
  } catch (error) {
    printInstallFailure('install', error);
  }
}

async function installCodex() {
  try {
    const version = await readPluginVersion();
    const now = new Date().toISOString();
    const PLUGINS_DIR = join(CODEX_CACHE_DIR, 'prompt-language', version);
    const installsRoot = join(CODEX_CACHE_DIR, 'prompt-language');
    console.log(`Installing prompt-language Codex scaffold v${version}...`);

    if (!existsSync(join(ROOT, 'dist'))) {
      throw new InstallCommandError('dist/ directory not found.', [
        'Run "npm run build" from the repository root before installing.',
      ]);
    }

    try {
      await fs.rm(OLD_CODEX_LOCAL_DIR, { recursive: true, force: true });
      await fs.rm(join(OLD_CODEX_MARKETPLACE_DIR, '.codex-plugin'), {
        recursive: true,
        force: true,
      });
    } catch {
      // ignore — old location may not exist
    }

    await fs.rm(PLUGINS_DIR, { recursive: true, force: true });
    await ensureDir(PLUGINS_DIR);
    await copyInstallDirectories(DIRS_TO_COPY_CODEX, PLUGINS_DIR, 'codex-install');

    const codexPluginState = await inspectJsonFile(
      join(PLUGINS_DIR, '.codex-plugin', 'plugin.json'),
    );
    if (codexPluginState.kind !== 'ok') {
      throw new InstallCommandError(
        `Installed Codex plugin manifest is unreadable at ${join(PLUGINS_DIR, '.codex-plugin', 'plugin.json')}.`,
        ['Delete the partial install and rerun "npx @45ck/prompt-language codex-install".'],
      );
    }

    const installed = (await readJsonForMutation(
      CODEX_INSTALLED_PLUGINS_PATH,
      'Codex installed_plugins.json',
      'codex-install',
    )) ?? {
      version: 2,
      plugins: {},
    };
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
    await writeJson(CODEX_INSTALLED_PLUGINS_PATH, installed);
    console.log('  Registered in Codex installed_plugins.json');

    const settings =
      (await readJsonForMutation(CODEX_SETTINGS_PATH, 'Codex settings.json', 'codex-install')) ??
      {};
    settings.extraKnownMarketplaces = settings.extraKnownMarketplaces ?? {};
    settings.extraKnownMarketplaces[MARKETPLACE_NAME] = {
      source: {
        source: 'directory',
        path: CODEX_CACHE_DIR,
      },
    };
    settings.enabledPlugins = settings.enabledPlugins ?? {};
    settings.enabledPlugins[PLUGIN_KEY] = true;
    await writeJson(CODEX_SETTINGS_PATH, settings);
    console.log('  Registered marketplace in Codex settings.json');
    console.log('  Enabled in Codex settings.json');

    await enableCodexHooksConfig();

    const removedVersions = await pruneStaleInstallVersions(installsRoot, version);
    if (removedVersions.length > 0) {
      console.log(`  Removed stale versions: ${removedVersions.join(', ')}`);
    }

    console.log(`\nprompt-language Codex scaffold v${version} installed successfully.\n`);
    console.log('Try it now:');
    console.log('  codex exec "Fix the failing tests. done when: tests_pass"\n');
    console.log('Learn more:');
    console.log('  npx @45ck/prompt-language validate    (preview a flow)');
    console.log('  https://github.com/45ck/prompt-language/blob/main/docs/eval-parity-matrix.md');
  } catch (error) {
    printInstallFailure('codex-install', error);
  }
}

async function readFlowText(args, commandName) {
  let flowText = '';
  const flagsWithValues = new Set(['--file', '--runner', '--model', '--state-dir', '--mode']);
  const readFromFile = async (path) => {
    try {
      return await fs.readFile(path, 'utf8');
    } catch (error) {
      const reason =
        error.code === 'ENOENT'
          ? `File not found: ${path}`
          : error.code === 'EACCES' || error.code === 'EPERM'
            ? `Permission denied: ${path}`
            : `Could not read flow file: ${path}`;
      console.error(`Error: ${reason}`);
      process.exit(1);
    }
  };

  const fileIdx = args.indexOf('--file');
  if (fileIdx >= 0 && args[fileIdx + 1]) {
    flowText = await readFromFile(args[fileIdx + 1]);
  } else {
    let positionalFile = null;
    for (let i = 0; i < args.length; i += 1) {
      const arg = args[i];
      if (!arg) continue;
      if (flagsWithValues.has(arg)) {
        i += 1;
        continue;
      }
      if (!arg.startsWith('-')) {
        positionalFile = arg;
        break;
      }
    }
    if (positionalFile) {
      flowText = await readFromFile(positionalFile);
    } else if (!process.stdin.isTTY) {
      const chunks = [];
      for await (const chunk of process.stdin) {
        chunks.push(chunk);
      }
      flowText = Buffer.concat(chunks).toString('utf8');
    }
  }

  if (!flowText.trim()) {
    console.error(`Error: No flow provided. Usage:`);
    console.error(`  npx @45ck/prompt-language ${commandName} --file my.flow`);
    console.error(`  npx @45ck/prompt-language ${commandName} my.flow`);
    console.error(`  cat my.flow | npx @45ck/prompt-language ${commandName}`);
    process.exit(1);
  }

  if (flowText.includes('\0')) {
    console.error('Error: Flow text contains null bytes.');
    process.exit(1);
  }

  return flowText;
}

function readOptionValue(args, name) {
  const idx = args.indexOf(name);
  if (idx < 0) return undefined;
  return args[idx + 1];
}

function readPositionalValue(args, flagsWithValues) {
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (!arg) continue;
    if (flagsWithValues.has(arg)) {
      i += 1;
      continue;
    }
    if (!arg.startsWith('-')) {
      return arg;
    }
  }
  return undefined;
}

function hasOption(args, name) {
  return args.includes(name);
}

function readPositiveIntegerOption(args, name, label) {
  const raw = readOptionValue(args, name);
  if (raw == null) return undefined;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    console.error(`Error: ${label} must be a positive integer.`);
    process.exit(1);
  }
  return parsed;
}

function buildDefaultEvalOutputPath(datasetPath, candidate) {
  const datasetName = datasetPath
    .replace(/^.*[\\/]/, '')
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-z0-9_-]+/gi, '-')
    .toLowerCase();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return join('.prompt-language', 'eval-reports', `${datasetName}.${candidate}.${timestamp}.json`);
}

function defaultModelForRunner(runner) {
  return runner === 'codex' ? 'gpt-5.2' : undefined;
}

function ensureSupportedRunner(runner) {
  if (runner !== 'claude' && runner !== 'codex' && runner !== 'opencode' && runner !== 'ollama') {
    console.error(
      `Error: Unsupported runner "${runner}". Supported runners: claude, codex, opencode, ollama.`,
    );
    process.exit(1);
  }
  return runner;
}

function ensureSupportedMode(mode) {
  if (mode !== 'interactive' && mode !== 'headless') {
    console.error(`Error: Unsupported mode "${mode}". Supported modes: interactive, headless.`);
    process.exit(1);
  }
  return mode;
}

function defaultValidateModeForRunner(runner) {
  return runner === 'claude' ? 'interactive' : 'headless';
}

function readRunnerOptions(args) {
  const runner = ensureSupportedRunner(readOptionValue(args, '--runner') ?? 'claude');
  const model = readOptionValue(args, '--model') ?? defaultModelForRunner(runner);
  const stateDir = readOptionValue(args, '--state-dir');
  return { runner, model, stateDir };
}

function readValidateProfileOptions(args) {
  const runnerValue = readOptionValue(args, '--runner');
  const modeValue = readOptionValue(args, '--mode');

  if (runnerValue == null) {
    if (modeValue != null) {
      console.error('Error: --mode requires --runner.');
      process.exit(1);
    }
    return {};
  }

  const runner = ensureSupportedRunner(runnerValue);
  const mode = ensureSupportedMode(modeValue ?? defaultValidateModeForRunner(runner));
  return { runner, mode };
}

async function evaluateExecutionPreflight(flowText, runner, mode) {
  const [{ parseFlow }, { runExecutionPreflight }, { probeRunnerBinary }] = await Promise.all([
    import(pathToFileURL(join(ROOT, 'dist', 'application', 'parse-flow.js')).href),
    import(pathToFileURL(join(ROOT, 'dist', 'application', 'execution-preflight.js')).href),
    import(
      pathToFileURL(join(ROOT, 'dist', 'infrastructure', 'adapters', 'runner-binary-probe.js')).href
    ),
  ]);

  const spec = parseFlow(flowText, { basePath: process.cwd() });
  return runExecutionPreflight(
    spec,
    {
      cwd: process.cwd(),
      runner,
      ...(mode != null ? { mode } : {}),
    },
    { probeRunnerBinary },
  );
}

function serializeExecutionReport(report) {
  return JSON.stringify(
    {
      status: report.status,
      diagnostics: report.diagnostics,
      outcomes: report.outcomes,
      ...(report.reason != null ? { reason: report.reason } : {}),
    },
    null,
    2,
  );
}

async function loadDiagnosticPresentation() {
  const [{ formatDiagnosticReport }, { deriveDiagnosticReportExitCode }] = await Promise.all([
    import(pathToFileURL(join(ROOT, 'dist', 'presentation', 'format-diagnostic-report.js')).href),
    import(pathToFileURL(join(ROOT, 'dist', 'domain', 'diagnostic-report.js')).href),
  ]);
  return { formatDiagnosticReport, deriveDiagnosticReportExitCode };
}

async function printAndExitBlockedPreflight(flowText, runner, mode, options = {}) {
  const { json = false, header = '[prompt-language preflight]' } = options;
  const [report, { formatDiagnosticReport, deriveDiagnosticReportExitCode }] = await Promise.all([
    evaluateExecutionPreflight(flowText, runner, mode),
    loadDiagnosticPresentation(),
  ]);

  if (report.status !== 'blocked') {
    return report;
  }

  if (json) {
    console.log(serializeExecutionReport(report));
  } else {
    console.error(formatDiagnosticReport(report, header));
  }
  process.exit(deriveDiagnosticReportExitCode(report));
}

function ensureJsonSupportedForRunner(json, runner, commandName) {
  if (!json || runner !== 'claude') {
    return;
  }

  const report = {
    status: 'blocked',
    diagnostics: [
      {
        code: 'PLC-007',
        kind: 'profile',
        phase: 'session-init',
        severity: 'error',
        blocksExecution: true,
        retryable: false,
        summary: `${commandName} --json is currently supported only for headless runners (codex, opencode, ollama).`,
        action:
          'Use --runner codex, --runner opencode, or --runner ollama for machine-readable execution reports.',
      },
    ],
    outcomes: [],
  };
  console.log(serializeExecutionReport(report));
  process.exit(2);
}

async function writeExecutionReport(report, options = {}) {
  const { json = false, header = '[prompt-language report]', stdoutOnOk = false } = options;

  if (json) {
    console.log(serializeExecutionReport(report));
    return;
  }

  const { formatDiagnosticReport } = await loadDiagnosticPresentation();
  const text = formatDiagnosticReport(report, header);
  if (stdoutOnOk && report.status === 'ok') {
    console.log(text);
    return;
  }
  console.error(text);
}

async function runOpenCodeFlow(flowText, model, stateDir) {
  return runHeadlessFlow(
    flowText,
    model,
    {
      runnerModule: 'opencode-prompt-turn-runner.js',
      runnerExport: 'OpenCodePromptTurnRunner',
    },
    stateDir,
  );
}

async function runCodexFlow(flowText, model, stateDir) {
  return runHeadlessFlow(
    flowText,
    model,
    {
      runnerModule: 'codex-prompt-turn-runner.js',
      runnerExport: 'CodexPromptTurnRunner',
    },
    stateDir,
  );
}

async function runOllamaFlow(flowText, model, stateDir) {
  return runHeadlessFlow(
    flowText,
    model,
    {
      runnerModule: 'ollama-prompt-turn-runner.js',
      runnerExport: 'OllamaPromptTurnRunner',
    },
    stateDir,
  );
}

async function runHeadlessFlow(flowText, model, runnerConfig, stateDir = '.prompt-language') {
  const [
    { runFlowHeadless },
    { FileStateStore },
    { ShellCommandRunner },
    { HeadlessProcessSpawner },
    { FileCaptureReader },
    { FileAuditLogger },
    { FileMemoryStore },
    { FileMessageStore },
    runnerModule,
  ] = await Promise.all([
    import(pathToFileURL(join(ROOT, 'dist', 'application', 'run-flow-headless.js')).href),
    import(
      pathToFileURL(join(ROOT, 'dist', 'infrastructure', 'adapters', 'file-state-store.js')).href
    ),
    import(
      pathToFileURL(join(ROOT, 'dist', 'infrastructure', 'adapters', 'shell-command-runner.js'))
        .href
    ),
    import(
      pathToFileURL(join(ROOT, 'dist', 'infrastructure', 'adapters', 'headless-process-spawner.js'))
        .href
    ),
    import(
      pathToFileURL(join(ROOT, 'dist', 'infrastructure', 'adapters', 'file-capture-reader.js')).href
    ),
    import(
      pathToFileURL(join(ROOT, 'dist', 'infrastructure', 'adapters', 'file-audit-logger.js')).href
    ),
    import(
      pathToFileURL(join(ROOT, 'dist', 'infrastructure', 'adapters', 'file-memory-store.js')).href
    ),
    import(
      pathToFileURL(join(ROOT, 'dist', 'infrastructure', 'adapters', 'file-message-store.js')).href
    ),
    import(
      pathToFileURL(join(ROOT, 'dist', 'infrastructure', 'adapters', runnerConfig.runnerModule))
        .href
    ),
  ]);
  const PromptTurnRunner = runnerModule[runnerConfig.runnerExport];

  const cwd = process.cwd();
  const resolvedStateDir = stateDir ?? '.prompt-language';
  const stateStore = new FileStateStore(cwd, resolvedStateDir);
  const auditLogger = new FileAuditLogger(cwd, resolvedStateDir);
  const captureReader = new FileCaptureReader(cwd, resolvedStateDir);
  const memoryStore = new FileMemoryStore(cwd, resolvedStateDir);
  const messageStore = new FileMessageStore(join(cwd, resolvedStateDir), {});
  const commandRunner = new ShellCommandRunner();
  const promptTurnRunner = new PromptTurnRunner();
  const processSpawner = new HeadlessProcessSpawner({
    auditLogger,
    captureReader,
    commandRunner,
    cwd,
    memoryStore,
    messageStore,
    promptTurnRunner,
  });

  await stateStore.clear('');
  await stateStore.clearPendingPrompt();

  const result = await runFlowHeadless(
    {
      cwd,
      flowText,
      ...(model != null ? { model } : {}),
      sessionId: randomUUID(),
    },
    {
      auditLogger,
      captureReader,
      commandRunner,
      memoryStore,
      messageStore,
      processSpawner,
      promptTurnRunner,
      stateStore,
    },
  );

  return result.report;
}

async function evalDataset() {
  if (!existsSync(join(ROOT, 'dist'))) {
    console.error('Error: dist/ directory not found. Run "npm run build" first.');
    process.exit(1);
  }

  const args = process.argv.slice(3);
  const flagsWithValues = new Set([
    '--dataset',
    '--candidate',
    '--repeat',
    '--harness',
    '--model',
    '--baseline',
    '--baseline-report',
    '--output',
    '--out',
    '--timeout-ms',
  ]);
  const datasetArg =
    readOptionValue(args, '--dataset') ?? readPositionalValue(args, flagsWithValues);
  if (!datasetArg) {
    console.error('Error: No dataset provided. Usage:');
    console.error('  npx @45ck/prompt-language eval --dataset experiments/eval/datasets/e1.jsonl');
    console.error('  npx @45ck/prompt-language eval experiments/eval/datasets/e1.jsonl');
    process.exit(1);
  }

  const candidate = readOptionValue(args, '--candidate') ?? 'gated';
  if (candidate !== 'gated' && candidate !== 'vanilla') {
    console.error('Error: --candidate must be either "gated" or "vanilla".');
    process.exit(1);
  }

  const repeat = readPositiveIntegerOption(args, '--repeat', '--repeat');
  const timeoutMs = readPositiveIntegerOption(args, '--timeout-ms', '--timeout-ms');
  const harness = readOptionValue(args, '--harness');
  const model = readOptionValue(args, '--model');
  const baselinePath =
    readOptionValue(args, '--baseline-report') ?? readOptionValue(args, '--baseline');
  const outputPath =
    readOptionValue(args, '--output') ??
    readOptionValue(args, '--out') ??
    buildDefaultEvalOutputPath(datasetArg, candidate);

  const datasetPath = resolve(process.cwd(), datasetArg);
  const resolvedOutputPath = resolve(process.cwd(), outputPath);

  if (harness) {
    if (harness !== 'claude' && harness !== 'codex' && harness !== 'opencode') {
      console.error('Error: --harness must be one of "claude", "codex", or "opencode".');
      process.exit(1);
    }
    process.env.EVAL_HARNESS = harness;
  }

  const { readEvalReport, runEvalDatasetFromFile } = await import(
    pathToFileURL(join(ROOT, 'dist', 'infrastructure', 'adapters', 'eval-dataset-runner.js')).href
  );

  let baselineReport;
  if (baselinePath) {
    try {
      baselineReport = await readEvalReport(resolve(process.cwd(), baselinePath));
    } catch (error) {
      console.error(
        `Error: Could not read baseline report: ${error instanceof Error ? error.message : String(error)}`,
      );
      process.exit(1);
    }
  }

  let report;
  try {
    report = await runEvalDatasetFromFile(datasetPath, {
      candidate,
      ...(repeat != null ? { repeat } : {}),
      ...(model != null ? { model } : {}),
      ...(timeoutMs != null ? { timeoutMs } : {}),
      ...(baselineReport != null ? { baselineReport } : {}),
      outputPath: resolvedOutputPath,
    });
  } catch (error) {
    console.error(
      `Error: Eval run failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(1);
  }

  const passRate = (report.summary.passRate * 100).toFixed(1);
  const averageSeconds = (report.summary.averageDurationMs / 1000).toFixed(2);

  console.log(`[prompt-language eval] Dataset: ${report.datasetName}`);
  console.log(`[prompt-language eval] Harness: ${report.harness}`);
  console.log(`[prompt-language eval] Candidate: ${report.candidate}`);
  console.log(
    `[prompt-language eval] Summary: ${report.summary.passedRuns}/${report.summary.totalRuns} passed (${passRate}%), avg ${averageSeconds}s`,
  );

  if (report.comparison) {
    const delta = (report.comparison.passRateDelta * 100).toFixed(1);
    console.log(
      `[prompt-language eval] Compare vs ${report.comparison.baselineCandidate}: winner=${report.comparison.winner}, delta=${delta} points, case wins ${report.comparison.candidateWins}-${report.comparison.baselineWins} (${report.comparison.ties} ties)`,
    );
  }

  console.log(`[prompt-language eval] Report written to ${resolvedOutputPath}`);
}

async function validate() {
  if (!existsSync(join(ROOT, 'dist'))) {
    console.error('Error: dist/ directory not found. Run "npm run build" first.');
    process.exit(1);
  }

  const args = process.argv.slice(3);
  const flowText = await readFlowText(args, 'validate');
  const profile = readValidateProfileOptions(args);
  const json = hasOption(args, '--json');
  const checkGates = hasOption(args, '--check-gates');
  const { buildValidateFlowPreview } = await import(
    pathToFileURL(join(ROOT, 'dist', 'presentation', 'validate-flow.js')).href
  );
  const { probeRunnerBinary } = await import(
    pathToFileURL(join(ROOT, 'dist', 'infrastructure', 'adapters', 'runner-binary-probe.js')).href
  );
  const preview = buildValidateFlowPreview(flowText, {
    cwd: process.cwd(),
    ...profile,
    ...(profile.runner != null ? { probeRunnerBinary } : {}),
  });
  let renderedFlow = preview.renderedFlow;
  let report = preview.report;
  let gateChecks = undefined;
  let output = preview.output;

  if (checkGates && preview.report.status !== 'blocked') {
    const { parseFlow } = await import(
      pathToFileURL(join(ROOT, 'dist', 'application', 'parse-flow.js')).href
    );
    const { createExecutionReport } = await import(
      pathToFileURL(join(ROOT, 'dist', 'domain', 'diagnostic-report.js')).href
    );
    const { renderFlow } = await import(
      pathToFileURL(join(ROOT, 'dist', 'domain', 'render-flow.js')).href
    );
    const { ShellCommandRunner } = await import(
      pathToFileURL(join(ROOT, 'dist', 'infrastructure', 'adapters', 'shell-command-runner.js'))
        .href
    );
    const { runDryRunGateChecks, formatDryRunGateCheckSection } = await import(
      pathToFileURL(join(ROOT, 'dist', 'application', 'dry-run-gate-check.js')).href
    );

    const spec = parseFlow(flowText, { basePath: process.cwd() });
    const gateCheck = await runDryRunGateChecks(spec, {
      cwd: process.cwd(),
      commandRunner: new ShellCommandRunner(),
    });

    gateChecks = gateCheck.entries;
    renderedFlow = renderFlow(gateCheck.state);
    report = createExecutionReport({
      diagnostics: [...preview.report.diagnostics, ...gateCheck.report.diagnostics],
      outcomes: [...preview.report.outcomes, ...gateCheck.report.outcomes],
      reason: gateCheck.report.reason ?? preview.report.reason,
    });
    output = `${preview.output}\n\n${formatDryRunGateCheckSection(gateCheck)}`;
  }

  if (json) {
    console.log(
      JSON.stringify(
        {
          status: report.status,
          diagnostics: report.diagnostics,
          outcomes: report.outcomes,
          complexity: preview.complexity,
          lintWarningCount: preview.lintWarningCount,
          renderedFlow,
          ...(gateChecks !== undefined ? { gateChecks } : {}),
        },
        null,
        2,
      ),
    );
  } else {
    console.log(output);
  }

  const { deriveDiagnosticReportExitCode } = await import(
    pathToFileURL(join(ROOT, 'dist', 'domain', 'diagnostic-report.js')).href
  );
  process.exit(deriveDiagnosticReportExitCode(report));
}

function readArtifactsRoot(args, fallback = 'artifacts') {
  return resolve(process.cwd(), readOptionValue(args, '--root') ?? fallback);
}

function requireArtifactTarget(args, flagsWithValues, usageLines) {
  const target = readPositionalValue(args, flagsWithValues);
  if (target) {
    return target;
  }

  console.error('Error: No artifact target provided.');
  for (const usageLine of usageLines) {
    console.error(usageLine);
  }
  process.exit(1);
}

async function artifacts() {
  if (!existsSync(join(ROOT, 'dist'))) {
    console.error('Error: dist/ directory not found. Run "npm run build" first.');
    process.exit(1);
  }

  const args = process.argv.slice(3);
  const subcommand = args[0] ?? 'list';
  const subArgs = args.slice(1);
  const json = hasOption(subArgs, '--json');
  const {
    inspectArtifactPackage,
    listArtifactPackages,
    renderArtifactPackageDetails,
    renderArtifactPackageList,
    renderArtifactValidationResult,
    validateArtifactPackage,
  } = await loadArtifactInspection();

  switch (subcommand) {
    case 'list': {
      const flagsWithValues = new Set(['--root']);
      const rootArg = readPositionalValue(subArgs, flagsWithValues);
      const result = await listArtifactPackages(rootArg ?? readArtifactsRoot(subArgs));
      if (json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(renderArtifactPackageList(result));
      }
      return;
    }
    case 'show': {
      const flagsWithValues = new Set(['--root', '--view']);
      const target = requireArtifactTarget(subArgs, flagsWithValues, [
        'Usage:',
        '  npx @45ck/prompt-language artifacts show <artifact-id-or-path>',
        '  npx @45ck/prompt-language artifacts show <artifact-id-or-path> --root .prompt-language/artifacts',
        '  npx @45ck/prompt-language artifacts show <artifact-id-or-path> --view markdown',
      ]);
      const viewName = readOptionValue(subArgs, '--view');
      const details = await inspectArtifactPackage(target, {
        rootDir: readArtifactsRoot(subArgs),
        ...(viewName != null ? { viewName } : {}),
      });
      if (json) {
        console.log(JSON.stringify(details, null, 2));
      } else {
        console.log(renderArtifactPackageDetails(details));
      }
      return;
    }
    case 'validate': {
      const flagsWithValues = new Set(['--root']);
      const target = requireArtifactTarget(subArgs, flagsWithValues, [
        'Usage:',
        '  npx @45ck/prompt-language artifacts validate <artifact-id-or-path>',
        '  npx @45ck/prompt-language artifacts validate <artifact-id-or-path> --root .prompt-language/artifacts',
      ]);
      const result = await validateArtifactPackage(target, {
        rootDir: readArtifactsRoot(subArgs),
      });
      if (json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(renderArtifactValidationResult(result));
      }
      if (!result.ok) {
        process.exit(2);
      }
      return;
    }
    case '--help':
    case '-h':
      console.log(`Usage: npx @45ck/prompt-language artifacts <subcommand> [options]

Subcommands:
  list [root]                 List artifact packages under the given root (default: artifacts)
  show <id-or-path>           Show manifest-backed package details
  validate <id-or-path>       Validate manifest shape, declared files, and payload content

Options:
  --root <path>               Resolve artifact ids from this root directory
  --view <name>               For show: inline a registered view file such as markdown or html
  --json                      Emit machine-readable JSON`);
      return;
    default:
      console.error(`Unknown artifacts subcommand: ${subcommand}`);
      console.error('Run "npx @45ck/prompt-language artifacts --help" for usage information.');
      process.exit(1);
  }
}

async function runFlow() {
  if (!existsSync(join(ROOT, 'dist'))) {
    console.error('Error: dist/ directory not found. Run "npm run build" first.');
    process.exit(1);
  }

  const args = process.argv.slice(3);
  const flowText = await readFlowText(args, 'run');
  const { runner, model, stateDir } = readRunnerOptions(args);
  const json = hasOption(args, '--json');
  await printAndExitBlockedPreflight(flowText, runner, undefined, {
    json,
    header: '[prompt-language run]',
  });
  ensureJsonSupportedForRunner(json, runner, 'run');

  if (runner === 'codex') {
    const report = await runCodexFlow(flowText, model, stateDir);
    if (json) {
      console.log(serializeExecutionReport(report));
    } else if (report.status !== 'ok' || report.diagnostics.length > 0) {
      await writeExecutionReport(report, { header: '[prompt-language run]', stdoutOnOk: true });
    }
    const { deriveDiagnosticReportExitCode } = await loadDiagnosticPresentation();
    process.exit(deriveDiagnosticReportExitCode(report));
    return;
  }

  if (runner === 'opencode') {
    const report = await runOpenCodeFlow(flowText, model, stateDir);
    if (json) {
      console.log(serializeExecutionReport(report));
    } else if (report.status !== 'ok' || report.diagnostics.length > 0) {
      await writeExecutionReport(report, { header: '[prompt-language run]', stdoutOnOk: true });
    }
    const { deriveDiagnosticReportExitCode } = await loadDiagnosticPresentation();
    process.exit(deriveDiagnosticReportExitCode(report));
    return;
  }

  if (runner === 'ollama') {
    const report = await runOllamaFlow(flowText, model, stateDir);
    if (json) {
      console.log(serializeExecutionReport(report));
    } else if (report.status !== 'ok' || report.diagnostics.length > 0) {
      await writeExecutionReport(report, { header: '[prompt-language run]', stdoutOnOk: true });
    }
    const { deriveDiagnosticReportExitCode } = await loadDiagnosticPresentation();
    process.exit(deriveDiagnosticReportExitCode(report));
    return;
  }

  const { execFileSync } = await import('node:child_process');
  const claudeCommand = process.platform === 'win32' ? 'claude.cmd' : 'claude';
  const claudeArgs = ['-p', '--dangerously-skip-permissions'];
  if (model) {
    claudeArgs.push('--model', model);
  }
  claudeArgs.push(flowText);
  try {
    execFileSync(claudeCommand, claudeArgs, {
      stdio: 'inherit',
      timeout: 600_000,
    });
  } catch (error) {
    const failure = error;
    const exitCode = typeof failure?.status === 'number' ? failure.status : 1;
    console.error(`[prompt-language run] Claude runner exited with code ${exitCode}.`);
    process.exit(3);
  }
}

async function listFlows() {
  const cwd = process.cwd();
  const results = [];

  async function walk(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist') {
          continue;
        }
        await walk(join(dir, entry.name));
        continue;
      }
      if (entry.isFile() && entry.name.endsWith('.flow')) {
        results.push(join(dir, entry.name));
      }
    }
  }

  await walk(cwd);
  results.sort((a, b) => a.localeCompare(b));
  for (const filePath of results) {
    console.log(filePath.slice(cwd.length + 1));
  }
}

async function uninstall() {
  console.log('Uninstalling prompt-language...');

  // Remove cache directory (current install location)
  try {
    await fs.rm(CACHE_DIR, { recursive: true, force: true });
    console.log(`  Removed ${CACHE_DIR}`);
  } catch {
    console.log('  Cache directory not found (already removed)');
  }

  // Remove old local directory (pre-cache migration)
  try {
    await fs.rm(OLD_LOCAL_DIR, { recursive: true, force: true });
    await fs.rm(join(OLD_MARKETPLACE_DIR, '.claude-plugin'), { recursive: true, force: true });
  } catch {
    // ignore — old location may not exist
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

  console.log('\nprompt-language runtime uninstalled successfully.');
}

async function uninstallCodex() {
  console.log('Uninstalling prompt-language Codex scaffold...');

  try {
    await fs.rm(CODEX_CACHE_DIR, { recursive: true, force: true });
    console.log(`  Removed ${CODEX_CACHE_DIR}`);
  } catch {
    console.log('  Cache directory not found (already removed)');
  }

  try {
    await fs.rm(OLD_CODEX_LOCAL_DIR, { recursive: true, force: true });
    await fs.rm(join(OLD_CODEX_MARKETPLACE_DIR, '.codex-plugin'), { recursive: true, force: true });
  } catch {
    // ignore — old location may not exist
  }

  const installed = await readJsonSafe(CODEX_INSTALLED_PLUGINS_PATH);
  if (installed?.plugins?.[PLUGIN_KEY]) {
    delete installed.plugins[PLUGIN_KEY];
    await writeJson(CODEX_INSTALLED_PLUGINS_PATH, installed);
    console.log('  Removed from Codex installed_plugins.json');
  }

  const settings = await readJsonSafe(CODEX_SETTINGS_PATH);
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
    await writeJson(CODEX_SETTINGS_PATH, settings);
    console.log('  Removed from Codex settings.json');
  }

  await disableCodexHooksConfig();

  console.log('\nprompt-language Codex scaffold uninstalled successfully.');
}

async function status() {
  const version = await readPluginVersion().catch(() => 'unknown');
  const PLUGINS_DIR = pluginsDir(version);
  const state = await collectInstallStatus({
    currentVersion: version,
    currentInstallPath: PLUGINS_DIR,
    installsRoot: join(CACHE_DIR, 'prompt-language'),
    registryPath: INSTALLED_PLUGINS_PATH,
    settingsPath: SETTINGS_PATH,
    pluginManifestRelativePath: join('.claude-plugin', 'plugin.json'),
  });

  console.log(`prompt-language v${version}`);
  console.log(
    `  Installed:    ${state.installed ? 'yes' : 'no'}${state.installed ? ` (${PLUGINS_DIR})` : ''}`,
  );
  console.log(`  Registered:   ${state.registered ? 'yes' : 'no'}`);
  console.log(`  Marketplace:  ${state.marketplace ? 'yes' : 'no'}`);
  console.log(`  Enabled:      ${state.enabled ? 'yes' : 'no'}`);

  if (state.staleVersions.length > 0) {
    console.log(`  Stale:        ${state.staleVersions.join(', ')}`);
  }

  for (const issue of state.issues) {
    console.log(`  Issue:        ${issue}`);
  }

  if (
    state.issues.length > 0 ||
    !state.installed ||
    !state.registered ||
    !state.enabled ||
    !state.marketplace
  ) {
    console.log('\nRemediation:');
    console.log('  Run "npx @45ck/prompt-language install" to refresh the Claude install.');
    if (state.staleVersions.length > 0) {
      console.log('  The install command will prune stale cached versions automatically.');
    }
  }
}

async function statusCodex() {
  const version = await readPluginVersion().catch(() => 'unknown');
  const PLUGINS_DIR = join(CODEX_CACHE_DIR, 'prompt-language', version);
  const state = await collectInstallStatus({
    currentVersion: version,
    currentInstallPath: PLUGINS_DIR,
    installsRoot: join(CODEX_CACHE_DIR, 'prompt-language'),
    registryPath: CODEX_INSTALLED_PLUGINS_PATH,
    settingsPath: CODEX_SETTINGS_PATH,
    pluginManifestRelativePath: join('.codex-plugin', 'plugin.json'),
  });

  const { inspectCodexHooksConfigFile } = await loadCodexInstallerAdapter();
  const codexHooks = await inspectCodexHooksConfigFile(CODEX_CONFIG_PATH);

  console.log(`prompt-language Codex scaffold v${version}`);
  console.log(
    `  Installed:    ${state.installed ? 'yes' : 'no'}${state.installed ? ` (${PLUGINS_DIR})` : ''}`,
  );
  console.log(`  Registered:   ${state.registered ? 'yes' : 'no'}`);
  console.log(`  Marketplace:  ${state.marketplace ? 'yes' : 'no'}`);
  console.log(`  Enabled:      ${state.enabled ? 'yes' : 'no'}`);
  console.log(`  codex_hooks:  ${formatCodexHooksStatus(codexHooks)}`);

  if (state.staleVersions.length > 0) {
    console.log(`  Stale:        ${state.staleVersions.join(', ')}`);
  }

  for (const issue of state.issues) {
    console.log(`  Issue:        ${issue}`);
  }

  if (codexHooks.ownership === 'conflict') {
    console.log('  Warning: conflicting codex_hooks entries detected in config.toml');
  }

  if (
    !state.installed ||
    !state.registered ||
    !state.enabled ||
    !state.marketplace ||
    !codexHooks.enabled ||
    state.issues.length > 0
  ) {
    console.log('\nRemediation:');
    console.log('  Run "npx @45ck/prompt-language codex-install" to refresh the Codex scaffold.');
    if (state.staleVersions.length > 0) {
      console.log('  The install command will prune stale cached versions automatically.');
    }
  }
}

async function enableCodexHooksConfig() {
  const { enableManagedCodexHooksFile } = await loadCodexInstallerAdapter();
  const result = await enableManagedCodexHooksFile(CODEX_CONFIG_PATH);

  if (result.outcome === 'created') {
    console.log('  Wrote config.toml with prompt-language-managed codex_hooks');
    return;
  }

  if (result.outcome === 'updated') {
    console.log('  Enabled prompt-language-managed codex_hooks in config.toml');
    return;
  }

  if (result.outcome === 'user-owned') {
    console.log('  Preserved existing user-owned codex_hooks setting in config.toml');
    return;
  }

  if (result.outcome === 'conflict') {
    console.warn(
      '  Detected conflicting codex_hooks entries in config.toml; leaving file unchanged',
    );
  }
}

async function disableCodexHooksConfig() {
  const { disableManagedCodexHooksFile } = await loadCodexInstallerAdapter();
  const result = await disableManagedCodexHooksFile(CODEX_CONFIG_PATH);

  if (result.outcome === 'removed') {
    console.log('  Removed prompt-language-managed codex_hooks from config.toml');
    return;
  }

  if (result.outcome === 'conflict') {
    console.warn(
      '  Detected conflicting codex_hooks entries in config.toml; leaving file unchanged',
    );
    return;
  }

  if (result.outcome === 'not-managed' && result.snapshot.ownership === 'user-owned') {
    console.log('  Preserved existing user-owned codex_hooks setting in config.toml');
  }
}

function formatCodexHooksStatus(snapshot) {
  const status = snapshot.enabled ? 'yes' : 'no';

  switch (snapshot.ownership) {
    case 'managed':
      return `${status} (managed)`;
    case 'user-owned':
      return `${status} (user-owned)`;
    case 'conflict':
      return `${status} (conflict)`;
    default:
      return status;
  }
}

async function renderWorkflow() {
  if (!existsSync(join(ROOT, 'dist'))) {
    console.error('Error: dist/ directory not found. Run "npm run build" first.');
    process.exit(1);
  }

  const args = process.argv.slice(3);
  const alias = args.find((arg) => arg != null && !arg.startsWith('-'));

  if (alias == null || alias.length === 0) {
    console.error('Error: Missing workflow alias.');
    console.error('Usage: npx @45ck/prompt-language render-workflow <name>');
    process.exit(1);
  }

  const { renderWorkflowAlias } = await loadRenderWorkflow();
  try {
    process.stdout.write(renderWorkflowAlias(alias).flowText);
  } catch (error) {
    console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

async function configureStatusLine(settings, installDir, autoMode = false) {
  const statuslineScript = join(installDir, 'bin', 'statusline.mjs').replace(/\\/g, '/');
  const command = `node "${statuslineScript}"`;

  if (settings?.statusLine) {
    // Always update if the existing status line points to a prompt-language path
    // (handles migration from old install locations)
    const existingCmd = settings.statusLine.command ?? '';
    const isOurStatusLine = existingCmd.includes('prompt-language');
    if (autoMode && !isOurStatusLine) {
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
  const hasPyproject = existsSync(join(cwd, 'pyproject.toml'));
  const hasSetupPy = existsSync(join(cwd, 'setup.py'));
  const hasGoMod = existsSync(join(cwd, 'go.mod'));
  const hasCargoToml = existsSync(join(cwd, 'Cargo.toml'));
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
  } else if (hasPyproject || hasSetupPy) {
    flow = `Goal: <describe your goal here>\n\nflow:\n  prompt: Implement the requested changes.\n  run: python -m pytest\n\ndone when:\n  pytest_pass\n`;
  } else if (hasGoMod) {
    flow = `Goal: <describe your goal here>\n\nflow:\n  prompt: Implement the requested changes.\n  run: go test ./...\n\ndone when:\n  go_test_pass\n`;
  } else if (hasCargoToml) {
    flow = `Goal: <describe your goal here>\n\nflow:\n  prompt: Implement the requested changes.\n  run: cargo test\n\ndone when:\n  cargo_test_pass\n`;
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
# prompt-language: control-flow runtime for Claude Code
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
  const args = process.argv.slice(3);
  const flowText = await readFlowText(args, 'ci');
  const { runner, model, stateDir } = readRunnerOptions(args);
  const json = hasOption(args, '--json');
  await printAndExitBlockedPreflight(flowText, runner, undefined, {
    json,
    header: '[prompt-language ci]',
  });
  ensureJsonSupportedForRunner(json, runner, 'ci');

  if (!json) {
    console.log(`[prompt-language CI] Running flow via ${runner}...`);
  }
  try {
    if (runner === 'codex') {
      const report = await runCodexFlow(flowText, model, stateDir);
      if (json) {
        console.log(serializeExecutionReport(report));
      } else if (report.status !== 'ok' || report.diagnostics.length > 0) {
        await writeExecutionReport(report, { header: '[prompt-language ci]', stdoutOnOk: true });
      } else {
        console.log('[prompt-language CI] Flow completed.');
      }
      const { deriveDiagnosticReportExitCode } = await loadDiagnosticPresentation();
      process.exit(deriveDiagnosticReportExitCode(report));
    } else if (runner === 'opencode') {
      const report = await runOpenCodeFlow(flowText, model, stateDir);
      if (json) {
        console.log(serializeExecutionReport(report));
      } else if (report.status !== 'ok' || report.diagnostics.length > 0) {
        await writeExecutionReport(report, { header: '[prompt-language ci]', stdoutOnOk: true });
      } else {
        console.log('[prompt-language CI] Flow completed.');
      }
      const { deriveDiagnosticReportExitCode } = await loadDiagnosticPresentation();
      process.exit(deriveDiagnosticReportExitCode(report));
    } else if (runner === 'ollama') {
      const report = await runOllamaFlow(flowText, model, stateDir);
      if (json) {
        console.log(serializeExecutionReport(report));
      } else if (report.status !== 'ok' || report.diagnostics.length > 0) {
        await writeExecutionReport(report, { header: '[prompt-language ci]', stdoutOnOk: true });
      } else {
        console.log('[prompt-language CI] Flow completed.');
      }
      const { deriveDiagnosticReportExitCode } = await loadDiagnosticPresentation();
      process.exit(deriveDiagnosticReportExitCode(report));
    } else if (runner === 'claude') {
      const { execFileSync } = await import('node:child_process');
      const claudeArgs = ['-p', '--dangerously-skip-permissions'];
      if (model) {
        claudeArgs.push('--model', model);
      }
      claudeArgs.push(flowText);
      execFileSync('claude', claudeArgs, {
        stdio: 'inherit',
        timeout: 600_000, // 10 min max
      });
      console.log('[prompt-language CI] Flow completed.');
      process.exit(0);
    } else {
      throw new Error(
        `Unsupported runner "${runner}". Supported runners: claude, codex, opencode, ollama.`,
      );
    }
  } catch (error) {
    const exitCode = typeof error?.status === 'number' ? error.status : 1;
    console.error(
      `[prompt-language CI] Flow failed with exit code ${exitCode}: ${error.message ?? error}`,
    );
    process.exit(3);
  }
}

const command = process.argv[2] ?? 'install';

switch (command) {
  case 'install':
    await install();
    break;
  case 'codex-install':
    await installCodex();
    break;
  case 'uninstall':
    await uninstall();
    break;
  case 'codex-uninstall':
    await uninstallCodex();
    break;
  case 'status':
    await status();
    break;
  case 'codex-status':
    await statusCodex();
    break;
  case 'init':
    await init();
    break;
  case 'run':
    await runFlow();
    break;
  case 'eval':
    await evalDataset();
    break;
  case 'demo':
    demo();
    break;
  case 'list':
    await listFlows();
    break;
  case 'validate':
    await validate();
    break;
  case 'render-workflow':
    await renderWorkflow();
    break;
  case 'artifacts':
    await artifacts();
    break;
  case 'ci':
    await ci();
    break;
  case 'statusline': {
    const settings = (await readJsonSafe(SETTINGS_PATH)) ?? {};
    const ver = await readPluginVersion().catch(() => '0.0.0');
    await configureStatusLine(settings, pluginsDir(ver));
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
  codex-install Install the Codex scaffold and local config
  uninstall    Remove the plugin and clean up settings
  codex-uninstall Remove the Codex scaffold and clean up settings
  status       Show installation status
  codex-status Show Codex scaffold status
  init         Scaffold a starter flow in the current directory
  run          Execute a .flow file or inline flow text (\`--runner claude|codex|opencode|ollama\`)
  eval         Run a JSONL eval dataset and optionally compare against a baseline report
  demo         Print an example flow to stdout
  list         Recursively list .flow files in the current directory
  validate     Parse, lint, score, and render a flow without executing it (\`--runner ... --mode interactive|headless\`, \`--check-gates\`)
  render-workflow Show the lowered .flow text for a canonical workflow alias
  artifacts    Inspect artifact packages (\`list\`, \`show\`, \`validate\`)
  ci           Run a flow headlessly (CI/CD mode, supports \`--runner codex|opencode|ollama\`)
  statusline   Configure the Claude Code status line
  watch        Watch for file changes and rebuild

Options:
  --help, -h       Show this help message
  --version, -V    Show version number`);
    break;
  case '--version':
  case '-V': {
    const ver = await readPluginVersion().catch(() => 'unknown');
    console.log(`prompt-language v${ver}`);
    break;
  }
  default:
    console.error(`Unknown command: ${command}`);
    console.error('Run "npx @45ck/prompt-language --help" for usage information.');
    process.exit(1);
}
