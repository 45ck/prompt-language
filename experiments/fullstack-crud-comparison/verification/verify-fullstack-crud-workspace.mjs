#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, relative } from 'node:path';

const EXCLUDED_DIRS = new Set([
  '.git',
  '.prompt-language',
  'node_modules',
  'dist',
  'build',
  '.next',
  'coverage',
]);
const TEXT_EXTENSIONS = new Set([
  '.js',
  '.jsx',
  '.ts',
  '.tsx',
  '.json',
  '.md',
  '.html',
  '.css',
  '.mjs',
  '.cjs',
]);
const ENTITY_TERMS = {
  customers: ['customer', 'customers', 'customerId'],
  assets: ['asset', 'assets', 'assetId'],
  workOrders: ['workOrder', 'workOrders', 'work order', 'work orders', 'work_order'],
};
const CRUD_TERMS = ['list', 'create', 'edit', 'detail', 'delete'];
const RULE_TERMS = [
  'customerId',
  'assetId',
  'completedAt',
  'open',
  'scheduled',
  'in_progress',
  'completed',
  'cancelled',
  'urgent',
];
const DOMAIN_BEHAVIOR_PROBE = String.raw`
const path = require('node:path');
const workspace = process.argv[1];
const domain = require(path.join(workspace, 'src', 'domain.js'));
const failures = [];

function requireFunction(name) {
  if (typeof domain[name] !== 'function') failures.push('missing_export:' + name);
  return domain[name];
}

function assert(condition, label) {
  if (!condition) failures.push(label);
}

function mustThrow(label, operation) {
  try {
    operation();
    failures.push('expected_throw:' + label);
  } catch {
    // Expected.
  }
}

function idOf(value, label) {
  assert(value && (typeof value.id === 'string' || typeof value.id === 'number'), label);
  return value && value.id;
}

const names = [
  'reset',
  'listCustomers',
  'createCustomer',
  'readCustomer',
  'detailCustomer',
  'editCustomer',
  'deleteCustomer',
  'listAssets',
  'createAsset',
  'readAsset',
  'detailAsset',
  'editAsset',
  'deleteAsset',
  'listWorkOrders',
  'createWorkOrder',
  'readWorkOrder',
  'detailWorkOrder',
  'editWorkOrder',
  'deleteWorkOrder',
];
for (const name of names) requireFunction(name);
if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exit(1);
}

domain.reset();
const customerA = domain.createCustomer({ name: 'Acme Field Services' });
const customerB = domain.createCustomer({ name: 'Beta Manufacturing' });
const customerAId = idOf(customerA, 'customer_id_missing');
const customerBId = idOf(customerB, 'customer_id_missing');
assert(domain.listCustomers().length === 2, 'customer_list_count');
assert(domain.readCustomer(customerAId).name === 'Acme Field Services', 'customer_read');
assert(domain.detailCustomer(customerAId).id === customerAId, 'customer_detail');
assert(domain.editCustomer(customerAId, { name: 'Acme Updated' }).name === 'Acme Updated', 'customer_edit');

const assetA = domain.createAsset({ customerId: customerAId, name: 'Truck 7' });
const assetB = domain.createAsset({ customerId: customerBId, name: 'Pump 2' });
const assetAId = idOf(assetA, 'asset_id_missing');
const assetBId = idOf(assetB, 'asset_id_missing');
assert(domain.listAssets().length === 2, 'asset_list_count');
assert(domain.readAsset(assetAId).customerId === customerAId, 'asset_read');
assert(domain.detailAsset(assetAId).id === assetAId, 'asset_detail');
assert(domain.editAsset(assetAId, { name: 'Truck 7A' }).name === 'Truck 7A', 'asset_edit');

mustThrow('unknown_customer', () =>
  domain.createWorkOrder({ customerId: 'missing', assetId: assetAId, status: 'open' }),
);
mustThrow('unknown_asset', () =>
  domain.createWorkOrder({ customerId: customerAId, assetId: 'missing', status: 'open' }),
);
mustThrow('asset_customer_mismatch', () =>
  domain.createWorkOrder({ customerId: customerAId, assetId: assetBId, status: 'open' }),
);
mustThrow('completed_requires_completedAt', () =>
  domain.createWorkOrder({
    customerId: customerAId,
    assetId: assetAId,
    status: 'completed',
    priority: 'normal',
  }),
);
mustThrow('non_completed_rejects_completedAt', () =>
  domain.createWorkOrder({
    customerId: customerAId,
    assetId: assetAId,
    status: 'open',
    priority: 'normal',
    completedAt: '2026-04-30T00:00:00Z',
  }),
);

const workOrder = domain.createWorkOrder({
  customerId: customerAId,
  assetId: assetAId,
  status: 'open',
  priority: 'urgent',
  title: 'Repair hydraulic lift',
});
const workOrderId = idOf(workOrder, 'work_order_id_missing');
assert(domain.listWorkOrders().length === 1, 'work_order_list_count');
assert(domain.readWorkOrder(workOrderId).priority === 'urgent', 'work_order_read');
assert(domain.detailWorkOrder(workOrderId).assetId === assetAId, 'work_order_detail');
assert(
  domain.editWorkOrder(workOrderId, {
    status: 'completed',
    completedAt: '2026-04-30T00:00:00Z',
  }).status === 'completed',
  'work_order_edit_completed',
);
domain.deleteWorkOrder(workOrderId);
assert(
  !domain.listWorkOrders().some((item) => item.id === workOrderId && !item.deleted && !item.deletedAt),
  'work_order_delete_safe',
);

const linked = domain.createWorkOrder({
  customerId: customerAId,
  assetId: assetAId,
  status: 'scheduled',
  priority: 'normal',
});
let customerDeleteBlocked = false;
try {
  domain.deleteCustomer(customerAId);
} catch {
  customerDeleteBlocked = true;
}
if (!customerDeleteBlocked) {
  assert(
    !domain.listWorkOrders().some((item) => item.customerId === customerAId && !item.deleted && !item.deletedAt),
    'customer_delete_left_dangling_work_order',
  );
}
assert(domain.readCustomer(customerBId).id === customerBId, 'unrelated_customer_preserved');
assert(domain.readAsset(assetBId).id === assetBId, 'unrelated_asset_preserved');
assert(linked, 'linked_work_order_created');

if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exit(1);
}
`;

