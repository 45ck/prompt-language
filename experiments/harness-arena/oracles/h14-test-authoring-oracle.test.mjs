import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

const ORACLE = join(import.meta.dirname, 'h14-test-authoring-oracle.mjs');

const CONTACTS_SOURCE = `// Contact management module.

function createContact(name, email, phone, company) {
  return {
    name: name || null,
    email,
    phone: phone || null,
    company: company || null,
    createdAt: Date.now(),
  };
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
    byEmail.set(contact.email, {
      ...existing,
      name: contact.name || existing.name,
      phone: contact.phone || existing.phone,
      company: contact.company || existing.company,
    });
  }
  return [...byEmail.values()];
}

module.exports = { createContact, findByEmail, addContact, removeContact, mergeDuplicates };
`;

const GOOD_TESTS = `
const { createContact, findByEmail, addContact, removeContact, mergeDuplicates } = require('./contacts');
let passed = 0;
let failed = 0;
function test(name, fn) { try { fn(); passed += 1; } catch (error) { failed += 1; console.error(error.message); } }
function assertEqual(actual, expected, message) { if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(message); }
test('createContact sets fields', () => assertEqual(createContact('A', 'a@x').email, 'a@x', 'email'));
test('findByEmail returns matches', () => assertEqual(findByEmail([createContact('A', 'a@x')], 'a@x').length, 1, 'count'));
test('addContact returns new array', () => assertEqual(addContact([], createContact('A', 'a@x')).length, 1, 'count'));
test('removeContact removes by email', () => assertEqual(removeContact([createContact('A', 'a@x')], 'a@x').length, 0, 'count'));
test('merge duplicate contacts basic', () => assertEqual(mergeDuplicates([createContact('A', 'a@x', '1', 'Old'), createContact('B', 'a@x', '2', 'New')]).length, 1, 'count'));
test('merge duplicate later field priority', () => assertEqual(mergeDuplicates([createContact('A', 'a@x', '1', 'Old'), createContact('B', 'a@x', '2', 'New')])[0].name, 'B', 'name'));
test('merge duplicate older fallback', () => assertEqual(mergeDuplicates([createContact('A', 'a@x', '1', 'Old'), createContact(null, 'a@x', null, '')])[0].phone, '1', 'phone'));
test('merge no duplicates preserves contacts', () => assertEqual(mergeDuplicates([createContact('A', 'a@x'), createContact('B', 'b@x')]).length, 2, 'count'));
test('merge multiple duplicate groups', () => {
  const result = mergeDuplicates([createContact('A', 'a@x', null, null), createContact('B', 'b@x', '2', 'Old'), createContact(null, 'a@x', '1', 'New'), createContact('B2', 'b@x', null, 'New')]);
  assertEqual(result.length, 2, 'count');
  assertEqual(result[0].phone, '1', 'a phone');
  assertEqual(result[1].company, 'New', 'b company');
});
if (failed > 0) process.exit(1);
`;

const SHALLOW_TESTS = `
const { createContact, findByEmail, addContact, removeContact, mergeDuplicates } = require('./contacts');
let passed = 0;
let failed = 0;
function test(name, fn) { try { fn(); passed += 1; } catch (error) { failed += 1; console.error(error.message); } }
function assertEqual(actual, expected, message) { if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(message); }
test('createContact sets fields', () => assertEqual(createContact('A', 'a@x').email, 'a@x', 'email'));
test('findByEmail returns matches', () => assertEqual(findByEmail([createContact('A', 'a@x')], 'a@x').length, 1, 'count'));
test('addContact returns new array', () => assertEqual(addContact([], createContact('A', 'a@x')).length, 1, 'count'));
test('removeContact removes by email', () => assertEqual(removeContact([createContact('A', 'a@x')], 'a@x').length, 0, 'count'));
test('merge duplicate contacts basic', () => { mergeDuplicates([createContact('A', 'a@x')]); });
test('merge duplicate later field priority', () => { mergeDuplicates([createContact('A', 'a@x')]); });
test('merge duplicate older fallback', () => { mergeDuplicates([createContact('A', 'a@x')]); });
test('merge no duplicates preserves contacts', () => { mergeDuplicates([createContact('A', 'a@x')]); });
test('merge multiple duplicate groups', () => { mergeDuplicates([createContact('A', 'a@x')]); });
if (failed > 0) process.exit(1);
`;

function tempWorkspace() {
  return join(
    tmpdir(),
    `ha-h14-test-authoring-oracle-${process.pid}-${Date.now()}-${Math.random()}`,
  );
}

function writeWorkspace(workspace, { contactsSource = CONTACTS_SOURCE, testSource = GOOD_TESTS }) {
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

test('H14 test-authoring oracle passes meaningful merge tests', () => {
  const workspace = tempWorkspace();
  try {
    writeWorkspace(workspace, {});
    const result = runOracle(workspace);
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.match(result.stdout, /PASS: tests reject broken merge implementations/);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('H14 test-authoring oracle rejects missing merge import', () => {
  const workspace = tempWorkspace();
  try {
    writeWorkspace(workspace, {
      testSource: GOOD_TESTS.replace('removeContact, mergeDuplicates', 'removeContact'),
    });
    const result = runOracle(workspace);
    assert.equal(result.status, 1, `${result.stdout}\n${result.stderr}`);
    assert.match(result.stdout, /does not import mergeDuplicates/);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('H14 test-authoring oracle rejects shallow tests that do not kill mutants', () => {
  const workspace = tempWorkspace();
  try {
    writeWorkspace(workspace, {
      testSource: SHALLOW_TESTS,
    });
    const result = runOracle(workspace);
    assert.equal(result.status, 1, `${result.stdout}\n${result.stderr}`);
    assert.match(result.stdout, /tests did not fail against mutant/);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});
