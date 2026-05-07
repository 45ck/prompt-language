#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const require = createRequire(import.meta.url);

function parseWorkspace(argv) {
  const index = argv.indexOf('--workspace');
  const value = index >= 0 ? argv[index + 1] : argv.at(-1);
  if (!value) throw new Error('usage: h14-tdd-red-green-oracle.mjs --workspace <workspace>');
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

function readWorkspaceFile(workspace, relativePath) {
  const path = join(workspace, ...relativePath.split('/'));
  assert(existsSync(path), `missing ${relativePath}`);
  return readFileSync(path, 'utf8');
}

function countMergeTests(testSource) {
  const testCalls = testSource.match(/test\s*\(\s*['"`][^'"`]*(merge|duplicate)[^'"`]*['"`]/gi);
  return testCalls?.length ?? 0;
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

function contact(name, email, phone, company) {
  return { name, email, phone, company };
}

function normalize(contacts) {
  return contacts
    .map(({ name, email, phone, company }) => ({ name, email, phone, company }))
    .sort((left, right) => left.email.localeCompare(right.email));
}

function runHiddenBehaviorChecks(workspace) {
  const { createContact, mergeDuplicates } = loadContacts(workspace);
  assert(typeof createContact === 'function', 'createContact export missing');
  assert(typeof mergeDuplicates === 'function', 'mergeDuplicates export missing');

  const basic = mergeDuplicates([
    createContact('Alice', 'alice@test.com', '111', null),
    createContact(null, 'alice@test.com', null, 'Acme'),
  ]);
  assert(basic.length === 1, `basic merge expected one contact, got ${basic.length}`);
  assert(basic[0].name === 'Alice', 'basic merge lost older non-empty name');
  assert(basic[0].phone === '111', 'basic merge lost older non-empty phone');
  assert(basic[0].company === 'Acme', 'basic merge did not add later company');

  const priority = mergeDuplicates([
    createContact('Old Alice', 'alice@test.com', '111', 'OldCo'),
    createContact('New Alice', 'alice@test.com', '', 'NewCo'),
  ]);
  assert(priority[0].name === 'New Alice', 'later non-empty name did not override');
  assert(priority[0].phone === '111', 'empty later phone should not erase older phone');
  assert(priority[0].company === 'NewCo', 'later non-empty company did not override');

  const grouped = normalize(
    mergeDuplicates([
      createContact('Alice', 'alice@test.com', null, null),
      createContact('Bob', 'bob@test.com', '222', null),
      createContact(null, 'alice@test.com', '111', 'Acme'),
      createContact('Bob B', 'bob@test.com', null, 'Beta'),
      createContact('Cara', 'cara@test.com', null, null),
    ]),
  );
  assert(
    JSON.stringify(grouped) ===
      JSON.stringify([
        contact('Alice', 'alice@test.com', '111', 'Acme'),
        contact('Bob B', 'bob@test.com', '222', 'Beta'),
        contact('Cara', 'cara@test.com', null, null),
      ]),
    `multiple duplicate groups merged incorrectly: ${JSON.stringify(grouped)}`,
  );
}

function main() {
  const workspace = parseWorkspace(process.argv.slice(2));
  const results = [];
  const contactsSource = readWorkspaceFile(workspace, 'src/contacts.js');
  const testSource = readWorkspaceFile(workspace, 'src/test.js');

  record(results, 'mergeDuplicates implementation exists', () => {
    assert(
      /\bfunction\s+mergeDuplicates\b|\bconst\s+mergeDuplicates\b|\bmergeDuplicates\s*=/.test(
        contactsSource,
      ),
      'mergeDuplicates implementation not found',
    );
  });
  record(results, 'mergeDuplicates is exported', () => {
    assert(
      /module\.exports\s*=.*mergeDuplicates/s.test(contactsSource),
      'mergeDuplicates not exported through module.exports',
    );
  });
  record(results, 'tests import and call mergeDuplicates', () => {
    assert(testSource.includes('mergeDuplicates'), 'src/test.js does not mention mergeDuplicates');
  });
  record(results, 'at least five merge/duplicate tests exist', () => {
    const count = countMergeTests(testSource);
    assert(count >= 5, `expected at least 5 merge/duplicate tests, found ${count}`);
  });
  record(results, 'public tests pass', () => runPublicTests(workspace));
  record(results, 'hidden behavior checks pass', () => runHiddenBehaviorChecks(workspace));

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
