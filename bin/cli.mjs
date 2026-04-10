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
  const PLUGINS_DIR = pluginsDir(version);
  console.log(`Installing prompt-language v${version}...`);

  if (!existsSync(join(ROOT, 'dist'))) {
    console.error('Error: dist/ directory not found. Run "npm run build" first.');
    process.exit(1);
  }

  // Clean up old install location (pre-cache migration)
  try {
    await fs.rm(OLD_LOCAL_DIR, { recursive: true, force: true });
    await fs.rm(join(OLD_MARKETPLACE_DIR, '.claude-plugin'), { recursive: true, force: true });
  } catch {
    // ignore — old location may not exist
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

  // Write marketplace catalog to cache directory for Claude Code discovery
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
        source: `./prompt-language/${version}`,
        category: 'development',
      },
    ],
  };
  await writeJson(join(CACHE_DIR, '.claude-plugin', 'marketplace.json'), marketplaceCatalog);
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
      path: CACHE_DIR,
    },
  };
  settings.enabledPlugins = settings.enabledPlugins ?? {};
  settings.enabledPlugins[PLUGIN_KEY] = true;
  await writeJson(SETTINGS_PATH, settings);
  console.log('  Registered marketplace in settings.json');
  console.log('  Enabled in settings.json');

  // Auto-configure status line if not already set
  await configureStatusLine(settings, PLUGINS_DIR, true);

  console.log(`\nprompt-language runtime v${version} installed successfully.\n`);
  console.log('Try it now:');
  console.log('  claude -p "Fix the failing tests. done when: tests_pass"\n');
  console.log('Or use a built-in skill:');
  console.log('  /fix-and-test\n');
  console.log('Learn more:');
  console.log('  npx @45ck/prompt-language init    (scaffold a starter flow)');
  console.log('  https://github.com/45ck/prompt-language/blob/main/docs/getting-started.md');
}

