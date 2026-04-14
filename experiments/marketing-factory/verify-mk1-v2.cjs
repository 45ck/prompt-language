#!/usr/bin/env node
// MK-1 v2: Quality + Accessibility (10 checks)
// Usage: node verify-mk1-v2.cjs <path-to-index.html>

const fs = require('fs');
const path = require('path');

const file = process.argv[2];
if (!file) {
  console.error('Usage: node verify-mk1-v2.cjs <path-to-index.html>');
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

// 7. Semantic HTML — has <main>, <nav>, <section>, <footer>
const semanticTags = ['main', 'nav', 'section', 'footer'];
const presentSemantic = semanticTags.filter((tag) => new RegExp(`<${tag}[\\s>]`, 'i').test(html));
const missingSemantic = semanticTags.filter((tag) => !new RegExp(`<${tag}[\\s>]`, 'i').test(html));
check(
  'Semantic HTML elements',
  missingSemantic.length === 0,
  missingSemantic.length === 0
    ? `All semantic elements present: ${presentSemantic.join(', ')}`
    : `Missing semantic elements: ${missingSemantic.join(', ')}`,
);

// 8. Heading hierarchy — h1 exists, no skipping levels
const hasH1 = /<h1[\s>]/i.test(html);
const headingLevels = (html.match(/<h([1-6])[\s>]/gi) || [])
  .map((m) => parseInt(m.match(/<h([1-6])/i)[1], 10))
  .sort((a, b) => a - b);
const uniqueLevels = [...new Set(headingLevels)];
let hierarchyOk = true;
let hierarchyDetail = '';
if (!hasH1) {
  hierarchyOk = false;
  hierarchyDetail = 'No <h1> element found';
} else {
  for (let i = 1; i < uniqueLevels.length; i++) {
    if (uniqueLevels[i] - uniqueLevels[i - 1] > 1) {
      hierarchyOk = false;
      hierarchyDetail = `Skipped heading level: h${uniqueLevels[i - 1]} to h${uniqueLevels[i]}`;
      break;
    }
  }
  if (hierarchyOk) {
    hierarchyDetail = `Heading levels used: ${uniqueLevels.map((l) => 'h' + l).join(', ')}`;
  }
}
check('Heading hierarchy', hierarchyOk, hierarchyDetail);

// 9. Lang attribute — <html lang="en"> present
const hasLang = /<html[^>]+lang=["'][a-z]{2,}/i.test(html);
check(
  'Lang attribute',
  hasLang,
  hasLang ? '<html> has lang attribute' : 'Missing lang attribute on <html> element',
);

// 10. ARIA on interactive — buttons/links have accessible text (not empty)
const interactiveEls = html.match(/<(button|a\b)[^>]*>[\s\S]*?<\/(button|a)>/gi) || [];
const emptyInteractive = interactiveEls.filter((el) => {
  const innerText = el.replace(/<[^>]+>/g, '').trim();
  const hasAriaLabel = /aria-label=["'][^"']+["']/i.test(el);
  const hasTitle = /title=["'][^"']+["']/i.test(el);
  const hasSrOnly = /sr-only|visually-hidden/i.test(el);
  return innerText.length === 0 && !hasAriaLabel && !hasTitle && !hasSrOnly;
});
check(
  'ARIA on interactive elements',
  emptyInteractive.length === 0,
  emptyInteractive.length === 0
    ? 'All buttons/links have accessible text or aria-label'
    : `${emptyInteractive.length} button(s)/link(s) missing accessible text`,
);

// Summary
console.log('\n=== MK-1 v2: Quality + Accessibility (10 checks) ===\n');
for (const c of checks) {
  const icon = c.status === 'PASS' ? '[PASS]' : '[FAIL]';
  console.log(`  ${icon} ${c.name}: ${c.detail}`);
}
console.log(`\nScore: ${pass}/${pass + fail}`);
process.exit(fail > 0 ? 1 : 0);
