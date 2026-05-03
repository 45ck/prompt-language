#!/usr/bin/env node

const { mkdirSync, writeFileSync } = require('node:fs');
const { join, resolve } = require('node:path');

const workspace = resolve(process.argv[2] ?? 'workspace/fscrud-01');

function write(path, content) {
  writeFileSync(join(workspace, path), content.trimStart() + '\n', 'utf8');
}

mkdirSync(join(workspace, 'src'), { recursive: true });
mkdirSync(join(workspace, '__tests__'), { recursive: true });
mkdirSync(join(workspace, 'public'), { recursive: true });
mkdirSync(join(workspace, 'data'), { recursive: true });

write(
  'package.json',
  JSON.stringify(
    {
      name: 'fscrud-01-scaffold-contract',
      private: true,
      scripts: {
        test: 'node --test',
        start: 'node src/server.js',
      },
    },
    null,
    2,
  ),
);

write(
  'CONTRACT.md',
  `
# FSCRUD-01 Senior Card Contract

GOAL: Implement a small CommonJS field-service work order tracker.
FILE: Fill src/domain.js first; contract tests are authoritative.
MUST: Export reset plus list/create/read/detail/edit/delete functions for customers, assets, and work_orders.
MUST: Validate customerId, assetId, asset/customer mismatch, status, completedAt, and priority.
MUST: Accept status values open, scheduled, in_progress, completed, cancelled.
MUST: Accept priority values low, normal, urgent.
MUST: Preserve package.json, __tests__/domain.contract.test.js, data/seed.json, and this contract.
CHECK: cd workspace/fscrud-01 && npm test.
REPAIR: Patch only missing behavior; do not rewrite passing contracts.
`,
);

write(
  'src/domain.js',
  `
const STATUS_VALUES = ['open', 'scheduled', 'in_progress', 'completed', 'cancelled'];
const PRIORITY_VALUES = ['low', 'normal', 'urgent'];

function notImplemented(name) {
  throw new Error(name + ' not implemented');
}

function reset() {
  return notImplemented('reset');
}

function listCustomers() { return notImplemented('listCustomers'); }
function createCustomer(input) { return notImplemented('createCustomer'); }
function readCustomer(id) { return notImplemented('readCustomer'); }
function detailCustomer(id) { return notImplemented('detailCustomer'); }
function editCustomer(id, patch) { return notImplemented('editCustomer'); }
function deleteCustomer(id) { return notImplemented('deleteCustomer'); }

function listAssets() { return notImplemented('listAssets'); }
function createAsset(input) { return notImplemented('createAsset'); }
function readAsset(id) { return notImplemented('readAsset'); }
function detailAsset(id) { return notImplemented('detailAsset'); }
function editAsset(id, patch) { return notImplemented('editAsset'); }
function deleteAsset(id) { return notImplemented('deleteAsset'); }

function listWorkOrders() { return notImplemented('listWorkOrders'); }
function createWorkOrder(input) { return notImplemented('createWorkOrder'); }
function readWorkOrder(id) { return notImplemented('readWorkOrder'); }
function detailWorkOrder(id) { return notImplemented('detailWorkOrder'); }
function editWorkOrder(id, patch) { return notImplemented('editWorkOrder'); }
function deleteWorkOrder(id) { return notImplemented('deleteWorkOrder'); }

module.exports = {
  reset,
  listCustomers,
  createCustomer,
  readCustomer,
  detailCustomer,
  editCustomer,
  deleteCustomer,
  listAssets,
  createAsset,
  readAsset,
  detailAsset,
  editAsset,
  deleteAsset,
  listWorkOrders,
  createWorkOrder,
  readWorkOrder,
  detailWorkOrder,
  editWorkOrder,
  deleteWorkOrder,
};
`,
);

