#!/usr/bin/env node
/**
 * Reproducible benchmark wrapper for prompt-language-0ovo.1.3.
 */

import { execSync } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..', '..');
const PROBE = resolve(import.meta.dirname, 'hook-runtime-overhead-probe.mjs');
const NPX_BIN = process.platform === 'win32' ? 'npx.cmd' : 'npx';

function parseArgs(argv) {
  const options = {
    iterations: 15,
    warmup: 3,
    jsonOut: null,
    selfCheck: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    const next = argv[index + 1];
    if (current === '--iterations' && next !== undefined) {
      options.iterations = Number.parseInt(next, 10);
      index += 1;
      continue;
    }
    if (current === '--warmup' && next !== undefined) {
      options.warmup = Number.parseInt(next, 10);
      index += 1;
      continue;
    }
    if (current === '--json-out' && next !== undefined) {
      options.jsonOut = resolve(process.cwd(), next);
      index += 1;
      continue;
    }
    if (current === '--self-check') {
      options.selfCheck = true;
      continue;
    }
    throw new Error(`Unknown argument "${current}"`);
  }

  if (!Number.isInteger(options.iterations) || options.iterations <= 0) {
    throw new Error(`--iterations must be a positive integer, received "${options.iterations}"`);
  }
  if (!Number.isInteger(options.warmup) || options.warmup < 0) {
    throw new Error(`--warmup must be a non-negative integer, received "${options.warmup}"`);
  }

  return options;
}

function quoteArg(value) {
  return `"${String(value).replaceAll('"', '\\"')}"`;
}

function runTsx(args) {
  const argTail = args.map((value) => quoteArg(value)).join(' ');
  return execSync(`${NPX_BIN} tsx ${quoteArg(PROBE)}${argTail.length > 0 ? ` ${argTail}` : ''}`, {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });
}

function summarize(samples) {
  if (samples.length === 0) {
    throw new Error('Cannot summarize an empty sample set.');
  }

  const sorted = [...samples].sort((left, right) => left - right);
  const total = sorted.reduce((sum, value) => sum + value, 0);
  const medianIndex = Math.floor(sorted.length / 2);
  const p95Index = Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1);

  return {
    count: sorted.length,
    minMs: sorted[0] ?? 0,
    maxMs: sorted[sorted.length - 1] ?? 0,
    meanMs: total / sorted.length,
    medianMs:
      sorted.length % 2 === 0
        ? ((sorted[medianIndex - 1] ?? 0) + (sorted[medianIndex] ?? 0)) / 2
        : (sorted[medianIndex] ?? 0),
    p95Ms: sorted[p95Index] ?? 0,
  };
}

function formatMs(value) {
  return value.toFixed(3);
}

function collectStartupSamples(iterations, warmup) {
  for (let index = 0; index < warmup; index += 1) {
    JSON.parse(runTsx(['startup-only']));
  }

  const samplesMs = [];
  for (let index = 0; index < iterations; index += 1) {
    const result = JSON.parse(runTsx(['startup-only']));
    samplesMs.push(result.startupMs);
  }

  return {
    samplesMs,
    summary: summarize(samplesMs),
  };
}

