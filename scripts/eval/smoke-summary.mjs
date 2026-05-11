#!/usr/bin/env node
/**
 * smoke-summary.mjs — aggregate live smoke telemetry without copying raw transcripts.
 *
 * Usage:
 *   node scripts/eval/smoke-summary.mjs
 *   node scripts/eval/smoke-summary.mjs --test A --harness codex,claude --last 20
 *   node scripts/eval/smoke-summary.mjs --json --out scripts/eval/results/smoke-summary.json
 */

import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_RESULTS_DIR = join(__dirname, 'results');

const NUMERIC_METRIC_KEYS = [
  'records',
  'inputTokens',
  'outputTokens',
  'totalTokens',
  'cacheReadInputTokens',
  'cacheCreationInputTokens',
  'reasoningOutputTokens',
  'estimatedCostUsd',
  'retryCount',
];

const TOKEN_METRIC_KEYS = [
  'inputTokens',
  'outputTokens',
  'totalTokens',
  'cacheReadInputTokens',
  'cacheCreationInputTokens',
  'reasoningOutputTokens',
];

const PROMPT_BACKED_TESTS = new Set(['A']);

function parseList(value) {
  if (typeof value !== 'string' || value.trim() === '') {
    return null;
  }
  return new Set(
    value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean),
  );
}

export function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    resultsDir: DEFAULT_RESULTS_DIR,
    format: 'markdown',
    out: null,
    last: null,
    harnesses: null,
    models: null,
    tests: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--json') {
      options.format = 'json';
    } else if (arg === '--markdown') {
      options.format = 'markdown';
    } else if (arg === '--results-dir') {
      options.resultsDir = resolve(argv[++index]);
    } else if (arg === '--out') {
      options.out = resolve(argv[++index]);
    } else if (arg === '--last') {
      options.last = Number.parseInt(argv[++index], 10);
    } else if (arg === '--harness') {
      options.harnesses = parseList(argv[++index]);
    } else if (arg === '--model') {
      options.models = parseList(argv[++index]);
    } else if (arg === '--test') {
      options.tests = parseList(argv[++index]);
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  if (options.last !== null && (!Number.isInteger(options.last) || options.last <= 0)) {
    throw new Error('--last must be a positive integer');
  }

  return options;
}

function safeNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function addMetric(target, key, value) {
  const numeric = safeNumber(value);
  if (numeric === null) {
    target[key] ??= null;
    return;
  }
  target[key] = (target[key] ?? 0) + numeric;
}

function emptyMetrics() {
  return Object.fromEntries(NUMERIC_METRIC_KEYS.map((key) => [key, null]));
}

function mergeMetrics(target, source = {}) {
  for (const key of NUMERIC_METRIC_KEYS) {
    addMetric(target, key, source[key]);
  }
}

function median(values) {
  const sorted = values.filter((value) => safeNumber(value) !== null).toSorted((a, b) => a - b);
  if (sorted.length === 0) {
    return null;
  }
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) {
    return sorted[middle];
  }
  return (sorted[middle - 1] + sorted[middle]) / 2;
}

function mean(values) {
  const numeric = values.filter((value) => safeNumber(value) !== null);
  if (numeric.length === 0) {
    return null;
  }
  return numeric.reduce((sum, value) => sum + value, 0) / numeric.length;
}

function formatPercent(value) {
  return value === null ? 'n/a' : `${(value * 100).toFixed(0)}%`;
}

function formatSeconds(value) {
  return value === null ? 'n/a' : `${(value / 1000).toFixed(1)}s`;
}

function formatNumber(value) {
  if (value === null || value === undefined) {
    return 'n/a';
  }
  if (Number.isInteger(value)) {
    return value.toLocaleString('en-US');
  }
  return value.toLocaleString('en-US', { maximumFractionDigits: 4 });
}

function formatCost(value) {
  if (value === null || value === undefined) {
    return 'n/a';
  }
  return `$${value.toFixed(6)}`;
}

function runOnlyKey(run) {
  const only = Array.isArray(run.only) ? run.only : [];
  return only.length === 0 ? 'all' : only.join(',');
}

