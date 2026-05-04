#!/usr/bin/env node
// cspell:ignore fscrud

const { mkdirSync, writeFileSync } = require('node:fs');
const { join, resolve } = require('node:path');

function domainKernelSource() {
  return `
'use strict';

const STATUS_VALUES = new Set(['open', 'scheduled', 'in_progress', 'completed', 'cancelled']);
const PRIORITY_VALUES = new Set(['low', 'normal', 'urgent']);

let customers;
let assets;
let workOrders;
let counters;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function nextId(prefix) {
  counters[prefix] += 1;
  return prefix + '-' + counters[prefix];
}

function findById(collection, id, label) {
  const item = collection.find((entry) => String(entry.id) === String(id));
  if (!item) throw new Error(label + ' not found');
  return item;
}

function assertRequired(value, label) {
  if (value == null || value === '') throw new Error(label + ' required');
}

function normalizeStatus(value) {
  const status = value ?? 'open';
  if (!STATUS_VALUES.has(status)) throw new Error('invalid status');
  return status;
}

function normalizePriority(value) {
  const priority = value ?? 'normal';
  if (!PRIORITY_VALUES.has(priority)) throw new Error('invalid priority');
  return priority;
}

function validateCompletion(status, completedAt) {
  if (status === 'completed' && !completedAt) throw new Error('completedAt required');
  if (status !== 'completed' && completedAt) throw new Error('completedAt invalid');
}

function activeWorkOrdersFor(field, id) {
  return workOrders.filter((order) => String(order[field]) === String(id));
}

function reset() {
  customers = [];
  assets = [];
  workOrders = [];
  counters = { customer: 0, asset: 0, workOrder: 0 };
  return { customers: 0, assets: 0, workOrders: 0 };
}

function listCustomers() {
  return clone(customers);
}

function createCustomer(input = {}) {
  assertRequired(input.name, 'customer.name');
  const customer = {
    id: input.id ?? nextId('customer'),
    name: input.name,
    email: input.email ?? '',
    phone: input.phone ?? '',
    serviceAddress: input.serviceAddress ?? input.address ?? '',
  };
  customers.push(customer);
  return clone(customer);
}

function readCustomer(id) {
  return clone(findById(customers, id, 'customer'));
}

function detailCustomer(id) {
  const customer = findById(customers, id, 'customer');
  return clone({
    ...customer,
    assets: assets.filter((asset) => String(asset.customerId) === String(customer.id)),
    workOrders: workOrders.filter((order) => String(order.customerId) === String(customer.id)),
  });
}

function editCustomer(id, patch = {}) {
  const customer = findById(customers, id, 'customer');
  Object.assign(customer, patch, { id: customer.id });
  assertRequired(customer.name, 'customer.name');
  return clone(customer);
}

function deleteCustomer(id) {
  findById(customers, id, 'customer');
  if (activeWorkOrdersFor('customerId', id).length > 0) {
    throw new Error('customer has active work_orders');
  }
  customers = customers.filter((customer) => String(customer.id) !== String(id));
  assets = assets.filter((asset) => String(asset.customerId) !== String(id));
  return { id, deleted: true };
}

function listAssets() {
  return clone(assets);
}

function createAsset(input = {}) {
  assertRequired(input.customerId, 'asset.customerId');
  findById(customers, input.customerId, 'customer');
  assertRequired(input.name, 'asset.name');
  const asset = {
    id: input.id ?? nextId('asset'),
    customerId: input.customerId,
    name: input.name,
    serialNumber: input.serialNumber ?? '',
    assetType: input.assetType ?? input.type ?? '',
    installedAt: input.installedAt ?? '',
  };
  assets.push(asset);
  return clone(asset);
}

function readAsset(id) {
  return clone(findById(assets, id, 'asset'));
}

function detailAsset(id) {
  const asset = findById(assets, id, 'asset');
  return clone({
    ...asset,
    customer: findById(customers, asset.customerId, 'customer'),
    workOrders: workOrders.filter((order) => String(order.assetId) === String(asset.id)),
  });
}

function editAsset(id, patch = {}) {
  const asset = findById(assets, id, 'asset');
  const next = { ...asset, ...patch, id: asset.id };
  findById(customers, next.customerId, 'customer');
  assertRequired(next.name, 'asset.name');
  Object.assign(asset, next);
  return clone(asset);
}

function deleteAsset(id) {
  findById(assets, id, 'asset');
  if (activeWorkOrdersFor('assetId', id).length > 0) {
    throw new Error('asset has active work_orders');
  }
  assets = assets.filter((asset) => String(asset.id) !== String(id));
  return { id, deleted: true };
}

function validateWorkOrderInput(input) {
  assertRequired(input.customerId, 'workOrder.customerId');
  assertRequired(input.assetId, 'workOrder.assetId');
  const customer = findById(customers, input.customerId, 'customer');
  const asset = findById(assets, input.assetId, 'asset');
  if (String(asset.customerId) !== String(customer.id)) {
    throw new Error('asset/customer mismatch');
  }
  const status = normalizeStatus(input.status);
  const priority = normalizePriority(input.priority);
  validateCompletion(status, input.completedAt);
  return { status, priority };
}

function listWorkOrders() {
  return clone(workOrders);
}

function createWorkOrder(input = {}) {
  const { status, priority } = validateWorkOrderInput(input);
  const workOrder = {
    id: input.id ?? nextId('workOrder'),
    customerId: input.customerId,
    assetId: input.assetId,
    title: input.title ?? input.summary ?? '',
    status,
    priority,
    completedAt: input.completedAt ?? null,
  };
  workOrders.push(workOrder);
  return clone(workOrder);
}

function readWorkOrder(id) {
  return clone(findById(workOrders, id, 'work_order'));
}

function detailWorkOrder(id) {
  const workOrder = findById(workOrders, id, 'work_order');
  return clone({
    ...workOrder,
    customer: findById(customers, workOrder.customerId, 'customer'),
    asset: findById(assets, workOrder.assetId, 'asset'),
  });
}

function editWorkOrder(id, patch = {}) {
  const workOrder = findById(workOrders, id, 'work_order');
  const next = { ...workOrder, ...patch, id: workOrder.id };
  const { status, priority } = validateWorkOrderInput(next);
  Object.assign(workOrder, next, { status, priority });
  return clone(workOrder);
}

function deleteWorkOrder(id) {
  findById(workOrders, id, 'work_order');
  workOrders = workOrders.filter((order) => String(order.id) !== String(id));
  return { id, deleted: true };
}

reset();

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
`;
}

function writeDomainKernel(workspacePath) {
  const workspace = resolve(workspacePath);
  mkdirSync(join(workspace, 'src'), { recursive: true });
  const domainPath = join(workspace, 'src', 'domain.js');
  writeFileSync(domainPath, `${domainKernelSource().trimStart()}\n`, 'utf8');
  return domainPath;
}

if (require.main === module) {
  const path = writeDomainKernel(process.argv[2] ?? 'workspace/fscrud-01');
  process.stdout.write(`wrote ${path}\n`);
}

module.exports = {
  domainKernelSource,
  writeDomainKernel,
};
