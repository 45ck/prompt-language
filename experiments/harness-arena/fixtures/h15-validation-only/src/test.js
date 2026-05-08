const { listContacts, getContact, createContact, deleteContact, patchContact } = require('./app');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
  } catch (error) {
    failed++;
    console.error(`FAIL: ${name} -- ${error.message}`);
  }
}

test('listContacts returns all', () => {
  const result = listContacts();
  if (result.status !== 200) throw new Error(`Status ${result.status}`);
  if (result.body.length < 1) throw new Error('Empty');
});

test('getContact returns existing', () => {
  const result = getContact(1);
  if (result.status !== 200) throw new Error(`Status ${result.status}`);
  if (result.body.name !== 'Alice Johnson') throw new Error('Wrong name');
});

test('createContact succeeds', () => {
  const result = createContact({ name: 'Test User', email: 'test@test.com' });
  if (result.status !== 201) throw new Error(`Status ${result.status}`);
  if (!result.body.id) throw new Error('No ID');
});

test('deleteContact preserves 204 null success behavior', () => {
  const created = createContact({ name: 'Delete Me', email: 'delete@example.com' });
  const result = deleteContact(created.body.id);
  if (result.status !== 204) throw new Error(`Status ${result.status}`);
  if (result.body !== null) throw new Error('Body should be null');
});

test('patchContact valid name update works', () => {
  const result = patchContact(1, { name: 'Alice Updated' });
  if (result.status !== 200) throw new Error(`Status ${result.status}`);
  if (result.body.name !== 'Alice Updated') throw new Error('Name not updated');
});

// TODO: Add validation-focused PATCH tests here.

console.log(`\nResults: ${passed}/${passed + failed} passed`);
if (failed > 0) {
  console.log(`VERDICT: FAIL (${failed} failed)`);
  process.exit(1);
}

console.log('VERDICT: PASS');
