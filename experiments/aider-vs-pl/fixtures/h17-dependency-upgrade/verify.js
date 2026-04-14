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

function getAllJsFiles(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...getAllJsFiles(full));
    else if (
      full.endsWith('.js') &&
      !full.includes('verify.js') &&
      !full.includes('config-v1.js') &&
      !full.includes('config-v2.js')
    ) {
      files.push(full);
    }
  }
  return files;
}

const jsFiles = getAllJsFiles('src');

// Check no v1 references remain in app code
for (const file of jsFiles) {
  test(`No config-v1 import in ${path.basename(file)}`, () => {
    const content = fs.readFileSync(file, 'utf8');
    if (content.includes('config-v1') || content.includes('ConfigV1')) {
      throw new Error('Still references config-v1');
    }
  });
}

// Check v2 is used
test('At least one file imports config-v2', () => {
  const found = jsFiles.some((f) => {
    const content = fs.readFileSync(f, 'utf8');
    return content.includes('config-v2') || content.includes('ConfigV2');
  });
  if (!found) throw new Error('No file imports config-v2');
});

// Check no callback patterns in config usage
for (const file of jsFiles) {
  test(`No callback pattern in ${path.basename(file)}`, () => {
    const content = fs.readFileSync(file, 'utf8');
    // Look for config method calls with callback arguments: config.get(key, (err
    const callbackPattern = /config\.(get|load|save|set)\s*\([^)]*,\s*\(?err/g;
    const matches = content.match(callbackPattern);
    if (matches) throw new Error(`Found ${matches.length} callback pattern(s)`);
  });
}

// Check getAll() replaced with entries()
test('No getAll() calls remain', () => {
  const found = jsFiles.some((f) => {
    const content = fs.readFileSync(f, 'utf8');
    return content.includes('.getAll()');
  });
  if (found) throw new Error('getAll() still used (should be entries())');
});

// Check app runs
test('Application runs without error', () => {
  const { execSync } = require('child_process');
  try {
    execSync('node src/app.js', { encoding: 'utf8', stdio: 'pipe', timeout: 10000 });
  } catch (e) {
    throw new Error(`App failed: ${e.stderr || e.message}`);
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