function getTsxVersion() {
  try {
    return execSync(`${NPX_BIN} tsx --version`, {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  } catch {
    return 'unknown';
  }
}

function buildPayload(options, startup, benchmark) {
  const nonRenderMedianMs =
    startup.summary.medianMs +
    benchmark.metrics.stateLoad.summary.medianMs +
    benchmark.metrics.stateSave.summary.medianMs +
    benchmark.metrics.gateEval.summary.medianMs;

  return {
    schemaVersion: 'hook-runtime-overhead.v1',
    recordedAt: new Date().toISOString(),
    command:
      `node scripts/eval/hook-runtime-overhead.mjs --iterations ${options.iterations} ` +
      `--warmup ${options.warmup}`,
    environment: {
      cwd: ROOT,
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
      tsxVersion: getTsxVersion(),
    },
    methodology: {
      iterations: options.iterations,
      warmup: options.warmup,
      startupBucket:
        'Repeated tsx probe launches recorded at the first executable line after module import.',
      stateIoBucket:
        'Measured with FileStateStore loadCurrent/save against a temp .prompt-language workspace.',
      renderBucket:
        'Measured with direct renderFlow/renderFlowCompact calls on one representative active state.',
      gateBucket:
        'Measured with evaluateCompletion over structured artifact/approval gates using in-memory state and runner.',
    },
    metrics: {
      startup,
      stateLoad: benchmark.metrics.stateLoad,
      stateSave: benchmark.metrics.stateSave,
      renderFull: benchmark.metrics.renderFull,
      renderCompact: benchmark.metrics.renderCompact,
      gateEval: benchmark.metrics.gateEval,
    },
    attribution: {
      renderMedianMs: benchmark.metrics.renderFull.summary.medianMs,
      compactRenderMedianMs: benchmark.metrics.renderCompact.summary.medianMs,
      nonRenderMedianMs,
      nonRenderBuckets: ['startup', 'stateLoad', 'stateSave', 'gateEval'],
      note: 'Non-render median is an attribution aid, not a literal end-to-end hook total.',
    },
  };
}

function printSummary(payload) {
  const rows = [
    ['startup', payload.metrics.startup.summary],
    ['stateLoad', payload.metrics.stateLoad.summary],
    ['stateSave', payload.metrics.stateSave.summary],
    ['renderFull', payload.metrics.renderFull.summary],
    ['renderCompact', payload.metrics.renderCompact.summary],
    ['gateEval', payload.metrics.gateEval.summary],
  ];

  console.log('[hook-runtime-overhead] Overhead capture');
  console.log(
    `[hook-runtime-overhead] node=${payload.environment.nodeVersion} platform=${payload.environment.platform} tsx=${payload.environment.tsxVersion}`,
  );
  console.log(
    `[hook-runtime-overhead] iterations=${payload.methodology.iterations} warmup=${payload.methodology.warmup}`,
  );
  console.log('');
  console.log('| Bucket | median ms | p95 ms | mean ms | min ms | max ms |');
  console.log('| --- | ---: | ---: | ---: | ---: | ---: |');
  for (const [label, summary] of rows) {
    console.log(
      `| ${label} | ${formatMs(summary.medianMs)} | ${formatMs(summary.p95Ms)} | ${formatMs(summary.meanMs)} | ${formatMs(summary.minMs)} | ${formatMs(summary.maxMs)} |`,
    );
  }
  console.log('');
  console.log(
    `[hook-runtime-overhead] render median=${formatMs(payload.attribution.renderMedianMs)}ms | non-render median=${formatMs(payload.attribution.nonRenderMedianMs)}ms`,
  );
}

function runSelfCheck(payload) {
  for (const key of [
    'startup',
    'stateLoad',
    'stateSave',
    'renderFull',
    'renderCompact',
    'gateEval',
  ]) {
    const metric = payload.metrics[key];
    if (!metric || !Array.isArray(metric.samplesMs)) {
      throw new Error(`Self-check failed: metric "${key}" is missing samples.`);
    }
    if (metric.samplesMs.length !== payload.methodology.iterations) {
      throw new Error(`Self-check failed: metric "${key}" sample count mismatch.`);
    }
    for (const value of metric.samplesMs) {
      if (!Number.isFinite(value) || value < 0) {
        throw new Error(`Self-check failed: metric "${key}" has invalid sample "${value}".`);
      }
    }
  }

  if (
    !Number.isFinite(payload.attribution.nonRenderMedianMs) ||
    payload.attribution.nonRenderMedianMs < 0
  ) {
    throw new Error('Self-check failed: nonRenderMedianMs is invalid.');
  }

  console.log('[hook-runtime-overhead] Self-check passed.');
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const startup = collectStartupSamples(options.iterations, options.warmup);
  const benchmark = JSON.parse(
    runTsx([
      'benchmark',
      '--iterations',
      String(options.iterations),
      '--warmup',
      String(options.warmup),
    ]),
  );

  const payload = buildPayload(options, startup, benchmark);
  printSummary(payload);

  if (options.jsonOut) {
    await writeFile(options.jsonOut, JSON.stringify(payload, null, 2), 'utf8');
    console.log(`[hook-runtime-overhead] Wrote JSON report to ${options.jsonOut}`);
  }

  if (options.selfCheck) {
    runSelfCheck(payload);
  }
}

main().catch((error) => {
  console.error(
    `[hook-runtime-overhead] ${error instanceof Error ? (error.stack ?? error.message) : String(error)}`,
  );
  process.exitCode = 1;
});
