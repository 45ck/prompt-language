#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

function parseArgs(argv) {
  const options = { workspace: null };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--workspace') {
      options.workspace = argv[index + 1] ?? null;
      index += 1;
      continue;
    }
    throw new Error(`Unknown option: ${arg}`);
  }
  if (!options.workspace) throw new Error('--workspace is required');
  return options;
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

function sectionBody(markdown, section) {
  const lines = markdown.split(/\r?\n/);
  const headingPattern = new RegExp(`^#{1,3}\\s+${escapeRegExp(section)}\\b`, 'i');
  const anyHeadingPattern = /^#{1,3}\s+\S/u;
  const start = lines.findIndex((line) => headingPattern.test(line));
  if (start === -1) return '';
  const end = lines.findIndex((line, index) => index > start && anyHeadingPattern.test(line));
  return lines
    .slice(start + 1, end === -1 ? lines.length : end)
    .join('\n')
    .trim();
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const { workspace } = parseArgs(process.argv.slice(2));
const outputPath = join(workspace, 'projection', 'portarium-evidence-envelope.md');

if (!existsSync(outputPath)) fail('missing projection/portarium-evidence-envelope.md');

const output = readFileSync(outputPath, 'utf8');
const requiredSections = [
  'Target Ref',
  'Context Refs',
  'Policy',
  'Gates',
  'Approvals',
  'Evidence',
  'Route',
  'Non-Goals',
];

for (const section of requiredSections) {
  const body = sectionBody(output, section);
  if (!body) fail(`missing or empty section: ${section}`);
}

const requiredPatterns = [
  [/GSLR-1|MC governed-Symphony|MacquarieCollege/i, 'stable MC/GSLR target'],
  [/docs\/architecture\/mc-governed-symphony-reference-vertical\.md/i, 'MC source ref'],
  [/docs\/architecture\/mc-gslr-1-projection-scenario\.md/i, 'MC scenario ref'],
  [/read-only/i, 'read-only policy'],
  [/no-mutation/i, 'no-mutation policy'],
  [/route manifest|hybrid-routing-manifest/i, 'route manifest evidence'],
  [/gate result|public gate|private oracle|deterministic gate/i, 'gate evidence'],
  [/human review|human approval|approval checkpoint/i, 'human approval point'],
  [/local\b[\s\S]{0,160}\b(bulk|bounded|draft|refactor|projection)/i, 'bounded local lane'],
  [
    /frontier|Codex|classification|repair|review/i,
    'frontier classification, repair, or review lane',
  ],
  [/no source-system writes|source-system writes/i, 'source-system write non-goal'],
  [
    /no solo local ownership|solo local ownership|local-only autonomy/i,
    'solo local ownership non-goal',
  ],
];

for (const [pattern, label] of requiredPatterns) {
  if (!pattern.test(output)) fail(`missing required private-oracle signal: ${label}`);
}

const forbiddenPatterns = [
  [/\bhidden oracles?\b/i, 'hidden-oracle leakage'],
  [
    /\b(local-only autonomy|solo local ownership)\b[\s\S]{0,80}\b(proven|ready|safe|accepted)\b/i,
    'solo local ownership claim',
  ],
  [
    /\bPortarium integration\b[\s\S]{0,80}\b(shipped|production|live)\b/i,
    'shipped integration claim',
  ],
  [/\b(student|staff|ticket|device|room|connector)\s*payload\b/i, 'raw vertical payload'],
  [/\b(password|credential|secret|token|cookie)\b/i, 'credential-like content'],
  [
    /\bwrite\b[\s\S]{0,80}\b(SEQTA|IXL|Jamf|Google Workspace|PaperCut|Freshservice)\b/i,
    'source-system write',
  ],
];

for (const [pattern, label] of forbiddenPatterns) {
  if (pattern.test(output) && !isAllowedNegativeStatement(output, label)) {
    fail(`forbidden private-oracle signal: ${label}`);
  }
}

console.log('gslr1 private oracle passed');

function isAllowedNegativeStatement(output, label) {
  if (label !== 'shipped integration claim') return false;
  return output
    .split(/\r?\n/)
    .some((line) => /Portarium integration/i.test(line) && /\b(no|not)\b/i.test(line));
}