async function installCodex() {
  const version = await readPluginVersion();
  const now = new Date().toISOString();
  const PLUGINS_DIR = join(CODEX_CACHE_DIR, 'prompt-language', version);
  console.log(`Installing prompt-language Codex scaffold v${version}...`);

  if (!existsSync(join(ROOT, 'dist'))) {
    console.error('Error: dist/ directory not found. Run "npm run build" first.');
    process.exit(1);
  }

  try {
    await fs.rm(OLD_CODEX_LOCAL_DIR, { recursive: true, force: true });
    await fs.rm(join(OLD_CODEX_MARKETPLACE_DIR, '.codex-plugin'), { recursive: true, force: true });
  } catch {
    // ignore — old location may not exist
  }

  await ensureDir(PLUGINS_DIR);
  for (const dir of DIRS_TO_COPY_CODEX) {
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

  await fs.readFile(join(PLUGINS_DIR, '.codex-plugin', 'plugin.json'), 'utf8');
  const installed = (await readJsonSafe(CODEX_INSTALLED_PLUGINS_PATH)) ?? {
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

  const settings = (await readJsonSafe(CODEX_SETTINGS_PATH)) ?? {};
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

  console.log(`\nprompt-language Codex scaffold v${version} installed successfully.\n`);
  console.log('Try it now:');
  console.log('  codex exec "Fix the failing tests. done when: tests_pass"\n');
  console.log('Learn more:');
  console.log('  npx @45ck/prompt-language validate    (preview a flow)');
  console.log('  https://github.com/45ck/prompt-language/blob/main/docs/eval-parity-matrix.md');
}

async function readFlowText(args, commandName) {
  let flowText = '';
  const flagsWithValues = new Set(['--file', '--runner', '--model', '--state-dir']);
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

function readRunnerOptions(args) {
  const runner = readOptionValue(args, '--runner') ?? 'claude';
  const model = readOptionValue(args, '--model') ?? defaultModelForRunner(runner);
  const stateDir = readOptionValue(args, '--state-dir');
  return { runner, model, stateDir };
}

async function runOpenCodeFlow(flowText, model, stateDir) {
  return runHeadlessFlow(flowText, model, {
    runnerModule: 'opencode-prompt-turn-runner.js',
    runnerExport: 'OpenCodePromptTurnRunner',
  }, stateDir);
}

async function runCodexFlow(flowText, model, stateDir) {
  return runHeadlessFlow(flowText, model, {
    runnerModule: 'codex-prompt-turn-runner.js',
    runnerExport: 'CodexPromptTurnRunner',
  }, stateDir);
}

async function runOllamaFlow(flowText, model, stateDir) {
  return runHeadlessFlow(flowText, model, {
    runnerModule: 'ollama-prompt-turn-runner.js',
    runnerExport: 'OllamaPromptTurnRunner',
  }, stateDir);
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

  if (result.finalState.status === 'completed') {
    return;
  }

  const reason = result.reason ?? `Flow ended with status "${result.finalState.status}".`;
  throw new Error(reason);
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

  const flowText = await readFlowText(process.argv.slice(3), 'validate');
  const { buildValidateFlowPreview } = await import(
    pathToFileURL(join(ROOT, 'dist', 'presentation', 'validate-flow.js')).href
  );
  const preview = buildValidateFlowPreview(flowText);
  console.log(preview.output);
}

async function runFlow() {
  if (!existsSync(join(ROOT, 'dist'))) {
    console.error('Error: dist/ directory not found. Run "npm run build" first.');
    process.exit(1);
  }

  const args = process.argv.slice(3);
  const flowText = await readFlowText(args, 'run');
  const { runner, model, stateDir } = readRunnerOptions(args);

  if (runner === 'codex') {
    await runCodexFlow(flowText, model, stateDir);
    return;
  }

  if (runner === 'opencode') {
    await runOpenCodeFlow(flowText, model, stateDir);
    return;
  }

  if (runner === 'ollama') {
    await runOllamaFlow(flowText, model, stateDir);
    return;
  }

  if (runner !== 'claude') {
    console.error(
      `Error: Unsupported runner "${runner}". Supported runners: claude, codex, opencode, ollama.`,
    );
    process.exit(1);
  }

  const { execFileSync } = await import('node:child_process');
  const claudeCommand = process.platform === 'win32' ? 'claude.cmd' : 'claude';
  const claudeArgs = ['-p', '--dangerously-skip-permissions'];
  if (model) {
    claudeArgs.push('--model', model);
  }
  claudeArgs.push(flowText);
  execFileSync(claudeCommand, claudeArgs, {
    stdio: 'inherit',
    timeout: 600_000,
  });
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

async function statusCodex() {
  const version = await readPluginVersion().catch(() => 'unknown');
  const PLUGINS_DIR = join(CODEX_CACHE_DIR, 'prompt-language', version);

  let installed = false;
  try {
    await fs.access(PLUGINS_DIR);
    installed = true;
  } catch {
    // not installed
  }

  const registry = await readJsonSafe(CODEX_INSTALLED_PLUGINS_PATH);
  const registered = !!registry?.plugins?.[PLUGIN_KEY];

  const settings = await readJsonSafe(CODEX_SETTINGS_PATH);
  const enabled = !!settings?.enabledPlugins?.[PLUGIN_KEY];
  const marketplace = !!settings?.extraKnownMarketplaces?.[MARKETPLACE_NAME];

  let configEnabled = false;
  try {
    const raw = await fs.readFile(CODEX_CONFIG_PATH, 'utf8');
    configEnabled = /codex_hooks\s*=\s*true/i.test(raw);
  } catch {
    // not configured
  }

  console.log(`prompt-language Codex scaffold v${version}`);
  console.log(`  Installed:    ${installed ? 'yes' : 'no'}${installed ? ` (${PLUGINS_DIR})` : ''}`);
  console.log(`  Registered:   ${registered ? 'yes' : 'no'}`);
  console.log(`  Marketplace:  ${marketplace ? 'yes' : 'no'}`);
  console.log(`  Enabled:      ${enabled ? 'yes' : 'no'}`);
  console.log(`  codex_hooks:  ${configEnabled ? 'yes' : 'no'}`);

  if (!installed || !registered || !enabled || !marketplace || !configEnabled) {
    console.log('\nRun "npx @45ck/prompt-language codex-install" to install the Codex scaffold.');
  }
}

async function enableCodexHooksConfig() {
  try {
    const raw = await fs.readFile(CODEX_CONFIG_PATH, 'utf8');
    if (/codex_hooks\s*=\s*true/i.test(raw)) {
      return;
    }

    const updated = insertOrUpdateCodexHooks(raw, true);
    await fs.writeFile(CODEX_CONFIG_PATH, updated, 'utf8');
    console.log('  Enabled codex_hooks in config.toml');
    return;
  } catch {
    // create a minimal config if it does not exist
  }

  await ensureDir(CODEX_DIR);
  await fs.writeFile(
    CODEX_CONFIG_PATH,
    '# prompt-language Codex scaffold.\n# Codex hooks are experimental; opt in explicitly before using the local install.\n\n[features]\ncodex_hooks = true\n',
    'utf8',
  );
  console.log('  Wrote config.toml with codex_hooks = true');
}

async function disableCodexHooksConfig() {
  try {
    const raw = await fs.readFile(CODEX_CONFIG_PATH, 'utf8');
    if (!/codex_hooks\s*=\s*true/i.test(raw)) {
      return;
    }

    const updated = insertOrUpdateCodexHooks(raw, false);
    await fs.writeFile(CODEX_CONFIG_PATH, updated, 'utf8');
    console.log('  Removed codex_hooks from config.toml');
  } catch {
    // ignore — config may not exist
  }
}

function insertOrUpdateCodexHooks(raw, enabled) {
  const normalized = raw.replace(/\r\n/g, '\n');
  const lines = normalized.split('\n');
  const featuresIndex = lines.findIndex((line) => line.trim() === '[features]');

  if (featuresIndex === -1) {
    if (!enabled) {
      return raw;
    }
    const prefix = normalized.trim().length > 0 ? `${normalized.trimEnd()}\n\n` : '';
    return `${prefix}[features]\ncodex_hooks = true\n`;
  }

  let nextSectionIndex = lines.length;
  for (let i = featuresIndex + 1; i < lines.length; i += 1) {
    if (lines[i].startsWith('[')) {
      nextSectionIndex = i;
      break;
    }
  }

  const sectionLines = lines.slice(featuresIndex + 1, nextSectionIndex);
  const codexLineIndex = sectionLines.findIndex((line) =>
    /^\s*codex_hooks\s*=\s*true\s*$/.test(line),
  );

  if (enabled) {
    if (codexLineIndex >= 0) {
      return normalized.endsWith('\n') ? normalized : `${normalized}\n`;
    }
    lines.splice(nextSectionIndex, 0, 'codex_hooks = true');
    return lines.join('\n').replace(/\n+$/, '\n');
  }

  if (codexLineIndex >= 0) {
    lines.splice(featuresIndex + 1 + codexLineIndex, 1);
    return lines.join('\n').replace(/\n+$/, '\n');
  }

  return normalized.endsWith('\n') ? normalized : `${normalized}\n`;
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

  console.log(`[prompt-language CI] Running flow via ${runner}...`);
  try {
    if (runner === 'codex') {
      await runCodexFlow(flowText, model, stateDir);
    } else if (runner === 'opencode') {
      await runOpenCodeFlow(flowText, model, stateDir);
    } else if (runner === 'ollama') {
      await runOllamaFlow(flowText, model, stateDir);
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
    } else {
      throw new Error(
        `Unsupported runner "${runner}". Supported runners: claude, codex, opencode, ollama.`,
      );
    }
    console.log('[prompt-language CI] Flow completed.');
    process.exit(0);
  } catch (error) {
    console.error(
      `[prompt-language CI] Flow failed with exit code ${error.status ?? 1}: ${error.message ?? error}`,
    );
    process.exit(error.status ?? 1);
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
  validate     Parse, lint, score, and render a flow without executing it
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
