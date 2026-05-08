import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

const ORACLE = join(import.meta.dirname, 'h15-api-endpoint-oracle.mjs');

function tempWorkspace() {
  return join(tmpdir(), `ha-h15-api-oracle-${process.pid}-${Date.now()}-${Math.random()}`);
}

function writeWorkspace(workspace, { appSource, testSource }) {
  mkdirSync(join(workspace, 'src'), { recursive: true });
  writeFileSync(
    join(workspace, 'package.json'),
    JSON.stringify({ private: true, type: 'commonjs', scripts: { test: 'node src/test.js' } }),
  );
  writeFileSync(join(workspace, 'src', 'app.js'), appSource);
  writeFileSync(join(workspace, 'src', 'test.js'), testSource);
}

function runOracle(workspace) {
  return spawnSync(process.execPath, [ORACLE, '--workspace', workspace], {
    encoding: 'utf8',
    timeout: 15_000,
    windowsHide: true,
  });
}

const PASSING_APP = `
const contacts = [
  { id: 1, name: 'Alice Johnson', email: 'alice@example.com', phone: '555-0101', company: 'Acme Corp' },
  { id: 2, name: 'Bob Smith', email: 'bob@example.com', phone: '555-0102', company: 'Globex Inc' },
  { id: 3, name: 'Carol Davis', email: 'carol@example.com', phone: '555-0103', company: null },
];
let nextId = 4;
function listContacts() {
  return { status: 200, body: contacts };
}
function getContact(id) {
  const contact = contacts.find((candidate) => candidate.id === id);
  if (!contact) return { status: 404, body: { error: 'Contact not found' } };
  return { status: 200, body: contact };
}
function createContact(data) {
  if (!data.name || !data.email) return { status: 400, body: { error: 'Name and email are required' } };
  const contact = {
    id: nextId++,
    name: data.name,
    email: data.email,
    phone: data.phone || null,
    company: data.company || null,
  };
  contacts.push(contact);
  return { status: 201, body: contact };
}
function deleteContact(id) {
  const index = contacts.findIndex((candidate) => candidate.id === id);
  if (index === -1) return { status: 404, body: { error: 'Contact not found' } };
  contacts.splice(index, 1);
  return { status: 204, body: null };
}
function patchContact(id, data) {
  const contact = contacts.find((candidate) => candidate.id === id);
  if (!contact) return { status: 404, body: { error: 'Contact not found' } };
  if (data.name !== undefined && (typeof data.name !== 'string' || data.name.length < 2 || data.name.length > 100)) {
    return { status: 400, body: { error: 'Invalid name' } };
  }
  if (data.email !== undefined) {
    const at = typeof data.email === 'string' ? data.email.indexOf('@') : -1;
    if (at < 1 || data.email.indexOf('.', at) === -1) return { status: 400, body: { error: 'Invalid email' } };
  }
  if (data.phone !== undefined && (typeof data.phone !== 'string' || !/^\\+?[\\d\\-\\s]{7,20}$/.test(data.phone))) {
    return { status: 400, body: { error: 'Invalid phone' } };
  }
  if (data.company !== undefined && data.company !== null && (typeof data.company !== 'string' || data.company.length < 1 || data.company.length > 200)) {
    return { status: 400, body: { error: 'Invalid company' } };
  }
  for (const field of ['name', 'email', 'phone', 'company']) {
    if (data[field] !== undefined) contact[field] = data[field];
  }
  return { status: 200, body: contact };
}
module.exports = { listContacts, getContact, createContact, deleteContact, patchContact, contacts };
`;

const NAMED_TESTS = `
const { patchContact } = require('./app');
function test(name, fn) { fn(); console.log(name); }
test('patch valid name', () => patchContact(1, { name: 'Alice Updated' }));
test('patch valid email', () => patchContact(1, { email: 'alice.updated@example.com' }));
test('patch valid phone', () => patchContact(1, { phone: '+1 555-0109' }));
test('patch null company', () => patchContact(1, { company: null }));
test('patch partial update', () => patchContact(1, { name: 'Alice Partial' }));
test('patch 404 missing ID', () => patchContact(999, { name: 'Nobody' }));
test('patch invalid name', () => patchContact(1, { name: 'A' }));
test('patch invalid email', () => patchContact(1, { email: 'bad@domain' }));
`;

const PROCEDURAL_TESTS = `
const { patchContact } = require('./app');
patchContact(1, { name: 'Alice Updated' });
patchContact(1, { email: 'alice.updated@example.com' });
patchContact(1, { phone: '+1 555-0109' });
patchContact(1, { company: null });
patchContact(1, { name: 'Alice Partial' });
patchContact(999, { name: 'Nobody' });
patchContact(1, { name: 'A' });
patchContact(1, { email: 'bad@domain' });
`;

test('H15 oracle passes a complete PATCH implementation with named tests', () => {
  const workspace = tempWorkspace();
  try {
    writeWorkspace(workspace, {
      appSource: PASSING_APP,
      testSource: NAMED_TESTS,
    });
    const result = runOracle(workspace);
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.match(result.stdout, /VERDICT: PASS/);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('H15 oracle accepts procedural PATCH checks as test coverage', () => {
  const workspace = tempWorkspace();
  try {
    writeWorkspace(workspace, {
      appSource: PASSING_APP,
      testSource: PROCEDURAL_TESTS,
    });
    const result = runOracle(workspace);
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.match(result.stdout, /src\/test\.js has at least 8 PATCH-related tests/);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('H15 oracle rejects changed DELETE behavior', () => {
  const workspace = tempWorkspace();
  try {
    writeWorkspace(workspace, {
      appSource: PASSING_APP.replace(
        'return { status: 204, body: null };',
        'return { status: 200, body: {} };',
      ),
      testSource: NAMED_TESTS,
    });
    const result = runOracle(workspace);
    assert.equal(result.status, 1, `${result.stdout}\n${result.stderr}`);
    assert.match(result.stdout, /delete status 200/);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('H15 oracle rejects empty company strings', () => {
  const workspace = tempWorkspace();
  try {
    writeWorkspace(workspace, {
      appSource: PASSING_APP.replace('data.company.length < 1 || ', ''),
      testSource: NAMED_TESTS,
    });
    const result = runOracle(workspace);
    assert.equal(result.status, 1, `${result.stdout}\n${result.stderr}`);
    assert.match(result.stdout, /PATCH rejects empty company string/);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});
