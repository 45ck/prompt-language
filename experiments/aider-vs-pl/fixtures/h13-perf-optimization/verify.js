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

// Clear cache and load fresh
delete require.cache[require.resolve('./src/app')];
delete require.cache[require.resolve('./src/db')];
const { getContactsWithCompanies, getContactsByIndustry, db } = require('./src/app');

test('getContactsWithCompanies returns 20 results', () => {
  const all = getContactsWithCompanies();
  if (all.length !== 20) throw new Error(`Expected 20, got ${all.length}`);
});

test('Results include company info', () => {
  const all = getContactsWithCompanies();
  const alice = all.find((c) => c.name.startsWith('Alice'));
  if (!alice) throw new Error('Alice not found');
  if (!alice.company) throw new Error('Company missing');
  if (!alice.industry) throw new Error('Industry missing');
  if (!alice.city) throw new Error('City missing');
});

test('getContactsWithCompanies uses at most 3 queries', () => {
  db.resetQueryCount();
  getContactsWithCompanies();
  const count = db.getQueryCount();
  // Should be 2 (contacts + companies) instead of 21 (1 + 20)
  if (count > 3) throw new Error(`Used ${count} queries (should be <=3, was 21 before fix)`);
});

test('getContactsByIndustry returns correct results', () => {
  const tech = getContactsByIndustry('Technology');
  if (tech.length !== 4) throw new Error(`Expected 4 tech contacts, got ${tech.length}`);
  for (const c of tech) {
    if (c.company !== 'Acme Corp') throw new Error(`Wrong company: ${c.company}`);
  }
});

test('getContactsByIndustry uses at most 3 queries', () => {
  db.resetQueryCount();
  getContactsByIndustry('Technology');
  const count = db.getQueryCount();
  if (count > 3) throw new Error(`Used ${count} queries (should be <=3)`);
});

test('All contacts have correct company mapping', () => {
  const all = getContactsWithCompanies();
  // Contacts 1,6,11,16 should map to company 1 (Acme Corp)
  const acmeContacts = all.filter((c) => c.company === 'Acme Corp');
  if (acmeContacts.length !== 4)
    throw new Error(`Expected 4 Acme contacts, got ${acmeContacts.length}`);
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
