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

function getJsFiles(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isFile() && full.endsWith('.js') && !full.includes('verify')) {
      files.push(full);
    }
  }
  return files;
}

const jsFiles = getJsFiles('src');

// Check config module exists
test('src/config.js exists', () => {
  if (!fs.existsSync('src/config.js')) throw new Error('No config.js');
});

// Check no process.env in non-config files
for (const file of jsFiles) {
  const basename = path.basename(file);
  if (basename === 'config.js') continue;
  test(`No process.env in ${basename}`, () => {
    const content = fs.readFileSync(file, 'utf8');
    const envReads = content.match(/process\.env\b/g);
    if (envReads) throw new Error(`Found ${envReads.length} process.env read(s)`);
  });
}

// Check config.js reads process.env
test('config.js reads process.env', () => {
  const content = fs.readFileSync('src/config.js', 'utf8');
  if (!content.includes('process.env')) throw new Error('config.js does not read process.env');
});

// Check config.js exports config object
test('config.js exports config', () => {
  const content = fs.readFileSync('src/config.js', 'utf8');
  if (!content.includes('module.exports') && !content.includes('exports.')) {
    throw new Error('config.js does not export anything');
  }
});

// Check app starts without any env vars
test('App starts with default config (no env vars)', () => {
  try {
    // Run with clean environment (minimal)
    execSync('node src/app.js', {
      encoding: 'utf8',
      stdio: 'pipe',
      timeout: 5000,
      env: { ...process.env, PORT: '', DB_HOST: '', JWT_SECRET: '', LOG_LEVEL: '', SMTP_HOST: '' },
    });
  } catch (e) {
    throw new Error(`App failed with defaults: ${e.stderr || e.message}`);
  }
});

// Check all known env vars are in config.js
test('Config covers all env vars (PORT, DB_HOST, JWT_SECRET, etc.)', () => {
  const content = fs.readFileSync('src/config.js', 'utf8');
  const requiredVars = ['PORT', 'DB_HOST', 'JWT_SECRET', 'LOG_LEVEL', 'SMTP_HOST'];
  for (const v of requiredVars) {
    if (!content.includes(v)) throw new Error(`Missing env var: ${v}`);
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
