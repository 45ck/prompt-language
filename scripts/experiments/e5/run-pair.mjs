#!/usr/bin/env node
// E5-B01 pair orchestrator.
//
// Runs a maintenance-viability pair end-to-end:
//   factory-codex -> factory-pl -> gate -> blind-handoff
//     -> maintenance-codex-tree -> maintenance-pl-tree -> scorecard
//
// Order is read from the pair manifest (supports counterbalancing).
// This script is intentionally orchestration-only: each stage delegates to
// a lane-specific or harness-specific subcommand that must exist before the
// pilot can actually run. Missing subcommands produce a clear error rather
// than a silent no-op.

import { readFile, writeFile, mkdir, rm, cp } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnFactoryCodex } from './spawn-factory-codex.mjs';
import { spawnFactoryPl } from './spawn-factory-pl.mjs';
import { runChangeRequest } from './run-change-request.mjs';
import { runJourneySuite } from './run-journey-suite.mjs';
import { verifyBlinding } from './verify-blinding.mjs';
import { scoreScorecard } from './score-scorecard.mjs';
import { runCrossFamilyReview } from '../meta/cross-family-review.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..', '..');

function usage() {
  console.error(
    'Usage: node scripts/experiments/e5/run-pair.mjs <pair-manifest> [--run-id <id>] [--dry-run] [--plan]',
  );
  process.exit(2);
}

// One-line description per stage kind. Used by --plan output.
const STAGE_DESCRIPTIONS = {
  'factory-codex': 'Build workspace via codex-alone factory lane',
  'factory-pl': 'Build workspace via prompt-language factory lane',
  'gate-family-1-2-3': 'Run journey-suite gate against lane workspaces',
  'cross-family-review':
    'Run an explicit cross-family reviewer against gated lane workspaces and abort on veto',
  'blind-handoff': 'Strip identity artifacts, git-init baseline, and verify blinding for each lane',
  'maintenance-codex-tree': 'Apply change requests to stripped codex workspace',
  'maintenance-pl-tree': 'Apply change requests to stripped pl workspace',
  scorecard: 'Render scorecard from template into run directory',
};

/**
 * Return the set of stage handlers. Handlers are thin wrappers over
 * lane/harness workers; see individual handler bodies for details.
 *
 * Exported so tests can enumerate handler keys and replace handlers with
 * spies without running the orchestrator.
 */
export function createStageHandlers() {
  return {
    'factory-codex': runFactoryCodex,
    'factory-pl': runFactoryPl,
    'gate-family-1-2-3': runGate,
    'cross-family-review': runCrossFamilyReviewStage,
    'blind-handoff': runBlindHandoff,
    'maintenance-codex-tree': runMaintenance('codex-workspace'),
    'maintenance-pl-tree': runMaintenance('pl-workspace'),
    scorecard: runScorecard,
  };
}

/**
 * Iterate stages declared on the manifest, dispatching to the handler map.
 * Errors from handlers propagate. Unknown stages throw.
 *
 * Exported so tests can drive the loop with a mock handler map.
 */
export async function runStages(manifest, handlers, ctx, { dryRun, log } = {}) {
  const logFn = log ?? (() => {});
  for (const stage of manifest.stages) {
    const handler = handlers[stage.stage];
    if (!handler) throw new Error(`unknown stage: ${stage.stage}`);
    logFn('stage:', stage.stage);
    if (dryRun) {
      logFn('  dry-run, skipping');
      continue;
    }
    await handler(stage, ctx);
  }
}

/**
 * Produce a --plan report without executing anything. Pure function over
 * the manifest and a run directory; performs no IO.
 */
export function createPlan(manifest, runDir) {
  const stages = manifest.stages.map((stage) => ({
    stage: stage.stage,
    description: STAGE_DESCRIPTIONS[stage.stage] ?? '(no description registered)',
    known: Object.prototype.hasOwnProperty.call(STAGE_DESCRIPTIONS, stage.stage),
  }));
  const workspaces = [
    join(runDir, 'codex-workspace'),
    join(runDir, 'pl-workspace'),
    join(runDir, 'codex-workspace-stripped'),
    join(runDir, 'pl-workspace-stripped'),
  ];
  return {
    pairId: manifest.pairId,
    batchId: manifest.batchId,
    runDir,
    stages,
    workspaces,
  };
}

