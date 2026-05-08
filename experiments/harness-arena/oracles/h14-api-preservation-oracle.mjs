#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const require = createRequire(import.meta.url);
const EXPECTED_EXPORTS = [
  'addContact',
  'createContact',
  'findByEmail',
  'mergeDuplicates',
  'removeContact',
];

function parseWorkspace(argv) {
  const index = argv.indexOf('--workspace');
  const value = index >= 0 ? argv[index + 1] : argv.at(-1);
  if (!value) throw new Error('usage: h14-api-preservation-oracle.mjs --workspace <workspace>');
  return resolve(value);
}

function record(results, name, fn) {
  try {
    fn();
    results.push({ name, passed: true });
  } catch (error) {
    results.push({ name, passed: false, message: error.message });
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertEqual(actual, expected, message) {
  const actualJson = JSON.stringify(actual);
  const expectedJson = JSON.stringify(expected);
  assert(actualJson === expectedJson, `${message}: expected ${expectedJson}, got ${actualJson}`);
}

function readWorkspaceFile(workspace, relativePath) {
  const path = join(workspace, ...relativePath.split('/'));
  assert(existsSync(path), `missing ${relativePath}`);
  return readFileSync(path, 'utf8');
}

function runPublicTests(workspace) {
  const result = spawnSync(process.execPath, ['src/test.js'], {
    cwd: workspace,
    encoding: 'utf8',
    timeout: 10_000,
    windowsHide: true,
  });
  assert(result.status === 0, `npm-equivalent test failed:\n${result.stdout}\n${result.stderr}`);
}

function loadContacts(workspace) {
  const modulePath = join(workspace, 'src', 'contacts.js');
  delete require.cache[require.resolve(modulePath)];
  return require(modulePath);
}

function snapshot(contact) {
  return {
    name: contact.name,
    email: contact.email,
    phone: contact.phone,
    company: contact.company,
  };
}

function runApiChecks(workspace) {
  const contacts = loadContacts(workspace);
  assertEqual(Object.keys(contacts).sort(), EXPECTED_EXPORTS, 'export names changed');

  const { createContact, findByEmail, addContact, removeContact, mergeDuplicates } = contacts;
  assert(typeof createContact === 'function', 'createContact export missing');
  assert(typeof findByEmail === 'function', 'findByEmail export missing');
  assert(typeof addContact === 'function', 'addContact export missing');
  assert(typeof removeContact === 'function', 'removeContact export missing');
  assert(typeof mergeDuplicates === 'function', 'mergeDuplicates export missing');
  assert(createContact.length === 4, 'createContact arity changed');
  assert(findByEmail.length === 2, 'findByEmail arity changed');
  assert(addContact.length === 2, 'addContact arity changed');
  assert(removeContact.length === 2, 'removeContact arity changed');
  assert(mergeDuplicates.length === 1, 'mergeDuplicates arity changed');

  const before = Date.now();
  const blank = createContact('', 'blank@test.com', '', undefined);
  const after = Date.now();
  assertEqual(
    snapshot(blank),
    {
      name: null,
      email: 'blank@test.com',
      phone: null,
      company: null,
    },
    'createContact falsy defaults changed',
  );
  assert(
    Number.isInteger(blank.createdAt) && blank.createdAt >= before && blank.createdAt <= after,
    'createContact createdAt changed',
  );

  const alice = createContact('Alice', 'alice@test.com', '111', 'Acme');
  const bob = createContact('Bob', 'bob@test.com', '222', 'Beta');
  const alice2 = createContact('Alice2', 'alice@test.com', '333', null);
  const contactsList = [alice, bob, alice2];
  assertEqual(findByEmail(contactsList, 'alice@test.com'), [alice, alice2], 'findByEmail changed');
  const added = addContact([alice], bob);
  assert(added.length === 2 && added[0] === alice && added[1] === bob, 'addContact changed');
  assertEqual(removeContact(contactsList, 'alice@test.com'), [bob], 'removeContact changed');
}

function runHiddenMergeChecks(workspace) {
  const { createContact, mergeDuplicates } = loadContacts(workspace);

  const input = [
    createContact('First', 'first@test.com', '111', 'OldCo'),
    createContact('Second', 'second@test.com', null, null),
    createContact('', 'first@test.com', '', 'NewCo'),
    createContact('Second New', 'second@test.com', '222', ''),
    createContact('Third', 'third@test.com', null, 'ThirdCo'),
  ];
  const before = JSON.stringify(input);
  const merged = mergeDuplicates(input);
  assert(JSON.stringify(input) === before, 'mergeDuplicates mutated input contacts');
  assert(merged !== input, 'mergeDuplicates returned original input array');
  assertEqual(
    merged.map((contact) => contact.email),
    ['first@test.com', 'second@test.com', 'third@test.com'],
    'mergeDuplicates changed first-seen group order',
  );
  assertEqual(
    snapshot(merged[0]),
    {
      name: 'First',
      email: 'first@test.com',
      phone: '111',
      company: 'NewCo',
    },
    'mergeDuplicates first group incorrect',
  );
  assertEqual(
    snapshot(merged[1]),
    {
      name: 'Second New',
      email: 'second@test.com',
      phone: '222',
      company: null,
    },
    'mergeDuplicates second group incorrect',
  );
  assertEqual(
    snapshot(merged[2]),
    {
      name: 'Third',
      email: 'third@test.com',
      phone: null,
      company: 'ThirdCo',
    },
    'mergeDuplicates unique group incorrect',
  );
}

function main() {
  const workspace = parseWorkspace(process.argv.slice(2));
  const results = [];
  const contactsSource = readWorkspaceFile(workspace, 'src/contacts.js');
  const testSource = readWorkspaceFile(workspace, 'src/test.js');

  record(results, 'source keeps expected export names', () => {
    for (const name of EXPECTED_EXPORTS) {
      assert(contactsSource.includes(name), `${name} missing from src/contacts.js`);
    }
  });
  record(results, 'public tests keep API contract coverage', () => {
    for (const fragment of ['exports preserve', 'arity', 'createdAt', 'mergeDuplicates']) {
      assert(testSource.includes(fragment), `src/test.js lost ${fragment} coverage`);
    }
  });
  record(results, 'public tests pass', () => runPublicTests(workspace));
  record(results, 'hidden API checks pass', () => runApiChecks(workspace));
  record(results, 'hidden merge checks pass', () => runHiddenMergeChecks(workspace));

  const failed = results.filter((result) => !result.passed);
  for (const result of results) {
    const prefix = result.passed ? 'PASS' : 'FAIL';
    console.log(`${prefix}: ${result.name}${result.message ? ` -- ${result.message}` : ''}`);
  }
  console.log(`\nResults: ${results.length - failed.length}/${results.length} passed`);
  if (failed.length > 0) process.exit(1);
}

try {
  main();
} catch (error) {
  console.error(error?.stack ?? error);
  process.exit(2);
}
