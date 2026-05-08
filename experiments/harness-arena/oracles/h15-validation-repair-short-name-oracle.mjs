#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';

const workspaceFlagIndex = process.argv.indexOf('--workspace');
const workspace = workspaceFlagIndex >= 0 ? process.argv[workspaceFlagIndex + 1] : process.argv[2];

if (!workspace) {
  console.error('Usage: h15-validation-repair-short-name-oracle.mjs --workspace <workspace>');
  process.exit(2);
}

const workspaceRoot = resolve(workspace);
const fixtureRoot = resolve(
  import.meta.dirname,
  '..',
  'fixtures',
  'h15-validation-repair-short-name',
);
const requireFromWorkspace = createRequire(`${workspaceRoot}/`);
const results = [];
let passed = 0;
let failed = 0;

function record(name, fn) {
  try {
    fn();
    passed += 1;
    results.push(`  PASS: ${name}`);
  } catch (error) {
    failed += 1;
    results.push(`  FAIL: ${name} -- ${error.message}`);
  }
}

function readWorkspaceFile(path) {
  return readFileSync(join(workspaceRoot, path), 'utf8');
}

function readFixtureFile(path) {
  return readFileSync(join(fixtureRoot, path), 'utf8');
}

function normalized(value) {
  return value.replace(/\r\n/g, '\n');
}

function listFiles(root, prefix = '') {
  const files = [];
  for (const entry of readdirSync(join(root, prefix), { withFileTypes: true })) {
    const path = join(prefix, entry.name);
    if (entry.isDirectory()) files.push(...listFiles(root, path));
    else files.push(path);
  }
  return files.sort();
}

record('workspace files stay in the repair contract', () => {
  const allowed = new Set([
    'HARNESS-ARENA-LIVE.md',
    'TASK.md',
    'local-worker-summary.md',
    'package.json',
    'src/app.js',
    'src/test.js',
  ]);
  const unexpected = listFiles(workspaceRoot).filter(
    (file) => !allowed.has(file) && !file.startsWith('.prompt-language/'),
  );
  if (unexpected.length > 0) throw new Error(`unexpected files: ${unexpected.join(', ')}`);
});

record('public tests are preserved exactly', () => {
  const workspaceTests = normalized(readWorkspaceFile('src/test.js'));
  const fixtureTests = normalized(readFixtureFile('src/test.js'));
  if (workspaceTests !== fixtureTests) throw new Error('src/test.js changed');
});

record('fixture task and package metadata are preserved', () => {
  for (const path of ['TASK.md', 'package.json']) {
    if (normalized(readWorkspaceFile(path)) !== normalized(readFixtureFile(path))) {
      throw new Error(`${path} changed`);
    }
  }
});

record('local worker summary exists', () => {
  const summary = readWorkspaceFile('local-worker-summary.md');
  for (const required of ['changed', 'checks', 'diff', 'src/app.js']) {
    if (!summary.toLowerCase().includes(required)) {
      throw new Error(`summary missing ${required}`);
    }
  }
});

record('public tests pass', () => {
  const result = spawnSync(process.execPath, ['src/test.js'], {
    cwd: workspaceRoot,
    encoding: 'utf8',
    timeout: 15_000,
    windowsHide: true,
  });
  if (result.status !== 0) {
    throw new Error(`node src/test.js failed: ${result.stdout} ${result.stderr}`);
  }
});