function getModel(run) {
  if (typeof run.model === 'string' && run.model.trim() !== '') {
    return run.model;
  }
  const telemetry = Array.isArray(run.providerTelemetry) ? run.providerTelemetry : [];
  const actualModel = telemetry.find(
    (entry) => typeof entry?.actualModel === 'string',
  )?.actualModel;
  return actualModel ?? 'unknown';
}

function getHarness(run) {
  return run.runnerHarness ?? run.harness ?? 'unknown';
}

function hasSelectedTest(run, selectedTests) {
  if (selectedTests === null) {
    return true;
  }
  const selectedSmokeIds = Array.isArray(run.only) ? run.only : [];
  if (selectedSmokeIds.some((id) => selectedTests.has(id))) {
    return true;
  }
  const tests = Array.isArray(run.tests) ? run.tests : [];
  return tests.some((test) => selectedTests.has(test.name));
}

function matchesFilters(run, options) {
  const harness = getHarness(run);
  const model = getModel(run);
  if (options.harnesses !== null && !options.harnesses.has(harness)) {
    return false;
  }
  if (options.models !== null && !options.models.has(model)) {
    return false;
  }
  return hasSelectedTest(run, options.tests);
}

async function loadSmokeReports(resultsDir, warnings) {
  let files;
  try {
    files = (await readdir(resultsDir))
      .filter((file) => file.startsWith('smoke-') && file.endsWith('.json'))
      .sort();
  } catch {
    throw new Error(`No smoke results directory found: ${resultsDir}`);
  }

  const reports = [];
  for (const file of files) {
    try {
      const raw = await readFile(join(resultsDir, file), 'utf8');
      reports.push({ ...JSON.parse(raw), reportId: file });
    } catch (error) {
      warnings.push(`Skipped malformed smoke report ${file}: ${error.message}`);
    }
  }
  return reports;
}

function costBasisFor(run, metrics) {
  const providers = Array.isArray(metrics?.providers) ? metrics.providers : [];
  if (safeNumber(metrics?.estimatedCostUsd) !== null) {
    return 'provider_reported';
  }
  if (providers.includes('ollama') || getHarness(run) === 'ollama') {
    return 'zero_api_cost';
  }
  return 'unknown';
}

function readClaimProfile(run) {
  const profile = run.claimProfile;
  if (profile && typeof profile === 'object') {
    const status =
      profile.status === 'claim-eligible' || profile.status === 'recorded-only'
        ? profile.status
        : 'unknown';
    return {
      status,
      blockers: Array.isArray(profile.blockers) ? profile.blockers.map(String).sort() : [],
    };
  }
  return {
    status: 'unknown',
    blockers: ['claim-profile-missing'],
  };
}

function addClaimProfile(target, claimProfile) {
  target.total += 1;
  if (claimProfile.status === 'claim-eligible') {
    target.claimEligible += 1;
  } else if (claimProfile.status === 'recorded-only') {
    target.recordedOnly += 1;
  } else {
    target.unknown += 1;
  }
  for (const blocker of claimProfile.blockers) {
    target.blockers[blocker] = (target.blockers[blocker] ?? 0) + 1;
  }
}

function addOutcome(target, run) {
  if (Object.hasOwn(target, 'total')) {
    target.total += 1;
  } else {
    target.runs += 1;
  }
  if (run.status === 'blocked') {
    target.blocked += 1;
  } else if (run.status === 'passed') {
    target.passed += 1;
  } else {
    target.failed += 1;
  }
}

function finalizeOutcome(target) {
  const attempted = target.passed + target.failed;
  target.passRateExcludingBlocked = attempted === 0 ? null : target.passed / attempted;
}

