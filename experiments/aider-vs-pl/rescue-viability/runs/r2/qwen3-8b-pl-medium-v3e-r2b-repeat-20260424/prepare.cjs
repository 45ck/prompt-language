const fs = require('node:fs');
const path = require('node:path');

const root = __dirname;
const seedDir = path.join(root, 'seed-src');
const srcDir = path.join(root, 'src');

fs.mkdirSync(srcDir, { recursive: true });

for (const entry of fs.readdirSync(seedDir)) {
  if (!entry.endsWith('.ts.txt')) {
    continue;
  }

  const target = entry.slice(0, -4);
  fs.copyFileSync(path.join(seedDir, entry), path.join(srcDir, target));
}
