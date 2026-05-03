// cspell:ignore fscrud
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = resolve(__dirname, '..', '..');
const VERIFY_SCRIPT = join(
  ROOT,
  'experiments',
  'fullstack-crud-comparison',
  'verification',
  'verify-fullstack-crud-workspace.mjs',
);
const SCAFFOLD_SCRIPT = join(
  ROOT,
  'experiments',
  'fullstack-crud-comparison',
  'scaffold',
  'write-scaffold-contract.cjs',
);

function runVerifier(workspace: string, extraArgs: string[] = []) {
  return spawnSync(
    process.execPath,
    [VERIFY_SCRIPT, '--workspace', workspace, '--json', ...extraArgs],
    {
      cwd: ROOT,
      encoding: 'utf8',
      timeout: 30_000,
    },
  );
}

function writeValidWorkspace(workspace: string): void {
  mkdirSync(join(workspace, 'src'), { recursive: true });
  mkdirSync(join(workspace, 'public'), { recursive: true });
  mkdirSync(join(workspace, '__tests__'), { recursive: true });
  mkdirSync(join(workspace, 'data'), { recursive: true });
  writeFileSync(
    join(workspace, 'package.json'),
    JSON.stringify(
      {
        scripts: {
          test: 'node --test',
          start: 'node src/server.js',
        },
      },
      null,
      2,
    ),
  );
  writeFileSync(join(workspace, 'README.md'), 'Install, test, and run the app with npm scripts.');
  writeFileSync(join(workspace, 'run-manifest.json'), '{}');
  writeFileSync(join(workspace, 'verification-report.md'), 'npm test passed.');
  writeFileSync(
    join(workspace, 'public', 'index.html'),
    '<h1>customers assets work_orders</h1><button>list create edit detail delete</button>',
  );
  writeFileSync(
    join(workspace, '__tests__', 'domain.test.js'),
    [
      "const test = require('node:test');",
      "const assert = require('node:assert/strict');",
      "const domain = require('../src/domain.js');",
      "test('domain rules pass', () => {",
      '  domain.reset();',
      "  const customer = domain.createCustomer({ name: 'Acme' });",
      "  const asset = domain.createAsset({ customerId: customer.id, name: 'Truck' });",
      "  const workOrder = domain.createWorkOrder({ customerId: customer.id, assetId: asset.id, status: 'open', priority: 'urgent' });",
      "  assert.equal(domain.readWorkOrder(workOrder.id).priority, 'urgent');",
      '});',
    ].join('\n'),
  );
  writeFileSync(
    join(workspace, 'src', 'domain.js'),
    [
      'const store = { customers: [], assets: [], work_orders: [] };',
      'const counters = { customers: 1, assets: 1, work_orders: 1 };',
      "const statuses = ['open', 'scheduled', 'in_progress', 'completed', 'cancelled'];",
      "const priorities = ['low', 'normal', 'urgent'];",
      'const clone = (value) => structuredClone(value);',
      'function reset() {',
      '  store.customers = []; store.assets = []; store.work_orders = [];',
      '  counters.customers = 1; counters.assets = 1; counters.work_orders = 1;',
      '}',
      'function nextId(kind) { return `${kind}-${counters[kind]++}`; }',
      'function active(items) { return items.filter((item) => !item.deletedAt); }',
      'function find(items, id, label) { const found = items.find((item) => item.id === id && !item.deletedAt); if (!found) throw new Error(`${label} not found`); return found; }',
      'function validateStatus(input) {',
      "  if (!statuses.includes(input.status)) throw new Error('invalid status');",
      "  if (input.priority && !priorities.includes(input.priority)) throw new Error('invalid priority');",
      "  if (input.status === 'completed' && !input.completedAt) throw new Error('completedAt required');",
      "  if (input.status !== 'completed' && input.completedAt) throw new Error('completedAt only for completed');",
      '}',
      "function createCustomer(input) { const item = { id: nextId('customers'), name: input.name }; store.customers.push(item); return clone(item); }",
      'function listCustomers() { return clone(active(store.customers)); }',
      "function readCustomer(id) { return clone(find(store.customers, id, 'customer')); }",
      'const detailCustomer = readCustomer;',
      "function editCustomer(id, patch) { const item = find(store.customers, id, 'customer'); Object.assign(item, patch); return clone(item); }",
      "function deleteCustomer(id) { find(store.customers, id, 'customer'); if (active(store.work_orders).some((item) => item.customerId === id)) throw new Error('customer has work_orders'); find(store.customers, id, 'customer').deletedAt = new Date().toISOString(); }",
      "function createAsset(input) { readCustomer(input.customerId); const item = { id: nextId('assets'), customerId: input.customerId, name: input.name }; store.assets.push(item); return clone(item); }",
      'function listAssets() { return clone(active(store.assets)); }',
      "function readAsset(id) { return clone(find(store.assets, id, 'asset')); }",
      'const detailAsset = readAsset;',
      "function editAsset(id, patch) { const item = find(store.assets, id, 'asset'); if (patch.customerId) readCustomer(patch.customerId); Object.assign(item, patch); return clone(item); }",
      "function deleteAsset(id) { find(store.assets, id, 'asset'); if (active(store.work_orders).some((item) => item.assetId === id)) throw new Error('asset has work_orders'); find(store.assets, id, 'asset').deletedAt = new Date().toISOString(); }",
      'function validateWorkOrder(input) {',
      '  const customer = readCustomer(input.customerId);',
      '  const asset = readAsset(input.assetId);',
      "  if (asset.customerId !== customer.id) throw new Error('asset/customer mismatch');",
      '  validateStatus(input);',
      '}',
      "function createWorkOrder(input) { validateWorkOrder(input); const item = { id: nextId('work_orders'), status: input.status, priority: input.priority || 'normal', customerId: input.customerId, assetId: input.assetId, title: input.title || '', completedAt: input.completedAt }; store.work_orders.push(item); return clone(item); }",
      'function listWorkOrders() { return clone(active(store.work_orders)); }',
      "function readWorkOrder(id) { return clone(find(store.work_orders, id, 'work_order')); }",
      'const detailWorkOrder = readWorkOrder;',
      "function editWorkOrder(id, patch) { const item = find(store.work_orders, id, 'work_order'); const next = { ...item, ...patch }; validateWorkOrder(next); Object.assign(item, next); return clone(item); }",
      "function deleteWorkOrder(id) { find(store.work_orders, id, 'work_order').deletedAt = new Date().toISOString(); }",
      'module.exports = { reset, listCustomers, createCustomer, readCustomer, detailCustomer, editCustomer, deleteCustomer, listAssets, createAsset, readAsset, detailAsset, editAsset, deleteAsset, listWorkOrders, createWorkOrder, readWorkOrder, detailWorkOrder, editWorkOrder, deleteWorkOrder };',
    ].join('\n'),
  );
  writeFileSync(
    join(workspace, 'data', 'seed.json'),
    JSON.stringify(
      {
        customers: [
          { id: 'customer-1', name: 'Acme Field Services' },
          { id: 'customer-2', name: 'Beta Manufacturing' },
        ],
        assets: [
          { id: 'asset-1', customerId: 'customer-1', name: 'Truck 7' },
          { id: 'asset-2', customerId: 'customer-1', name: 'Lift 3' },
          { id: 'asset-3', customerId: 'customer-2', name: 'Pump 2' },
        ],
        work_orders: [
          {
            id: 'work-order-1',
            customerId: 'customer-1',
            assetId: 'asset-1',
            status: 'open',
            priority: 'urgent',
          },
          {
            id: 'work-order-2',
            customerId: 'customer-1',
            assetId: 'asset-2',
            status: 'scheduled',
            priority: 'normal',
          },
          {
            id: 'work-order-3',
            customerId: 'customer-2',
            assetId: 'asset-3',
            status: 'completed',
            priority: 'low',
            completedAt: '2026-04-30T00:00:00Z',
          },
        ],
      },
      null,
      2,
    ),
  );
}