let app;
record('workspace app loads and exports the original API', () => {
  const appPath = requireFromWorkspace.resolve('./src/app.js');
  delete requireFromWorkspace.cache?.[appPath];
  app = requireFromWorkspace('./src/app.js');
  for (const exportName of [
    'listContacts',
    'getContact',
    'createContact',
    'deleteContact',
    'patchContact',
    'contacts',
  ]) {
    if (!(exportName in app)) throw new Error(`missing export ${exportName}`);
  }
  const seedContacts = app.listContacts();
  if (seedContacts.status !== 200 || !Array.isArray(seedContacts.body)) {
    throw new Error('listContacts response changed');
  }
  const expectedSeeds = [
    [1, 'Alice Johnson', 'alice@example.com', '555-0101', 'Acme Corp'],
    [2, 'Bob Smith', 'bob@example.com', '555-0102', 'Globex Inc'],
    [3, 'Carol Davis', 'carol@example.com', '555-0103', null],
  ];
  for (const [id, name, email, phone, company] of expectedSeeds) {
    const contact = seedContacts.body.find((candidate) => candidate.id === id);
    if (!contact) throw new Error(`missing seed contact ${id}`);
    if (
      contact.name !== name ||
      contact.email !== email ||
      contact.phone !== phone ||
      contact.company !== company
    ) {
      throw new Error(`seed contact ${id} changed`);
    }
  }
});

record('only the short-name error-body bug is repaired', () => {
  const shortName = app.patchContact(1, { name: 'A' });
  if (shortName.status !== 400) throw new Error(`short name status ${shortName.status}`);
  if (!shortName.body?.error) throw new Error('short name missing error body');

  const validName = app.patchContact(1, { name: 'Alice Repaired' });
  if (validName.status !== 200 || validName.body.name !== 'Alice Repaired') {
    throw new Error('valid name update changed');
  }

  const validPhone = app.patchContact(2, { phone: '+1 555-0199' });
  if (validPhone.status !== 200 || validPhone.body.phone !== '+1 555-0199') {
    throw new Error('valid + phone update changed');
  }

  const deleted = app.deleteContact(
    app.createContact({ name: 'Delete Candidate', email: 'delete.candidate@example.com' }).body.id,
  );
  if (deleted.status !== 204 || deleted.body !== null) throw new Error('delete behavior changed');

  const missingGet = app.getContact(999);
  if (missingGet.status !== 404 || !missingGet.body?.error) {
    throw new Error('GET missing ID behavior changed');
  }

  const missingDelete = app.deleteContact(999);
  if (missingDelete.status !== 404 || !missingDelete.body?.error) {
    throw new Error('DELETE missing ID behavior changed');
  }
});

record('hidden validation edges still return 400 with error bodies', () => {
  const cases = [
    ['non-string name', { name: null }],
    ['long name', { name: 'A'.repeat(101) }],
    ['email without dot after @', { email: 'bad@domain' }],
    ['email without @', { email: 'bad.domain' }],
    ['non-string email', { email: null }],
    ['invalid phone characters', { phone: 'abc!@#' }],
    ['short phone', { phone: '123456' }],
    ['long phone', { phone: '+1 555 0101 0101 0101 9999' }],
    ['empty company', { company: '' }],
    ['long company', { company: 'C'.repeat(201) }],
    ['non-string company', { company: 123 }],
  ];

  for (const [name, data] of cases) {
    const result = app.patchContact(1, data);
    if (result.status !== 400) throw new Error(`${name} expected 400, got ${result.status}`);
    if (!result.body?.error) throw new Error(`${name} missing error body`);
  }
});

record('partial PATCH and missing ID behavior are preserved', () => {
  const before = app.getContact(3);
  const originalEmail = before.body.email;
  const originalPhone = before.body.phone;
  const result = app.patchContact(3, { name: 'Carol Repaired' });
  if (result.status !== 200) throw new Error(`partial status ${result.status}`);
  const after = app.getContact(3);
  if (after.body.email !== originalEmail) throw new Error('partial update changed email');
  if (after.body.phone !== originalPhone) throw new Error('partial update changed phone');

  const missing = app.patchContact(999, { name: 'Nobody' });
  if (missing.status !== 404 || !missing.body?.error)
    throw new Error('missing ID behavior changed');
});

console.log(`\nResults: ${passed}/${passed + failed} passed`);
for (const result of results) console.log(result);

if (failed > 0) {
  console.log(`\nVERDICT: FAIL (${failed} failed)`);
  process.exit(1);
}

console.log('\nVERDICT: PASS');
