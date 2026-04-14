const { createContact, findByEmail, addContact, removeContact } = require('./contacts');

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

function assertEqual(actual, expected, msg) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${msg}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

// Existing tests for current functionality
test('createContact sets fields', () => {
  const c = createContact('Alice', 'alice@test.com', '555-0001', 'Acme');
  assertEqual(c.name, 'Alice', 'name');
  assertEqual(c.email, 'alice@test.com', 'email');
});

test('findByEmail returns matches', () => {
  const contacts = [
    createContact('Alice', 'alice@test.com', '555', 'Acme'),
    createContact('Bob', 'bob@test.com', '556', null),
    createContact('Alice2', 'alice@test.com', '557', 'Globex'),
  ];
  const found = findByEmail(contacts, 'alice@test.com');
  assertEqual(found.length, 2, 'count');
});

test('addContact returns new array', () => {
  const contacts = [createContact('Alice', 'a@t.com', '555', null)];
  const newContact = createContact('Bob', 'b@t.com', '556', null);
  const result = addContact(contacts, newContact);
  assertEqual(result.length, 2, 'count');
  assertEqual(contacts.length, 1, 'original unchanged');
});

test('removeContact removes by email', () => {
  const contacts = [
    createContact('Alice', 'a@t.com', '555', null),
    createContact('Bob', 'b@t.com', '556', null),
  ];
  const result = removeContact(contacts, 'a@t.com');
  assertEqual(result.length, 1, 'count');
  assertEqual(result[0].name, 'Bob', 'remaining');
});

// TODO: Tests for mergeDuplicates() should be added here

console.log(`\nResults: ${passed}/${passed + failed} passed`);
if (failed > 0) {
  console.log(`VERDICT: FAIL (${failed} failed)`);
  process.exit(1);
} else {
  console.log('VERDICT: PASS');
  process.exit(0);
}
