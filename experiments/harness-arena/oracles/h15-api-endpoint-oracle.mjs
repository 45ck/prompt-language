#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

const workspaceFlagIndex = process.argv.indexOf('--workspace');
const workspace = workspaceFlagIndex >= 0 ? process.argv[workspaceFlagIndex + 1] : process.argv[2];

if (!workspace) {
  console.error('Usage: h15-api-endpoint-oracle.mjs --workspace <workspace>');
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

const patchContact = app.patchContact || app.updateContact;

test('patchContact or updateContact function exists', () => {
  if (typeof patchContact !== 'function') {
    throw new Error('No patchContact/updateContact exported');
  }
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
    throw new Error('listContacts did not return the seed contacts');
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
  const missingAfterDelete = app.getContact(createResult.body.id);
  if (missingAfterDelete.status !== 404) throw new Error('deleted contact is still reachable');
});

test('PATCH returns 200 on valid name update', () => {
  const result = patchContact(1, { name: 'Alice Updated' });
  if (result.status !== 200) throw new Error(`Status ${result.status}`);
  if (result.body.name !== 'Alice Updated') throw new Error('Name not updated');
});

test('PATCH accepts valid email with dot after @', () => {
  const result = patchContact(2, { email: 'bob.new@example.com' });
  if (result.status !== 200) throw new Error(`Status ${result.status}`);
  if (result.body.email !== 'bob.new@example.com') throw new Error('Email not updated');
});

test('PATCH accepts valid phone characters and length', () => {
  const result = patchContact(2, { phone: '+1 555-0199' });
  if (result.status !== 200) throw new Error(`Status ${result.status}`);
  if (result.body.phone !== '+1 555-0199') throw new Error('Phone not updated');
});

test('PATCH accepts null company to clear field', () => {
  const result = patchContact(2, { company: null });
  if (result.status !== 200) throw new Error(`Status ${result.status}`);
  if (result.body.company !== null) throw new Error('Company not cleared');
});

test('PATCH only updates provided fields', () => {
  const before = app.getContact(3);
  const originalEmail = before.body.email;
  const originalPhone = before.body.phone;
  const result = patchContact(3, { name: 'Carol Patched' });
  if (result.status !== 200) throw new Error(`Status ${result.status}`);
  const after = app.getContact(3);
  if (after.body.name !== 'Carol Patched') throw new Error('Name not updated');
  if (after.body.email !== originalEmail) throw new Error('Email was changed');
  if (after.body.phone !== originalPhone) throw new Error('Phone was changed');
});

test('PATCH returns 404 for missing ID', () => {
  const result = patchContact(999, { name: 'Nobody' });
  if (result.status !== 404) throw new Error(`Status ${result.status}`);
});

test('PATCH rejects short name', () => {
  const result = patchContact(1, { name: 'A' });
  if (result.status !== 400) throw new Error(`Expected 400, got ${result.status}`);
});

test('PATCH rejects invalid email without dot after @', () => {
  const result = patchContact(1, { email: 'bad@domain' });
  if (result.status !== 400) throw new Error(`Expected 400, got ${result.status}`);
});

test('PATCH rejects invalid phone characters', () => {
  const result = patchContact(1, { phone: 'abc!@#' });
  if (result.status !== 400) throw new Error(`Expected 400, got ${result.status}`);
});

test('PATCH rejects empty company string', () => {
  const result = patchContact(1, { company: '' });
  if (result.status !== 400) throw new Error(`Expected 400, got ${result.status}`);
});

test('src/test.js has at least 8 PATCH-related tests', () => {
  const testSource = readFileSync(resolve(workspaceRoot, 'src/test.js'), 'utf8');
  const namedPatchTests = testSource.match(
    /test\s*\(\s*['"][^'"]*(patch|update|valid|invalid|404|null|company|partial)[^'"]*['"]/gi,
  );
  const patchCalls = testSource.match(/\b(patchContact|updateContact)\s*\(/g);
  const patchTestCount = Math.max(namedPatchTests?.length ?? 0, patchCalls?.length ?? 0);
  if (patchTestCount < 8) {
    throw new Error(`Expected 8+ PATCH tests, found ${patchTestCount}`);
  }
});

console.log(`\nResults: ${passed}/${passed + failed} passed`);
for (const result of results) console.log(result);

if (failed > 0) {
  console.log(`\nVERDICT: FAIL (${failed} failed)`);
  process.exit(1);
}

console.log('\nVERDICT: PASS');
