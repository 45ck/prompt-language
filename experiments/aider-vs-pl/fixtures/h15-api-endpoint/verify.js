const fs = require('fs');

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

// Load the app fresh
delete require.cache[require.resolve('./src/app')];
const app = require('./src/app');

test('patchContact or updateContact function exists', () => {
  const hasPatch =
    typeof app.patchContact === 'function' || typeof app.updateContact === 'function';
  if (!hasPatch) throw new Error('No patchContact/updateContact exported');
});

const patchFn = app.patchContact || app.updateContact;

test('PATCH returns 200 on valid update', () => {
  const r = patchFn(1, { name: 'Alice Updated' });
  if (r.status !== 200) throw new Error(`Status ${r.status}`);
});

test('PATCH only updates provided fields', () => {
  const before = app.getContact(1);
  const originalEmail = before.body.email;
  patchFn(1, { name: 'Alice Patched' });
  const after = app.getContact(1);
  if (after.body.email !== originalEmail) throw new Error('Email was changed');
  if (after.body.name !== 'Alice Patched') throw new Error('Name not updated');
});

test('PATCH returns 404 for missing ID', () => {
  const r = patchFn(999, { name: 'Nobody' });
  if (r.status !== 404) throw new Error(`Status ${r.status}`);
});

test('PATCH rejects short name', () => {
  const r = patchFn(1, { name: 'A' });
  if (r.status !== 400) throw new Error(`Expected 400, got ${r.status}`);
});

test('PATCH rejects invalid email', () => {
  const r = patchFn(1, { email: 'not-an-email' });
  if (r.status !== 400) throw new Error(`Expected 400, got ${r.status}`);
});

test('PATCH rejects invalid phone', () => {
  const r = patchFn(1, { phone: 'abc!@#' });
  if (r.status !== 400) throw new Error(`Expected 400, got ${r.status}`);
});

test('PATCH accepts valid email', () => {
  const r = patchFn(2, { email: 'bob.new@example.com' });
  if (r.status !== 200) throw new Error(`Status ${r.status}`);
  if (r.body.email !== 'bob.new@example.com') throw new Error('Email not updated');
});

test('PATCH accepts null company (clear field)', () => {
  const r = patchFn(2, { company: null });
  if (r.status !== 200) throw new Error(`Status ${r.status}`);
  if (r.body.company !== null) throw new Error('Company not cleared');
});

// Check test file has at least 8 PATCH-related tests
test('test.js has at least 8 PATCH test cases', () => {
  const testSource = fs.readFileSync('src/test.js', 'utf8');
  const patchTests = testSource.match(
    /test\s*\([^)]*[Pp]atch|test\s*\([^)]*[Uu]pdate|test\s*\([^)]*valid/gi,
  );
  if (!patchTests || patchTests.length < 8) {
    throw new Error(`Expected 8+ PATCH tests, found ${patchTests ? patchTests.length : 0}`);
  }
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
