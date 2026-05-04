// cspell:ignore fscrud
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';
import { parseFlow } from './parse-flow.js';

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
const DOMAIN_KERNEL_SCRIPT = join(
  ROOT,
  'experiments',
  'fullstack-crud-comparison',
  'scaffold',
  'write-domain-kernel.cjs',
);
const R33_PUBLIC_GATE_SCRIPT = join(
  ROOT,
  'experiments',
  'fullstack-crud-comparison',
  'scaffold',
  'verify-r33-public.cjs',
);
const R34_HANDOFF_SCRIPT = join(
  ROOT,
  'experiments',
  'fullstack-crud-comparison',
  'scaffold',
  'write-r34-handoff-artifacts.cjs',
);
const R34_PUBLIC_GATE_SCRIPT = join(
  ROOT,
  'experiments',
  'fullstack-crud-comparison',
  'scaffold',
  'verify-r34-public.cjs',
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
    [
      '<h1>customers assets work_orders</h1>',
      '<section>customers list create read edit detail delete email phone serviceAddress</section>',
      '<section>assets list create read edit detail delete customerId serialNumber assetType</section>',
      '<section>work_orders list create read edit detail delete customerId assetId status priority completedAt</section>',
      '<p>open scheduled in_progress completed cancelled low normal urgent</p>',
    ].join('\n'),
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
        uiSurface: boolean;
        testsPresent: boolean;
        domainBehavior: boolean;
        seedIntegrity: boolean;
        pathRootIsolation: boolean;
      };
      uiSurface: { passed: boolean; missing: { entityCrud: string[] } };
      scoreBreakdown: { uiSurface: { score: number; maxScore: number } };
      domainSubScores: {
        entities: { passed: boolean; score: number; maxScore: number };
        executableBehavior: { passed: boolean; score: number; maxScore: number };
      };
    };

    expect(result.status).toBe(0);
    expect(report.passed).toBe(true);
    expect(report.score).toBeGreaterThanOrEqual(80);
    expect(report.checks.browserUi).toBe(true);
    expect(report.checks.uiSurface).toBe(true);
    expect(report.uiSurface.passed).toBe(true);
    expect(report.uiSurface.missing.entityCrud).toEqual([]);
    expect(report.scoreBreakdown.uiSurface).toMatchObject({ score: 4, maxScore: 4 });
    expect(report.domainSubScores.entities).toMatchObject({ passed: true, score: 8, maxScore: 8 });
    expect(report.domainSubScores.executableBehavior).toEqual({
      passed: true,
      score: 15,
      maxScore: 15,
    });
    expect(report.checks.testsPresent).toBe(true);
    expect(report.checks.domainBehavior).toBe(true);
    expect(report.checks.seedIntegrity).toBe(true);
    expect(report.checks.pathRootIsolation).toBe(true);
  });

  it('fails when UI files exist but omit required CRUD task concepts', () => {
    const workspace = mkdtempSync(join(tmpdir(), 'fscrud-ui-surface-'));
    writeValidWorkspace(workspace);
    writeFileSync(
      join(workspace, 'public', 'index.html'),
      '<h1>Field service dashboard</h1><p>Generated shell only.</p>',
    );

    const result = runVerifier(workspace, ['--no-run-tests']);
    const report = JSON.parse(result.stdout) as {
      hardFailures: string[];
      checks: {
        browserUi: boolean;
        uiSurface: boolean;
        allEntities: boolean;
        allCrudTerms: boolean;
      };
      scoreBreakdown: { uiSurface: { score: number; maxScore: number } };
      uiSurface: {
        passed: boolean;
        missing: {
          entities: string[];
          crud: string[];
          taskConcepts: string[];
          entityCrud: string[];
        };
      };
    };

    expect(result.status).toBe(1);
    expect(report.hardFailures).toContain('ui_surface_incomplete');
    expect(report.checks.browserUi).toBe(true);
    expect(report.checks.uiSurface).toBe(false);
    expect(report.checks.allEntities).toBe(true);
    expect(report.checks.allCrudTerms).toBe(true);
    expect(report.scoreBreakdown.uiSurface).toMatchObject({ score: 2, maxScore: 4 });
    expect(report.uiSurface.passed).toBe(false);
    expect(report.uiSurface.missing.entities).toEqual(['customers', 'assets', 'workOrders']);
    expect(report.uiSurface.missing.crud).toEqual(['list', 'create', 'edit', 'detail', 'delete']);
    expect(report.uiSurface.missing.taskConcepts).toEqual([
      'customerReference',
      'assetReference',
      'status',
      'priority',
      'completion',
    ]);
    expect(report.uiSurface.missing.entityCrud).toContain('workOrders.delete');
  });

  it('fails when generated app files leak to the run root outside the workspace', () => {
    const attemptRoot = mkdtempSync(join(tmpdir(), 'fscrud-root-leak-'));
    const workspace = join(attemptRoot, 'workspace', 'fscrud-01');
    try {
      writeValidWorkspace(workspace);
      mkdirSync(join(attemptRoot, 'src'), { recursive: true });
      writeFileSync(join(attemptRoot, 'src', 'domain.js'), 'module.exports = {};\n');

      const result = runVerifier(workspace);
      const report = JSON.parse(result.stdout) as {
        passed: boolean;
        hardFailures: string[];
        checks: { pathRootIsolation: boolean };
        pathRootIsolation: { leaks: string[] };
      };

      expect(result.status).toBe(1);
      expect(report.passed).toBe(false);
      expect(report.hardFailures).toContain('path_root_isolation_failed');
      expect(report.checks.pathRootIsolation).toBe(false);
      expect(report.pathRootIsolation.leaks).toContain('src/domain.js');
    } finally {
      rmSync(attemptRoot, { recursive: true, force: true });
    }
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
      'pl-fullstack-crud-micro-contract-v1.flow',
      'pl-fullstack-crud-micro-contract-v2.flow',
      'pl-fullstack-crud-ui-skeleton-r33.flow',
      'pl-fullstack-crud-server-only-r34.flow',
    ];

    for (const flow of flows) {
      const flowText = readFileSync(
        join(ROOT, 'experiments', 'fullstack-crud-comparison', 'flows', flow),
        'utf8',
      );
      const spec = parseFlow(flowText);
      expect(spec.warnings, `${flow} parser warnings`).toEqual([]);

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

  it('accepts an R33 workspace that satisfies the public gate contract', () => {
    const attemptRoot = mkdtempSync(join(tmpdir(), 'fscrud-r33-public-gate-'));
    const workspace = join(attemptRoot, 'workspace', 'fscrud-01');
    try {
      execFileSync(process.execPath, [SCAFFOLD_SCRIPT, workspace], {
        cwd: ROOT,
        encoding: 'utf8',
      });
      execFileSync(process.execPath, [DOMAIN_KERNEL_SCRIPT, workspace], {
        cwd: ROOT,
        encoding: 'utf8',
      });
      writeFileSync(
        join(workspace, 'public', 'index.html'),
        [
          '<!doctype html><html><body>',
          '<section>customers customerId list create edit detail delete</section>',
          '<section>assets assetId customerId list create edit detail delete</section>',
          '<section>work_orders status open scheduled in_progress completed cancelled priority low normal urgent completedAt list create edit detail delete</section>',
          '</body></html>',
        ].join('\n'),
      );
      writeFileSync(
        join(workspace, 'src', 'server.js'),
        "const domain = require('./domain.js');\nmodule.exports = { domain, customers: true, assets: true, work_orders: true };\n",
      );
      writeFileSync(
        join(workspace, 'run-manifest.json'),
        JSON.stringify(
          {
            arm: 'r33-pl-ui-skeleton-integration',
            features: [
              'deterministic-domain-kernel',
              'deterministic-ui-skeleton',
              'protected-artifacts',
              'local-only',
            ],
          },
          null,
          2,
        ),
      );
      writeFileSync(
        join(workspace, 'README.md'),
        'Run with npm test and npm start. Deterministic domain and UI files are protected.\n',
      );
      writeFileSync(
        join(workspace, 'verification-report.md'),
        'Public checks: check:domain:exports, check:domain:customer, check:domain:assets, check:domain:work-orders, npm test. Hidden verifier is run only by the harness.\n',
      );

      const result = spawnSync(process.execPath, [R33_PUBLIC_GATE_SCRIPT, 'workspace/fscrud-01'], {
        cwd: attemptRoot,
        encoding: 'utf8',
        timeout: 30_000,
      });

      expect(result.status).toBe(0);
      expect(result.stdout).toContain('r33_public_gate_ok');
    } finally {
      rmSync(attemptRoot, { recursive: true, force: true });
    }
  });

  it('writes deterministic R34 handoff artifacts for server-only diagnostics', () => {
    const workspace = mkdtempSync(join(tmpdir(), 'fscrud-r34-handoff-'));
    try {
      execFileSync(process.execPath, [R34_HANDOFF_SCRIPT, workspace], {
        cwd: ROOT,
        encoding: 'utf8',
      });

      const readme = readFileSync(join(workspace, 'README.md'), 'utf8');
      const manifest = readFileSync(join(workspace, 'run-manifest.json'), 'utf8');
      const report = readFileSync(join(workspace, 'verification-report.md'), 'utf8');

      expect(readme).toContain('npm test');
      expect(readme).toContain('npm start');
      expect(manifest).toContain('r34-pl-server-only-integration');
      expect(manifest).toContain('deterministic-handoff-docs');
      expect(report).toContain('check:domain:exports');
      expect(report).toContain('hidden verifier');
    } finally {
      rmSync(workspace, { recursive: true, force: true });
    }
  });

  it('accepts an R34 workspace that satisfies the server-only public gate contract', () => {
    const attemptRoot = mkdtempSync(join(tmpdir(), 'fscrud-r34-public-gate-'));
    const workspace = join(attemptRoot, 'workspace', 'fscrud-01');
    try {
      execFileSync(process.execPath, [SCAFFOLD_SCRIPT, workspace], {
        cwd: ROOT,
        encoding: 'utf8',
      });
      execFileSync(process.execPath, [DOMAIN_KERNEL_SCRIPT, workspace], {
        cwd: ROOT,
        encoding: 'utf8',
      });
      execFileSync(process.execPath, [R34_HANDOFF_SCRIPT, workspace], {
        cwd: ROOT,
        encoding: 'utf8',
      });
      writeFileSync(
        join(workspace, 'public', 'index.html'),
        [
          '<!doctype html><html><body>',
          '<section>customers customerId list create edit detail delete</section>',
          '<section>assets assetId customerId list create edit detail delete</section>',
          '<section>work_orders status open scheduled in_progress completed cancelled priority low normal urgent completedAt list create edit detail delete</section>',
          '</body></html>',
        ].join('\n'),
      );
      writeFileSync(
        join(workspace, 'src', 'server.js'),
        "const domain = require('./domain.js');\nmodule.exports = { domain, customers: true, assets: true, work_orders: true };\n",
      );

      const result = spawnSync(process.execPath, [R34_PUBLIC_GATE_SCRIPT, 'workspace/fscrud-01'], {
        cwd: attemptRoot,
        encoding: 'utf8',
        timeout: 30_000,
      });

      expect(result.status).toBe(0);
      expect(result.stdout).toContain('r34_public_gate_ok');
    } finally {
      rmSync(attemptRoot, { recursive: true, force: true });
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
        'DOMAIN_API.md',
        'contracts/domain-exports.json',
        'scripts/check-domain-exports.cjs',
        'scripts/check-domain-customer.cjs',
        'scripts/check-domain-assets.cjs',
        'scripts/check-domain-work-orders.cjs',
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
      const moduleExportsBlock = domain.slice(domain.indexOf('module.exports'));
      expect(moduleExportsBlock).not.toContain('STATUS_VALUES');
      expect(moduleExportsBlock).not.toContain('PRIORITY_VALUES');
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

      const domainApi = readFileSync(join(workspace, 'DOMAIN_API.md'), 'utf8');
      expect(domainApi).toContain('module.exports = {');
      expect(domainApi).toContain('listCustomers');
      expect(domainApi).toContain('editWorkOrder');

      const exportsContract = JSON.parse(
        readFileSync(join(workspace, 'contracts', 'domain-exports.json'), 'utf8'),
      ) as { exports: string[] };
      expect(exportsContract.exports).toContain('deleteCustomer');
      expect(exportsContract.exports).toContain('listWorkOrders');

      const exportCheck = execFileSync(process.execPath, [
        join(workspace, 'scripts', 'check-domain-exports.cjs'),
      ]);
      expect(exportCheck.toString()).toContain('domain_export_surface_ok');
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
      'pl-fullstack-crud-micro-contract-v1.flow',
      'pl-fullstack-crud-micro-contract-v2.flow',
    ];

    for (const flow of flows) {
      const source = readFileSync(
        join(ROOT, 'experiments', 'fullstack-crud-comparison', 'flows', flow),
        'utf8',
      );

      expect(source).toContain('Task contract: ${task_contract}');
      if (
        flow === 'pl-fullstack-crud-scaffold-contract-v1.flow' ||
        flow === 'pl-fullstack-crud-micro-contract-v1.flow' ||
        flow === 'pl-fullstack-crud-micro-contract-v2.flow'
      ) {
        expect(source).toContain('__tests__/domain.contract.test.js');
        expect(source).toContain('module.exports');
        expect(source).toContain('run_root_src_domain_leak');
        expect(source).toContain('Treat ${fscrud_workspace} as the app root');
        if (flow === 'pl-fullstack-crud-scaffold-contract-v1.flow') {
          expect(source).toContain('CommonJS only');
          expect(source).toContain('ALLOWED_FILES: workspace/fscrud-01/src/domain.js');
          expect(source).toContain('Object.keys(moduleExports).sort()');
          expect(source).toContain('domain_module_load_failed');
          expect(source).toContain('module_exports_surface_mismatch');
          expect(source).toContain('module_exports_non_function');
          expect(source).toContain('when the failing verifier field directly names that file');
        }
        if (flow === 'pl-fullstack-crud-micro-contract-v1.flow') {
          expect(source).toContain('Object.keys(moduleExports).sort()');
          expect(source).toContain('domain_module_load_failed');
          expect(source).toContain('module_exports_surface_mismatch');
          expect(source).toContain('module_exports_non_function');
        }
        if (flow === 'pl-fullstack-crud-micro-contract-v2.flow') {
          expect(source).toContain('DOMAIN_API.md');
          expect(source).toContain('contracts/domain-exports.json');
          expect(source).toContain('npm run check:domain:exports');
          expect(source).toContain(
            'the hidden FSCRUD verifier is run only by the experiment harness after the flow',
          );
          expect(source).not.toContain('verify-fullstack-crud-workspace.mjs');
        }
        expect(source).toContain('Never edit workspace/fscrud-01/__tests__');
        expect(source).not.toContain('unexpected_export_name_present');
        expect(source).not.toContain('missing_required_export');
        expect(source).not.toContain('forbidden_domain_shape');
        const promptLines = source
          .split(/\r?\n/)
          .filter((line) => line.trimStart().startsWith('prompt:'));
        for (const promptLine of promptLines) {
          expect(promptLine).not.toContain('updateCustomer');
          expect(promptLine).not.toContain('updateAsset');
          expect(promptLine).not.toContain('updateWorkOrder');
          expect(promptLine).not.toContain('export const');
          expect(promptLine).not.toContain('export default');
          expect(promptLine).toContain('Work only in ${fscrud_workspace}');
          expect(promptLine).toContain('Treat ${fscrud_workspace} as the app root');
          expect(promptLine).toContain('workspace/fscrud-01/');
          expect(promptLine).toContain('Do not create or edit ./src/* at the run root');
          expect(promptLine).not.toContain('ACTION read_file src/');
          expect(promptLine).not.toContain('FILE src/');
        }
        for (const repairLine of promptLines.filter((line) => line.includes('Repair'))) {
          expect(repairLine).toContain('Work only in ${fscrud_workspace}');
          expect(repairLine).toContain('Treat ${fscrud_workspace} as the app root');
          expect(repairLine).toContain('workspace/fscrud-01/');
          expect(repairLine).toContain('Do not create or edit ./src/* at the run root');
          expect(repairLine).not.toContain('ALLOWED_FILES: src/domain.js');
          expect(repairLine).not.toContain('ACTION read_file src/domain.js');
        }
        for (const deterministicLine of source
          .split(/\r?\n/)
          .filter(
            (line) => line.includes('grounded-by') || line.trimStart().startsWith('run: node -e'),
          )) {
          expect(deterministicLine).not.toContain('updateCustomer');
          expect(deterministicLine).not.toContain('updateAsset');
          expect(deterministicLine).not.toContain('updateWorkOrder');
          expect(deterministicLine).not.toContain('export const');
          expect(deterministicLine).not.toContain('export default');
        }
      } else {
        expect(source).toContain('__tests__/domain.test.js');
      }
      expect(source).not.toContain('let task_brief = "${last_stdout}"');
    }
  });
});
