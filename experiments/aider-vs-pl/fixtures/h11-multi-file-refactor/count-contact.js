const fs = require('fs');
const path = require('path');

const target = process.argv[2];

if (!target) {
  console.error('Usage: node count-contact.js <relative-path>');
  process.exit(1);
}

const file = path.resolve(process.cwd(), target);
const content = fs.readFileSync(file, 'utf8');
const matches = content.match(/\bContact\b/g);

process.stdout.write(String(matches ? matches.length : 0));
