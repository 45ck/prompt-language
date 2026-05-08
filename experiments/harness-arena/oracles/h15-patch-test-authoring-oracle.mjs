#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const EXPECTED_APP_SOURCE = `// Simple API framework (no Express dependency).
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

const MUTANTS = {
  'allow email without dot after at': EXPECTED_APP_SOURCE.replace(
    "return atIndex > 0 && email.indexOf('.', atIndex + 1) > atIndex + 1;",
    'return atIndex > 0;',
  ),
  'allow invalid phone characters': EXPECTED_APP_SOURCE.replace(
    "return typeof phone === 'string' && /^\\+?[\\d\\s-]{7,20}$/.test(phone);",
    "return typeof phone === 'string' && phone.length >= 7 && phone.length <= 20;",
  ),
  'allow short names': EXPECTED_APP_SOURCE.replace('data.name.length < 2 || ', ''),
  'allow empty company strings': EXPECTED_APP_SOURCE.replace('data.company.length < 1 || ', ''),
  'reject null company': EXPECTED_APP_SOURCE.replace(
    `data.company !== undefined &&
    data.company !== null &&
    (typeof data.company !== 'string' || data.company.length < 1 || data.company.length > 200)`,
    `data.company !== undefined &&
    (typeof data.company !== 'string' || data.company.length < 1 || data.company.length > 200)`,
  ),
  'overwrite unrelated fields during partial update': EXPECTED_APP_SOURCE.replace(
    'if (data[field] !== undefined) contact[field] = data[field];',
    'contact[field] = data[field] ?? null;',
  ),
};

function parseWorkspace(argv) {
  const index = argv.indexOf('--workspace');
  const value = index >= 0 ? argv[index + 1] : argv.at(-1);
  if (!value) throw new Error('usage: h15-patch-test-authoring-oracle.mjs --workspace <workspace>');
  return resolve(value);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function record(results, name, fn) {
  try {
    fn();
    results.push({ name, passed: true });
  } catch (error) {
    results.push({ name, passed: false, message: error.message });
  }
}

function readWorkspaceFile(workspace, relativePath) {
  const path = join(workspace, ...relativePath.split('/'));
  assert(existsSync(path), `missing ${relativePath}`);
  return readFileSync(path, 'utf8');
}

function runTests(workspace) {
  const result = spawnSync(process.execPath, ['src/test.js'], {
    cwd: workspace,
    encoding: 'utf8',
    timeout: 10_000,
    windowsHide: true,
  });
  assert(result.status === 0, `public tests failed:\n${result.stdout}\n${result.stderr}`);
}

function assertAppUnchanged(appSource) {
  assert(
    appSource.trim() === EXPECTED_APP_SOURCE.trim(),
    'src/app.js changed; this route is tests-only',
  );
}

function assertTestShape(testSource) {
  assert(
    /const\s+\{[\s\S]*patchContact[\s\S]*\}\s*=\s*require\(['"]\.\/app['"]\)/.test(testSource),
    'src/test.js does not import patchContact from ./app',
  );

  const validationTests =
    testSource.match(
      /test\s*\(\s*['"][^'"]*(patch|validation|invalid|reject|short|long|email|phone|company|null|partial|missing)[^'"]*['"]/gi,
    )?.length ?? 0;
  const patchCalls = testSource.match(/\bpatchContact\s*\(/g)?.length ?? 0;
  assert(
    validationTests >= 8,
    `expected at least 8 PATCH validation tests, found ${validationTests}`,
  );
  assert(patchCalls >= 9, `expected at least 9 patchContact calls, found ${patchCalls}`);

  const requiredCases = [
    [/name:\s*['"]A['"]/, 'short name'],
    [/repeat\(101\)/, 'long name'],
    [/email:\s*['"]bad@domain['"]|email:\s*['"]test@domain['"]/, 'email without dot after @'],
    [/email:\s*['"]bad\.domain['"]|email:\s*['"]testdomain\.com['"]/, 'email without @'],
    [/phone:\s*['"][^'"]*[A-Za-z!][^'"]*['"]/, 'invalid phone characters'],
    [/phone:\s*['"]123456['"]/, 'short phone'],
    [/company:\s*['"]{2}/, 'empty company string'],
    [/company:\s*null/, 'null company'],
    [/patchContact\(\s*999/, 'missing ID'],
  ];
  for (const [pattern, label] of requiredCases) {
    assert(pattern.test(testSource), `missing required case: ${label}`);
  }

  for (const original of [
    'listContacts returns all',
    'getContact returns existing',
    'createContact succeeds',
    'deleteContact preserves 204 null success behavior',
    'patchContact valid name update works',
  ]) {
    assert(testSource.includes(original), `existing test removed: ${original}`);
  }
}

function assertTestsKillMutants(testSource) {
  for (const [name, appSource] of Object.entries(MUTANTS)) {
    const mutantWorkspace = mkdtempSync(join(tmpdir(), 'ha-h15-test-authoring-mutant-'));
    try {
      mkdirSync(join(mutantWorkspace, 'src'), { recursive: true });
      writeFileSync(
        join(mutantWorkspace, 'package.json'),
        JSON.stringify({ private: true, type: 'commonjs', scripts: { test: 'node src/test.js' } }),
      );
      writeFileSync(join(mutantWorkspace, 'src', 'app.js'), appSource);
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
  const appSource = readWorkspaceFile(workspace, 'src/app.js');
  const testSource = readWorkspaceFile(workspace, 'src/test.js');

  record(results, 'implementation remains unchanged', () => assertAppUnchanged(appSource));
  record(results, 'tests import and exercise PATCH validation', () => assertTestShape(testSource));
  record(results, 'public tests pass', () => runTests(workspace));
  record(results, 'tests reject broken PATCH validation mutants', () =>
    assertTestsKillMutants(testSource),
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
