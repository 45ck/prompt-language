const fs = require('fs');
const path = require('path');

const includeReadme = process.argv.includes('--include-readme');
const root = process.cwd();

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(full));
      continue;
    }
    if (entry.isFile() && full.endsWith('.js')) {
      files.push(full);
    }
  }

  return files;
}

function hasContactWord(file) {
  const content = fs.readFileSync(file, 'utf8');
  return /\bContact\b/.test(content);
}

const targets = walk(path.join(root, 'src'))
  .filter(hasContactWord)
  .map((file) => path.relative(root, file).replace(/\\/g, '/'));

if (includeReadme) {
  const readmePath = path.join(root, 'README.md');
  if (fs.existsSync(readmePath) && hasContactWord(readmePath)) {
    targets.push('README.md');
  }
}

process.stdout.write(targets.join('\n'));
