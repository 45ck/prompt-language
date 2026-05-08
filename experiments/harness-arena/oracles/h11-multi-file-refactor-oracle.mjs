#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';

const require = createRequire(import.meta.url);
const REQUIRED_SRC_FILES = [
  'src/app.js',
  'src/client-store.js',
  'src/client.js',
  'src/routes.js',
  'src/seed.js',
  'src/test.js',
];

function parseWorkspace(argv) {
  const index = argv.indexOf('--workspace');
  const value = index >= 0 ? argv[index + 1] : argv.at(-1);
  if (!value) throw new Error('usage: h11-multi-file-refactor-oracle.mjs --workspace <workspace>');
  return resolve(value);
}

function record(results, name, fn) {
  try {
    fn();
    results.push({ name, passed: true });
  } catch (error) {
    results.push({ name, passed: false, message: error.message });
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertEqual(actual, expected, message) {
  const actualJson = JSON.stringify(actual);
  const expectedJson = JSON.stringify(expected);
  assert(actualJson === expectedJson, `${message}: expected ${expectedJson}, got ${actualJson}`);
}

function listJsFiles(root) {
  const files = [];
  function walk(relativeDir) {
    const absoluteDir = join(root, ...relativeDir.split('/').filter(Boolean));
    for (const entry of readdirSync(absoluteDir, { withFileTypes: true })) {
      const relativePath = relativeDir ? `${relativeDir}/${entry.name}` : entry.name;
      if (entry.isDirectory()) walk(relativePath);
      else if (entry.isFile() && entry.name.endsWith('.js')) files.push(relativePath);
    }
  }
  walk('src');
  return files.sort();
}

function readWorkspaceFile(workspace, relativePath) {
  const path = join(workspace, ...relativePath.split('/'));
  assert(existsSync(path), `missing ${relativePath}`);
  return readFileSync(path, 'utf8');
}

function runCommand(workspace, command, args) {
  const result = spawnSync(command, args, {
    cwd: workspace,
    encoding: 'utf8',
    timeout: 10_000,
    windowsHide: true,
  });
  assert(
    result.status === 0,
    `${[command, ...args].join(' ')} failed:\n${result.stdout}\n${result.stderr}`,
  );
  return result;
}

function loadModule(workspace, relativePath) {
  const modulePath = join(workspace, ...relativePath.split('/'));
  delete require.cache[require.resolve(modulePath)];
  return require(modulePath);
}

function runRenameStructureChecks(workspace) {
  const jsFiles = listJsFiles(workspace);
  for (const file of REQUIRED_SRC_FILES) {
    assert(jsFiles.includes(file), `required renamed file missing: ${file}`);
  }

  const oldFiles = jsFiles.filter((file) => /contact/i.test(basename(file)));
  assert(oldFiles.length === 0, `old contact filenames remain: ${oldFiles.join(', ')}`);

  const scannedFiles = [...jsFiles, 'README.md'].filter((file) =>
    existsSync(join(workspace, ...file.split('/'))),
  );
  const offenders = [];
  for (const file of scannedFiles) {
    const text = readWorkspaceFile(workspace, file);
    if (/\bContacts?\b/.test(text) || /\bcontact(s)?\b/.test(text)) {
      offenders.push(file);
    }
  }
  assert(offenders.length === 0, `Contact terminology remains in ${offenders.join(', ')}`);
}

function runPublicChecks(workspace) {
  runCommand(workspace, 'npm', ['test']);
  runCommand(workspace, process.execPath, ['src/app.js']);
}

function runHiddenApiChecks(workspace) {
  const { Client } = loadModule(workspace, 'src/client.js');
  const { ClientStore } = loadModule(workspace, 'src/client-store.js');
  const { createRoutes } = loadModule(workspace, 'src/routes.js');
  const seed = loadModule(workspace, 'src/seed.js');

  assert(typeof Client === 'function', 'Client export missing');
  assert(typeof ClientStore === 'function', 'ClientStore export missing');
  assert(typeof createRoutes === 'function', 'createRoutes export missing');
  assert(Array.isArray(seed.seedClients), 'seedClients export missing');
  assert(typeof seed.loadSeedData === 'function', 'loadSeedData export missing');

  const client = new Client('Alice', 'alice@example.com', '555-0101', 'Acme');
  assertEqual(
    client.toJSON(),
    {
      name: 'Alice',
      email: 'alice@example.com',
      phone: '555-0101',
      company: 'Acme',
      createdAt: client.createdAt,
    },
    'Client toJSON changed',
  );
  assertEqual(client.getDisplayName(), 'Alice (Acme)', 'Client display name changed');

  const store = new ClientStore();
  const loaded = seed.loadSeedData(store);
  assert(loaded >= 5, 'seed load count changed');
  assert(store.count() === loaded, 'ClientStore count mismatch');
  assert(store.findByEmail('alice@example.com')?.name === 'Alice Johnson', 'findByEmail changed');
  assert(store.findByCompany('Acme Corp').length === 2, 'findByCompany changed');
}

function runHiddenRouteChecks(workspace) {
  const { ClientStore } = loadModule(workspace, 'src/client-store.js');
  const { createRoutes } = loadModule(workspace, 'src/routes.js');
  const { loadSeedData } = loadModule(workspace, 'src/seed.js');

  const store = new ClientStore();
  loadSeedData(store);
  const routes = createRoutes(store);
  assertEqual(
    Object.keys(routes).sort(),
    ['createClient', 'deleteClient', 'getClient', 'listClients'],
    'route names changed',
  );
  assert(routes.listClients().status === 200, 'listClients failed');
  assert(routes.getClient('alice@example.com').status === 200, 'getClient failed');
  assert(routes.getClient('missing@example.com').status === 404, 'getClient 404 failed');
  assert(
    routes.createClient({
      name: 'Frank Moore',
      email: 'frank@example.com',
      phone: '555-0106',
      company: 'Initrode',
    }).status === 201,
    'createClient failed',
  );
  assert(routes.createClient({ name: 'Frank Again', email: 'frank@example.com' }).status === 409);
  assert(routes.deleteClient('frank@example.com').status === 204, 'deleteClient failed');
}

function main() {
  const workspace = parseWorkspace(process.argv.slice(2));
  const results = [];

  record(results, 'rename structure is complete', () => runRenameStructureChecks(workspace));
  record(results, 'public tests and app smoke pass', () => runPublicChecks(workspace));
  record(results, 'hidden Client API checks pass', () => runHiddenApiChecks(workspace));
  record(results, 'hidden Client route checks pass', () => runHiddenRouteChecks(workspace));

  const failed = results.filter((result) => !result.passed);
  for (const result of results) {
    const prefix = result.passed ? 'PASS' : 'FAIL';
    console.log(`${prefix}: ${result.name}${result.message ? ` -- ${result.message}` : ''}`);
  }
  console.log(`\nResults: ${results.length - failed.length}/${results.length} passed`);
  if (failed.length > 0) process.exit(1);
}

try {
  main();
} catch (error) {
  console.error(error?.stack ?? error);
  process.exit(2);
}