function parseArgs(argv) {
  const options = { workspace: process.cwd(), json: false, runTests: true };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--json') {
      options.json = true;
      continue;
    }
    if (arg === '--no-run-tests') {
      options.runTests = false;
      continue;
    }
    if (arg === '--workspace') {
      const value = argv[index + 1];
      index += 1;
      if (value == null || value.trim() === '') {
        throw new Error('--workspace requires a path');
      }
      options.workspace = value;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }
  return { ...options, workspace: resolve(options.workspace) };
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

function extensionOf(path) {
  const index = path.lastIndexOf('.');
  return index === -1 ? '' : path.slice(index);
}

function listTextFiles(root) {
  const files = [];
  function walk(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (!EXCLUDED_DIRS.has(entry.name)) walk(join(dir, entry.name));
        continue;
      }
      if (!entry.isFile()) continue;
      const path = join(dir, entry.name);
      if (TEXT_EXTENSIONS.has(extensionOf(entry.name))) {
        files.push(path);
      }
    }
  }
  if (existsSync(root)) walk(root);
  return files.sort((left, right) => left.localeCompare(right));
}

function readCorpus(files) {
  return files
    .map((file) => {
      try {
        return readFileSync(file, 'utf8');
      } catch {
        return '';
      }
    })
    .join('\n')
    .toLowerCase();
}

