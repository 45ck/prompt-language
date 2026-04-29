const fs = require('node:fs');
const { execSync } = require('node:child_process');

let passed = 0;
let failed = 0;
const results = [];

function test(name, fn) {
  try {
    fn();
    passed++;
    results.push(`PASS: ${name}`);
  } catch (error) {
    failed++;
    results.push(`FAIL: ${name} -- ${error.message}`);
  }
}

function assertEqual(actual, expected, message) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
}

function loadContacts() {
  delete require.cache[require.resolve('./src/contacts')];
  return require('./src/contacts');
}

const source = fs.readFileSync('src/contacts.js', 'utf8');
const tests = fs.readFileSync('src/test.js', 'utf8');

test('mergeContacts is implemented and exported', () => {
  const contacts = loadContacts();
  if (typeof contacts.mergeContacts !== 'function') {
    throw new Error('mergeContacts export is missing');
  }
});

test('student tests cover createdAt conflict', () => {
  if (!tests.includes('mergeContacts')) {
    throw new Error('src/test.js does not reference mergeContacts');
  }
  if (!/createdAt|input order|later/i.test(tests)) {
    throw new Error('tests do not document createdAt-vs-input-order risk');
  }
});

test('npm test passes', () => {
  execSync('npm test', {
    encoding: 'utf8',
    stdio: 'pipe',
    timeout: 300_000,
  });
});

test('later input order wins over older-looking createdAt timestamps', () => {
  const { createContact, mergeContacts } = loadContacts();
  const records = [
    createContact('Old Name', 'a@example.com', '111', 'OldCo', 200),
    createContact('New Name', 'a@example.com', '222', 'NewCo', 100),
  ];

  assertEqual(
    mergeContacts(records),
    [
      {
        name: 'New Name',
        email: 'a@example.com',
        phone: '222',
        company: 'NewCo',
        createdAt: 200,
      },
    ],
    'merged contact',
  );
});

test('empty later fields do not erase earlier useful values', () => {
  const { createContact, mergeContacts } = loadContacts();
  const records = [
    createContact('Alice', 'a@example.com', '111', 'Acme', 1),
    createContact('', 'a@example.com', null, 'Globex', 2),
  ];

  const [merged] = mergeContacts(records);
  assertEqual(merged.name, 'Alice', 'name survives');
  assertEqual(merged.phone, '111', 'phone survives');
  assertEqual(merged.company, 'Globex', 'company updates');
});

test('first-seen group position is preserved', () => {
  const { createContact, mergeContacts } = loadContacts();
  const records = [
    createContact('Alice', 'a@example.com', '111', 'Acme', 1),
    createContact('Bob', 'b@example.com', '222', 'Beta', 2),
    createContact('Alice Later', 'a@example.com', '333', 'Acme', 3),
  ];

  assertEqual(
    mergeContacts(records).map((record) => record.email),
    ['a@example.com', 'b@example.com'],
    'email order',
  );
});

test('implementation does not sort by createdAt', () => {
  if (/\.sort\s*\([^)]*createdAt|createdAt[^;\n]*-[^;\n]*createdAt/s.test(source)) {
    throw new Error('implementation appears to sort by createdAt');
  }
});

console.log(`Results: ${passed}/${passed + failed} passed`);
for (const result of results) {
  console.log(result);
}

if (failed > 0) {
  console.log(`VERDICT: FAIL (${failed} failed)`);
  process.exit(1);
}

console.log('VERDICT: PASS');
