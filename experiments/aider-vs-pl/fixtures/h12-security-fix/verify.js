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

// Read source files to check for vulnerable patterns
const appSource = fs.readFileSync(path.join(__dirname, 'src', 'app.js'), 'utf8');

test('No string concatenation in SQL queries', () => {
  // Look for patterns like: "SELECT ... '" + variable
  const concatPattern = /["'`]SELECT[^"'`]*["'`]\s*\+/gi;
  const matches = appSource.match(concatPattern);
  if (matches) throw new Error(`Found ${matches.length} SQL string concatenation(s)`);
});

test('No template literal SQL injection', () => {
  // Look for template literals with ${} inside SQL strings
  const templatePattern = /`SELECT[^`]*\$\{[^}]+\}[^`]*`/gi;
  const matches = appSource.match(templatePattern);
  if (matches) throw new Error(`Found ${matches.length} template literal SQL injection(s)`);
});

test('Uses parameterized queries or safe patterns', () => {
  // Check that queryParams or parameterized pattern is used
  const hasParams =
    appSource.includes('queryParams') ||
    (appSource.includes('?') && (appSource.includes('params') || appSource.includes('param'))) ||
    // Or manual escaping/sanitization function
    appSource.includes('escape') ||
    appSource.includes('sanitize') ||
    // Or the query building avoids injection entirely
    (!appSource.includes('+ searchTerm') &&
      !appSource.includes('+ email') &&
      !appSource.includes('${company}'));
  if (!hasParams) throw new Error('No parameterized query pattern found');
});

// Functional tests: require the fixed app and test it works
test('App loads without error', () => {
  // Clear require cache
  delete require.cache[require.resolve('./src/app')];
  delete require.cache[require.resolve('./src/db')];
  require('./src/app');
});

test('Normal search still works', () => {
  delete require.cache[require.resolve('./src/app')];
  delete require.cache[require.resolve('./src/db')];
  const { handleSearch } = require('./src/app');
  const result = handleSearch('Alice');
  if (result.status !== 200) throw new Error(`Status ${result.status}`);
  if (result.body.length !== 1) throw new Error(`Expected 1 result, got ${result.body.length}`);
});

test('Email lookup still works', () => {
  delete require.cache[require.resolve('./src/app')];
  delete require.cache[require.resolve('./src/db')];
  const { handleGetByEmail } = require('./src/app');
  const result = handleGetByEmail('alice@example.com');
  if (result.status !== 200) throw new Error(`Status ${result.status}`);
  if (result.body.name !== 'Alice Johnson') throw new Error(`Wrong name: ${result.body.name}`);
});

test('Company lookup still works', () => {
  delete require.cache[require.resolve('./src/app')];
  delete require.cache[require.resolve('./src/db')];
  const { handleGetByCompany } = require('./src/app');
  const result = handleGetByCompany('Acme Corp');
  if (result.status !== 200) throw new Error(`Status ${result.status}`);
  if (result.body.length !== 2) throw new Error(`Expected 2, got ${result.body.length}`);
});

test("Name with apostrophe works (Dan O'Brien)", () => {
  delete require.cache[require.resolve('./src/app')];
  delete require.cache[require.resolve('./src/db')];
  const { handleSearch } = require('./src/app');
  const result = handleSearch("O'Brien");
  if (result.status !== 200) throw new Error(`Status ${result.status}`);
  if (result.body.length !== 1) throw new Error(`Expected 1, got ${result.body.length}`);
});

test('SQL injection attempt returns safe result', () => {
  delete require.cache[require.resolve('./src/app')];
  delete require.cache[require.resolve('./src/db')];
  const { handleSearch } = require('./src/app');
  // Classic injection: try to dump all records
  const result = handleSearch("' OR '1'='1");
  // Should return 0 results (injection should not work) or handle gracefully
  if (result.status === 200 && result.body.length === 4) {
    throw new Error('SQL injection succeeded — returned all 4 records');
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
