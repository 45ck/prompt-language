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
    if (entry.isFile() && (full.endsWith('.js') || full.endsWith('.md'))) {
      files.push(full);
    }
  }

  return files;
}

const matches = [];
const candidates = walk(path.join(root, 'src')).map((file) =>
  path.relative(root, file).replace(/\\/g, '/'),
);

if (includeReadme && fs.existsSync(path.join(root, 'README.md'))) {
  candidates.push('README.md');
}

for (const relativePath of candidates) {
  const absolutePath = path.join(root, relativePath);
  const lines = fs.readFileSync(absolutePath, 'utf8').split(/\r?\n/);
  lines.forEach((line, index) => {
    if (/\bContact\b/.test(line)) {
      matches.push(`${relativePath}:${index + 1}:${line.trim()}`);
    }
  });
}

if (matches.length > 0) {
  process.stdout.write(matches.join('\n'));
  process.exit(1);
}

process.stdout.write('none');