function relativeTextPath(root, file) {
  return relative(root, file).replaceAll('\\', '/');
}

function checkFileExists(root, relativePath) {
  return existsSync(join(root, relativePath));
}

function hasAny(corpus, terms) {
  return terms.some((term) => corpus.includes(term.toLowerCase()));
}

function countEntityCoverage(corpus) {
  return Object.fromEntries(
    Object.entries(ENTITY_TERMS).map(([entity, terms]) => [entity, hasAny(corpus, terms)]),
  );
}

function countCrudCoverage(corpus) {
  return Object.fromEntries(CRUD_TERMS.map((term) => [term, corpus.includes(term)]));
}

function hasTestFile(workspace, files) {
  return files
    .map((file) => relativeTextPath(workspace, file).toLowerCase())
    .some(
      (path) =>
        path === 'test.js' ||
        path === 'test.mjs' ||
        path.startsWith('tests/') ||
        path.startsWith('__tests__/') ||
        path.includes('/tests/') ||
        path.includes('/__tests__/') ||
        /\.(test|spec)\.[cm]?[jt]sx?$/.test(path),
    );
}

function hasSeedData(workspace, files, corpus) {
  return (
    checkFileExists(workspace, 'data/seed.json') ||
    files
      .map((file) => relativeTextPath(workspace, file).toLowerCase())
      .some((path) => /(^|\/)seed[-_.a-z0-9]*\.(json|js|mjs|cjs|ts)$/.test(path)) ||
    corpus.includes('seed data')
  );
}

function validateSeedIntegrity(workspace) {
  const seed = readJson(join(workspace, 'data', 'seed.json'));
  const failures = [];
  if (seed === null || typeof seed !== 'object' || Array.isArray(seed)) {
    return { passed: false, failures: ['seed_json_missing_or_invalid'], counts: {} };
  }

  const customers = Array.isArray(seed.customers) ? seed.customers : [];
  const assets = Array.isArray(seed.assets) ? seed.assets : [];
  const workOrders = Array.isArray(seed.work_orders)
    ? seed.work_orders
    : Array.isArray(seed.workOrders)
      ? seed.workOrders
      : [];
  const customerIds = new Set(customers.map((customer) => String(customer.id ?? '')));
  const assetById = new Map(assets.map((asset) => [String(asset.id ?? ''), asset]));
  const validStatuses = new Set(['open', 'scheduled', 'in_progress', 'completed', 'cancelled']);
  const validPriorities = new Set(['low', 'normal', 'urgent']);

  if (customers.length < 2) failures.push('seed_customers_lt_2');
  if (assets.length < 3) failures.push('seed_assets_lt_3');
  if (workOrders.length < 3) failures.push('seed_work_orders_lt_3');
  if (customers.some((customer) => !customer.id)) failures.push('seed_customer_id_missing');

  for (const asset of assets) {
    if (!asset.id) failures.push('seed_asset_id_missing');
    if (!customerIds.has(String(asset.customerId ?? ''))) {
      failures.push(`seed_asset_customer_missing:${asset.id ?? 'unknown'}`);
    }
  }

  for (const workOrder of workOrders) {
    const asset = assetById.get(String(workOrder.assetId ?? ''));
    const status = String(workOrder.status ?? '');
    const priority = String(workOrder.priority ?? '');
    if (!workOrder.id) failures.push('seed_work_order_id_missing');
    if (!customerIds.has(String(workOrder.customerId ?? ''))) {
      failures.push(`seed_work_order_customer_missing:${workOrder.id ?? 'unknown'}`);
    }
    if (!asset) {
      failures.push(`seed_work_order_asset_missing:${workOrder.id ?? 'unknown'}`);
    } else if (String(asset.customerId ?? '') !== String(workOrder.customerId ?? '')) {
      failures.push(`seed_work_order_asset_customer_mismatch:${workOrder.id ?? 'unknown'}`);
    }
    if (!validStatuses.has(status)) failures.push(`seed_work_order_status_invalid:${status}`);
    if (!validPriorities.has(priority))
      failures.push(`seed_work_order_priority_invalid:${priority}`);
    if (status === 'completed' && !workOrder.completedAt) {
      failures.push(`seed_completed_missing_completedAt:${workOrder.id ?? 'unknown'}`);
    }
    if (status !== 'completed' && workOrder.completedAt) {
      failures.push(`seed_non_completed_has_completedAt:${workOrder.id ?? 'unknown'}`);
    }
  }

  return {
    passed: failures.length === 0,
    failures,
    counts: {
      customers: customers.length,
      assets: assets.length,
      workOrders: workOrders.length,
    },
  };
}

