const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

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

// Oracle-contamination exclusions: do not scan files the rename-agent
// does not author. Aider writes its chat history to .aider.chat.history.md
// (which includes the rendered flow text containing "Contact"); PL writes
// session state under .prompt-language/; pnpm/npm may drop lockfiles.
const EXCLUDE_DIRS = new Set(['node_modules', '.prompt-language', '.aider.tags.cache.v3', '.git']);
const EXCLUDE_FILE_PREFIXES = ['.aider.'];

function getAllFiles(dir, ext) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory() && !EXCLUDE_DIRS.has(entry.name)) {
      files.push(...getAllFiles(full, ext));
    } else if (
      entry.isFile() &&
      full.endsWith(ext) &&
      !EXCLUDE_FILE_PREFIXES.some((p) => entry.name.startsWith(p))
    ) {
      files.push(full);
    }
  }
  return files;
}

// Check no "Contact" references remain in JS files
const jsFiles = getAllFiles('.', '.js').filter((f) => !f.includes('verify.js'));
for (const file of jsFiles) {
  test(`No "Contact" in ${file}`, () => {
    const content = fs.readFileSync(file, 'utf8');
    // Match Contact as a word boundary (class name), not inside "Client"
    const matches = content.match(/\bContact\b/g);
    if (matches) throw new Error(`Found ${matches.length} occurrences of "Contact"`);
  });
}

// Check no "Contact" in markdown files
const mdFiles = getAllFiles('.', '.md').filter((f) => !f.includes('TASK.md'));
for (const file of mdFiles) {
  test(`No "Contact" in ${file}`, () => {
    const content = fs.readFileSync(file, 'utf8');
    const matches = content.match(/\bContact\b/g);
    if (matches) throw new Error(`Found ${matches.length} occurrences of "Contact"`);
  });
}

// Check "Client" exists in key files
test('"Client" class exists in some .js file', () => {
  const found = jsFiles.some((f) => {
    const content = fs.readFileSync(f, 'utf8');
    return /\bClient\b/.test(content);
  });
  if (!found) throw new Error('No file contains "Client"');
});

test('"ClientStore" or "Client" store class exists', () => {
  const found = jsFiles.some((f) => {
    const content = fs.readFileSync(f, 'utf8');
    return /\bClientStore\b/.test(content) || /class\s+Client\b/.test(content);
  });
  if (!found) throw new Error('No ClientStore found');
});

// Check app still runs
test('Application runs without error', () => {
  try {
    execSync('node src/app.js', { encoding: 'utf8', stdio: 'pipe', timeout: 5000 });
  } catch (e) {
    // Also check if files were renamed (client.js instead of contact.js)
    try {
      execSync('node src/app.js', { encoding: 'utf8', stdio: 'pipe', timeout: 5000 });
    } catch (e2) {
      throw new Error(`App failed: ${e2.message}`);
    }
  }
});

// Check imports resolve (no require errors)
test('All imports resolve', () => {
  const output = execSync(
    'node -e "try { require(\'./src/app\'); } catch(e) { console.error(e.message); process.exit(1); }"',
    {
      encoding: 'utf8',
      stdio: 'pipe',
      timeout: 5000,
    },
  );
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
