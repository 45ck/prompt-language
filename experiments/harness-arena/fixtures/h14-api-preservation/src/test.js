const {
  createContact,
  findByEmail,
  addContact,
  removeContact,
  mergeDuplicates,
} = require('./contacts');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed += 1;
  } catch (error) {
    failed += 1;
    console.error(`FAIL: ${name} -- ${error.message}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertEqual(actual, expected, message) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
}

test('exports preserve public function names', () => {
  const contacts = require('./contacts');
  assertEqual(
    Object.keys(contacts).sort(),
    ['addContact', 'createContact', 'findByEmail', 'mergeDuplicates', 'removeContact'],
    'export names',
  );
});

test('exports preserve positional arity', () => {
  assertEqual(createContact.length, 4, 'createContact arity');
  assertEqual(findByEmail.length, 2, 'findByEmail arity');
  assertEqual(addContact.length, 2, 'addContact arity');
  assertEqual(removeContact.length, 2, 'removeContact arity');
  assertEqual(mergeDuplicates.length, 1, 'mergeDuplicates arity');
});

test('createContact preserves field defaults and createdAt', () => {
  const before = Date.now();
  const contact = createContact('', 'alice@test.com', '', null);
  const after = Date.now();
  assertEqual(contact.name, null, 'empty name becomes null');
  assertEqual(contact.email, 'alice@test.com', 'email preserved');
  assertEqual(contact.phone, null, 'empty phone becomes null');
  assertEqual(contact.company, null, 'empty company becomes null');
  assert(contact.createdAt >= before && contact.createdAt <= after, 'createdAt is current time');
});

test('findByEmail returns matching contacts without mutation', () => {
  const contacts = [
    createContact('Alice', 'alice@test.com', '555', 'Acme'),
    createContact('Bob', 'bob@test.com', '556', 'Globex'),
    createContact('Alice2', 'alice@test.com', '557', null),
  ];
  const before = JSON.stringify(contacts);
  const found = findByEmail(contacts, 'alice@test.com');
  assertEqual(found.length, 2, 'match count');
  assertEqual(JSON.stringify(contacts), before, 'input unchanged');
});

test('addContact returns a new array and preserves existing entries', () => {
  const alice = createContact('Alice', 'alice@test.com', '555', 'Acme');
  const bob = createContact('Bob', 'bob@test.com', '556', 'Globex');
  const contacts = [alice];
  const result = addContact(contacts, bob);
  assert(result !== contacts, 'new array returned');
  assertEqual(result, [alice, bob], 'contacts appended');
  assertEqual(contacts, [alice], 'input unchanged');
});

test('removeContact removes all contacts with matching email', () => {
  const contacts = [
    createContact('Alice', 'alice@test.com', '555', 'Acme'),
    createContact('Alice2', 'alice@test.com', '557', null),
    createContact('Bob', 'bob@test.com', '556', 'Globex'),
  ];
  const result = removeContact(contacts, 'alice@test.com');
  assertEqual(result.length, 1, 'remaining count');
  assertEqual(result[0].email, 'bob@test.com', 'remaining email');
});

test('mergeDuplicates later non-empty fields override earlier values', () => {
  const result = mergeDuplicates([
    createContact('Alice', 'alice@test.com', '555', 'Acme'),
    createContact('Alice2', 'alice@test.com', '557', 'Globex'),
  ]);
  assertEqual(result.length, 1, 'merged duplicate count');
  assertEqual(result[0].name, 'Alice2', 'later name');
  assertEqual(result[0].phone, '557', 'later phone');
  assertEqual(result[0].company, 'Globex', 'later company');
});

test('mergeDuplicates keeps earlier non-empty fields when later values are empty', () => {
  const result = mergeDuplicates([
    createContact('Alice', 'alice@test.com', '555', 'Acme'),
    createContact(null, 'alice@test.com', null, ''),
  ]);
  assertEqual(result.length, 1, 'merged duplicate count');
  assertEqual(result[0].name, 'Alice', 'earlier name');
  assertEqual(result[0].phone, '555', 'earlier phone');
  assertEqual(result[0].company, 'Acme', 'earlier company');
});

test('mergeDuplicates preserves unique contacts and group order', () => {
  const result = mergeDuplicates([
    createContact('Alice', 'alice@test.com', null, null),
    createContact('Bob', 'bob@test.com', '556', 'OldCo'),
    createContact(null, 'alice@test.com', '555', 'Acme'),
    createContact('Cara', 'cara@test.com', null, null),
    createContact('Bob2', 'bob@test.com', null, 'NewCo'),
  ]);
  assertEqual(result.length, 3, 'merged group count');
  assertEqual(
    result.map((contact) => contact.email),
    ['alice@test.com', 'bob@test.com', 'cara@test.com'],
    'group order',
  );
  assertEqual(result[0].phone, '555', 'alice phone merged');
  assertEqual(result[1].name, 'Bob2', 'bob later name');
  assertEqual(result[1].phone, '556', 'bob earlier phone kept');
  assertEqual(result[1].company, 'NewCo', 'bob later company');
});

console.log(`\nResults: ${passed}/${passed + failed} passed`);
if (failed > 0) {
  console.log(`VERDICT: FAIL (${failed} failed)`);
  process.exit(1);
}
console.log('VERDICT: PASS');
