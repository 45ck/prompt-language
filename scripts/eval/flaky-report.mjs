#!/usr/bin/env node
/**
 * flaky-report.mjs — Smoke Test Stability Report
 *
 * Reads structured result files from scripts/eval/results/ and produces
 * a markdown table showing per-test pass rates and flaky test detection.
 *
 * A test is considered "flaky" if its pass rate is below 95%.
 *
 * Usage:
 *   node scripts/eval/flaky-report.mjs
 *
 * Exits with code 1 if any test is flaky (for CI integration).
 */

import { readdir, readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RESULTS_DIR = join(__dirname, 'results');
const FLAKY_THRESHOLD = 0.95;

async function loadResults() {
  let files;
  try {
    files = (await readdir(RESULTS_DIR))
      .filter((f) => f.startsWith('smoke-') && f.endsWith('.json'))
      .sort();
  } catch {
    console.error('No results directory found. Run smoke tests first:');
    console.error('  npm run eval:smoke');
    process.exit(1);
  }

  if (files.length === 0) {
    console.error('No result files found in', RESULTS_DIR);
    console.error('Run smoke tests first: npm run eval:smoke');
    process.exit(1);
  }

  const runs = [];
  for (const f of files) {
    try {
      const content = await readFile(join(RESULTS_DIR, f), 'utf-8');
      runs.push(JSON.parse(content));
    } catch {
      /* skip malformed files */
    }
  }

  return runs;
}

function buildReport(runs) {
  // Aggregate per-test stats across all runs
  const stats = new Map();

  for (const run of runs) {
    for (const test of run.tests) {
      if (!stats.has(test.name)) {
        stats.set(test.name, {
          name: test.name,
          label: test.label,
          passes: 0,
          total: 0,
          durations: [],
        });
      }
      const s = stats.get(test.name);
      s.total++;
      if (test.passed) s.passes++;
      s.durations.push(test.duration_ms);
    }
  }

  // Sort by test name (A, B, C, ...)
  const sorted = [...stats.values()].sort((a, b) => a.name.localeCompare(b.name));

  return sorted.map((s) => {
    const passRate = s.total > 0 ? s.passes / s.total : 0;
    const avgDuration =
      s.durations.length > 0 ? s.durations.reduce((a, b) => a + b, 0) / s.durations.length : 0;
    return {
      name: s.name,
      label: s.label,
      passRate,
      runs: s.total,
      avgDuration_ms: avgDuration,
      status: passRate >= FLAKY_THRESHOLD ? 'stable' : 'FLAKY',
    };
  });
}

function printReport(entries, runs) {
  console.log('## Smoke Test Stability Report');
  console.log('');
  console.log(`Based on ${runs.length} run(s).`);
  console.log('');
  console.log('| Test | Label | Pass Rate | Runs | Avg Duration | Status |');
  console.log('|------|-------|-----------|------|-------------|--------|');

  for (const e of entries) {
    const rate = `${(e.passRate * 100).toFixed(0)}%`;
    const avgSec = `${(e.avgDuration_ms / 1000).toFixed(1)}s`;
    console.log(
      `| ${e.name}    | ${e.label.padEnd(30)} | ${rate.padStart(4)}      | ${String(e.runs).padStart(4)} | ${avgSec.padStart(11)} | ${e.status.padEnd(6)} |`,
    );
  }

  const flakyTests = entries.filter((e) => e.status === 'FLAKY');
  if (flakyTests.length > 0) {
    console.log('');
    console.log(`Flaky tests detected (pass rate < ${FLAKY_THRESHOLD * 100}%):`);
    for (const t of flakyTests) {
      console.log(
        `  - ${t.name}: ${t.label} (${(t.passRate * 100).toFixed(0)}% pass rate over ${t.runs} runs)`,
      );
    }
  } else {
    console.log('');
    console.log('All tests are stable.');
  }

  return flakyTests.length;
}

async function main() {
  const runs = await loadResults();
  const entries = buildReport(runs);
  const flakyCount = printReport(entries, runs);

  if (flakyCount > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
