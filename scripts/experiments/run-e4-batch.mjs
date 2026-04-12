#!/usr/bin/env node

import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const PAIR_RUNNER = join(ROOT, 'scripts', 'experiments', 'run-e4-patched-pair.mjs');
const RESULTS_ROOT = join(ROOT, 'experiments', 'results', 'e4-factory');
const RUNS_ROOT = join(RESULTS_ROOT, 'runs');
const INCOMPLETE_ROOT = join(RESULTS_ROOT, 'incomplete');
const BATCHES_ROOT = join(RESULTS_ROOT, 'batches');
const GIT_BIN = process.platform === 'win32' ? 'git.exe' : 'git';
const DEFAULT_MODEL = 'gpt-5.2';
const DEFAULT_PAIRS = 6;
const DEFAULT_SCENARIO = 's0-clean';
const DEFAULT_ORDERS = [
  'codex-first',
  'pl-first',
  'codex-first',
  'pl-first',
  'codex-first',
  'pl-first',
];

function parseArgs(argv) {
  const options = {
    model: DEFAULT_MODEL,
    pairs: DEFAULT_PAIRS,
    scenario: DEFAULT_SCENARIO,
    batchId: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    const next = argv[index + 1];

    if (current === '--model' && next !== undefined) {
      options.model = next;
      index += 1;
      continue;
    }
    if (current === '--pairs' && next !== undefined) {
      options.pairs = parsePositiveInteger(next, '--pairs');
      index += 1;
      continue;
    }
    if (current === '--batch-id' && next !== undefined) {
      options.batchId = next;
      index += 1;
      continue;
    }
    if (current === '--scenario' && next !== undefined) {
      options.scenario = next;
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument "${current}"`);
  }

  if (options.scenario !== DEFAULT_SCENARIO) {
    throw new Error(`Only scenario "${DEFAULT_SCENARIO}" is currently implemented`);
  }

  return options;
}

function parsePositiveInteger(value, flagName) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${flagName} must be a positive integer, received "${value}"`);
  }
  return parsed;
}

function pad(value) {
  return String(value).padStart(2, '0');
}

async function ensureDir(path) {
  await mkdir(path, { recursive: true });
}

async function writeText(path, content) {
  await ensureDir(dirname(path));
  await writeFile(path, `${content}\n`, 'utf8');
}

async function writeJson(path, value) {
  await writeText(path, JSON.stringify(value, null, 2));
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

function readGitHead() {
  return execFileSync(GIT_BIN, ['rev-parse', 'HEAD'], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 20_000,
    windowsHide: true,
  }).trim();
}

function readGitStatusShort() {
  return execFileSync(GIT_BIN, ['status', '--short'], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 20_000,
    windowsHide: true,
  }).trim();
}

function sanitizeModel(model) {
  return model.replaceAll('.', '').replaceAll('-', '');
}

async function nextBatchNumber() {
  if (!existsSync(BATCHES_ROOT)) {
    return 1;
  }
  const names = await readdir(BATCHES_ROOT, { withFileTypes: true });
  let highest = 0;
  for (const entry of names) {
    if (!entry.isDirectory()) {
      continue;
    }
    const match = /^e4-b(\d{2})-/i.exec(entry.name);
    if (!match) {
      continue;
    }
    highest = Math.max(highest, Number.parseInt(match[1], 10));
  }
  return highest + 1;
}

async function nextAttemptNumber() {
  const buckets = [];
  if (existsSync(RUNS_ROOT)) {
    buckets.push(...(await readdir(RUNS_ROOT, { withFileTypes: true })));
  }
  if (existsSync(INCOMPLETE_ROOT)) {
    buckets.push(...(await readdir(INCOMPLETE_ROOT, { withFileTypes: true })));
  }

  let highest = 1;
  for (const entry of buckets) {
    if (!entry.isDirectory()) {
      continue;
    }
    const match = /(?:^|[-_])a(\d{2})(?:[-_]|$)/i.exec(entry.name) ?? /^A(\d{2})/i.exec(entry.name);
    if (!match) {
      continue;
    }
    highest = Math.max(highest, Number.parseInt(match[1], 10));
  }

  return highest + 1;
}

