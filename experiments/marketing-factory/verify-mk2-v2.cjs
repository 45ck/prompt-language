#!/usr/bin/env node
// MK-2 v2: Content + SEO (10 checks)
// Usage: node verify-mk2-v2.cjs <path-to-index.html>

const fs = require('fs');

const file = process.argv[2];
if (!file) {
  console.error('Usage: node verify-mk2-v2.cjs <path-to-index.html>');
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
const quoteFallback = (html.match(/["\u201C][^"\u201D]{20,}["\u201D]/g) || []).length;
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

// 7. Meta description — <meta name="description" content="..."> present and non-empty
const metaDescMatch = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i);
const hasMetaDesc = metaDescMatch !== null && metaDescMatch[1].trim().length > 0;
check(
  'Meta description',
  hasMetaDesc,
  hasMetaDesc
    ? `Meta description: "${metaDescMatch[1].substring(0, 60)}${metaDescMatch[1].length > 60 ? '...' : ''}"`
    : 'Missing or empty <meta name="description"> tag',
);

// 8. Open Graph tags — og:title and og:description present
const hasOgTitle = /<meta\s+property=["']og:title["']\s+content=["'][^"']+["']/i.test(html);
const hasOgDesc = /<meta\s+property=["']og:description["']\s+content=["'][^"']+["']/i.test(html);
check(
  'Open Graph tags',
  hasOgTitle && hasOgDesc,
  `og:title: ${hasOgTitle ? 'found' : 'missing'}, og:description: ${hasOgDesc ? 'found' : 'missing'}`,
);

// 9. Favicon reference — <link rel="icon" or <link rel="shortcut icon"
const hasFavicon = /<link\s+[^>]*rel=["'](?:icon|shortcut icon)["']/i.test(html);
check(
  'Favicon reference',
  hasFavicon,
  hasFavicon ? 'Favicon link tag found' : 'Missing <link rel="icon"> tag',
);

// 10. JSON-LD schema — <script type="application/ld+json"> with valid JSON
const ldJsonMatches =
  html.match(/<script\s+type=["']application\/ld\+json["']>([\s\S]*?)<\/script>/gi) || [];
let ldJsonValid = false;
let ldJsonDetail = 'No JSON-LD schema found';
if (ldJsonMatches.length > 0) {
  const content = ldJsonMatches[0]
    .replace(/<script[^>]*>/i, '')
    .replace(/<\/script>/i, '')
    .trim();
  try {
    JSON.parse(content);
    ldJsonValid = true;
    ldJsonDetail = `${ldJsonMatches.length} JSON-LD block(s) with valid JSON`;
  } catch (e) {
    ldJsonDetail = `JSON-LD block found but contains invalid JSON: ${e.message}`;
  }
}
check('JSON-LD schema', ldJsonValid, ldJsonDetail);

// Summary
console.log('\n=== MK-2 v2: Content + SEO (10 checks) ===\n');
for (const c of checks) {
  const icon = c.status === 'PASS' ? '[PASS]' : '[FAIL]';
  console.log(`  ${icon} ${c.name}: ${c.detail}`);
}
console.log(`\nScore: ${pass}/${pass + fail}`);
process.exit(fail > 0 ? 1 : 0);
