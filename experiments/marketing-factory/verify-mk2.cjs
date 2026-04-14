#!/usr/bin/env node
// MK-2: Structured content completeness — checks all required sections present
// Usage: node verify-mk2.js <path-to-index.html>

const fs = require('fs');

const file = process.argv[2];
if (!file) {
  console.error('Usage: node verify-mk2.js <path-to-index.html>');
  process.exit(1);
}

if (!fs.existsSync(file)) {
  console.error(`File not found: ${file}`);
  process.exit(1);
}

const html = fs.readFileSync(file, 'utf8');
const lower = html.toLowerCase();
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

// 1. Hero section with headline + CTA button
const hasHero =
  /id=["']hero["']/i.test(html) ||
  /<section[^>]*class=["'][^"']*hero[^"']*["']/i.test(html) ||
  (lower.includes('hero') && /<h1/i.test(html));
const hasCTA = /<(button|a)[^>]*>(get\s+started|start\s+|sign\s+up|try\s+|deploy|monitor)/i.test(
  html,
);
check(
  'Hero section',
  hasHero && hasCTA,
  hasHero && hasCTA
    ? 'Hero section with headline and CTA found'
    : `Hero: ${hasHero ? 'found' : 'missing'}, CTA: ${hasCTA ? 'found' : 'missing'}`,
);

// 2. Features section with 3+ feature cards
const hasFeatures =
  /id=["']features["']/i.test(html) ||
  /<section[^>]*class=["'][^"']*features?[^"']*["']/i.test(html);
const featureCards = (
  html.match(/<(div|article|li)[^>]*class=["'][^"']*(?:feature|card)[^"']*["']/gi) || []
).length;
// Fallback: count h3 tags within features-like sections
const h3Count = (html.match(/<h3/gi) || []).length;
const effectiveCards = Math.max(featureCards, h3Count >= 3 ? h3Count : 0);
check(
  'Features section (3+ cards)',
  hasFeatures && effectiveCards >= 3,
  `Features section: ${hasFeatures ? 'found' : 'missing'}, cards/items: ${effectiveCards}`,
);

// 3. Pricing section with 2+ tiers
const hasPricing =
  /id=["']pricing["']/i.test(html) || /<section[^>]*class=["'][^"']*pricing[^"']*["']/i.test(html);
const priceMatches =
  html.match(/\$\d+|\d+\/mo|\/month|free|starter|pro|enterprise|basic|premium/gi) || [];
check(
  'Pricing section (2+ tiers)',
  hasPricing && priceMatches.length >= 2,
  `Pricing section: ${hasPricing ? 'found' : 'missing'}, tier indicators: ${priceMatches.length}`,
);

// 4. Testimonials section with 2+ quotes
const hasTestimonials =
  /id=["']testimonials["']/i.test(html) ||
  /<section[^>]*class=["'][^"']*testimonial[^"']*["']/i.test(html);
const quoteMatches = (
  html.match(/<blockquote|class=["'][^"']*(?:quote|testimonial-card|review)[^"']*["']/gi) || []
).length;
// Fallback: count <p> or <q> elements that look like quotes
const quoteFallback = (html.match(/[""\u201C][^""\u201D]{20,}[""\u201D]/g) || []).length;
const effectiveQuotes = Math.max(quoteMatches, quoteFallback);
check(
  'Testimonials (2+ quotes)',
  hasTestimonials && effectiveQuotes >= 2,
  `Testimonials: ${hasTestimonials ? 'found' : 'missing'}, quotes: ${effectiveQuotes}`,
);

// 5. Footer with contact info + social links
const hasFooter = /<footer/i.test(html);
const hasSocial =
  /twitter|linkedin|github|x\.com/i.test(html) &&
  (html.match(/twitter|linkedin|github|x\.com/gi) || []).length >= 2;
const hasContact = /contact|email|mailto:|info@|support@|phone|\d{3}[-.\s]\d{3}/i.test(html);
check(
  'Footer (contact + social)',
  hasFooter && hasSocial && hasContact,
  `Footer: ${hasFooter ? 'found' : 'missing'}, social: ${hasSocial ? 'found' : 'missing'}, contact: ${hasContact ? 'found' : 'missing'}`,
);

// 6. Navigation with links to all sections
const hasNav = /<nav/i.test(html);
const navLinks = html.match(/href="#[^"]+"/gi) || [];
const navTargets = navLinks.map((l) => l.match(/href="#([^"]+)"/i)[1].toLowerCase());
const requiredSections = ['features', 'pricing', 'testimonials'];
const coveredSections = requiredSections.filter(
  (s) => navTargets.some((t) => t.includes(s)) || lower.includes(`href="#${s}"`),
);
check(
  'Navigation (links to sections)',
  hasNav && coveredSections.length >= 3,
  `Nav: ${hasNav ? 'found' : 'missing'}, linked sections: ${coveredSections.join(', ') || 'none'} (need: ${requiredSections.join(', ')})`,
);

// Summary
console.log('\n=== MK-2: Structured Content Completeness ===\n');
for (const c of checks) {
  const icon = c.status === 'PASS' ? '[PASS]' : '[FAIL]';
  console.log(`  ${icon} ${c.name}: ${c.detail}`);
}
console.log(`\nScore: ${pass}/${pass + fail}`);
process.exit(fail > 0 ? 1 : 0);
