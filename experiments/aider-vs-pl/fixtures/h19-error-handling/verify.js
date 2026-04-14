const fs = require('fs');
const path = require('path');

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

// Check for custom error classes
test('Custom error classes exist', () => {
  const allFiles = fs.readdirSync('src').filter((f) => f.endsWith('.js'));
  const allContent = allFiles.map((f) => fs.readFileSync(path.join('src', f), 'utf8')).join('\n');
  const hasNotFound = allContent.includes('NotFoundError') || allContent.includes('NotFound');
  const hasValidation = allContent.includes('ValidationError') || allContent.includes('Validation');
  if (!hasNotFound) throw new Error('No NotFoundError class');
  if (!hasValidation) throw new Error('No ValidationError class');
});

// Check no bare catch blocks
test('No bare catch blocks', () => {
  const files = ['src/routes.js', 'src/app.js'];
  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    // Bare catch: catch(e) { } or catch(e) { console.log(e) } with nothing else
    const bareCatches = content.match(/catch\s*\([^)]*\)\s*\{\s*\}/g);
    if (bareCatches) throw new Error(`Bare catch in ${file}: ${bareCatches.length} found`);
  }
});

// Functional: load app and test
delete require.cache[require.resolve('./src/app')];
delete require.cache[require.resolve('./src/routes')];
delete require.cache[require.resolve('./src/database')];
const { handleRequest } = require('./src/app');

test('GET /contacts returns 200', () => {
  const r = handleRequest('GET', '/contacts');
  if (r.status !== 200) throw new Error(`Status ${r.status}`);
});

test('GET /contacts/999 returns 404', () => {
  const r = handleRequest('GET', '/contacts/999');
  if (r.status !== 404) throw new Error(`Expected 404, got ${r.status}`);
});

test('GET /contacts/999 has error body', () => {
  const r = handleRequest('GET', '/contacts/999');
  if (!r.body || !r.body.error) throw new Error('No error in response body');
});

test('POST /contacts without name returns 400', () => {
  const r = handleRequest('POST', '/contacts', {});
  if (r.status !== 400) throw new Error(`Expected 400, got ${r.status}`);
});

test('POST /contacts with name returns 201', () => {
  const r = handleRequest('POST', '/contacts', { name: 'Test', email: 'test@t.com' });
  if (r.status !== 201) throw new Error(`Expected 201, got ${r.status}`);
});

test('PUT /contacts/999 returns 404', () => {
  const r = handleRequest('PUT', '/contacts/999', { name: 'Nobody' });
  if (r.status !== 404) throw new Error(`Expected 404, got ${r.status}`);
});

test('GET /search without query returns 400', () => {
  const r = handleRequest('GET', '/search', {});
  if (r.status !== 400) throw new Error(`Expected 400, got ${r.status}`);
});

test('Error responses have consistent structure', () => {
  const r = handleRequest('GET', '/contacts/999');
  if (!r.body.error || typeof r.body.error !== 'string') {
    throw new Error('Error response should have { error: string }');
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
