#!/usr/bin/env node
// Verify: does the site have all required content sections?
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';

const projectDir = resolve(process.argv[2] || '.');

const REQUIRED_SECTIONS = [
  { name: 'hero', patterns: ['hero', 'banner', 'landing', 'jumbotron'] },
  { name: 'features', patterns: ['feature', 'capability', 'benefit'] },
  { name: 'how-it-works', patterns: ['how.it.works', 'how-it-works', 'process', 'steps'] },
  { name: 'testimonials', patterns: ['testimonial', 'review', 'social.proof', 'quote'] },
  { name: 'pricing', patterns: ['pricing', 'plans', 'tiers'] },
  { name: 'integrations', patterns: ['integration', 'connect', 'partner'] },
  { name: 'faq', patterns: ['faq', 'question', 'accordion'] },
  { name: 'cta', patterns: ['cta', 'call.to.action', 'signup', 'get.started'] },
];

export function verifyContent(dir) {
  const result = { name: 'content', pass: false, details: '', sections: {} };

  // Collect all source content
  const skipDirs = new Set(['node_modules', '.next', 'dist', 'out', '.git', '.astro']);
  let allContent = '';

  function walk(d) {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (skipDirs.has(entry.name)) continue;
        walk(join(d, entry.name));
      } else if (/\.(tsx?|jsx?|astro|svelte|vue|html|css)$/.test(entry.name)) {
        try {
          allContent += '\n' + entry.name + '\n' + readFileSync(join(d, entry.name), 'utf8');
        } catch {
          /* skip unreadable */
        }
      }
    }
  }

  walk(dir);
  const lower = allContent.toLowerCase();

  let found = 0;
  for (const section of REQUIRED_SECTIONS) {
    const hasSection = section.patterns.some((p) => new RegExp(p, 'i').test(lower));
    result.sections[section.name] = hasSection;
    if (hasSection) found++;
  }

  result.pass = found >= 6; // 6 out of 8 required
  result.details = `${found}/${REQUIRED_SECTIONS.length} sections found: ${Object.entries(
    result.sections,
  )
    .map(([k, v]) => `${k}=${v ? 'YES' : 'NO'}`)
    .join(', ')}`;

  return result;
}

if (process.argv[1] === import.meta.filename) {
  const r = verifyContent(projectDir);
  console.log(`[${r.pass ? 'PASS' : 'FAIL'}] ${r.name}: ${r.details}`);
  process.exit(r.pass ? 0 : 1);
}