export function formatPlan(plan) {
  const lines = [];
  lines.push(`pair: ${plan.pairId}`);
  lines.push(`batch: ${plan.batchId}`);
  lines.push(`runDir: ${plan.runDir}`);
  lines.push('stages:');
  for (const [i, s] of plan.stages.entries()) {
    const mark = s.known ? ' ' : '?';
    lines.push(`  ${i + 1}. [${mark}] ${s.stage} - ${s.description}`);
  }
  lines.push('workspace paths (created on live run):');
  for (const w of plan.workspaces) {
    lines.push(`  - ${w}`);
  }
  return lines.join('\n');
}

// -----------------------------------------------------------------------------
// Stage handlers. Each is a thin wrapper that delegates to the real worker.

async function runFactoryCodex(stage, ctx) {
  const workspace = join(ctx.runDir, 'codex-workspace');
  const laneResultsRoot = join(ctx.runDir, 'codex-lane-results');
  await mkdir(workspace, { recursive: true });
  const summary = await spawnFactoryCodex({
    workspace,
    timeBudgetMin: stage.timeBudgetMin,
    laneResultsRoot,
  });
  ctx.log('  factory-codex:', summary.failureClass, `${summary.wallClockSec}s`);
  return summary;
}

async function runFactoryPl(stage, ctx) {
  const workspace = join(ctx.runDir, 'pl-workspace');
  const laneResultsRoot = join(ctx.runDir, 'pl-lane-results');
  await mkdir(workspace, { recursive: true });
  const summary = await spawnFactoryPl({
    workspace,
    timeBudgetMin: stage.timeBudgetMin,
    runId: ctx.runId,
    laneResultsRoot,
  });
  ctx.log('  factory-pl:', summary.failureClass, `${summary.wallClockSec}s`);
  return summary;
}

async function runGate(stage, ctx) {
  const targets = stage.appliesTo ?? ['codex-workspace', 'pl-workspace'];
  const report = {};
  const blockingIssues = [];
  for (const target of targets) {
    const workspace = join(ctx.runDir, target);
    if (!existsSync(workspace)) {
      report[target] = { gateStatus: 'skipped-no-workspace' };
      blockingIssues.push({
        target,
        kind: 'missing-workspace',
        detail: `workspace missing: ${workspace}`,
      });
      continue;
    }
    report[target] = await invokeHarness(stage.harness, workspace);
    const issue = classifyGateIssue(target, report[target]);
    if (issue) blockingIssues.push(issue);
  }
  const overallStatus = blockingIssues.some((issue) => issue.kind === 'pending-manual-review')
    ? 'blocked-manual-review'
    : blockingIssues.length > 0
      ? 'failed'
      : 'passed';
  const artifact = {
    overallStatus,
    harness: stage.harness,
    targets: report,
    blockingIssues,
  };
  await writeFile(join(ctx.runDir, 'gate-report.json'), JSON.stringify(artifact, null, 2));
  if (blockingIssues.length > 0) {
    const summary = blockingIssues
      .map((issue) => `${issue.target}: ${issue.kind}${issue.detail ? ` (${issue.detail})` : ''}`)
      .join('; ');
    throw new Error(`gate-family-1-2-3 did not clear: ${summary}`);
  }
}

