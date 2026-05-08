import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

const ORACLE = join(import.meta.dirname, 'h15-validation-only-oracle.mjs');

function tempWorkspace() {
  return join(tmpdir(), `ha-h15-validation-oracle-${process.pid}-${Date.now()}-${Math.random()}`);
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

const PASSING_TESTS = `
const { patchContact } = require('./app');
function test(name, fn) { fn(); console.log(name); }
test('patch invalid short name is rejected', () => { if (patchContact(1, { name: 'A' }).status !== 400) throw new Error('bad'); });
test('patch invalid email without dot is rejected', () => { if (patchContact(1, { email: 'bad@domain' }).status !== 400) throw new Error('bad'); });
test('patch invalid phone characters are rejected', () => { if (patchContact(1, { phone: 'abc!@#' }).status !== 400) throw new Error('bad'); });
test('patch empty company is rejected', () => { if (patchContact(1, { company: '' }).status !== 400) throw new Error('bad'); });
test('patch null company is accepted', () => { if (patchContact(2, { company: null }).status !== 200) throw new Error('bad'); });
test('patch partial update preserves other fields', () => { if (patchContact(3, { name: 'Carol Validated' }).status !== 200) throw new Error('bad'); });
`;

test('H15 validation oracle passes a validation-hardened PATCH implementation', () => {
  const workspace = tempWorkspace();
  try {
    writeWorkspace(workspace, {
      appSource: PASSING_APP,
      testSource: PASSING_TESTS,
    });
    const result = runOracle(workspace);
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.match(result.stdout, /VERDICT: PASS/);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('H15 validation oracle rejects empty company strings', () => {
  const workspace = tempWorkspace();
  try {
    writeWorkspace(workspace, {
      appSource: PASSING_APP.replace('data.company.length < 1 || ', ''),
      testSource: PASSING_TESTS,
    });
    const result = runOracle(workspace);
    assert.equal(result.status, 1, `${result.stdout}\n${result.stderr}`);
    assert.match(result.stdout, /empty company string/);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('H15 validation oracle rejects missing validation tests', () => {
  const workspace = tempWorkspace();
  try {
    writeWorkspace(workspace, {
      appSource: PASSING_APP,
      testSource: "const { patchContact } = require('./app'); patchContact(1, { name: 'Ok' });",
    });
    const result = runOracle(workspace);
    assert.equal(result.status, 1, `${result.stdout}\n${result.stderr}`);
    assert.match(result.stdout, /Expected 6\+ validation-focused tests/);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});
