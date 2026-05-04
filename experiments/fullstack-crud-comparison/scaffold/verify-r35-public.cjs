#!/usr/bin/env node
'use strict';

const { existsSync, readdirSync, readFileSync } = require('node:fs');
const { join } = require('node:path');
const { spawnSync } = require('node:child_process');

const workspace = process.argv[2] || 'workspace/fscrud-01';
const attemptRoot = process.cwd();

function fail(message) {
  console.error(message);
  process.exit(1);
}

function assertExists(relativePath) {
  const fullPath = join(attemptRoot, relativePath);
  if (!existsSync(fullPath)) {
    fail(`missing_file:${relativePath}`);
  }
  return fullPath;
}

function readWorkspaceFile(relativePath) {
  return readFileSync(assertExists(join(workspace, relativePath)), 'utf8');
}

function listFiles(root, prefix = '') {
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
    const fullPath = join(root, entry.name);
    return entry.isDirectory() ? listFiles(fullPath, relativePath) : [relativePath];
  });
}

for (const leak of ['src/domain.js', 'src/server.js', 'public/index.html']) {
  if (existsSync(join(attemptRoot, leak))) {
    fail(`run_root_leak:${leak}`);
  }
}

for (const nestedRoot of listFiles(join(attemptRoot, workspace)).filter((path) =>
  path.startsWith('fscrud-01/'),
)) {
  fail(`nested_app_root:${nestedRoot}`);
}

for (const relativePath of [
  'src/domain.js',
  'src/server.js',
  'public/index.html',
  'README.md',
  'run-manifest.json',
  'verification-report.md',
]) {
  assertExists(join(workspace, relativePath));
}

const domain = readWorkspaceFile('src/domain.js');
if (domain.includes('not implemented')) {
  fail('domain_kernel_not_preserved');
}

const server = readWorkspaceFile('src/server.js').toLowerCase();
for (const term of ["require('./domain.js')", 'customers', 'assets', 'work_orders']) {
  if (!server.includes(term)) {
    fail(`server_term_missing:${term}`);
  }
}

const ui = readWorkspaceFile('public/index.html').toLowerCase();
for (const term of [
  'customers',
  'assets',
  'work_orders',
  'list',
  'create',
  'edit',
  'detail',
  'delete',
  'customerid',
  'assetid',
  'status',
  'open',
  'scheduled',
  'in_progress',
  'completed',
  'cancelled',
  'priority',
  'low',
  'normal',
  'urgent',
  'completedat',
]) {
  if (!ui.includes(term)) {
    fail(`ui_skeleton_term_missing:${term}`);
  }
}

const manifest = readWorkspaceFile('run-manifest.json').toLowerCase();
for (const term of [
  'r35-pl-handoff-artifacts',
  'deterministic-domain-kernel',
  'deterministic-ui-skeleton',
  'deterministic-server-integration',
  'local-generated-handoff-artifacts',
  'local-only',
]) {
  if (!manifest.includes(term)) {
    fail(`manifest_term_missing:${term}`);
  }
}

const readme = readWorkspaceFile('README.md').toLowerCase();
for (const term of ['npm test', 'npm start', 'deterministic', 'handoff']) {
  if (!readme.includes(term)) {
    fail(`readme_term_missing:${term}`);
  }
}

const report = readWorkspaceFile('verification-report.md').toLowerCase();
for (const term of ['check:domain:exports', 'hidden verifier', 'r35', 'handoff']) {
  if (!report.includes(term)) {
    fail(`verification_report_term_missing:${term}`);
  }
}

const publicChecks = [
  'npm run check:domain:exports',
  'npm run check:domain:customer',
  'npm run check:domain:assets',
  'npm run check:domain:work-orders',
  'npm test',
];

for (const command of publicChecks) {
  const result = spawnSync(command, {
    cwd: join(attemptRoot, workspace),
    encoding: 'utf8',
    shell: true,
    stdio: 'inherit',
  });
  if (result.status !== 0) {
    fail(`public_check_failed:${command}`);
  }
}

console.log('r35_public_gate_ok');
