#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const outputPath = join(process.cwd(), 'projection', 'portarium-evidence-envelope.md');

function fail(message) {
  console.error(message);
  process.exit(1);
}

if (!existsSync(outputPath)) {
  fail('missing projection/portarium-evidence-envelope.md');
}

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
  const sectionPattern = new RegExp(`^#{1,3}\\s+${section}\\b`, 'im');
  if (!sectionPattern.test(output)) fail(`missing section: ${section}`);
}

const requiredConcepts = [
  /read-only|no-mutation/i,
  /Prompt Language|PL\b/i,
  /local/i,
  /frontier|Codex/i,
  /manifest/i,
  /gate/i,
  /approval/i,
  /evidence/i,
];

for (const pattern of requiredConcepts) {
  if (!pattern.test(output)) fail(`missing concept matching ${pattern}`);
}

const forbiddenPatterns = [
  /\b(student|staff|ticket|device|room|connector)\s*payload\b/i,
  /\bpassword\b|\bcredential\b|\bsecret\b/i,
  /\bhidden oracle\b/i,
  /\blocal-only autonomy\b/i,
  /\bshipped\b.*\bPortarium integration\b/i,
  /\bwrite\b.*\b(SEQTA|IXL|Jamf|Google Workspace|PaperCut|Freshservice)\b/i,
];

for (const pattern of forbiddenPatterns) {
  if (pattern.test(output)) fail(`forbidden unsafe content matching ${pattern}`);
}

console.log('public gate passed');