write(
  '__tests__/domain.contract.test.js',
  `
const test = require('node:test');
const assert = require('node:assert/strict');
const domain = require('../src/domain.js');

function assertThrows(label, operation) {
  assert.throws(operation, undefined, label);
}

test('customers and assets expose CRUD behavior', () => {
  domain.reset();
  const customer = domain.createCustomer({ name: 'Acme Field Services' });
  assert.equal(domain.listCustomers().length, 1);
  assert.equal(domain.readCustomer(customer.id).name, 'Acme Field Services');
  assert.equal(domain.detailCustomer(customer.id).id, customer.id);
  assert.equal(domain.editCustomer(customer.id, { name: 'Acme Updated' }).name, 'Acme Updated');

  const asset = domain.createAsset({ customerId: customer.id, name: 'Truck 7' });
  assert.equal(domain.listAssets().length, 1);
  assert.equal(domain.readAsset(asset.id).customerId, customer.id);
  assert.equal(domain.detailAsset(asset.id).id, asset.id);
  assert.equal(domain.editAsset(asset.id, { name: 'Truck 7A' }).name, 'Truck 7A');
});

test('work orders enforce references, status, completedAt, and priority', () => {
  domain.reset();
  const customerA = domain.createCustomer({ name: 'Acme Field Services' });
  const customerB = domain.createCustomer({ name: 'Beta Manufacturing' });
  const assetA = domain.createAsset({ customerId: customerA.id, name: 'Truck 7' });
  const assetB = domain.createAsset({ customerId: customerB.id, name: 'Pump 2' });

  assertThrows('unknown customerId', () =>
    domain.createWorkOrder({ customerId: 'missing', assetId: assetA.id, status: 'open' }),
  );
  assertThrows('unknown assetId', () =>
    domain.createWorkOrder({ customerId: customerA.id, assetId: 'missing', status: 'open' }),
  );
  assertThrows('asset/customer mismatch', () =>
    domain.createWorkOrder({ customerId: customerA.id, assetId: assetB.id, status: 'open' }),
  );
  assertThrows('completed requires completedAt', () =>
    domain.createWorkOrder({
      customerId: customerA.id,
      assetId: assetA.id,
      status: 'completed',
      priority: 'normal',
    }),
  );
  assertThrows('non-completed rejects completedAt', () =>
    domain.createWorkOrder({
      customerId: customerA.id,
      assetId: assetA.id,
      status: 'open',
      priority: 'normal',
      completedAt: '2026-04-30T00:00:00Z',
    }),
  );

  const workOrder = domain.createWorkOrder({
    customerId: customerA.id,
    assetId: assetA.id,
    status: 'open',
    priority: 'urgent',
    title: 'Repair hydraulic lift',
  });
  assert.equal(domain.readWorkOrder(workOrder.id).priority, 'urgent');
  assert.equal(domain.detailWorkOrder(workOrder.id).assetId, assetA.id);
  assert.equal(
    domain.editWorkOrder(workOrder.id, {
      status: 'completed',
      completedAt: '2026-04-30T00:00:00Z',
    }).status,
    'completed',
  );
  domain.deleteWorkOrder(workOrder.id);
  assert.equal(domain.listWorkOrders().some((item) => item.id === workOrder.id), false);
});

test('safe deletes do not leave active dangling work orders', () => {
  domain.reset();
  const customer = domain.createCustomer({ name: 'Acme Field Services' });
  const asset = domain.createAsset({ customerId: customer.id, name: 'Truck 7' });
  domain.createWorkOrder({
    customerId: customer.id,
    assetId: asset.id,
    status: 'scheduled',
    priority: 'normal',
  });

  try {
    domain.deleteCustomer(customer.id);
  } catch {
    return;
  }

  assert.equal(
    domain.listWorkOrders().some((item) => item.customerId === customer.id && !item.deletedAt),
    false,
  );
});
`,
);

write(
  'data/seed.json',
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

write(
  'src/server.js',
  `
const http = require('node:http');
const domain = require('./domain.js');

const server = http.createServer((request, response) => {
  response.setHeader('content-type', 'application/json');
  response.end(JSON.stringify({ ok: true, path: request.url, exports: Object.keys(domain) }));
});

if (require.main === module) {
  server.listen(process.env.PORT || 3000);
}

module.exports = { server };
`,
);

write(
  'public/index.html',
  `
<!doctype html>
<html lang="en">
  <head><meta charset="utf-8"><title>FSCRUD-01</title></head>
  <body>
    <h1>FSCRUD-01 Field Service Work Orders</h1>
    <section id="customers">customers list create read edit detail delete</section>
    <section id="assets">assets list create read edit detail delete customerId</section>
    <section id="work_orders">work_orders list create read edit detail delete customerId assetId status completedAt priority</section>
  </body>
</html>
`,
);

write(
  'README.md',
  `
# FSCRUD-01

Run tests with \`npm test\` and start the local server with \`npm start\`.
`,
);

write(
  'run-manifest.json',
  JSON.stringify(
    {
      experiment: 'FSCRUD-01',
      arm: 'pl-local-crud-scaffold-contract',
      scaffoldContract: true,
    },
    null,
    2,
  ),
);

write(
  'verification-report.md',
  `
# Verification Report

This scaffold starts with failing contract tests. Update this report only after
running \`npm test\` and the FSCRUD verifier.
`,
);
