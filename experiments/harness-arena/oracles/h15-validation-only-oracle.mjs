#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

const workspaceFlagIndex = process.argv.indexOf('--workspace');
const workspace = workspaceFlagIndex >= 0 ? process.argv[workspaceFlagIndex + 1] : process.argv[2];

if (!workspace) {
  console.error('Usage: h15-validation-only-oracle.mjs --workspace <workspace>');
  process.exit(2);
}

const workspaceRoot = resolve(workspace);
const requireFromWorkspace = createRequire(`${workspaceRoot}/`);
const results = [];
let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed += 1;
    results.push(`  PASS: ${name}`);
  } catch (error) {
    failed += 1;
    results.push(`  FAIL: ${name} -- ${error.message}`);
  }
}

let app;
try {
  const appPath = requireFromWorkspace.resolve('./src/app.js');
  delete requireFromWorkspace.cache?.[appPath];
  app = requireFromWorkspace('./src/app.js');
} catch (error) {
  console.error(`Failed to load workspace app: ${error.message}`);
  process.exit(1);
}

const patchContact = app.patchContact;

test('patchContact function exists', () => {
  if (typeof patchContact !== 'function') throw new Error('No patchContact exported');
});

test('original exports are preserved', () => {
  for (const exportName of [
    'listContacts',
    'getContact',
    'createContact',
    'deleteContact',
    'contacts',
  ]) {
    if (!(exportName in app)) throw new Error(`Missing ${exportName}`);
  }
});

test('existing GET, POST, and DELETE behavior is preserved', () => {
  const listResult = app.listContacts();
  if (listResult.status !== 200) throw new Error(`list status ${listResult.status}`);
  if (!Array.isArray(listResult.body) || listResult.body.length < 3) {
    throw new Error('listContacts did not return seed contacts');
  }

  const getResult = app.getContact(1);
  if (getResult.status !== 200) throw new Error(`get status ${getResult.status}`);
  if (getResult.body.name !== 'Alice Johnson') throw new Error('seed contact changed');

  const createResult = app.createContact({
    name: 'Delete Candidate',
    email: 'delete.candidate@example.com',
  });
  if (createResult.status !== 201) throw new Error(`create status ${createResult.status}`);
  const deleteResult = app.deleteContact(createResult.body.id);
  if (deleteResult.status !== 204) throw new Error(`delete status ${deleteResult.status}`);
  if (deleteResult.body !== null) throw new Error('delete body should be null');
});

test('valid PATCH updates still work', () => {
  let result = patchContact(1, { name: 'Alice Validated' });
  if (result.status !== 200) throw new Error(`valid name status ${result.status}`);
  if (result.body.name !== 'Alice Validated') throw new Error('name not updated');

  result = patchContact(2, { email: 'bob.validated@example.com' });
  if (result.status !== 200) throw new Error(`valid email status ${result.status}`);
  if (result.body.email !== 'bob.validated@example.com') throw new Error('email not updated');

  result = patchContact(2, { phone: '+1 555-0199' });
  if (result.status !== 200) throw new Error(`valid phone status ${result.status}`);
  if (result.body.phone !== '+1 555-0199') throw new Error('phone not updated');

  result = patchContact(2, { company: null });
  if (result.status !== 200) throw new Error(`null company status ${result.status}`);
  if (result.body.company !== null) throw new Error('company not cleared');
});

test('PATCH only updates provided fields', () => {
  const before = app.getContact(3);
  const originalEmail = before.body.email;
  const originalPhone = before.body.phone;
  const result = patchContact(3, { name: 'Carol Validated' });
  if (result.status !== 200) throw new Error(`Status ${result.status}`);
  const after = app.getContact(3);
  if (after.body.name !== 'Carol Validated') throw new Error('Name not updated');
  if (after.body.email !== originalEmail) throw new Error('Email was changed');
  if (after.body.phone !== originalPhone) throw new Error('Phone was changed');
});

test('PATCH returns 404 for missing ID', () => {
  const result = patchContact(999, { name: 'Nobody' });
  if (result.status !== 404) throw new Error(`Status ${result.status}`);
});

test('PATCH rejects invalid validation edge cases', () => {
  const cases = [
    ['short name', { name: 'A' }],
    ['long name', { name: 'A'.repeat(101) }],
    ['non-string name', { name: null }],
    ['email without dot after @', { email: 'bad@domain' }],
    ['email without @', { email: 'bad.domain' }],
    ['non-string email', { email: null }],
    ['invalid phone characters', { phone: 'abc!@#' }],
    ['short phone', { phone: '123456' }],
    ['long phone', { phone: '+1 555 0101 0101 0101 9999' }],
    ['empty company string', { company: '' }],
    ['long company', { company: 'C'.repeat(201) }],
    ['non-string company', { company: 123 }],
  ];

  for (const [name, data] of cases) {
    const result = patchContact(1, data);
    if (result.status !== 400) throw new Error(`${name} expected 400, got ${result.status}`);
    if (!result.body?.error) throw new Error(`${name} did not include an error body`);
  }
});

test('src/test.js has validation-focused PATCH tests', () => {
  const testSource = readFileSync(resolve(workspaceRoot, 'src/test.js'), 'utf8');
  const validationTests = testSource.match(
    /test\s*\(\s*['"][^'"]*(validation|invalid|reject|short|email|phone|company|null|partial)[^'"]*['"]/gi,
  );
  const patchCalls = testSource.match(/\bpatchContact\s*\(/g);
  if ((validationTests?.length ?? 0) < 6) {
    throw new Error(`Expected 6+ validation-focused tests, found ${validationTests?.length ?? 0}`);
  }
  if ((patchCalls?.length ?? 0) < 6) {
    throw new Error(`Expected 6+ patchContact calls, found ${patchCalls?.length ?? 0}`);
  }
});

console.log(`\nResults: ${passed}/${passed + failed} passed`);
for (const result of results) console.log(result);

if (failed > 0) {
  console.log(`\nVERDICT: FAIL (${failed} failed)`);
  process.exit(1);
}

console.log('\nVERDICT: PASS');