function aggregateRuns(reports, options) {
  const warnings = [];
  const filtered = reports.filter((run) => matchesFilters(run, options));
  const selected =
    options.last === null || filtered.length <= options.last
      ? filtered
      : filtered.slice(-options.last);

  const summary = {
    generatedAt: new Date().toISOString(),
    source: {
      resultsDir: options.resultsDir,
      reportCount: selected.length,
      filters: {
        harnesses: options.harnesses === null ? null : [...options.harnesses].sort(),
        models: options.models === null ? null : [...options.models].sort(),
        tests: options.tests === null ? null : [...options.tests].sort(),
        last: options.last,
      },
      dateRange: {
        first: selected[0]?.timestamp ?? null,
        last: selected.at(-1)?.timestamp ?? null,
      },
    },
    runs: {
      total: 0,
      passed: 0,
      failed: 0,
      blocked: 0,
      passRateExcludingBlocked: null,
    },
    matrix: [],
    providers: [],
    tests: [],
    claimProfiles: {
      total: 0,
      claimEligible: 0,
      recordedOnly: 0,
      unknown: 0,
      blockers: {},
    },
    evidenceWarnings: warnings,
  };

  const matrix = new Map();
  const providers = new Map();
  const tests = new Map();

  for (const run of selected) {
    addOutcome(summary.runs, run);

    const harness = getHarness(run);
    const model = getModel(run);
    const only = runOnlyKey(run);
    const claimProfile = readClaimProfile(run);
    addClaimProfile(summary.claimProfiles, claimProfile);
    const matrixKey = `${harness}\u0000${model}\u0000${only}`;
    if (!matrix.has(matrixKey)) {
      matrix.set(matrixKey, {
        harness,
        model,
        smokeIds: only,
        runs: 0,
        passed: 0,
        failed: 0,
        blocked: 0,
        passRateExcludingBlocked: null,
        medianDurationMs: null,
        durationsMs: [],
        providerMetrics: emptyMetrics(),
        costBasis: new Set(),
        claimProfileStatuses: new Set(),
        claimProfileBlockers: new Set(),
        reportIds: [],
      });
    }
    const cell = matrix.get(matrixKey);
    addOutcome(cell, run);
    cell.reportIds.push(run.reportId);
    cell.durationsMs.push(run.duration_ms);
    mergeMetrics(cell.providerMetrics, run.providerMetrics);
    cell.costBasis.add(costBasisFor(run, run.providerMetrics));
    cell.claimProfileStatuses.add(claimProfile.status);
    for (const blocker of claimProfile.blockers) {
      cell.claimProfileBlockers.add(blocker);
    }

    const providerNames =
      Array.isArray(run.providerMetrics?.providers) && run.providerMetrics.providers.length > 0
        ? run.providerMetrics.providers
        : [harness];
    for (const provider of providerNames) {
      if (!providers.has(provider)) {
        providers.set(provider, {
          provider,
          runs: 0,
          metrics: emptyMetrics(),
          costBasis: new Set(),
        });
      }
      const providerEntry = providers.get(provider);
      providerEntry.runs += 1;
      mergeMetrics(providerEntry.metrics, run.providerMetrics);
      providerEntry.costBasis.add(costBasisFor(run, run.providerMetrics));
    }

    const runTests = Array.isArray(run.tests) ? run.tests : [];
    for (const test of runTests) {
      if (options.tests !== null && !options.tests.has(test.name)) {
        continue;
      }
      if (!tests.has(test.name)) {
        tests.set(test.name, {
          name: test.name,
          label: test.label ?? '',
          runs: 0,
          passed: 0,
          failed: 0,
          passRate: null,
          avgDurationMs: null,
          medianDurationMs: null,
          latestStatus: null,
          failureStreak: 0,
          durationsMs: [],
          outcomes: [],
        });
      }
      const entry = tests.get(test.name);
      entry.runs += 1;
      if (test.passed) {
        entry.passed += 1;
      } else {
        entry.failed += 1;
      }
      entry.latestStatus = test.passed ? 'passed' : 'failed';
      entry.durationsMs.push(test.duration_ms);
      entry.outcomes.push(Boolean(test.passed));
    }

    const records = safeNumber(run.providerMetrics?.records);
    const selectedSmokeIds = Array.isArray(run.only) ? run.only : [];
    if (
      run.status !== 'blocked' &&
      records !== null &&
      records === 0 &&
      selectedSmokeIds.some((id) => PROMPT_BACKED_TESTS.has(id))
    ) {
      warnings.push(`${run.reportId} has zero provider records for prompt-backed smoke ${only}.`);
    }
    if (run.status === 'blocked') {
      warnings.push(`${run.reportId} is blocked and excluded from correctness pass-rate claims.`);
    }
    if (claimProfile.status !== 'claim-eligible') {
      warnings.push(
        `${run.reportId} is ${claimProfile.status} for claim-profile purposes (${claimProfile.blockers.join(', ') || 'no blockers listed'}).`,
      );
    }
  }

  finalizeOutcome(summary.runs);

  summary.matrix = [...matrix.values()]
    .map((cell) => {
      finalizeOutcome(cell);
      const providerMetrics = cell.providerMetrics;
      const result = {
        harness: cell.harness,
        model: cell.model,
        smokeIds: cell.smokeIds,
        runs: cell.runs,
        passed: cell.passed,
        failed: cell.failed,
        blocked: cell.blocked,
        passRateExcludingBlocked: cell.passRateExcludingBlocked,
        medianDurationMs: median(cell.durationsMs),
        providerMetrics,
        costBasis: [...cell.costBasis].sort(),
        claimProfileStatuses: [...cell.claimProfileStatuses].sort(),
        claimProfileBlockers: [...cell.claimProfileBlockers].sort(),
        reportIds: cell.reportIds,
      };
      return result;
    })
    .sort((a, b) => `${a.harness}\u0000${a.model}`.localeCompare(`${b.harness}\u0000${b.model}`));

  summary.providers = [...providers.values()]
    .map((entry) => ({
      provider: entry.provider,
      runs: entry.runs,
      metrics: entry.metrics,
      costBasis: [...entry.costBasis].sort(),
    }))
    .sort((a, b) => a.provider.localeCompare(b.provider));

  summary.tests = [...tests.values()]
    .map((entry) => {
      entry.passRate = entry.runs === 0 ? null : entry.passed / entry.runs;
      entry.avgDurationMs = mean(entry.durationsMs);
      entry.medianDurationMs = median(entry.durationsMs);
      let streak = 0;
      for (let index = entry.outcomes.length - 1; index >= 0; index -= 1) {
        if (entry.outcomes[index]) {
          break;
        }
        streak += 1;
      }
      entry.failureStreak = streak;
      delete entry.durationsMs;
      delete entry.outcomes;
      return entry;
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  if (selected.length === 0) {
    warnings.push('No smoke reports matched the selected filters.');
  }
  for (const cell of summary.matrix) {
    if (cell.providerMetrics.records === null) {
      warnings.push(
        `${cell.harness}/${cell.model}/${cell.smokeIds} has no provider metric records; token/cost claims are unavailable.`,
      );
    }
    if (cell.costBasis.includes('unknown')) {
      warnings.push(
        `${cell.harness}/${cell.model}/${cell.smokeIds} has unknown cost basis; keep estimated cost null unless a pricing basis is attached.`,
      );
    }
  }

  return summary;
}

export async function buildSmokeSummary(options) {
  const loadWarnings = [];
  const reports = await loadSmokeReports(options.resultsDir, loadWarnings);
  const summary = aggregateRuns(reports, options);
  summary.evidenceWarnings.unshift(...loadWarnings);
  return summary;
}

export function renderMarkdown(summary) {
  const lines = [];
  lines.push('# Smoke Evidence Summary');
  lines.push('');
  lines.push(
    `Based on ${summary.source.reportCount} smoke report(s), ${summary.source.dateRange.first ?? 'n/a'} to ${
      summary.source.dateRange.last ?? 'n/a'
    }.`,
  );
  lines.push('');
  lines.push('## Run Outcomes');
  lines.push('');
  lines.push(
    '| Harness | Model | Smoke ids | Runs | Passed | Failed | Blocked | Pass Rate | Median Time | Cost | Cost Basis |',
  );
  lines.push('| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |');
  for (const cell of summary.matrix) {
    lines.push(
      `| ${cell.harness} | ${cell.model} | ${cell.smokeIds} | ${cell.runs} | ${cell.passed} | ${cell.failed} | ${cell.blocked} | ${formatPercent(
        cell.passRateExcludingBlocked,
      )} | ${formatSeconds(cell.medianDurationMs)} | ${formatCost(
        cell.providerMetrics.estimatedCostUsd,
      )} | ${cell.costBasis.join(', ')} |`,
    );
  }
  if (summary.matrix.length === 0) {
    lines.push('| n/a | n/a | n/a | 0 | 0 | 0 | 0 | n/a | n/a | n/a | n/a |');
  }
  lines.push('');
  lines.push('## Claim Profile');
  lines.push('');
  lines.push(
    `Runs: ${summary.claimProfiles.total}; claim-eligible: ${summary.claimProfiles.claimEligible}; recorded-only: ${summary.claimProfiles.recordedOnly}; unknown: ${summary.claimProfiles.unknown}.`,
  );
  const blockers = Object.entries(summary.claimProfiles.blockers).sort((a, b) =>
    a[0].localeCompare(b[0]),
  );
  if (blockers.length === 0) {
    lines.push('');
    lines.push('- No claim-profile blockers reported.');
  } else {
    lines.push('');
    for (const [blocker, count] of blockers) {
      lines.push(`- ${blocker}: ${count}`);
    }
  }
  lines.push('');
  lines.push('## Provider Usage');
  lines.push('');
  lines.push(
    '| Provider | Runs | Records | Input | Output | Cache Read | Cache Create | Reasoning | Cost | Cost Basis |',
  );
  lines.push('| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |');
  for (const provider of summary.providers) {
    lines.push(
      `| ${provider.provider} | ${provider.runs} | ${formatNumber(provider.metrics.records)} | ${formatNumber(
        provider.metrics.inputTokens,
      )} | ${formatNumber(provider.metrics.outputTokens)} | ${formatNumber(
        provider.metrics.cacheReadInputTokens,
      )} | ${formatNumber(provider.metrics.cacheCreationInputTokens)} | ${formatNumber(
        provider.metrics.reasoningOutputTokens,
      )} | ${formatCost(provider.metrics.estimatedCostUsd)} | ${provider.costBasis.join(', ')} |`,
    );
  }
  if (summary.providers.length === 0) {
    lines.push('| n/a | 0 | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a |');
  }
  lines.push('');
  lines.push('## Test Stability');
  lines.push('');
  lines.push('| Test | Label | Runs | Pass Rate | Avg Time | Median Time | Latest | Fail Streak |');
  lines.push('| --- | --- | ---: | ---: | ---: | ---: | --- | ---: |');
  for (const test of summary.tests) {
    lines.push(
      `| ${test.name} | ${test.label} | ${test.runs} | ${formatPercent(test.passRate)} | ${formatSeconds(
        test.avgDurationMs,
      )} | ${formatSeconds(test.medianDurationMs)} | ${test.latestStatus ?? 'n/a'} | ${test.failureStreak} |`,
    );
  }
  if (summary.tests.length === 0) {
    lines.push('| n/a | n/a | 0 | n/a | n/a | n/a | n/a | 0 |');
  }
  lines.push('');
  lines.push('## Evidence Warnings');
  lines.push('');
  if (summary.evidenceWarnings.length === 0) {
    lines.push('- None.');
  } else {
    for (const warning of summary.evidenceWarnings) {
      lines.push(`- ${warning}`);
    }
  }
  lines.push('');
  lines.push(
    'Claim boundary: this is bounded smoke telemetry. It supports measurement readiness, not proof that PL is cheaper, faster, or better.',
  );
  lines.push('');
  return lines.join('\n');
}

export function renderJson(summary) {
  return `${JSON.stringify(summary, null, 2)}\n`;
}

async function writeOutput(output, outputPath) {
  if (outputPath === null) {
    process.stdout.write(output);
    return;
  }
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, output, 'utf8');
}

async function main() {
  const options = parseArgs();
  const summary = await buildSmokeSummary(options);
  const output = options.format === 'json' ? renderJson(summary) : renderMarkdown(summary);
  await writeOutput(output, options.out);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`Fatal error: ${error.message}`);
    process.exit(1);
  });
}

export { TOKEN_METRIC_KEYS };
