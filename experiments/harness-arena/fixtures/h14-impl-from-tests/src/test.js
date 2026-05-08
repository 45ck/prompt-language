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

function assertEqual(actual, expected, message) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
}

test('createContact sets fields', () => {
  const contact = createContact('Alice', 'alice@test.com', '555-0001', 'Acme');
  assertEqual(contact.name, 'Alice', 'name');
  assertEqual(contact.email, 'alice@test.com', 'email');
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

test('mergeDuplicates basic duplicate contacts', () => {
  const contacts = [
    createContact('Alice', 'alice@test.com', '555', 'Acme'),
    createContact('Alice2', 'alice@test.com', '557', 'Globex'),
  ];
  const result = mergeDuplicates(contacts);
  assertEqual(result.length, 1, 'merged to one contact');
  assertEqual(result[0].name, 'Alice2', 'later name used');
  assertEqual(result[0].email, 'alice@test.com', 'email preserved');
  assertEqual(result[0].phone, '557', 'later phone used');
  assertEqual(result[0].company, 'Globex', 'later company used');
});

test('mergeDuplicates duplicate later non-empty field priority', () => {
  const contacts = [
    createContact('Alice', 'alice@test.com', '555', 'Acme'),
    createContact('Alice2', 'alice@test.com', null, 'Globex'),
  ];
  const result = mergeDuplicates(contacts);
  assertEqual(result[0].name, 'Alice2', 'later name used');
  assertEqual(result[0].phone, '555', 'earlier phone preserved when later is empty');
  assertEqual(result[0].company, 'Globex', 'later company used');
});

test('mergeDuplicates duplicate older non-empty fallback', () => {
  const contacts = [
    createContact('Alice', 'alice@test.com', null, 'Acme'),
    createContact(null, 'alice@test.com', '555', null),
  ];
  const result = mergeDuplicates(contacts);
  assertEqual(result[0].name, 'Alice', 'earlier name preserved when later is empty');
  assertEqual(result[0].phone, '555', 'later phone used');
  assertEqual(result[0].company, 'Acme', 'earlier company preserved when later is empty');
});

test('mergeDuplicates no duplicates preserves contacts', () => {
  const contacts = [
    createContact('Alice', 'alice@test.com', '555', 'Acme'),
    createContact('Bob', 'bob@test.com', '556', 'Globex'),
  ];
  const result = mergeDuplicates(contacts);
  assertEqual(result.length, 2, 'no change when no duplicates');
  assertEqual(result[0].name, 'Alice', 'first unique contact preserved');
  assertEqual(result[1].name, 'Bob', 'second unique contact preserved');
});

test('mergeDuplicates multiple duplicate groups', () => {
  const contacts = [
    createContact('Alice', 'alice@test.com', '555', 'Acme'),
    createContact('Alice2', 'alice@test.com', '557', 'Globex'),
    createContact('Bob', 'bob@test.com', '556', 'OldCo'),
    createContact('Bob2', 'bob@test.com', '558', null),
    createContact('Cara', 'cara@test.com', null, null),
  ];
  const result = mergeDuplicates(contacts);
  assertEqual(result.length, 3, 'two merged groups plus unique contact');
  assertEqual(result[0].name, 'Alice2', 'first group later name');
  assertEqual(result[1].name, 'Bob2', 'second group later name');
  assertEqual(result[1].company, 'OldCo', 'second group fallback company');
  assertEqual(result[2].name, 'Cara', 'unique contact preserved');
});

console.log(`\nResults: ${passed}/${passed + failed} passed`);
if (failed > 0) {
  console.log(`VERDICT: FAIL (${failed} failed)`);
  process.exit(1);
}
console.log('VERDICT: PASS');
