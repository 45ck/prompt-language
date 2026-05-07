import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

const ORACLE = join(import.meta.dirname, 'h14-tdd-red-green-oracle.mjs');

function tempWorkspace() {
  return join(tmpdir(), `ha-h14-oracle-${process.pid}-${Date.now()}-${Math.random()}`);
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
  return { name: name || null, email, phone: phone || null, company: company || null };
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
module.exports = { createContact, mergeDuplicates };
`;

const PASSING_TESTS = `
const { createContact, mergeDuplicates } = require('./contacts');
function test(name, fn) { fn(); console.log(name); }
function assert(condition, message) { if (!condition) throw new Error(message); }
test('merge basic duplicate contacts', () => assert(mergeDuplicates([createContact('A', 'a@x', null, null), createContact(null, 'a@x', '1', null)]).length === 1));
test('merge duplicate later fields win', () => assert(mergeDuplicates([createContact('A', 'a@x', null, null), createContact('B', 'a@x', null, null)])[0].name === 'B'));
test('merge duplicate older fallback stays', () => assert(mergeDuplicates([createContact('A', 'a@x', '1', null), createContact(null, 'a@x', null, null)])[0].phone === '1'));
test('merge no duplicates preserves count', () => assert(mergeDuplicates([createContact('A', 'a@x', null, null), createContact('B', 'b@x', null, null)]).length === 2));
test('merge multiple duplicate groups', () => assert(mergeDuplicates([createContact('A', 'a@x', null, null), createContact('B', 'b@x', null, null), createContact(null, 'a@x', '1', null)]).length === 2));
`;

test('H14 oracle passes a complete TDD merge implementation', () => {
  const workspace = tempWorkspace();
  try {
    writeWorkspace(workspace, {
      contactsSource: PASSING_CONTACTS,
      testSource: PASSING_TESTS,
    });
    const result = runOracle(workspace);
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.match(result.stdout, /PASS: hidden behavior checks pass/);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('H14 oracle rejects implementations without enough merge tests', () => {
  const workspace = tempWorkspace();
  try {
    writeWorkspace(workspace, {
      contactsSource: PASSING_CONTACTS,
      testSource: `
const { createContact, mergeDuplicates } = require('./contacts');
function test(name, fn) { fn(); }
test('merge one duplicate', () => mergeDuplicates([createContact('A', 'a@x')]));
`,
    });
    const result = runOracle(workspace);
    assert.equal(result.status, 1, `${result.stdout}\n${result.stderr}`);
    assert.match(result.stdout, /expected at least 5 merge\/duplicate tests/);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});
