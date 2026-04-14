#!/usr/bin/env node
// MK-3: Brand voice consistency — checks tone, style, and brand compliance
// Usage: node verify-mk3.js <path-to-index.html>

const fs = require('fs');

const file = process.argv[2];
if (!file) {
  console.error('Usage: node verify-mk3.js <path-to-index.html>');
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

// Strip HTML tags for text analysis
const textContent = html
  .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
  .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

// 1. No filler phrases
const fillerWords = [
  'very',
  'really',
  'just',
  'basically',
  'actually',
  'simply',
  'literally',
  'quite',
  'rather',
];
const foundFillers = [];
for (const filler of fillerWords) {
  const re = new RegExp(`\\b${filler}\\b`, 'gi');
  const matches = textContent.match(re);
  if (matches) foundFillers.push(`${filler}(${matches.length})`);
}
check(
  'No filler phrases',
  foundFillers.length === 0,
  foundFillers.length === 0 ? 'No filler words found' : `Found fillers: ${foundFillers.join(', ')}`,
);

// 2. Action verbs in CTAs (not passive voice)
const ctaMatches =
  html.match(/<(button|a\s+[^>]*class=["'][^"']*(?:btn|cta|button)[^"']*["'])[^>]*>([^<]+)</gi) ||
  [];
const ctaTexts = ctaMatches.map((m) => m.replace(/<[^>]+>/g, '').trim());
// Also grab standalone buttons
const buttonTexts = (html.match(/<button[^>]*>([^<]+)<\/button>/gi) || []).map((m) =>
  m.replace(/<[^>]+>/g, '').trim(),
);
const allCTAs = [...new Set([...ctaTexts, ...buttonTexts])].filter(
  (t) => t.length > 0 && t.length < 50,
);
const actionVerbs =
  /^(get|start|try|deploy|monitor|sign|join|create|build|launch|discover|explore|view|learn|see|contact|request|book|schedule)/i;
const passiveCTAs = allCTAs.filter((cta) => !actionVerbs.test(cta.trim()) && !/free/i.test(cta));
check(
  'Action verbs in CTAs',
  allCTAs.length > 0 && passiveCTAs.length <= 1,
  allCTAs.length === 0
    ? 'No CTA buttons detected'
    : `${allCTAs.length} CTAs found. Non-action: ${passiveCTAs.length > 0 ? passiveCTAs.join(', ') : 'none'}`,
);

// 3. Consistent heading capitalization (Title Case)
const headings = html.match(/<h[1-6][^>]*>([^<]+)<\/h[1-6]>/gi) || [];
const headingTexts = headings.map((h) => h.replace(/<[^>]+>/g, '').trim());
const minorWords = new Set([
  'a',
  'an',
  'the',
  'and',
  'but',
  'or',
  'for',
  'nor',
  'in',
  'on',
  'at',
  'to',
  'by',
  'of',
  'with',
]);
const notTitleCase = headingTexts.filter((h) => {
  const words = h.split(/\s+/);
  if (words.length <= 1) return false;
  return words.some((w, i) => {
    if (/^\d/.test(w)) return false;
    if (i > 0 && minorWords.has(w.toLowerCase())) return false;
    return w.length > 0 && w[0] !== w[0].toUpperCase();
  });
});
check(
  'Title Case headings',
  headingTexts.length > 0 && notTitleCase.length <= 1,
  headingTexts.length === 0
    ? 'No headings found'
    : `${headingTexts.length} headings, non-Title-Case: ${notTitleCase.length > 0 ? notTitleCase.join(' | ') : 'none'}`,
);

// 4. No exclamation marks in body copy (professional tone)
// Allow in <script> but not in visible text
const exclamations = textContent.match(/[A-Za-z][^.!?]*!/g) || [];
// Filter out JavaScript-like content
const realExclamations = exclamations.filter(
  (e) => !/function|var |let |const |if\s*\(|===|!==|!=/.test(e),
);
check(
  'No exclamation marks',
  realExclamations.length <= 1,
  realExclamations.length <= 1
    ? `${realExclamations.length} exclamation(s) in body copy (acceptable)`
    : `Found ${realExclamations.length} exclamation marks — unprofessional tone`,
);

// 5. Product name used consistently (exact "CloudPulse" match)
const correctName = (textContent.match(/CloudPulse/g) || []).length;
const wrongVariants = (
  textContent.match(/cloud\s+pulse|cloudpulse|Cloud\s+Pulse|CLOUDPULSE/gi) || []
).filter((v) => v !== 'CloudPulse');
check(
  'Product name consistency',
  correctName >= 3 && wrongVariants.length === 0,
  `"CloudPulse" appears ${correctName} times. Wrong variants: ${wrongVariants.length > 0 ? wrongVariants.join(', ') : 'none'}`,
);

// 6. Sentence length (under 20 words average)
const sentences = textContent
  .split(/[.!?]+/)
  .map((s) => s.trim())
  .filter((s) => s.length > 10);
const wordCounts = sentences.map((s) => s.split(/\s+/).length);
const avgWords =
  wordCounts.length > 0 ? wordCounts.reduce((a, b) => a + b, 0) / wordCounts.length : 0;
check(
  'Sentence brevity (<20 avg)',
  avgWords > 0 && avgWords <= 20,
  `${sentences.length} sentences, average ${avgWords.toFixed(1)} words`,
);

// Summary
console.log('\n=== MK-3: Brand Voice Consistency ===\n');
for (const c of checks) {
  const icon = c.status === 'PASS' ? '[PASS]' : '[FAIL]';
  console.log(`  ${icon} ${c.name}: ${c.detail}`);
}
console.log(`\nScore: ${pass}/${pass + fail}`);
process.exit(fail > 0 ? 1 : 0);
