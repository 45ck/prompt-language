import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { test } from 'node:test';

const require = createRequire(import.meta.url);
const {
  EXPECTED_EXPORTS,
  normalizeDomainExportSurface,
} = require('./normalize-domain-export-surface.cjs');

function tempWorkspace() {
  return mkdtempSync(join(tmpdir(), 'fscrud-normalize-'));
}

function writeDomain(workspace, source) {
  const src = join(workspace, 'src');
  mkdirSync(src, { recursive: true });
  writeFileSync(join(src, 'domain.js'), source, 'utf8');
}

test('creates an exact stub module when domain.js is missing', () => {
  const workspace = tempWorkspace();
  try {
    const result = normalizeDomainExportSurface(workspace);
    const domain = require(join(workspace, 'src', 'domain.js'));

    assert.equal(result.mode, 'stubbed-missing-file');
    assert.deepEqual(Object.keys(domain).sort(), [...EXPECTED_EXPORTS].sort());
    assert.equal(typeof domain.reset, 'function');
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('wraps partial CommonJS exports without discarding implemented behavior', () => {
  const workspace = tempWorkspace();
  try {
    writeDomain(
      workspace,
      "exports.reset = () => 'reset';\nexports.listCustomers = () => [{ id: 'customer-1' }];\n",
    );

    const result = normalizeDomainExportSurface(workspace);
    delete require.cache[require.resolve(join(workspace, 'src', 'domain.js'))];
    const domain = require(join(workspace, 'src', 'domain.js'));

    assert.equal(result.mode, 'appended-export-wrapper');
    assert.deepEqual(Object.keys(domain).sort(), [...EXPECTED_EXPORTS].sort());
    assert.equal(domain.reset(), 'reset');
    assert.deepEqual(domain.listCustomers(), [{ id: 'customer-1' }]);
    assert.throws(() => domain.deleteCustomer('customer-1'), /deleteCustomer not implemented/);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('wraps declared functions when module.exports was omitted', () => {
  const workspace = tempWorkspace();
  try {
    writeDomain(
      workspace,
      "function reset() { return 'reset'; }\nfunction listCustomers() { return [{ id: 'customer-1' }]; }\n",
    );

    const result = normalizeDomainExportSurface(workspace);
    delete require.cache[require.resolve(join(workspace, 'src', 'domain.js'))];
    const domain = require(join(workspace, 'src', 'domain.js'));

    assert.equal(result.mode, 'appended-export-wrapper');
    assert.deepEqual(Object.keys(domain).sort(), [...EXPECTED_EXPORTS].sort());
    assert.equal(domain.reset(), 'reset');
    assert.deepEqual(domain.listCustomers(), [{ id: 'customer-1' }]);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('replaces unloadable entity-shaped modules with an exact stub surface', () => {
  const workspace = tempWorkspace();
  try {
    writeDomain(workspace, 'module.exports = { Customer, Asset };\n');

    const result = normalizeDomainExportSurface(workspace);
    const source = readFileSync(join(workspace, 'src', 'domain.js'), 'utf8');
    delete require.cache[require.resolve(join(workspace, 'src', 'domain.js'))];
    const domain = require(join(workspace, 'src', 'domain.js'));

    assert.equal(result.mode, 'stubbed-unloadable-module');
    assert.match(source, /function createWorkOrder/);
    assert.deepEqual(Object.keys(domain).sort(), [...EXPECTED_EXPORTS].sort());
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});
