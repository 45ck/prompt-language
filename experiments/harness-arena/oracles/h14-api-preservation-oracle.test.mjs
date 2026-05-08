import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

const ORACLE = join(import.meta.dirname, 'h14-api-preservation-oracle.mjs');

function tempWorkspace() {
  return join(tmpdir(), `ha-h14-api-oracle-${process.pid}-${Date.now()}-${Math.random()}`);
}

function writeWorkspace(workspace, { contactsSource, testSource }) {
  mkdirSync(join(workspace, 'src'), { recursive: true });
  writeFileSync(
    join(workspace, 'package.json'),
    JSON.stringify({ private: true, type: 'commonjs', scripts: { test: 'node src/test.js' } }),
  );
  writeFileSync(join(workspace, 'src', 'contacts.js'), contactsSource);
  writeFileSync(join(workspace, 'src', 'test.js'), testSource);
}

function runOracle(workspace) {
  return spawnSync(process.execPath, [ORACLE, '--workspace', workspace], {
    encoding: 'utf8',
    timeout: 15_000,
    windowsHide: true,
  });
}

const PASSING_CONTACTS = `
function createContact(name, email, phone, company) {
  return { name: name || null, email, phone: phone || null, company: company || null, createdAt: Date.now() };
}
function findByEmail(contacts, email) {
  return contacts.filter((contact) => contact.email === email);
}
function addContact(contacts, contact) {
  return [...contacts, contact];
}
function removeContact(contacts, email) {
  return contacts.filter((contact) => contact.email !== email);
}
function mergeDuplicates(contacts) {
  const byEmail = new Map();
  for (const contact of contacts) {
    const existing = byEmail.get(contact.email);
    if (!existing) {
      byEmail.set(contact.email, { ...contact });
      continue;
    }
    for (const field of ['name', 'phone', 'company']) {
      if (contact[field]) existing[field] = contact[field];
    }
  }
  return [...byEmail.values()];
}
module.exports = { createContact, findByEmail, addContact, removeContact, mergeDuplicates };
`;

const PASSING_TESTS = `
const contacts = require('./contacts');
const { createContact, findByEmail, addContact, removeContact, mergeDuplicates } = contacts;
function test(name, fn) { fn(); console.log(name); }
function assert(condition, message) { if (!condition) throw new Error(message); }
test('exports preserve public function names', () => assert(Object.keys(contacts).includes('mergeDuplicates')));
test('exports preserve positional arity', () => assert(createContact.length === 4 && mergeDuplicates.length === 1));
test('createContact preserves field defaults and createdAt', () => assert(createContact('', 'a@x', '', null).createdAt));
test('findByEmail returns matching contacts without mutation', () => assert(findByEmail([createContact('A', 'a@x')], 'a@x').length === 1));
test('addContact returns a new array and preserves existing entries', () => assert(addContact([], createContact('A', 'a@x')).length === 1));
test('removeContact removes all contacts with matching email', () => assert(removeContact([createContact('A', 'a@x')], 'a@x').length === 0));
test('mergeDuplicates later non-empty fields override earlier values', () => assert(mergeDuplicates([createContact('A', 'a@x', null, null), createContact('B', 'a@x', null, null)])[0].name === 'B'));
test('mergeDuplicates keeps earlier non-empty fields when later values are empty', () => assert(mergeDuplicates([createContact('A', 'a@x', '1', null), createContact(null, 'a@x', null, null)])[0].phone === '1'));
test('mergeDuplicates preserves unique contacts and group order', () => assert(mergeDuplicates([createContact('A', 'a@x'), createContact('B', 'b@x')]).length === 2));
`;

test('H14 API preservation oracle passes a complete API-preserving merge implementation', () => {
  const workspace = tempWorkspace();
  try {
    writeWorkspace(workspace, {
      contactsSource: PASSING_CONTACTS,
      testSource: PASSING_TESTS,
    });
    const result = runOracle(workspace);
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.match(result.stdout, /PASS: hidden API checks pass/);
    assert.match(result.stdout, /PASS: hidden merge checks pass/);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('H14 API preservation oracle rejects changed arity', () => {
  const workspace = tempWorkspace();
  try {
    writeWorkspace(workspace, {
      contactsSource: PASSING_CONTACTS.replace(
        'function createContact(name, email, phone, company)',
        'function createContact({ name, email, phone, company })',
      ),
      testSource: PASSING_TESTS,
    });
    const result = runOracle(workspace);
    assert.equal(result.status, 1, `${result.stdout}\n${result.stderr}`);
    assert.match(result.stdout, /createContact arity changed/);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('H14 API preservation oracle rejects merge implementations that mutate inputs', () => {
  const workspace = tempWorkspace();
  try {
    writeWorkspace(workspace, {
      contactsSource: PASSING_CONTACTS.replace(
        'byEmail.set(contact.email, { ...contact });',
        'byEmail.set(contact.email, contact);',
      ),
      testSource: PASSING_TESTS,
    });
    const result = runOracle(workspace);
    assert.equal(result.status, 1, `${result.stdout}\n${result.stderr}`);
    assert.match(result.stdout, /mergeDuplicates mutated input contacts/);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});
