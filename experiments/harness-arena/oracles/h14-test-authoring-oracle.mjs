#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const EXPECTED_CONTACTS_SOURCE = `// Contact management module.

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

const MUTANTS = {
  'return original contacts without merging': EXPECTED_CONTACTS_SOURCE.replace(
    /function mergeDuplicates\(contacts\) \{[\s\S]*?\n\}/,
    'function mergeDuplicates(contacts) {\n  return contacts;\n}',
  ),
  'keep only first duplicate values': EXPECTED_CONTACTS_SOURCE.replace(
    /function mergeDuplicates\(contacts\) \{[\s\S]*?\n\}/,
    `function mergeDuplicates(contacts) {
  const byEmail = new Map();
  for (const contact of contacts) {
    if (!byEmail.has(contact.email)) byEmail.set(contact.email, { ...contact });
  }
  return [...byEmail.values()];
}`,
  ),
  'erase older values with empty later values': EXPECTED_CONTACTS_SOURCE.replace(
    /function mergeDuplicates\(contacts\) \{[\s\S]*?\n\}/,
    `function mergeDuplicates(contacts) {
  const byEmail = new Map();
  for (const contact of contacts) {
    const existing = byEmail.get(contact.email);
    byEmail.set(contact.email, existing ? { ...existing, ...contact } : { ...contact });
  }
  return [...byEmail.values()];
}`,
  ),
};

function parseWorkspace(argv) {
  const index = argv.indexOf('--workspace');
  const value = index >= 0 ? argv[index + 1] : argv.at(-1);
  if (!value) throw new Error('usage: h14-test-authoring-oracle.mjs --workspace <workspace>');
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

function runPublicTests(workspace) {
  const result = spawnSync(process.execPath, ['src/test.js'], {
    cwd: workspace,
    encoding: 'utf8',
    timeout: 10_000,
    windowsHide: true,
  });
  assert(result.status === 0, `npm-equivalent test failed:\n${result.stdout}\n${result.stderr}`);
  return result;
}

function countMergeTests(testSource) {
  const testCalls = testSource.match(/test\s*\(\s*['"`][^'"`]*(merge|duplicate)[^'"`]*['"`]/gi);
  return testCalls?.length ?? 0;
}

function countMergeCalls(testSource) {
  return testSource.match(/mergeDuplicates\s*\(/g)?.length ?? 0;
}

function assertTestShape(testSource) {
  assert(testSource.includes('mergeDuplicates'), 'src/test.js does not mention mergeDuplicates');
  assert(
    /const\s+\{[\s\S]*mergeDuplicates[\s\S]*\}\s*=\s*require\(['"]\.\/contacts['"]\)/.test(
      testSource,
    ),
    'src/test.js does not import mergeDuplicates from ./contacts',
  );
  const tests = countMergeTests(testSource);
  const calls = countMergeCalls(testSource);
  assert(tests >= 5, `expected at least 5 merge/duplicate tests, found ${tests}`);
  assert(calls >= 5, `expected at least 5 mergeDuplicates calls, found ${calls}`);
  for (const original of [
    'createContact sets fields',
    'findByEmail returns matches',
    'addContact returns new array',
    'removeContact removes by email',
  ]) {
    assert(testSource.includes(original), `existing test removed: ${original}`);
  }
}

function assertContactsUnchanged(contactsSource) {
  assert(
    contactsSource.trim() === EXPECTED_CONTACTS_SOURCE.trim(),
    'src/contacts.js changed; this subrole is tests-only',
  );
}

function assertTestsKillMutants(workspace, testSource) {
  for (const [name, contactsSource] of Object.entries(MUTANTS)) {
    const mutantWorkspace = mkdtempSync(join(tmpdir(), 'ha-h14-test-authoring-mutant-'));
    try {
      writeFileSync(
        join(mutantWorkspace, 'package.json'),
        JSON.stringify({ private: true, type: 'commonjs', scripts: { test: 'node src/test.js' } }),
      );
      mkdirSync(join(mutantWorkspace, 'src'), { recursive: true });
      writeFileSync(join(mutantWorkspace, 'src', 'contacts.js'), contactsSource);
      writeFileSync(join(mutantWorkspace, 'src', 'test.js'), testSource);
      const result = spawnSync(process.execPath, ['src/test.js'], {
        cwd: mutantWorkspace,
        encoding: 'utf8',
        timeout: 10_000,
        windowsHide: true,
      });
      assert(result.status !== 0, `tests did not fail against mutant: ${name}`);
    } finally {
      rmSync(mutantWorkspace, { recursive: true, force: true });
    }
  }
}

function main() {
  const workspace = parseWorkspace(process.argv.slice(2));
  const results = [];
  const contactsSource = readWorkspaceFile(workspace, 'src/contacts.js');
  const testSource = readWorkspaceFile(workspace, 'src/test.js');

  record(results, 'contacts implementation remains unchanged', () =>
    assertContactsUnchanged(contactsSource),
  );
  record(results, 'tests import and exercise mergeDuplicates', () => assertTestShape(testSource));
  record(results, 'public tests pass', () => runPublicTests(workspace));
  record(results, 'tests reject broken merge implementations', () =>
    assertTestsKillMutants(workspace, testSource),
  );

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