function runProcess(command, args, { cwd, timeoutMs } = {}) {
  return spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    timeout: timeoutMs,
    maxBuffer: 64 * 1024 * 1024,
    windowsHide: true,
  });
}

function median(values) {
  if (values.length === 0) {
    return null;
  }
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round(((sorted[middle - 1] + sorted[middle]) / 2) * 100) / 100
    : sorted[middle];
}

function summarizeLane(runScorecard, laneName) {
  return runScorecard.lanes.find((lane) => lane.lane === laneName) ?? null;
}

function determineBatchVerdict(summary) {
  if (!summary.claimEligibility.throughputClaimEligible) {
    return 'inconclusive';
  }

  const plSuccess = summary.lanes['pl-sequential'].successRate;
  const codexSuccess = summary.lanes['codex-alone'].successRate;
  const plMedian = summary.lanes['pl-sequential'].medianTimeToGreenSec;
  const codexMedian = summary.lanes['codex-alone'].medianTimeToGreenSec;

  if (plMedian === null || codexMedian === null) {
    return 'inconclusive';
  }

  const faster = Math.min(plMedian, codexMedian);
  const slower = Math.max(plMedian, codexMedian);
  const deltaRatio = slower === 0 ? 0 : (slower - faster) / slower;

  if (deltaRatio < 0.1 && plSuccess === codexSuccess) {
    return 'parity';
  }

  if (plSuccess >= codexSuccess && plMedian < codexMedian && deltaRatio >= 0.1) {
    return 'prompt-language-better';
  }
  if (codexSuccess >= plSuccess && codexMedian < plMedian && deltaRatio >= 0.1) {
    return 'codex-alone-better';
  }

  return 'mixed';
}

function buildSummary(plan, completedPairs, abortedPairs) {
  const eligiblePairs = completedPairs.filter((pair) => pair.validForBatchSummary);
  const orderCounts = completedPairs.reduce(
    (counts, pair) => {
      counts[pair.order] += 1;
      return counts;
    },
    { 'codex-first': 0, 'pl-first': 0 },
  );

  const plLaneMetrics = eligiblePairs
    .map((pair) => pair.lanes['pl-sequential'])
    .filter((lane) => lane !== null);
  const codexLaneMetrics = eligiblePairs
    .map((pair) => pair.lanes['codex-alone'])
    .filter((lane) => lane !== null);

  const summary = {
    batchId: plan.batchId,
    scenario: plan.scenario,
    model: plan.model,
    frozenCommit: plan.gitCommit,
    plannedPairs: plan.plannedPairs,
    completedPairs: completedPairs.length,
    eligiblePairs: eligiblePairs.length,
    abortedPairs,
    orderCounts,
    claimEligibility: {
      throughputClaimEligible:
        abortedPairs.length === 0 &&
        eligiblePairs.length >= 4 &&
        orderCounts['codex-first'] >= 2 &&
        orderCounts['pl-first'] >= 2,
      reasons: [
        abortedPairs.length === 0 ? null : 'batch contains harness-fatal aborted pairs',
        eligiblePairs.length >= 4 ? null : 'fewer than four completed clean paired runs',
        orderCounts['codex-first'] >= 2 ? null : 'fewer than two codex-first pairs',
        orderCounts['pl-first'] >= 2 ? null : 'fewer than two pl-first pairs',
      ].filter((reason) => reason !== null),
    },
    lanes: {
      'pl-sequential': {
        successCount: plLaneMetrics.filter((lane) => lane.verdict === 'success').length,
        successRate:
          eligiblePairs.length === 0
            ? null
            : Math.round(
                (plLaneMetrics.filter((lane) => lane.verdict === 'success').length /
                  eligiblePairs.length) *
                  100,
              ) / 100,
        medianTimeToGreenSec: median(
          plLaneMetrics
            .map((lane) => lane.metrics.timeToGreenSec)
            .filter((value) => Number.isFinite(value)),
        ),
        medianTimeToFirstRelevantWriteSec: median(
          plLaneMetrics
            .map(
              (lane) => lane.metrics.timeToFirstRelevantWriteSec ?? lane.metrics.timeToFirstCodeSec,
            )
            .filter((value) => Number.isFinite(value)),
        ),
      },
      'codex-alone': {
        successCount: codexLaneMetrics.filter((lane) => lane.verdict === 'success').length,
        successRate:
          eligiblePairs.length === 0
            ? null
            : Math.round(
                (codexLaneMetrics.filter((lane) => lane.verdict === 'success').length /
                  eligiblePairs.length) *
                  100,
              ) / 100,
        medianTimeToGreenSec: median(
          codexLaneMetrics
            .map((lane) => lane.metrics.timeToGreenSec)
            .filter((value) => Number.isFinite(value)),
        ),
        medianTimeToFirstRelevantWriteSec: median(
          codexLaneMetrics
            .map(
              (lane) => lane.metrics.timeToFirstRelevantWriteSec ?? lane.metrics.timeToFirstCodeSec,
            )
            .filter((value) => Number.isFinite(value)),
        ),
      },
    },
  };

  summary.comparativeVerdict = determineBatchVerdict(summary);
  return summary;
}

