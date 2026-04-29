const { createContact, findByEmail, addContact, removeContact } = require('./contacts');

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

function assertEqual(actual, expected, message) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
}

test('createContact sets fields', () => {
  const contact = createContact('Alice', 'alice@example.com', '555-0100', 'Acme', 10);
  assertEqual(contact.name, 'Alice', 'name');
  assertEqual(contact.email, 'alice@example.com', 'email');
  assertEqual(contact.createdAt, 10, 'createdAt');
});

test('findByEmail returns matching contacts', () => {
  const contacts = [
    createContact('Alice', 'a@example.com', '555', 'Acme'),
    createContact('Bob', 'b@example.com', '556', 'Beta'),
    createContact('Alice2', 'a@example.com', '557', 'Acme'),
  ];

  assertEqual(findByEmail(contacts, 'a@example.com').length, 2, 'match count');
});

test('addContact returns a new array', () => {
  const contacts = [createContact('Alice', 'a@example.com', '555', 'Acme')];
  const result = addContact(contacts, createContact('Bob', 'b@example.com', '556', 'Beta'));
  assertEqual(contacts.length, 1, 'original length');
  assertEqual(result.length, 2, 'result length');
});

test('removeContact removes matching email', () => {
  const contacts = [
    createContact('Alice', 'a@example.com', '555', 'Acme'),
    createContact('Bob', 'b@example.com', '556', 'Beta'),
  ];

  assertEqual(
    removeContact(contacts, 'a@example.com')[0].email,
    'b@example.com',
    'remaining email',
  );
});

console.log(`\nResults: ${passed}/${passed + failed} passed`);
if (failed > 0) {
  console.log(`VERDICT: FAIL (${failed} failed)`);
  process.exit(1);
}

console.log('VERDICT: PASS');
