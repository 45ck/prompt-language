const { execSync } = require('child_process');
const fs = require('fs');

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

delete require.cache[require.resolve('./src/contacts')];
const { createContact, filterByCompany, getStatistics, getSummary } = require('./src/contacts');

// Core bug: empty array should not crash
test('getStatistics handles empty array', () => {
  try {
    const result = getStatistics([]);
    if (result.total !== 0) throw new Error(`Total should be 0, got ${result.total}`);
  } catch (e) {
    throw new Error(`Crashed on empty array: ${e.message}`);
  }
});

test('filterByCompany + getStatistics for nonexistent company', () => {
  const contacts = [createContact('Alice', 'a@t.com', 30, 'Acme')];
  const filtered = filterByCompany(contacts, 'NonexistentCorp');
  try {
    getStatistics(filtered);
  } catch (e) {
    throw new Error(`Crashed on filtered empty result: ${e.message}`);
  }
});

test('getSummary handles empty array', () => {
  try {
    getSummary([]);
  } catch (e) {
    throw new Error(`getSummary crashed on empty array: ${e.message}`);
  }
});

test('getStatistics still works for non-empty arrays', () => {
  const contacts = [
    createContact('Alice', 'a@t.com', 30, 'Acme'),
    createContact('Bob', 'b@t.com', 25, 'Acme'),
  ];
  const stats = getStatistics(contacts);
  if (stats.total !== 2) throw new Error(`Expected 2, got ${stats.total}`);
  if (stats.topCompany !== 'Acme') throw new Error(`Wrong company: ${stats.topCompany}`);
});

test('getStatistics handles single-element array', () => {
  const contacts = [createContact('Solo', 's@t.com', 40, 'X')];
  const stats = getStatistics(contacts);
  if (stats.total !== 1) throw new Error(`Expected 1, got ${stats.total}`);
  if (stats.youngest !== 'Solo') throw new Error('Wrong youngest');
  if (stats.oldest !== 'Solo') throw new Error('Wrong oldest');
});

test('Test file includes empty-array test case', () => {
  const testSource = fs.readFileSync('src/test.js', 'utf8');
  const hasEmptyTest =
    testSource.includes('empty') || testSource.includes('[]') || testSource.includes('no contacts');
  if (!hasEmptyTest) throw new Error('No test for empty array in test.js');
});

test('All tests pass', () => {
  try {
    execSync('node src/test.js', { encoding: 'utf8', stdio: 'pipe', timeout: 5000 });
  } catch (e) {
    throw new Error(`Tests failed: ${e.stdout || e.stderr}`);
  }
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
