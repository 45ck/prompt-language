#!/usr/bin/env node

/**
 * Flow validation script — parses, lints, and scores a flow.
 *
 * Usage:
 *   node validate.mjs <file>        # validate a flow file
 *   echo "flow text" | node validate.mjs   # validate from stdin
 */

import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const distRoot = join(__dirname, '..', '..', 'dist');

const { parseFlow } = await import(
  pathToFileURL(join(distRoot, 'application', 'parse-flow.js')).href
);
const { lintFlow } = await import(pathToFileURL(join(distRoot, 'domain', 'lint-flow.js')).href);
const { flowComplexityScore } = await import(
  pathToFileURL(join(distRoot, 'domain', 'flow-complexity.js')).href
);

const COMPLEXITY_LABELS = ['', 'Trivial', 'Simple', 'Moderate', 'Complex', 'Very complex'];

async function readInput() {
  const filePath = process.argv[2];
  if (filePath) {
    return readFileSync(filePath, 'utf8');
  }

  // Read from stdin
  const chunks = [];
  if (!process.stdin.isTTY) {
    for await (const chunk of process.stdin) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks).toString('utf8');
  }

  console.error('Usage: node validate.mjs <file>');
  console.error('       echo "flow text" | node validate.mjs');
  process.exit(1);
}

const input = await readInput();

if (!input.trim()) {
  console.error('Error: empty input');
  process.exit(1);
}

const spec = parseFlow(input);
const lintWarnings = lintFlow(spec);
const complexity = flowComplexityScore(spec);

// Print results
console.log('=== Flow Validation ===\n');

// Goal
if (spec.goal) {
  console.log(`Goal: ${spec.goal}`);
} else {
  console.log('Goal: (missing)');
}
console.log(`Nodes: ${spec.nodes.length}`);
console.log(`Gates: ${spec.completionGates.length}`);
console.log(`Complexity: ${complexity}/5 (${COMPLEXITY_LABELS[complexity]})`);
console.log();

// Parse warnings
if (spec.warnings.length > 0) {
  console.log(`Parse warnings (${spec.warnings.length}):`);
  for (const w of spec.warnings) {
    console.log(`  - ${w}`);
  }
  console.log();
}

// Lint warnings
if (lintWarnings.length > 0) {
  console.log(`Lint warnings (${lintWarnings.length}):`);
  for (const w of lintWarnings) {
    const loc = w.nodeId ? ` [${w.nodeId}]` : '';
    console.log(`  - ${w.message}${loc}`);
  }
  console.log();
}

// Summary
const totalWarnings = spec.warnings.length + lintWarnings.length;
if (totalWarnings === 0) {
  console.log('Result: PASS — no issues found');
} else {
  console.log(`Result: ${totalWarnings} warning(s) found`);
}

process.exit(totalWarnings > 0 ? 1 : 0);