async function runCrossFamilyReviewStage(stage, ctx) {
  const reviewer = stage.reviewer ?? {};
  const reviewerFamily = reviewer.family ?? stage.reviewerFamily;
  const reviewerModel = reviewer.model ?? stage.reviewerModel;
  const reviewerBin = reviewer.bin ?? stage.reviewerBin;
  if (!reviewerFamily || !reviewerModel) {
    throw new Error(
      'cross-family-review stage requires reviewer family and reviewer model configuration',
    );
  }

  const appliesTo = stage.appliesTo ?? [];
  if (!Array.isArray(appliesTo) || appliesTo.length === 0) {
    throw new Error('cross-family-review stage requires at least one appliesTo entry');
  }

  const artifactPath = join(ctx.runDir, 'cross-family-review-report.json');
  const artifact = {
    reviewer: {
      family: reviewerFamily,
      model: reviewerModel,
      bin: reviewerBin ?? 'claude',
    },
    overallStatus: 'passed',
    results: {},
  };

  for (const item of appliesTo) {
    const target = normalizeCrossFamilyTarget(item, stage);
    const workspace = join(ctx.runDir, target.workspace);
    if (!existsSync(workspace)) {
      artifact.overallStatus = 'failed';
      artifact.results[target.workspace] = {
        verdict: 'error',
        reasons: [`workspace missing: ${workspace}`],
        factoryFamily: target.factoryFamily,
        factoryModel: target.factoryModel ?? null,
        reviewerFamily,
        reviewerModel,
        familySeparationValid: false,
      };
      await writeFile(artifactPath, JSON.stringify(artifact, null, 2));
      throw new Error(`cross-family-review aborted: workspace missing for ${target.workspace}`);
    }

    const result = await runCrossFamilyReview({
      bundleDir: workspace,
      reviewerFamily,
      reviewerModel,
      reviewerBin,
      factoryFamily: target.factoryFamily,
      flowFile: target.flowFile,
    });
    artifact.results[target.workspace] = {
      ...result,
      factoryModel: target.factoryModel ?? null,
      artifactPath: join(workspace, 'cross-family-review.json'),
    };

    if (result.verdict !== 'approve') {
      artifact.overallStatus = 'failed';
      await writeFile(artifactPath, JSON.stringify(artifact, null, 2));
      throw new Error(
        `cross-family-review aborted for ${target.workspace}: ${result.verdict} (${result.reasons.join('; ')})`,
      );
    }
  }

  await writeFile(artifactPath, JSON.stringify(artifact, null, 2));
  ctx.log('  cross-family-review: approve');
}

function normalizeCrossFamilyTarget(item, stage) {
  if (typeof item === 'string') {
    return {
      workspace: item,
      factoryFamily: stage.factoryFamily,
      factoryModel: stage.factoryModel,
      flowFile: stage.flowFile,
    };
  }
  const workspace = item.workspace ?? item.target;
  if (!workspace) {
    throw new Error('cross-family-review appliesTo entries must include workspace');
  }
  const factoryFamily = item.factoryFamily ?? stage.factoryFamily;
  if (!factoryFamily) {
    throw new Error(`cross-family-review missing factoryFamily for ${workspace}`);
  }
  return {
    workspace,
    factoryFamily,
    factoryModel: item.factoryModel ?? stage.factoryModel,
    flowFile: item.flowFile ?? stage.flowFile,
  };
}

function classifyGateIssue(target, result) {
  if (!result || typeof result !== 'object') {
    return {
      target,
      kind: 'invalid-gate-report',
      detail: 'harness returned no structured report',
    };
  }
  if (result.gateStatus === 'harness-missing') {
    return {
      target,
      kind: 'harness-missing',
      detail: result.harness,
    };
  }
  if (result.exitCode !== undefined && result.exitCode !== 0) {
    return {
      target,
      kind: 'harness-exit-nonzero',
      detail: `exitCode=${result.exitCode}`,
    };
  }
  if (result.gateStatus === 'failed') {
    return {
      target,
      kind: 'failed-gate',
      detail: result.notes ?? 'journey-suite reported failed',
    };
  }
  if (result.gateStatus === 'pending-manual-review') {
    return {
      target,
      kind: 'pending-manual-review',
      detail: 'manual evidence still required before this lane can clear family 1-3',
    };
  }
  if (result.gateStatus === 'passed') {
    return null;
  }
  if (result.gateStatus === 'skipped-no-workspace') {
    return {
      target,
      kind: 'missing-workspace',
      detail: 'gate skipped because workspace was missing',
    };
  }
  return {
    target,
    kind: 'unexpected-gate-status',
    detail: String(result.gateStatus ?? 'undefined'),
  };
}

