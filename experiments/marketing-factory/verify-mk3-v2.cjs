#!/usr/bin/env node
// MK-3 v2: Brand Voice + Design Consistency (10 checks)
// Usage: node verify-mk3-v2.cjs <path-to-index.html>

const fs = require('fs');

const file = process.argv[2];
if (!file) {
  console.error('Usage: node verify-mk3-v2.cjs <path-to-index.html>');
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

// Extract style content for CSS checks
const styleBlocks = (html.match(/<style[^>]*>([\s\S]*?)<\/style>/gi) || [])
  .map((s) => s.replace(/<\/?style[^>]*>/gi, ''))
  .join('\n');
const inlineStyles = (html.match(/style=["']([^"']+)["']/gi) || [])
  .map((s) => s.replace(/style=["']|["']/gi, ''))
  .join('\n');
const allCSS = styleBlocks + '\n' + inlineStyles;

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
const exclamations = textContent.match(/[A-Za-z][^.!?]*!/g) || [];
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

// 7. Max 3 font families — count unique font-family declarations
const fontFamilyMatches = allCSS.match(/font-family\s*:\s*([^;}"]+)/gi) || [];
const fontFamilies = new Set();
for (const match of fontFamilyMatches) {
  const value = match.replace(/font-family\s*:\s*/i, '').trim();
  // Extract the primary font (first in the list, before fallbacks like sans-serif)
  const primary = value.split(',')[0].trim().replace(/["']/g, '');
  if (
    primary &&
    !/^(sans-serif|serif|monospace|cursive|fantasy|system-ui|inherit|initial)$/i.test(primary)
  ) {
    fontFamilies.add(primary.toLowerCase());
  }
}
check(
  'Max 3 font families',
  fontFamilies.size <= 3,
  fontFamilies.size === 0
    ? 'No custom font families declared (using defaults)'
    : `${fontFamilies.size} font families: ${[...fontFamilies].join(', ')}`,
);

// 8. Color palette compliance — hex colors from defined palette + standard
const approvedBase = ['2563eb', '7c3aed', '10b981', '1e293b', 'f8fafc'];
const standardColors = ['000000', 'ffffff', '000', 'fff'];
const hexMatches = allCSS.match(/#([0-9a-fA-F]{3,8})\b/g) || [];
// Also check inline HTML for hex colors
const htmlHexMatches = html.match(/#([0-9a-fA-F]{3,8})\b/g) || [];
const allHexColors = [...new Set([...hexMatches, ...htmlHexMatches])];

function normalizeHex(hex) {
  let h = hex.replace('#', '').toLowerCase();
  // Expand 3-char to 6-char
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  // Strip alpha channel (8-char hex)
  if (h.length === 8) h = h.substring(0, 6);
  return h;
}

function isApprovedColor(hex) {
  const norm = normalizeHex(hex);
  if (standardColors.includes(norm) || standardColors.includes(hex.replace('#', '').toLowerCase()))
    return true;
  // Check if it's from the palette or a shade variant (same hue family)
  for (const base of approvedBase) {
    if (norm === base) return true;
    // Allow lighter/darker variants: check if the color shares the dominant channel pattern
    const br = parseInt(base.substring(0, 2), 16);
    const bg = parseInt(base.substring(2, 4), 16);
    const bb = parseInt(base.substring(4, 6), 16);
    const cr = parseInt(norm.substring(0, 2), 16);
    const cg = parseInt(norm.substring(2, 4), 16);
    const cb = parseInt(norm.substring(4, 6), 16);
    if (isNaN(cr) || isNaN(cg) || isNaN(cb)) continue;
    // Shade detection: same dominant channel ordering and within range
    const baseMax = Math.max(br, bg, bb);
    const baseMin = Math.min(br, bg, bb);
    const colorMax = Math.max(cr, cg, cb);
    const colorMin = Math.min(cr, cg, cb);
    // If the hue angle is similar (dominant/subordinate channels match)
    const baseOrder = [br, bg, bb]
      .map((v, i) => ({ v, i }))
      .sort((a, b) => b.v - a.v)
      .map((x) => x.i);
    const colorOrder = [cr, cg, cb]
      .map((v, i) => ({ v, i }))
      .sort((a, b) => b.v - a.v)
      .map((x) => x.i);
    if (baseOrder[0] === colorOrder[0] && baseOrder[2] === colorOrder[2]) {
      // Same hue family — allow as shade/tint
      if (baseMax - baseMin > 20 || colorMax - colorMin > 20) {
        return true;
      }
    }
  }
  // Allow grays (r === g === b)
  const nr = parseInt(norm.substring(0, 2), 16);
  const ng = parseInt(norm.substring(2, 4), 16);
  const nb = parseInt(norm.substring(4, 6), 16);
  if (!isNaN(nr) && Math.abs(nr - ng) <= 15 && Math.abs(ng - nb) <= 15 && Math.abs(nr - nb) <= 15) {
    return true;
  }
  return false;
}

const offPaletteColors = allHexColors.filter((c) => !isApprovedColor(c));
check(
  'Color palette compliance',
  offPaletteColors.length === 0,
  offPaletteColors.length === 0
    ? `All ${allHexColors.length} hex colors are from the approved palette or standard shades`
    : `${offPaletteColors.length} off-palette colors: ${offPaletteColors.slice(0, 5).join(', ')}${offPaletteColors.length > 5 ? '...' : ''}`,
);

// 9. Consistent button class — all <button> or .btn/.cta use a consistent naming pattern
const buttonEls = html.match(/<button[^>]*>/gi) || [];
const buttonClasses = buttonEls
  .map((b) => {
    const classMatch = b.match(/class=["']([^"']+)["']/i);
    return classMatch ? classMatch[1] : '';
  })
  .filter((c) => c.length > 0);
// Check for consistent prefix pattern
const classTokens = buttonClasses.flatMap((c) => c.split(/\s+/));
const btnPatterns = classTokens.filter((t) => /btn|button|cta/i.test(t));
const uniquePrefixes = new Set(btnPatterns.map((p) => p.replace(/[-_].*/, '').toLowerCase()));
const hasConsistentButtons =
  buttonEls.length === 0 || (buttonClasses.length > 0 && uniquePrefixes.size <= 2);
check(
  'Consistent button class',
  hasConsistentButtons,
  buttonEls.length === 0
    ? 'No <button> elements found'
    : `${buttonEls.length} buttons, ${uniquePrefixes.size} naming pattern(s): ${[...uniquePrefixes].join(', ') || 'none'}`,
);

// 10. CSS custom properties — uses -- CSS variables for at least colors
const customPropDefs = allCSS.match(/--[\w-]+\s*:/g) || [];
const customPropColorDefs =
  allCSS.match(/--[\w-]*(?:color|bg|text|primary|secondary|accent|brand)[\w-]*\s*:/gi) || [];
const customPropUsages = allCSS.match(/var\(--[\w-]+\)/g) || [];
const hasCustomProps = customPropDefs.length > 0 && customPropUsages.length > 0;
check(
  'CSS custom properties',
  hasCustomProps,
  hasCustomProps
    ? `${customPropDefs.length} custom properties defined, ${customPropUsages.length} usages (${customPropColorDefs.length} color-related)`
    : `Custom properties: ${customPropDefs.length} defined, ${customPropUsages.length} usages — indicates no design system`,
);

// Summary
console.log('\n=== MK-3 v2: Brand Voice + Design Consistency (10 checks) ===\n');
for (const c of checks) {
  const icon = c.status === 'PASS' ? '[PASS]' : '[FAIL]';
  console.log(`  ${icon} ${c.name}: ${c.detail}`);
}
console.log(`\nScore: ${pass}/${pass + fail}`);
process.exit(fail > 0 ? 1 : 0);
