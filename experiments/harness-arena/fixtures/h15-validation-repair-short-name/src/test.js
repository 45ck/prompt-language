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

function expectStatus(result, status) {
  if (result.status !== status) throw new Error(`Status ${result.status}`);
}

function expectErrorBody(result) {
  if (!result.body || typeof result.body.error !== 'string') {
    throw new Error('Missing error body');
  }
}

test('listContacts returns all', () => {
  const result = listContacts();
  expectStatus(result, 200);
  if (result.body.length < 1) throw new Error('Empty');
});

test('getContact returns existing', () => {
  const result = getContact(1);
  expectStatus(result, 200);
  if (result.body.name !== 'Alice Johnson') throw new Error('Wrong name');
});

test('createContact succeeds', () => {
  const result = createContact({ name: 'Test User', email: 'test@test.com' });
  expectStatus(result, 201);
  if (!result.body.id) throw new Error('No ID');
});

test('deleteContact preserves 204 null success behavior', () => {
  const created = createContact({ name: 'Delete Me', email: 'delete@example.com' });
  const result = deleteContact(created.body.id);
  expectStatus(result, 204);
  if (result.body !== null) throw new Error('Body should be null');
});

test('patchContact valid name update works', () => {
  const result = patchContact(1, { name: 'Alice Updated' });
  expectStatus(result, 200);
  if (result.body.name !== 'Alice Updated') throw new Error('Name not updated');
});

test('patch valid plus phone update works', () => {
  const result = patchContact(2, { phone: '+1 555-0199' });
  expectStatus(result, 200);
  if (result.body.phone !== '+1 555-0199') throw new Error('Phone not updated');
});

test('patch short name validation includes an error body', () => {
  const result = patchContact(1, { name: 'A' });
  expectStatus(result, 400);
  expectErrorBody(result);
});

test('patch non-string name validation is rejected', () => {
  const result = patchContact(1, { name: null });
  expectStatus(result, 400);
  expectErrorBody(result);
});

test('patch long name validation is rejected', () => {
  const result = patchContact(1, { name: 'A'.repeat(101) });
  expectStatus(result, 400);
  expectErrorBody(result);
});

test('patch email without dot after at validation is rejected', () => {
  const result = patchContact(1, { email: 'bad@domain' });
  expectStatus(result, 400);
  expectErrorBody(result);
});

test('patch email without at validation is rejected', () => {
  const result = patchContact(1, { email: 'bad.domain' });
  expectStatus(result, 400);
  expectErrorBody(result);
});

test('patch non-string email validation is rejected', () => {
  const result = patchContact(1, { email: null });
  expectStatus(result, 400);
  expectErrorBody(result);
});

test('patch phone invalid characters validation is rejected', () => {
  const result = patchContact(1, { phone: 'abc!' });
  expectStatus(result, 400);
  expectErrorBody(result);
});

test('patch short phone validation is rejected', () => {
  const result = patchContact(1, { phone: '123456' });
  expectStatus(result, 400);
  expectErrorBody(result);
});

test('patch long phone validation is rejected', () => {
  const result = patchContact(1, { phone: '+1 555 0101 0101 0101 9999' });
  expectStatus(result, 400);
  expectErrorBody(result);
});

test('patch empty company validation is rejected', () => {
  const result = patchContact(1, { company: '' });
  expectStatus(result, 400);
  expectErrorBody(result);
});

test('patch long company validation is rejected', () => {
  const result = patchContact(1, { company: 'C'.repeat(201) });
  expectStatus(result, 400);
  expectErrorBody(result);
});

test('patch non-string company validation is rejected', () => {
  const result = patchContact(1, { company: 123 });
  expectStatus(result, 400);
  expectErrorBody(result);
});

test('patch null company is accepted', () => {
  const result = patchContact(2, { company: null });
  expectStatus(result, 200);
  if (result.body.company !== null) throw new Error('Company should be null');
});

test('patch partial update preserves other fields', () => {
  const before = getContact(3);
  const originalEmail = before.body.email;
  const originalPhone = before.body.phone;
  const result = patchContact(3, { name: 'Carol Updated' });
  expectStatus(result, 200);
  const after = getContact(3);
  if (after.body.name !== 'Carol Updated') throw new Error('Name not updated');
  if (after.body.email !== originalEmail) throw new Error('Email changed');
  if (after.body.phone !== originalPhone) throw new Error('Phone changed');
});

test('patch missing ID returns 404', () => {
  const result = patchContact(999, { name: 'Nobody' });
  expectStatus(result, 404);
});

console.log(`\nResults: ${passed}/${passed + failed} passed`);
if (failed > 0) {
  console.log(`VERDICT: FAIL (${failed} failed)`);
  process.exit(1);
}

console.log('VERDICT: PASS');