function runDomainBehaviorProbe(workspace) {
  const domainPath = join(workspace, 'src', 'domain.js');
  if (!existsSync(domainPath)) {
    return {
      skipped: false,
      passed: false,
      exitCode: 1,
      stdout: '',
      stderr: 'src/domain.js is missing',
    };
  }

  const result = spawnSync(process.execPath, ['-e', DOMAIN_BEHAVIOR_PROBE, workspace], {
    cwd: workspace,
    encoding: 'utf8',
    timeout: 30_000,
    maxBuffer: 1024 * 1024,
    windowsHide: true,
  });
  const exitCode = result.status ?? (result.signal ? 124 : 1);
  return {
    skipped: false,
    passed: exitCode === 0,
    exitCode,
    timedOut: result.error?.code === 'ETIMEDOUT',
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? String(result.error ?? ''),
  };
}

function runNpmTest(workspace, enabled, packageJson) {
  if (!enabled) {
    return { skipped: true, exitCode: null, stdout: '', stderr: '', durationMs: 0 };
  }

  if (packageJson === null || typeof packageJson?.scripts?.test !== 'string') {
    return {
      skipped: false,
      exitCode: 1,
      timedOut: false,
      stdout: '',
      stderr: 'package.json is missing or does not declare a test script; npm test was not run.',
      durationMs: 0,
    };
  }

  const started = Date.now();
  const result = spawnSync(process.platform === 'win32' ? 'cmd.exe' : 'npm', npmTestArgs(), {
    cwd: workspace,
    encoding: 'utf8',
    timeout: 300_000,
    maxBuffer: 8 * 1024 * 1024,
    windowsHide: true,
  });

  return {
    skipped: false,
    exitCode: result.status ?? (result.signal ? 124 : 1),
    timedOut: result.error?.code === 'ETIMEDOUT',
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? String(result.error ?? ''),
    durationMs: Date.now() - started,
  };
}

function npmTestArgs() {
  if (process.platform === 'win32') {
    return ['/d', '/s', '/c', 'npm test'];
  }
  return ['test'];
}

