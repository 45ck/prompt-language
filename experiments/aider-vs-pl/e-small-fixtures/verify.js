const { execSync } = require('child_process');
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
function assertEqual(a, b, msg) {
  if (JSON.stringify(a) !== JSON.stringify(b))
    throw new Error(
      `${msg}\n    Expected: ${JSON.stringify(b)}\n    Actual:   ${JSON.stringify(a)}`,
    );
}
test('csv2json.js exists', () => {
  if (!fs.existsSync('csv2json.js')) throw new Error('csv2json.js not found');
});
test('runs on valid CSV', () => {
  const r = execSync('node csv2json.js test-input.csv', { encoding: 'utf8' });
  JSON.parse(r);
});
test('produces 4 records', () => {
  const d = JSON.parse(execSync('node csv2json.js test-input.csv', { encoding: 'utf8' }));
  if (d.length !== 4) throw new Error(`Expected 4, got ${d.length}`);
});
test('correct header keys', () => {
  const d = JSON.parse(execSync('node csv2json.js test-input.csv', { encoding: 'utf8' }));
  assertEqual(Object.keys(d[0]).sort(), ['age', 'city', 'name', 'notes'], 'Wrong keys');
});
test('simple row values correct', () => {
  const d = JSON.parse(execSync('node csv2json.js test-input.csv', { encoding: 'utf8' }));
  assertEqual(d[0].name, 'Alice', '');
  assertEqual(d[0].age, '30', '');
  assertEqual(d[0].city, 'New York', '');
});
test('handles quoted field with comma', () => {
  const d = JSON.parse(execSync('node csv2json.js test-input.csv', { encoding: 'utf8' }));
  assertEqual(d[1].name, 'Smith, Bob', '');
  assertEqual(d[1].notes, 'has a comma, in notes', '');
});
test('empty field becomes null', () => {
  const d = JSON.parse(execSync('node csv2json.js test-input.csv', { encoding: 'utf8' }));
  if (d[2].age !== null) throw new Error(`Got ${JSON.stringify(d[2].age)}`);
  if (d[2].notes !== null) throw new Error(`Got ${JSON.stringify(d[2].notes)}`);
});
test('empty quoted field becomes null', () => {
  const d = JSON.parse(execSync('node csv2json.js test-input.csv', { encoding: 'utf8' }));
  if (d[3].city !== null) throw new Error(`Got ${JSON.stringify(d[3].city)}`);
});
test('no argument exits 1', () => {
  try {
    execSync('node csv2json.js', { encoding: 'utf8', stdio: 'pipe' });
    throw new Error('Should have thrown');
  } catch (e) {
    if (e.message === 'Should have thrown' || e.status !== 1)
      throw new Error(`Exit code ${e.status}`);
  }
});
test('missing file exits 1', () => {
  try {
    execSync('node csv2json.js nonexistent.csv', { encoding: 'utf8', stdio: 'pipe' });
    throw new Error('Should have thrown');
  } catch (e) {
    if (e.message === 'Should have thrown' || e.status !== 1)
      throw new Error(`Exit code ${e.status}`);
  }
});
test('empty file exits 1', () => {
  fs.writeFileSync('empty.csv', '');
  try {
    execSync('node csv2json.js empty.csv', { encoding: 'utf8', stdio: 'pipe' });
    throw new Error('Should have thrown');
  } catch (e) {
    if (e.message === 'Should have thrown' || e.status !== 1)
      throw new Error(`Exit code ${e.status}`);
  } finally {
    try {
      fs.unlinkSync('empty.csv');
    } catch {
      /* cleanup */
    }
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
