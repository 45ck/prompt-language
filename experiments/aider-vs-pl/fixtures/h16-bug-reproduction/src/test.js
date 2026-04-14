const { createContact, filterByCompany, getStatistics, getSummary } = require('./contacts');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
  } catch (e) {
    failed++;
    console.error(`FAIL: ${name} -- ${e.message}`);
  }
}

const sampleContacts = [
  createContact('Alice', 'alice@test.com', 30, 'Acme'),
  createContact('Bob', 'bob@test.com', 25, 'Acme'),
  createContact('Carol', 'carol@test.com', 35, 'Globex'),
  createContact('Dan', 'dan@test.com', 28, 'Initech'),
  createContact('Eve', 'eve@test.com', 32, 'Acme'),
];

test('getStatistics returns correct total', () => {
  const stats = getStatistics(sampleContacts);
  if (stats.total !== 5) throw new Error(`Expected 5, got ${stats.total}`);
});

test('getStatistics calculates average age', () => {
  const stats = getStatistics(sampleContacts);
  if (stats.averageAge !== 30) throw new Error(`Expected 30, got ${stats.averageAge}`);
});

test('getStatistics finds top company', () => {
  const stats = getStatistics(sampleContacts);
  if (stats.topCompany !== 'Acme') throw new Error(`Expected Acme, got ${stats.topCompany}`);
});

test('filterByCompany returns matches', () => {
  const acme = filterByCompany(sampleContacts, 'Acme');
  if (acme.length !== 3) throw new Error(`Expected 3, got ${acme.length}`);
});

test('getSummary returns string', () => {
  const summary = getSummary(sampleContacts);
  if (!summary.includes('5 contacts')) throw new Error('Bad summary');
});

console.log(`\nResults: ${passed}/${passed + failed} passed`);
if (failed > 0) {
  console.log(`VERDICT: FAIL (${failed} failed)`);
  process.exit(1);
} else {
  console.log('VERDICT: PASS');
  process.exit(0);
}