function renderSummaryMarkdown(plan, summary, completedPairs) {
  const lines = [
    '# Batch Summary',
    '',
    `Batch: \`${plan.batchId}\``,
    `Scenario: \`${plan.scenario}\``,
    `Model: \`${plan.model}\``,
    `Frozen commit: \`${plan.gitCommit}\``,
    '',
    '## Status',
    '',
    `- planned pairs: ${plan.plannedPairs}`,
    `- completed pairs: ${summary.completedPairs}`,
    `- eligible pairs: ${summary.eligiblePairs}`,
    `- throughput claim eligible: ${summary.claimEligibility.throughputClaimEligible}`,
    `- comparative verdict: \`${summary.comparativeVerdict}\``,
    '',
    '## Lane Medians',
    '',
    `- \`prompt-language\` median time to green: ${summary.lanes['pl-sequential'].medianTimeToGreenSec ?? 'n/a'}s`,
    `- \`prompt-language\` median first relevant write: ${summary.lanes['pl-sequential'].medianTimeToFirstRelevantWriteSec ?? 'n/a'}s`,
    `- \`codex-alone\` median time to green: ${summary.lanes['codex-alone'].medianTimeToGreenSec ?? 'n/a'}s`,
    `- \`codex-alone\` median first relevant write: ${summary.lanes['codex-alone'].medianTimeToFirstRelevantWriteSec ?? 'n/a'}s`,
    '',
    '## Order Balance',
    '',
    `- codex-first pairs: ${summary.orderCounts['codex-first']}`,
    `- pl-first pairs: ${summary.orderCounts['pl-first']}`,
    '',
    '## Pair Links',
    '',
    ...completedPairs.map(
      (pair) =>
        `- [${pair.attemptLabel} ${pair.pairId}](../../runs/${pair.runId}/outcome.md): order=\`${pair.order}\`, verdict=\`${pair.scorecard.comparativeVerdict}\``,
    ),
    '',
    '## Eligibility Notes',
    '',
    ...(summary.claimEligibility.reasons.length === 0
      ? ['- no batch-level eligibility blockers recorded']
      : summary.claimEligibility.reasons.map((reason) => `- ${reason}`)),
    '',
  ];

  return lines.join('\n');
}

function captureSystemSnapshot() {
  if (process.platform !== 'win32') {
    return {
      timestamp: new Date().toISOString(),
      platform: process.platform,
      totalMemoryBytes: null,
      freeMemoryBytes: null,
      cpuLoadPercent: null,
      codexProcesses: [],
      ollamaProcesses: [],
      error: 'pre-run system gate is only implemented on Windows',
    };
  }

  const command = [
    '$cpu = (Get-CimInstance Win32_Processor | Measure-Object -Property LoadPercentage -Average).Average',
    '$mem = Get-CimInstance Win32_OperatingSystem',
    '$total = [int64]((Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory)',
    '$free = [int64]($mem.FreePhysicalMemory * 1kb)',
    '$codex = @(Get-Process codex -ErrorAction SilentlyContinue | Select-Object Id, ProcessName, WS, CPU)',
    '$ollama = @(Get-Process ollama -ErrorAction SilentlyContinue | Select-Object Id, ProcessName, WS, CPU)',
    '[pscustomobject]@{',
    '  timestamp = (Get-Date).ToString("o")',
    '  totalMemoryBytes = $total',
    '  freeMemoryBytes = $free',
    '  cpuLoadPercent = $cpu',
    '  codexProcesses = $codex',
    '  ollamaProcesses = $ollama',
    '} | ConvertTo-Json -Depth 5 -Compress',
  ].join('\n');

  const result = runProcess(
    'powershell',
    ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', command],
    { cwd: ROOT, timeoutMs: 20_000 },
  );
  if (result.status !== 0) {
    throw new Error(`system snapshot failed: ${result.stderr || result.error || 'unknown error'}`);
  }
  return JSON.parse(result.stdout.trim());
}

