import { performance } from 'node:perf_hooks';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FileStateStore } from '../../src/infrastructure/adapters/file-state-store.js';
import { InMemoryStateStore } from '../../src/infrastructure/adapters/in-memory-state-store.js';
import { InMemoryCommandRunner } from '../../src/infrastructure/adapters/in-memory-command-runner.js';
import { renderFlow, renderFlowCompact } from '../../src/domain/render-flow.js';
import {
  createPromptNode,
  createRunNode,
  createIfNode,
  createForeachNode,
} from '../../src/domain/flow-node.js';
import { createCompletionGate, createFlowSpec } from '../../src/domain/flow-spec.js';
import { createSessionState } from '../../src/domain/session-state.js';
import { evaluateCompletion } from '../../src/application/evaluate-completion.js';

const startupMs = performance.now();

function parseOptions(argv) {
  let iterations = 15;
  let warmup = 3;

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    const next = argv[index + 1];
    if (current === '--iterations' && next !== undefined) {
      iterations = Number.parseInt(next, 10);
      index += 1;
      continue;
    }
    if (current === '--warmup' && next !== undefined) {
      warmup = Number.parseInt(next, 10);
      index += 1;
    }
  }

  if (!Number.isInteger(iterations) || iterations <= 0) {
    throw new Error(`--iterations must be a positive integer, received "${iterations}"`);
  }
  if (!Number.isInteger(warmup) || warmup < 0) {
    throw new Error(`--warmup must be a non-negative integer, received "${warmup}"`);
  }

  return { iterations, warmup };
}

function summarize(samplesMs) {
  if (samplesMs.length === 0) {
    throw new Error('Cannot summarize an empty sample set.');
  }

  const sorted = [...samplesMs].sort((left, right) => left - right);
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

async function sampleSeries(action, options) {
  for (let index = 0; index < options.warmup; index += 1) {
    await action();
  }

  const samplesMs = [];
  for (let index = 0; index < options.iterations; index += 1) {
    const startedAt = performance.now();
    await action();
    samplesMs.push(performance.now() - startedAt);
  }

  return {
    samplesMs,
    summary: summarize(samplesMs),
  };
}

function createBenchmarkState() {
  const spec = createFlowSpec(
    'Hook/runtime overhead benchmark',
    [
      createPromptNode('p1', 'Inspect ${repo} and summarize ${ticket}.'),
      createRunNode('r1', 'npm test'),
      createIfNode(
        'if1',
        'command_failed',
        [createPromptNode('p2', 'Fix ${repo} before shipping.')],
        [createPromptNode('p3', 'Ship ${ticket}.')],
      ),
      createForeachNode('fe1', 'file', '${files}', [createRunNode('r2', 'echo ${file}')]),
    ],
    [
      createCompletionGate('artifact_valid deploy_plan'),
      createCompletionGate('artifact_active deploy_plan'),
      createCompletionGate('approval_passed("review_deploy_plan")'),
    ],
  );

  return {
    ...createSessionState('hook-runtime-overhead', spec),
    currentNodePath: [2, 0],
    variables: {
      repo: 'payments-service',
      ticket: 'PL-OVO-013',
      files: '["src/a.ts","src/b.ts","src/c.ts"]',
      command_failed: 'false',
      command_succeeded: 'true',
      last_exit_code: '0',
      last_stdout: 'all green',
      last_stderr: '',
      approve_rejected: 'false',
      '_artifacts.deploy_plan': {
        artifactId: 'deploy-plan',
        revisionId: 'rev-4',
        runId: 'run-9',
        validationState: 'valid',
        reviewState: 'accepted',
        revisionState: 'active',
      },
      '_approvals.review_deploy_plan': {
        artifactId: 'deploy-plan',
        revisionId: 'rev-4',
        runId: 'run-9',
        outcome: 'approved',
      },
    },
  };
}

async function runBenchmark(options) {
  const benchmarkState = createBenchmarkState();
  const tempRoot = await mkdtemp(join(tmpdir(), 'pl-hook-runtime-overhead-'));

  try {
    const fileStore = new FileStateStore(tempRoot);
    await fileStore.save(benchmarkState);

    const stateLoad = await sampleSeries(async () => {
      await fileStore.loadCurrent();
    }, options);

    let saveCounter = 0;
    const stateSave = await sampleSeries(async () => {
      saveCounter += 1;
      await fileStore.save({
        ...benchmarkState,
        updatedAt: benchmarkState.updatedAt + saveCounter,
        variables: {
          ...benchmarkState.variables,
          last_stdout: `all green ${saveCounter}`,
        },
      });
    }, options);

    const renderFull = await sampleSeries(() => {
      renderFlow(benchmarkState);
    }, options);

    const renderCompact = await sampleSeries(() => {
      renderFlowCompact(benchmarkState);
    }, options);

    const gateStore = new InMemoryStateStore();
    const gateRunner = new InMemoryCommandRunner();

    const gateEval = await sampleSeries(async () => {
      await gateStore.save({
        ...benchmarkState,
        status: 'active',
      });
      await evaluateCompletion(gateStore, gateRunner);
    }, options);

    process.stdout.write(
      JSON.stringify(
        {
          startupMs,
          iterations: options.iterations,
          warmup: options.warmup,
          metrics: {
            stateLoad,
            stateSave,
            renderFull,
            renderCompact,
            gateEval,
          },
        },
        null,
        2,
      ),
    );
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}

async function main() {
  const [mode = 'benchmark', ...rest] = process.argv.slice(2);

  if (mode === 'startup-only') {
    process.stdout.write(JSON.stringify({ startupMs }));
    return;
  }

  if (mode === 'benchmark') {
    await runBenchmark(parseOptions(rest));
    return;
  }

  throw new Error(`Unknown mode "${mode}". Use "startup-only" or "benchmark".`);
}

main().catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`,
  );
  process.exitCode = 1;
});