async function runBlindHandoff(stage, ctx) {
  const handoffMeta = { lanes: {} };
  for (const laneDir of ['codex-workspace', 'pl-workspace']) {
    const src = join(ctx.runDir, laneDir);
    const dst = join(ctx.runDir, `${laneDir}-stripped`);
    if (!existsSync(src)) {
      ctx.log(`  ${laneDir}: missing, skip strip`);
      continue;
    }
    await cp(src, dst, { recursive: true });
    const stripped = await stripBlindedPaths(dst, stage.strip);
    const diffPath = join(ctx.runDir, `${laneDir}-strip.diff.json`);
    await writeFile(diffPath, JSON.stringify(stripped, null, 2));
    ctx.log(`  ${laneDir}: stripped ${stripped.length} entries`);

    // Git-init a baseline so maintenance-lane rework is measurable via
    // `git diff --numstat HEAD` instead of returning null.
    const baselineSha = await gitInitBaseline(dst);
    ctx.log(`  ${laneDir}: baseline commit ${baselineSha.slice(0, 10)}`);

    // Blinding verifier: identity leaks abort the pair.
    const report = await verifyBlinding(dst);
    const reportPath = join(ctx.runDir, `${laneDir}-blinding.json`);
    await writeFile(reportPath, JSON.stringify(report, null, 2));
    if (!report.clean) {
      const summary = report.violations
        .slice(0, 5)
        .map((v) => `    - [${v.kind}] ${v.path}: ${v.reason}`)
        .join('\n');
      throw new Error(
        `blind-handoff aborted: ${report.violationCount} blinding violation(s) in ${laneDir}-stripped.\n` +
          `See ${reportPath}\n${summary}`,
      );
    }
    ctx.log(`  ${laneDir}: blinding clean (${report.warningCount} warnings)`);

    handoffMeta.lanes[laneDir] = {
      strippedPath: dst,
      baselineSha,
      strippedEntries: stripped.length,
      blindingReport: reportPath,
      warningCount: report.warningCount,
    };
  }
  await writeFile(
    join(ctx.runDir, 'blind-handoff-meta.json'),
    JSON.stringify(handoffMeta, null, 2),
  );
}

function runGit(args, cwd) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn('git', args, {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (c) => (stdout += c.toString()));
    child.stderr.on('data', (c) => (stderr += c.toString()));
    child.once('error', (err) =>
      reject(new Error(`git not available (${args.join(' ')}): ${err.message}`)),
    );
    child.once('close', (code) => {
      if (code !== 0) {
        reject(new Error(`git ${args.join(' ')} failed (${code}): ${stderr.trim()}`));
        return;
      }
      resolvePromise(stdout.trim());
    });
  });
}

async function gitInitBaseline(dir) {
  await runGit(['init', '-q', '-b', 'main'], dir);
  await runGit(['add', '-A'], dir);
  await runGit(
    [
      '-c',
      'user.name=e5-handoff',
      '-c',
      'user.email=e5@local',
      '-c',
      'commit.gpgsign=false',
      'commit',
      '-q',
      '--allow-empty',
      '-m',
      'baseline',
    ],
    dir,
  );
  return await runGit(['rev-parse', 'HEAD'], dir);
}

function runMaintenance(laneDir) {
  return async (stage, ctx) => {
    const input = join(ctx.runDir, `${laneDir}-stripped`);
    if (!existsSync(input)) {
      throw new Error(`maintenance input missing: ${input}`);
    }
    // Baseline journey run BEFORE any CR is applied (for driftDelta).
    const baseline = await runJourneySuite({
      workspace: input,
      reportPath: join(ctx.runDir, `${laneDir}-baseline-journey.json`),
    });
    ctx.log(`  ${laneDir}: baseline gate=${baseline.gateStatus}`);

    const crs = stage.changeRequests ?? ['CR-01', 'CR-02', 'CR-03', 'CR-04', 'CR-05'];
    const results = [];
    for (const crId of crs) {
      ctx.log(`  ${laneDir}: applying ${crId}`);
      const crResultsRoot = join(ctx.runDir, `${laneDir}-cr`, crId);
      const res = await runChangeRequest({
        workspace: input,
        changeRequestId: crId,
        baselineJourneyReport: baseline,
        resultsRoot: crResultsRoot,
      });
      results.push(res);
      ctx.log(
        `    ${crId}: pass=${res.pass} rework=${res.reworkCost.totalReworkUnits} drift=${res.driftDelta}`,
      );
    }
    const outPath = join(ctx.runDir, `${laneDir}-maintenance.json`);
    await writeFile(outPath, JSON.stringify({ baseline, results }, null, 2));
    return { outPath, results };
  };
}