function scoreWorkspace(workspace, packageJson, files, corpus, testResult) {
  const entityCoverage = countEntityCoverage(corpus);
  const crudCoverage = countCrudCoverage(corpus);
  const ruleCoverage = Object.fromEntries(
    RULE_TERMS.map((term) => [term, corpus.includes(term.toLowerCase())]),
  );
  const seedIntegrity = validateSeedIntegrity(workspace);
  const domainBehavior = runDomainBehaviorProbe(workspace);
  const checks = {
    packageJson: packageJson !== null,
    readme: checkFileExists(workspace, 'README.md'),
    runManifest: checkFileExists(workspace, 'run-manifest.json'),
    verificationReport: checkFileExists(workspace, 'verification-report.md'),
    browserUi: checkFileExists(workspace, 'public/index.html'),
    testScript: typeof packageJson?.scripts?.test === 'string',
    runScript:
      typeof packageJson?.scripts?.dev === 'string' ||
      typeof packageJson?.scripts?.start === 'string',
    allEntities: Object.values(entityCoverage).every(Boolean),
    allCrudTerms: Object.values(crudCoverage).every(Boolean),
    relationshipRules: ['customerId', 'assetId', 'completedAt'].every((term) =>
      corpus.includes(term.toLowerCase()),
    ),
    statusRules: ['open', 'scheduled', 'in_progress', 'completed', 'cancelled'].every((term) =>
      corpus.includes(term),
    ),
    priorityRules: ['low', 'normal', 'urgent'].every((term) => corpus.includes(term)),
    seedData: hasSeedData(workspace, files, corpus),
    seedIntegrity: seedIntegrity.passed,
    testsPresent: hasTestFile(workspace, files),
    npmTestPassed: testResult.skipped ? null : testResult.exitCode === 0,
    domainBehavior: domainBehavior.passed,
  };

  const score = [
    checks.packageJson ? 10 : 0,
    checks.readme ? 5 : 0,
    checks.runManifest ? 4 : 0,
    checks.verificationReport ? 4 : 0,
    checks.testScript ? 7 : 0,
    checks.runScript ? 5 : 0,
    checks.browserUi ? 4 : 0,
    checks.allEntities ? 8 : 0,
    checks.allCrudTerms ? 5 : 0,
    checks.relationshipRules ? 5 : 0,
    checks.statusRules ? 4 : 0,
    checks.priorityRules ? 3 : 0,
    checks.seedData ? 4 : 0,
    checks.seedIntegrity ? 8 : 0,
    checks.testsPresent ? 4 : 0,
    checks.npmTestPassed === true ? 5 : 0,
    checks.domainBehavior ? 15 : 0,
  ].reduce((sum, value) => sum + value, 0);

  return {
    score,
    checks,
    entityCoverage,
    crudCoverage,
    ruleCoverage,
    seedIntegrity,
    domainBehavior,
  };
}

function hardFailures(workspace, scoreResult) {
  const failures = [];
  if (!existsSync(workspace) || !statSync(workspace).isDirectory()) {
    failures.push('workspace_missing');
  }
  if (!scoreResult.checks.packageJson) failures.push('package_json_missing_or_invalid');
  if (!scoreResult.checks.browserUi) failures.push('browser_ui_missing');
  if (!scoreResult.checks.allEntities) failures.push('required_entity_family_missing');
  if (!scoreResult.checks.testScript) failures.push('test_script_missing');
  if (!scoreResult.checks.testsPresent) failures.push('tests_missing');
  if (scoreResult.checks.npmTestPassed === false) failures.push('npm_test_failed');
  if (!scoreResult.checks.seedIntegrity) failures.push('seed_integrity_failed');
  if (!scoreResult.checks.domainBehavior) failures.push('domain_behavior_failed');
  return failures;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const packageJson = readJson(join(options.workspace, 'package.json'));
  const files = listTextFiles(options.workspace);
  const corpus = readCorpus(files);
  const testResult = runNpmTest(options.workspace, options.runTests, packageJson);
  const scoreResult = scoreWorkspace(options.workspace, packageJson, files, corpus, testResult);
  const failures = hardFailures(options.workspace, scoreResult);
  const passed = failures.length === 0 && scoreResult.score >= 80;
  const report = {
    verifier: 'fullstack-crud-workspace',
    workspace: options.workspace,
    fileCount: files.length,
    files: files.map((file) => relativeTextPath(options.workspace, file)),
    passed,
    hardFailures: failures,
    score: scoreResult.score,
    maxScore: 100,
    ...scoreResult,
    npmTest: testResult,
  };

  if (options.json) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    process.stdout.write(
      [
        `FSCRUD verifier: ${passed ? 'PASS' : 'FAIL'}`,
        `score: ${scoreResult.score}/100`,
        `hard failures: ${failures.length === 0 ? 'none' : failures.join(', ')}`,
      ].join('\n') + '\n',
    );
  }

  process.exitCode = passed ? 0 : 1;
}

main();