describe('FSCRUD verifier script', () => {
  it('passes a workspace with required artifacts, entity terms, rules, and tests', () => {
    const workspace = mkdtempSync(join(tmpdir(), 'fscrud-valid-'));
    writeValidWorkspace(workspace);

    const result = runVerifier(workspace);
    const report = JSON.parse(result.stdout) as {
      passed: boolean;
      score: number;
      checks: {
        browserUi: boolean;
        testsPresent: boolean;
        domainBehavior: boolean;
        seedIntegrity: boolean;
      };
    };

    expect(result.status).toBe(0);
    expect(report.passed).toBe(true);
    expect(report.score).toBeGreaterThanOrEqual(80);
    expect(report.checks.browserUi).toBe(true);
    expect(report.checks.testsPresent).toBe(true);
    expect(report.checks.domainBehavior).toBe(true);
    expect(report.checks.seedIntegrity).toBe(true);
  });

  it('fails when the package and entity surface are missing', () => {
    const workspace = mkdtempSync(join(tmpdir(), 'fscrud-invalid-'));
    writeFileSync(join(workspace, 'README.md'), 'incomplete');

    const result = runVerifier(workspace);
    const report = JSON.parse(result.stdout) as {
      passed: boolean;
      hardFailures: string[];
      checks: { npmTestPassed: boolean };
      npmTest: { exitCode: number; stderr: string; stdout: string };
    };

    expect(result.status).toBe(1);
    expect(report.passed).toBe(false);
    expect(report.hardFailures).toContain('package_json_missing_or_invalid');
    expect(report.checks.npmTestPassed).toBe(false);
    expect(report.npmTest.exitCode).toBe(1);
    expect(report.npmTest.stderr).toContain('package.json is missing');
    expect(report.npmTest.stdout).not.toContain('@45ck/prompt-language');
  });

  it('fails when npm test passes without a real test file', () => {
    const workspace = mkdtempSync(join(tmpdir(), 'fscrud-zero-tests-'));
    mkdirSync(join(workspace, 'src'), { recursive: true });
    mkdirSync(join(workspace, 'public'), { recursive: true });
    writeFileSync(
      join(workspace, 'package.json'),
      JSON.stringify({ scripts: { test: 'node --test', start: 'node src/server.js' } }, null, 2),
    );
    writeFileSync(
      join(workspace, 'public', 'index.html'),
      '<h1>customers assets work_orders</h1><button>list create edit detail delete</button>',
    );
    writeFileSync(
      join(workspace, 'src', 'app.js'),
      [
        'const customers = ["customerId"];',
        'const assets = ["assetId"];',
        'const workOrders = ["workOrder", "work orders"];',
        'const crud = ["list", "create", "edit", "detail", "delete"];',
        'const status = ["open", "scheduled", "in_progress", "completed", "cancelled"];',
        'const priority = ["low", "normal", "urgent"];',
        'const completedAt = "completedAt";',
      ].join('\n'),
    );

    const result = runVerifier(workspace);
    const report = JSON.parse(result.stdout) as {
      hardFailures: string[];
      checks: { testsPresent: boolean; npmTestPassed: boolean };
    };

    expect(result.status).toBe(1);
    expect(report.hardFailures).toContain('tests_missing');
    expect(report.checks.testsPresent).toBe(false);
    expect(report.checks.npmTestPassed).toBe(true);
  });

  it('fails a token-stuffed workspace with placeholder tests', () => {
    const workspace = mkdtempSync(join(tmpdir(), 'fscrud-token-stuffed-'));
    mkdirSync(join(workspace, 'src'), { recursive: true });
    mkdirSync(join(workspace, 'public'), { recursive: true });
    mkdirSync(join(workspace, '__tests__'), { recursive: true });
    mkdirSync(join(workspace, 'data'), { recursive: true });
    writeFileSync(
      join(workspace, 'package.json'),
      JSON.stringify({ scripts: { test: 'node --test', start: 'node src/server.js' } }, null, 2),
    );
    writeFileSync(
      join(workspace, 'README.md'),
      'customers assets work_orders list create edit detail delete',
    );
    writeFileSync(join(workspace, 'run-manifest.json'), '{}');
    writeFileSync(join(workspace, 'verification-report.md'), 'npm test passed.');
    writeFileSync(
      join(workspace, 'public', 'index.html'),
      [
        'customers assets work_orders',
        'customerId assetId completedAt',
        'list create edit detail delete',
        'open scheduled in_progress completed cancelled low normal urgent',
      ].join(' '),
    );
    writeFileSync(
      join(workspace, '__tests__', 'domain.test.js'),
      [
        "const test = require('node:test');",
        "const assert = require('node:assert/strict');",
        "test('placeholder', () => assert.equal(1, 1));",
      ].join('\n'),
    );
    writeFileSync(
      join(workspace, 'src', 'domain.js'),
      'module.exports = { customers: [], assets: [], work_orders: [] };\n',
    );
    writeFileSync(
      join(workspace, 'data', 'seed.json'),
      JSON.stringify({ customers: [], assets: [], work_orders: [] }, null, 2),
    );

    const result = runVerifier(workspace);
    const report = JSON.parse(result.stdout) as {
      hardFailures: string[];
      score: number;
      checks: { domainBehavior: boolean; seedIntegrity: boolean; npmTestPassed: boolean };
    };

    expect(result.status).toBe(1);
    expect(report.checks.npmTestPassed).toBe(true);
    expect(report.checks.domainBehavior).toBe(false);
    expect(report.checks.seedIntegrity).toBe(false);
    expect(report.hardFailures).toContain('domain_behavior_failed');
    expect(report.hardFailures).toContain('seed_integrity_failed');
    expect(report.score).toBeLessThan(80);
  });

  it('fails invalid seed references even when seed keywords are present', () => {
    const workspace = mkdtempSync(join(tmpdir(), 'fscrud-invalid-seed-'));
    writeValidWorkspace(workspace);
    writeFileSync(
      join(workspace, 'data', 'seed.json'),
      JSON.stringify(
        {
          customers: [
            { id: 'customer-1', name: 'Acme' },
            { id: 'customer-2', name: 'Beta' },
          ],
          assets: [
            { id: 'asset-1', customerId: 'customer-1', name: 'Truck' },
            { id: 'asset-2', customerId: 'customer-1', name: 'Lift' },
            { id: 'asset-3', customerId: 'missing', name: 'Pump' },
          ],
          work_orders: [
            {
              id: 'work-order-1',
              customerId: 'customer-2',
              assetId: 'asset-1',
              status: 'completed',
              priority: 'urgent',
            },
            {
              id: 'work-order-2',
              customerId: 'customer-1',
              assetId: 'asset-2',
              status: 'open',
              priority: 'normal',
              completedAt: '2026-04-30T00:00:00Z',
            },
            {
              id: 'work-order-3',
              customerId: 'customer-1',
              assetId: 'asset-2',
              status: 'scheduled',
              priority: 'low',
            },
          ],
        },
        null,
        2,
      ),
    );

    const result = runVerifier(workspace);
    const report = JSON.parse(result.stdout) as {
      hardFailures: string[];
      seedIntegrity: { passed: boolean; failures: string[] };
    };

    expect(result.status).toBe(1);
    expect(report.hardFailures).toContain('seed_integrity_failed');
    expect(report.seedIntegrity.passed).toBe(false);
    expect(report.seedIntegrity.failures).toEqual(
      expect.arrayContaining([
        'seed_asset_customer_missing:asset-3',
        'seed_work_order_asset_customer_mismatch:work-order-1',
        'seed_completed_missing_completedAt:work-order-1',
        'seed_non_completed_has_completedAt:work-order-2',
      ]),
    );
  });

  it('keeps FSCRUD flows parse-valid', () => {
    const flows = [
      'solo-local-crud.flow',
      'pl-fullstack-crud-v1.flow',
      'pl-fullstack-crud-tight-v2.flow',
      'pl-fullstack-crud-tight-v3.flow',
      'pl-fullstack-crud-scaffold-contract-v1.flow',
    ];

    for (const flow of flows) {
      const output = execFileSync(
        process.execPath,
        [
          join(ROOT, 'bin', 'cli.mjs'),
          'validate',
          '--runner',
          'aider',
          '--mode',
          'headless',
          '--file',
          join(ROOT, 'experiments', 'fullstack-crud-comparison', 'flows', flow),
        ],
        { cwd: ROOT, encoding: 'utf8' },
      );
      expect(output).toContain('Flow parsed successfully');
    }
  });

  it('writes a scaffold with contract artifacts and required domain vocabulary', () => {
    const workspace = mkdtempSync(join(tmpdir(), 'fscrud-scaffold-'));
    try {
      execFileSync(process.execPath, [SCAFFOLD_SCRIPT, workspace], {
        cwd: ROOT,
        encoding: 'utf8',
      });

      for (const relativePath of [
        'package.json',
        'CONTRACT.md',
        'README.md',
        'run-manifest.json',
        'verification-report.md',
        'src/domain.js',
        'src/server.js',
        'public/index.html',
        '__tests__/domain.contract.test.js',
        'data/seed.json',
      ]) {
        expect(existsSync(join(workspace, relativePath))).toBe(true);
      }

      const domain = readFileSync(join(workspace, 'src/domain.js'), 'utf8');
      expect(domain).toContain('module.exports = {');
      expect(domain).not.toContain('export const');
      expect(domain).not.toContain('export function');
      expect(domain).not.toContain('export default');
      expect(domain).not.toContain('updateCustomer');
      expect(domain).not.toContain('updateAsset');
      expect(domain).not.toContain('updateWorkOrder');
      for (const term of [
        'reset',
        'listCustomers',
        'createCustomer',
        'editCustomer',
        'listAssets',
        'createAsset',
        'editAsset',
        'listWorkOrders',
        'createWorkOrder',
        'editWorkOrder',
        'in_progress',
        'cancelled',
        'urgent',
      ]) {
        expect(domain).toContain(term);
      }

      const contract = readFileSync(join(workspace, 'CONTRACT.md'), 'utf8');
      expect(contract).toContain(
        'status values open, scheduled, in_progress, completed, cancelled',
      );
      expect(contract).toContain('priority values low, normal, urgent');
    } finally {
      rmSync(workspace, { recursive: true, force: true });
    }
  });

  it('fails raw scaffold output until executable domain behavior is implemented', () => {
    const workspace = mkdtempSync(join(tmpdir(), 'fscrud-scaffold-placeholder-'));
    try {
      execFileSync(process.execPath, [SCAFFOLD_SCRIPT, workspace], {
        cwd: ROOT,
        encoding: 'utf8',
      });

      const result = runVerifier(workspace);
      const report = JSON.parse(result.stdout) as {
        passed: boolean;
        hardFailures: string[];
        checks: { domainBehavior: boolean };
        domainBehavior: { stderr: string };
      };

      expect(result.status).toBe(1);
      expect(report.passed).toBe(false);
      expect(report.hardFailures).toContain('domain_behavior_failed');
      expect(report.checks.domainBehavior).toBe(false);
      expect(report.domainBehavior.stderr).toContain('reset not implemented');
    } finally {
      rmSync(workspace, { recursive: true, force: true });
    }
  });

  it('fails ESM update-style domain exports from local model output', () => {
    const workspace = mkdtempSync(join(tmpdir(), 'fscrud-esm-update-shape-'));
    try {
      writeValidWorkspace(workspace);
      writeFileSync(
        join(workspace, 'src', 'domain.js'),
        [
          'export const customers = {};',
          'export const assets = {};',
          'export const createCustomer = () => ({});',
          'export const readCustomer = () => ({});',
          'export const updateCustomer = () => ({});',
          'export const deleteCustomer = () => {};',
          'export const createAsset = () => ({});',
          'export const readAsset = () => ({});',
          'export const updateAsset = () => ({});',
          'export const deleteAsset = () => {};',
          'export const createWorkOrder = () => ({});',
          'export const readWorkOrder = () => ({});',
          'export const updateWorkOrder = () => ({});',
          'export const deleteWorkOrder = () => {};',
          'export const reset = () => {};',
        ].join('\n'),
      );

      const result = runVerifier(workspace, ['--no-run-tests']);
      const report = JSON.parse(result.stdout) as {
        hardFailures: string[];
        checks: { domainBehavior: boolean };
        domainBehavior: { stderr: string };
      };

      expect(result.status).toBe(1);
      expect(report.hardFailures).toContain('domain_behavior_failed');
      expect(report.checks.domainBehavior).toBe(false);
      expect(report.domainBehavior.stderr).toContain('missing_export:listCustomers');
    } finally {
      rmSync(workspace, { recursive: true, force: true });
    }
  });

  it('fails CommonJS update aliases when canonical edit exports are missing', () => {
    const workspace = mkdtempSync(join(tmpdir(), 'fscrud-update-alias-shape-'));
    try {
      writeValidWorkspace(workspace);
      const source = readFileSync(join(workspace, 'src', 'domain.js'), 'utf8')
        .replaceAll('editCustomer', 'updateCustomer')
        .replaceAll('editAsset', 'updateAsset')
        .replaceAll('editWorkOrder', 'updateWorkOrder');
      writeFileSync(join(workspace, 'src', 'domain.js'), source);

      const result = runVerifier(workspace, ['--no-run-tests']);
      const report = JSON.parse(result.stdout) as {
        hardFailures: string[];
        checks: { domainBehavior: boolean };
        domainBehavior: { stderr: string };
      };

      expect(result.status).toBe(1);
      expect(report.hardFailures).toContain('domain_behavior_failed');
      expect(report.checks.domainBehavior).toBe(false);
      expect(report.domainBehavior.stderr).toContain('missing_export:editCustomer');
      expect(report.domainBehavior.stderr).toContain('missing_export:editAsset');
      expect(report.domainBehavior.stderr).toContain('missing_export:editWorkOrder');
    } finally {
      rmSync(workspace, { recursive: true, force: true });
    }
  });

  it('keeps FSCRUD task context inline instead of binding artifact handles as the task', () => {
    const flows = [
      'solo-local-crud.flow',
      'pl-fullstack-crud-v1.flow',
      'pl-fullstack-crud-tight-v2.flow',
      'pl-fullstack-crud-tight-v3.flow',
      'pl-fullstack-crud-scaffold-contract-v1.flow',
    ];

    for (const flow of flows) {
      const source = readFileSync(
        join(ROOT, 'experiments', 'fullstack-crud-comparison', 'flows', flow),
        'utf8',
      );

      expect(source).toContain('Task contract: ${task_contract}');
      if (flow === 'pl-fullstack-crud-scaffold-contract-v1.flow') {
        expect(source).toContain('__tests__/domain.contract.test.js');
        expect(source).toContain('CommonJS only');
        expect(source).toContain('module.exports');
        expect(source).toContain('forbidden_domain_shape');
        expect(source).toContain('export const');
        expect(source).toContain('updateCustomer');
      } else {
        expect(source).toContain('__tests__/domain.test.js');
      }
      expect(source).not.toContain('let task_brief = "${last_stdout}"');
    }
  });
});
