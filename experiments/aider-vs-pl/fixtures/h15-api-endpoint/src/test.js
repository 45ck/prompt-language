// Existing tests for GET/POST/DELETE
const { listContacts, getContact, createContact, deleteContact } = require('./app');

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

test('listContacts returns all', () => {
  const r = listContacts();
  if (r.status !== 200) throw new Error(`Status ${r.status}`);
  if (r.body.length < 1) throw new Error('Empty');
});

test('getContact returns existing', () => {
  const r = getContact(1);
  if (r.status !== 200) throw new Error(`Status ${r.status}`);
  if (r.body.name !== 'Alice Johnson') throw new Error('Wrong name');
});

test('getContact 404 for missing', () => {
  const r = getContact(999);
  if (r.status !== 404) throw new Error(`Status ${r.status}`);
});

test('createContact succeeds', () => {
  const r = createContact({ name: 'Test User', email: 'test@test.com' });
  if (r.status !== 201) throw new Error(`Status ${r.status}`);
  if (!r.body.id) throw new Error('No ID');
});

test('createContact rejects missing fields', () => {
  const r = createContact({ name: '' });
  if (r.status !== 400) throw new Error(`Status ${r.status}`);
});

// TODO: Add PATCH endpoint tests here

console.log(`\nResults: ${passed}/${passed + failed} passed`);
if (failed > 0) {
  console.log(`VERDICT: FAIL (${failed} failed)`);
  process.exit(1);
} else {
  console.log('VERDICT: PASS');
  process.exit(0);
}
