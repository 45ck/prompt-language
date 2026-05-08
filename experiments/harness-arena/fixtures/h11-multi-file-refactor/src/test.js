const { Contact } = require('./contact');
const { ContactStore } = require('./contact-store');

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

test('Contact constructor sets fields', () => {
  const c = new Contact('Alice', 'alice@test.com', '555-0001', 'Acme');
  if (c.name !== 'Alice') throw new Error('name mismatch');
  if (c.email !== 'alice@test.com') throw new Error('email mismatch');
});

test('Contact toJSON returns object', () => {
  const c = new Contact('Bob', 'bob@test.com', '555-0002', null);
  const json = c.toJSON();
  if (typeof json !== 'object') throw new Error('not an object');
  if (json.name !== 'Bob') throw new Error('name mismatch');
});

test('Contact getDisplayName with company', () => {
  const c = new Contact('Alice', 'a@t.com', '555', 'Acme');
  if (c.getDisplayName() !== 'Alice (Acme)') throw new Error('wrong display name');
});

test('Contact getDisplayName without company', () => {
  const c = new Contact('Bob', 'b@t.com', '555', null);
  if (c.getDisplayName() !== 'Bob') throw new Error('wrong display name');
});

test('ContactStore add and count', () => {
  const store = new ContactStore();
  store.add({ name: 'Test', email: 'test@t.com', phone: '555', company: null });
  if (store.count() !== 1) throw new Error('count mismatch');
});

test('ContactStore findByEmail', () => {
  const store = new ContactStore();
  store.add({ name: 'Test', email: 'test@t.com', phone: '555', company: null });
  const found = store.findByEmail('test@t.com');
  if (!found) throw new Error('not found');
  if (found.name !== 'Test') throw new Error('name mismatch');
});

test('ContactStore findByCompany', () => {
  const store = new ContactStore();
  store.add({ name: 'A', email: 'a@t.com', phone: '1', company: 'X' });
  store.add({ name: 'B', email: 'b@t.com', phone: '2', company: 'X' });
  store.add({ name: 'C', email: 'c@t.com', phone: '3', company: 'Y' });
  const results = store.findByCompany('X');
  if (results.length !== 2) throw new Error('count mismatch');
});

test('ContactStore remove', () => {
  const store = new ContactStore();
  store.add({ name: 'Test', email: 'test@t.com', phone: '555', company: null });
  if (!store.remove('test@t.com')) throw new Error('remove returned false');
  if (store.count() !== 0) throw new Error('count should be 0');
});

console.log(`\nResults: ${passed}/${passed + failed} passed`);
if (failed > 0) {
  console.log(`VERDICT: FAIL (${failed} failed)`);
  process.exit(1);
} else {
  console.log('VERDICT: PASS');
  process.exit(0);
}
