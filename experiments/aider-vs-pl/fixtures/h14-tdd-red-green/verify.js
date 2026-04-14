const fs = require('fs');
const { execSync } = require('child_process');

let passed = 0;
let failed = 0;
const results = [];

function test(name, fn) {
  try {
    fn();
    passed++;
    results.push(`  PASS: ${name}`);
  } catch (e) {
    failed++;
    results.push(`  FAIL: ${name} -- ${e.message}`);
  }
}

const contactsSource = fs.readFileSync('src/contacts.js', 'utf8');
const testSource = fs.readFileSync('src/test.js', 'utf8');

test('mergeDuplicates function exists in contacts.js', () => {
  if (!contactsSource.includes('mergeDuplicates')) {
    throw new Error('mergeDuplicates not found in contacts.js');
  }
});

test('mergeDuplicates is exported', () => {
  if (
    !contactsSource.includes('mergeDuplicates') ||
    !contactsSource.match(/exports.*mergeDuplicates/s)
  ) {
    throw new Error('mergeDuplicates not exported');
  }
});

test('Tests reference mergeDuplicates', () => {
  if (!testSource.includes('mergeDuplicates')) {
    throw new Error('No tests for mergeDuplicates in test.js');
  }
});

test('At least 4 test cases for merge', () => {
  // Count test() calls that mention merge/duplicate
  const mergeTests = testSource.match(/test\s*\([^)]*[Mm]erge|test\s*\([^)]*[Dd]uplic/g);
  if (!mergeTests || mergeTests.length < 4) {
    throw new Error(
      `Expected at least 4 merge test cases, found ${mergeTests ? mergeTests.length : 0}`,
    );
  }
});

test('All tests pass', () => {
  try {
    execSync('node src/test.js', { encoding: 'utf8', stdio: 'pipe', timeout: 5000 });
  } catch (e) {
    throw new Error(`Tests failed: ${e.stdout || e.stderr}`);
  }
});

test('mergeDuplicates handles basic merge', () => {
  delete require.cache[require.resolve('./src/contacts')];
  const { createContact, mergeDuplicates } = require('./src/contacts');
  const contacts = [
    createContact('Alice', 'alice@test.com', '555', 'Acme'),
    createContact('Alice Johnson', 'alice@test.com', null, null),
  ];
  const merged = mergeDuplicates(contacts);
  if (merged.length !== 1) throw new Error(`Expected 1, got ${merged.length}`);
  if (merged[0].email !== 'alice@test.com') throw new Error('Wrong email');
});

test('mergeDuplicates keeps most complete data', () => {
  delete require.cache[require.resolve('./src/contacts')];
  const { createContact, mergeDuplicates } = require('./src/contacts');
  const contacts = [
    createContact(null, 'alice@test.com', '555', null),
    createContact('Alice', 'alice@test.com', null, 'Acme'),
  ];
  const merged = mergeDuplicates(contacts);
  if (merged.length !== 1) throw new Error(`Expected 1, got ${merged.length}`);
  // Should have data from both records
  if (!merged[0].name) throw new Error('Name lost in merge');
  if (!merged[0].phone) throw new Error('Phone lost in merge');
});

test('mergeDuplicates preserves non-duplicates', () => {
  delete require.cache[require.resolve('./src/contacts')];
  const { createContact, mergeDuplicates } = require('./src/contacts');
  const contacts = [
    createContact('Alice', 'alice@test.com', '555', 'Acme'),
    createContact('Bob', 'bob@test.com', '556', 'Globex'),
  ];
  const merged = mergeDuplicates(contacts);
  if (merged.length !== 2) throw new Error(`Expected 2, got ${merged.length}`);
});

console.log(`\nResults: ${passed}/${passed + failed} passed`);
results.forEach((r) => console.log(r));
if (failed > 0) {
  console.log(`\nVERDICT: FAIL (${failed} failed)`);
  process.exit(1);
} else {
  console.log('\nVERDICT: PASS');
  process.exit(0);
}
