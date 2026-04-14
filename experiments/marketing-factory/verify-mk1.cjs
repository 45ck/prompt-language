#!/usr/bin/env node
// MK-1: Gate-enforced quality — checks HTML validity, links, responsiveness
// Usage: node verify-mk1.js <path-to-index.html>

const fs = require('fs');
const path = require('path');

const file = process.argv[2];
if (!file) {
  console.error('Usage: node verify-mk1.js <path-to-index.html>');
  process.exit(1);
}

if (!fs.existsSync(file)) {
  console.error(`File not found: ${file}`);
  process.exit(1);
}

const html = fs.readFileSync(file, 'utf8');
const checks = [];
let pass = 0;
let fail = 0;

function check(name, ok, detail) {
  if (ok) {
    pass++;
    checks.push({ name, status: 'PASS', detail });
  } else {
    fail++;
    checks.push({ name, status: 'FAIL', detail });
  }
}

// 1. Valid HTML — DOCTYPE present
check('DOCTYPE present', /<!DOCTYPE\s+html>/i.test(html), 'Checks for <!DOCTYPE html> declaration');

// 2. No unclosed major tags (simple heuristic)
const majorTags = ['html', 'head', 'body', 'nav', 'section', 'footer', 'div'];
const unclosed = [];
for (const tag of majorTags) {
  const opens = (html.match(new RegExp(`<${tag}[\\s>]`, 'gi')) || []).length;
  const closes = (html.match(new RegExp(`</${tag}>`, 'gi')) || []).length;
  if (opens > closes) unclosed.push(tag);
}
check(
  'No unclosed tags',
  unclosed.length === 0,
  unclosed.length === 0
    ? 'All major HTML tags are properly closed'
    : `Unclosed tags: ${unclosed.join(', ')}`,
);

// 3. Internal links resolve — all href="#id" have matching id="..."
const anchorLinks = html.match(/href="#([^"]+)"/g) || [];
const ids = html.match(/id="([^"]+)"/g) || [];
const idSet = new Set(ids.map((m) => m.match(/id="([^"]+)"/)[1]));
const broken = anchorLinks.filter((a) => {
  const target = a.match(/href="#([^"]+)"/)[1];
  return !idSet.has(target);
});
check(
  'Internal links resolve',
  broken.length === 0,
  broken.length === 0
    ? `All ${anchorLinks.length} anchor links resolve`
    : `Broken links: ${broken.join(', ')}`,
);

// 4. Responsive meta viewport
check(
  'Viewport meta tag',
  /meta\s+name=["']viewport["'][^>]*content=["'][^"']*width=device-width/i.test(html),
  'Checks for <meta name="viewport" content="...width=device-width...">',
);

// 5. CSS media queries for mobile
check(
  'Mobile media queries',
  /@media[^{]*max-width\s*:\s*\d+px/i.test(html),
  'Checks for @media (max-width: Npx) responsive rules',
);

// 6. No broken image references (no <img src="..." unless data: or svg)
const imgSrcs = html.match(/<img[^>]+src="([^"]+)"/g) || [];
const brokenImgs = imgSrcs.filter((img) => {
  const src = img.match(/src="([^"]+)"/)[1];
  return (
    !src.startsWith('data:') &&
    !src.startsWith('http') &&
    !fs.existsSync(path.resolve(path.dirname(file), src))
  );
});
check(
  'No broken images',
  brokenImgs.length === 0,
  brokenImgs.length === 0
    ? 'No broken local image references'
    : `Broken images: ${brokenImgs.map((i) => i.match(/src="([^"]+)"/)[1]).join(', ')}`,
);

// Summary
console.log('\n=== MK-1: Gate-Enforced Quality ===\n');
for (const c of checks) {
  const icon = c.status === 'PASS' ? '[PASS]' : '[FAIL]';
  console.log(`  ${icon} ${c.name}: ${c.detail}`);
}
console.log(`\nScore: ${pass}/${pass + fail}`);
process.exit(fail > 0 ? 1 : 0);
