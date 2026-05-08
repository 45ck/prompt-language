import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

const ORACLE = join(import.meta.dirname, 'h15-patch-test-authoring-oracle.mjs');

const APP_SOURCE = `// Simple API framework (no Express dependency).
const contacts = [
  {
    id: 1,
    name: 'Alice Johnson',
    email: 'alice@example.com',
    phone: '555-0101',
    company: 'Acme Corp',
  },
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
  if (!data.name || !data.email) {
    return { status: 400, body: { error: 'Name and email are required' } };
  }
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

function hasValidEmailShape(email) {
  if (typeof email !== 'string') return false;
  const atIndex = email.indexOf('@');
  return atIndex > 0 && email.indexOf('.', atIndex + 1) > atIndex + 1;
}

function hasValidPhoneShape(phone) {
  return typeof phone === 'string' && /^\\+?[\\d\\s-]{7,20}$/.test(phone);
}

function patchContact(id, data) {
  const contact = contacts.find((candidate) => candidate.id === id);
  if (!contact) return { status: 404, body: { error: 'Contact not found' } };

  if (data.name !== undefined) {
    if (typeof data.name !== 'string' || data.name.length < 2 || data.name.length > 100) {
      return { status: 400, body: { error: 'Invalid name' } };
    }
  }
  if (data.email !== undefined && !hasValidEmailShape(data.email)) {
    return { status: 400, body: { error: 'Invalid email' } };
  }
  if (data.phone !== undefined && !hasValidPhoneShape(data.phone)) {
    return { status: 400, body: { error: 'Invalid phone' } };
  }
  if (
    data.company !== undefined &&
    data.company !== null &&
    (typeof data.company !== 'string' || data.company.length < 1 || data.company.length > 200)
  ) {
    return { status: 400, body: { error: 'Invalid company' } };
  }

  for (const field of ['name', 'email', 'phone', 'company']) {
    if (data[field] !== undefined) contact[field] = data[field];
  }

  return { status: 200, body: contact };
}

module.exports = { listContacts, getContact, createContact, deleteContact, patchContact, contacts };
`;

const PASSING_TESTS = `
const { listContacts, getContact, createContact, deleteContact, patchContact } = require('./app');
let passed = 0;
let failed = 0;
function test(name, fn) {
  try { fn(); passed++; } catch (error) { failed++; console.error(error.message); }
}
test('listContacts returns all', () => { if (listContacts().status !== 200) throw new Error('bad'); });
test('getContact returns existing', () => { if (getContact(1).status !== 200) throw new Error('bad'); });
test('createContact succeeds', () => { if (createContact({ name: 'Test User', email: 'test@test.com' }).status !== 201) throw new Error('bad'); });
test('deleteContact preserves 204 null success behavior', () => { const c = createContact({ name: 'Delete Me', email: 'delete@example.com' }); const r = deleteContact(c.body.id); if (r.status !== 204 || r.body !== null) throw new Error('bad'); });
test('patchContact valid name update works', () => { if (patchContact(1, { name: 'Alice Updated' }).status !== 200) throw new Error('bad'); });
test('patch invalid short name is rejected', () => { if (patchContact(1, { name: 'A' }).status !== 400) throw new Error('bad'); });
test('patch invalid long name is rejected', () => { if (patchContact(1, { name: 'A'.repeat(101) }).status !== 400) throw new Error('bad'); });
test('patch invalid email without dot is rejected', () => { if (patchContact(1, { email: 'bad@domain' }).status !== 400) throw new Error('bad'); });
test('patch invalid email without at is rejected', () => { if (patchContact(1, { email: 'bad.domain' }).status !== 400) throw new Error('bad'); });
test('patch invalid phone characters are rejected', () => { if (patchContact(1, { phone: 'abc1234!' }).status !== 400) throw new Error('bad'); });
test('patch invalid short phone is rejected', () => { if (patchContact(1, { phone: '123456' }).status !== 400) throw new Error('bad'); });
test('patch empty company string is rejected', () => { if (patchContact(1, { company: '' }).status !== 400) throw new Error('bad'); });
test('patch null company is accepted', () => { if (patchContact(2, { company: null }).status !== 200) throw new Error('bad'); });
test('patch partial update preserves other fields', () => { const before = getContact(3).body.email; const r = patchContact(3, { name: 'Carol Updated' }); if (r.status !== 200 || getContact(3).body.email !== before) throw new Error('bad'); });
test('patch missing ID returns 404', () => { if (patchContact(999, { name: 'Nobody' }).status !== 404) throw new Error('bad'); });
if (failed > 0) process.exit(1);
`;

function tempWorkspace() {
  return join(
    tmpdir(),
    `ha-h15-patch-test-authoring-oracle-${process.pid}-${Date.now()}-${Math.random()}`,
  );
}

function writeWorkspace(workspace, { appSource = APP_SOURCE, testSource = PASSING_TESTS }) {
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

test('H15 PATCH test-authoring oracle passes strong tests without app edits', () => {
  const workspace = tempWorkspace();
  try {
    writeWorkspace(workspace, {});
    const result = runOracle(workspace);
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.match(result.stdout, /tests reject broken PATCH validation mutants/);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('H15 PATCH test-authoring oracle rejects implementation edits', () => {
  const workspace = tempWorkspace();
  try {
    writeWorkspace(workspace, {
      appSource: APP_SOURCE.replace('Invalid phone', 'Invalid phone number'),
    });
    const result = runOracle(workspace);
    assert.equal(result.status, 1, `${result.stdout}\n${result.stderr}`);
    assert.match(result.stdout, /implementation remains unchanged/);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('H15 PATCH test-authoring oracle rejects shallow tests that do not kill mutants', () => {
  const workspace = tempWorkspace();
  try {
    writeWorkspace(workspace, {
      testSource: PASSING_TESTS.replace(
        "test('patch invalid phone characters are rejected', () => { if (patchContact(1, { phone: 'abc1234!' }).status !== 400) throw new Error('bad'); });",
        "test('patch valid phone is accepted', () => { if (patchContact(1, { phone: '+1 555-0199' }).status !== 200) throw new Error('bad'); });",
      ),
    });
    const result = runOracle(workspace);
    assert.equal(result.status, 1, `${result.stdout}\n${result.stderr}`);
    assert.match(result.stdout, /tests reject broken PATCH validation mutants/);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});