function collectProcessIds(processes) {
  return new Set(
    processes
      .map((processInfo) => processInfo?.Id)
      .filter((value) => Number.isInteger(value))
      .map((value) => Number(value)),
  );
}

function unexpectedProcessIds(snapshotProcesses, baselineIds) {
  return snapshotProcesses
    .map((processInfo) => processInfo?.Id)
    .filter((value) => Number.isInteger(value))
    .map((value) => Number(value))
    .filter((value) => !baselineIds.has(value));
}

function enforcePreRunGate(snapshot, baseline) {
  const unexpectedCodex = unexpectedProcessIds(snapshot.codexProcesses, baseline.codexProcessIds);
  if (unexpectedCodex.length > 0) {
    throw new Error(
      `pre-run gate failed: unexpected codex processes are active (${unexpectedCodex.join(', ')})`,
    );
  }
  if (snapshot.freeMemoryBytes !== null && snapshot.freeMemoryBytes < 2_000_000_000) {
    throw new Error('pre-run gate failed: free RAM is below 2 GB');
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const gitStatus = readGitStatusShort();
  if (gitStatus.length > 0) {
    throw new Error('batch runs require a clean git worktree');
  }

  const batchNumber = await nextBatchNumber();
  const batchId =
    options.batchId ??
    `e4-b${pad(batchNumber)}-${options.scenario}-${sanitizeModel(options.model)}`;
  const batchRoot = join(BATCHES_ROOT, batchId);
  await ensureDir(batchRoot);
  const baselineSnapshot = captureSystemSnapshot();
  const processBaseline = {
    codexProcessIds: collectProcessIds(baselineSnapshot.codexProcesses),
    ollamaProcessIds: collectProcessIds(baselineSnapshot.ollamaProcesses),
  };
  await writeJson(join(batchRoot, 'baseline-system.json'), baselineSnapshot);

  const plannedOrders = DEFAULT_ORDERS.slice(0, options.pairs);
  if (plannedOrders.length !== options.pairs) {
    throw new Error(`No fixed order schedule is defined for ${options.pairs} pairs`);
  }

  const plan = {
    batchId,
    scenario: options.scenario,
    model: options.model,
    plannedPairs: options.pairs,
    orders: plannedOrders.map((order, index) => ({ pairId: `p${pad(index + 1)}`, order })),
    gitCommit: readGitHead(),
    exclusionRules: [
      'system-level contamination at the pre-run gate',
      'harness crash before the pair runner writes a closed run pack',
      'missing raw trace files required by results:e4',
    ],
    primaryEndpoint: 'median timeToGreenSec by lane across eligible clean pairs',
    decisionRules: {
      promptLanguageBetter:
        'success rate is not worse and median timeToGreenSec is at least 10% better',
      codexAloneBetter:
        'success rate is not worse and median timeToGreenSec is at least 10% better',
      parity: 'success rates match and median timeToGreenSec is within 10%',
    },
    processBaseline: {
      codexProcessIds: [...processBaseline.codexProcessIds],
      ollamaProcessIds: [...processBaseline.ollamaProcessIds],
    },
  };
  await writeJson(join(batchRoot, 'plan.json'), plan);

  const completedPairs = [];
  const abortedPairs = [];
  let summary = buildSummary(plan, completedPairs, abortedPairs);
  await writeJson(join(batchRoot, 'pairs.json'), completedPairs);
  await writeJson(join(batchRoot, 'summary.json'), summary);
  await writeText(
    join(batchRoot, 'summary.md'),
    renderSummaryMarkdown(plan, summary, completedPairs),
  );

  for (let index = 0; index < plan.orders.length; index += 1) {
    const pair = plan.orders[index];
    const pairId = pair.pairId;
    const order = pair.order;
    const attemptNumber = await nextAttemptNumber();
    const attemptLabel = `A${pad(attemptNumber)}`;
    const runId = `a${pad(attemptNumber)}-${batchId}-${pairId}-${options.scenario}-${order}`;
    try {
      const snapshot = captureSystemSnapshot();
      enforcePreRunGate(snapshot, processBaseline);
      await writeJson(join(batchRoot, `${pairId}-system-before.json`), snapshot);

      const result = runProcess(
        process.execPath,
        [
          PAIR_RUNNER,
          '--model',
          options.model,
          '--scenario',
          options.scenario,
          '--order',
          order,
          '--batch-id',
          batchId,
          '--pair-id',
          pairId,
          '--attempt-label',
          attemptLabel,
          '--run-id',
          runId,
        ],
        {
          cwd: ROOT,
          timeoutMs: 2 * 60 * 60 * 1000,
        },
      );

      await writeText(
        join(batchRoot, `${pairId}-runner.log`),
        [
          `attemptLabel: ${attemptLabel}`,
          `runId: ${runId}`,
          `exitCode: ${result.status ?? -1}`,
          '',
          'stdout:',
          result.stdout ?? '(no stdout)',
          '',
          'stderr:',
          result.stderr ?? '(no stderr)',
        ].join('\n'),
      );

      if (result.status !== 0) {
        abortedPairs.push({
          pairId,
          order,
          runId,
          attemptLabel,
          incompletePath: existsSync(join(INCOMPLETE_ROOT, runId))
            ? `experiments/results/e4-factory/incomplete/${runId}`
            : null,
        });
        break;
      }

      const scorecard = await readJson(join(RUNS_ROOT, runId, 'scorecard.json'));
      const runMetadata = await readJson(join(RUNS_ROOT, runId, 'run.json'));
      const plLane = summarizeLane(scorecard, 'pl-sequential');
      const codexLane = summarizeLane(scorecard, 'codex-alone');

      completedPairs.push({
        pairId,
        order,
        runId,
        attemptLabel,
        scorecard,
        runMetadata,
        validForBatchSummary:
          plLane !== null &&
          codexLane !== null &&
          scorecard.admissibility.class === 'primary-comparison' &&
          runMetadata.gitCommit === plan.gitCommit &&
          plLane.metrics.throughputMetricsComplete === true &&
          codexLane.metrics.throughputMetricsComplete === true &&
          typeof plLane.metrics.timeToGreenSec === 'number' &&
          typeof codexLane.metrics.timeToGreenSec === 'number',
        lanes: {
          'pl-sequential': plLane,
          'codex-alone': codexLane,
        },
      });
    } catch (error) {
      abortedPairs.push({
        pairId,
        order,
        runId,
        attemptLabel,
        incompletePath: existsSync(join(INCOMPLETE_ROOT, runId))
          ? `experiments/results/e4-factory/incomplete/${runId}`
          : null,
        error: error instanceof Error ? error.message : String(error),
      });
      break;
    }

    summary = buildSummary(plan, completedPairs, abortedPairs);
    await writeJson(join(batchRoot, 'pairs.json'), completedPairs);
    await writeJson(join(batchRoot, 'summary.json'), summary);
    await writeText(
      join(batchRoot, 'summary.md'),
      renderSummaryMarkdown(plan, summary, completedPairs),
    );
  }

  summary = buildSummary(plan, completedPairs, abortedPairs);
  await writeJson(join(batchRoot, 'pairs.json'), completedPairs);
  await writeJson(join(batchRoot, 'summary.json'), summary);
  await writeText(
    join(batchRoot, 'summary.md'),
    renderSummaryMarkdown(plan, summary, completedPairs),
  );

  if (abortedPairs.length > 0) {
    throw new Error(`batch aborted after harness-fatal pair ${abortedPairs[0].pairId}`);
  }

  console.log(`[e4:batch] completed ${batchId} with ${completedPairs.length} pairs`);
}

main().catch((error) => {
  console.error(`[e4:batch] FAIL - ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