async function runScorecard(stage, ctx) {
  const templatePath = resolve(repoRoot, stage.template);
  const tpl = JSON.parse(await readFile(templatePath, 'utf8'));
  tpl.runId = ctx.runId;
  tpl.batch = { batchId: ctx.manifest.batchId, pairId: ctx.manifest.pairId };
  tpl.admissibility.class = 'pilot-scaffold';
  tpl.admissibility.reason = 'Scaffolded via run-pair.mjs; no live factory run completed yet.';
  const scorecardPath = join(ctx.runDir, 'scorecard.json');
  await writeFile(scorecardPath, JSON.stringify(tpl, null, 2));

  // Final step: invoke the maintenance-viability aggregator. If the template
  // still has null placeholders (scaffold-only path), scoring will leave the
  // index null; this is reported in the summary file. Real runs that have
  // populated the four families will get a computed index written back.
  try {
    const { scorecard: scored, lanes, pair } = scoreScorecard(tpl);
    await writeFile(scorecardPath, JSON.stringify(scored, null, 2));
    await writeFile(
      join(ctx.runDir, 'scoring-summary.json'),
      JSON.stringify({ lanes, pair }, null, 2),
    );
    ctx.log(`  scorecard: verdict=${pair.verdict}`);
  } catch (err) {
    ctx.log(`  scorecard: aggregator skipped (${err.message})`);
  }
}

// -----------------------------------------------------------------------------
// Helpers

async function invokeHarness(harnessPath, workspace) {
  const harness = resolve(repoRoot, harnessPath);
  if (!existsSync(harness)) {
    return {
      gateStatus: 'harness-missing',
      harness,
    };
  }
  return await new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, [harness, '--workspace', workspace, '--json'], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (c) => (stdout += c.toString()));
    child.stderr.on('data', (c) => (stderr += c.toString()));
    child.on('close', (code) => {
      try {
        const parsed = stdout.trim() ? JSON.parse(stdout) : {};
        resolvePromise({ exitCode: code, stderr, ...parsed });
      } catch (err) {
        reject(new Error(`harness returned non-JSON (exit ${code}): ${err.message}\n${stdout}`));
      }
    });
    child.on('error', reject);
  });
}

async function stripBlindedPaths(root, patterns) {
  const removed = [];
  const { readdir } = await import('node:fs/promises');
  async function walk(dir) {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (matchesAny(entry.name, patterns)) {
        removed.push({ path: full, reason: 'pattern match' });
        await rm(full, { recursive: true, force: true });
        continue;
      }
      if (entry.isDirectory()) await walk(full);
    }
  }
  await walk(root);
  return removed;
}

function matchesAny(name, patterns) {
  for (const p of patterns) {
    if (p.endsWith('/')) {
      if (name === p.slice(0, -1)) return true;
      continue;
    }
    if (p.startsWith('*.')) {
      if (name.endsWith(p.slice(1))) return true;
      continue;
    }
    if (name === p) return true;
  }
  return false;
}

// -----------------------------------------------------------------------------
// CLI entry point. Only runs when the file is invoked directly.

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args[0].startsWith('--')) usage();

  const manifestArg = args[0];
  const flags = new Map();
  for (let i = 1; i < args.length; i += 1) {
    const key = args[i];
    if (!key.startsWith('--')) usage();
    const value = i + 1 < args.length && !args[i + 1].startsWith('--') ? args[++i] : 'true';
    flags.set(key, value);
  }
  const runId =
    flags.get('--run-id') ??
    `${new Date()
      .toISOString()
      .replace(/[-:T.Z]/g, '')
      .slice(0, 12)}-${Math.random().toString(36).slice(2, 6)}`;
  const dryRun = flags.get('--dry-run') === 'true';
  const planMode = flags.get('--plan') === 'true';

  const manifestPath = resolve(repoRoot, manifestArg);
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  const batchDir = resolve(manifestPath, '..', '..');
  const runDir = join(batchDir, 'runs', runId);

  if (planMode) {
    const plan = createPlan(manifest, runDir);
    process.stdout.write(formatPlan(plan) + '\n');
    return;
  }

  const log = (...parts) => console.log(`[${runId}]`, ...parts);
  log('pair', manifest.pairId, 'batch', manifest.batchId, 'dry-run:', dryRun);
  if (!dryRun) await mkdir(runDir, { recursive: true });

  const handlers = createStageHandlers();
  const ctx = { runDir, runId, manifest, log };
  await runStages(manifest, handlers, ctx, { dryRun, log });

  log('done');
}

const invokedDirectly = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
if (invokedDirectly) {
  await main();
}
