#!/usr/bin/env node

/* cspell:ignore rawpayload sourcepayload studentpayload */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const SOLUTION = String.raw`
const FORBIDDEN_KEYS = new Set([
  'rawpayload',
  'sourcepayload',
  'studentpayload',
  'credential',
  'secret',
  'token',
  'password',
]);

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function scanForbiddenKeys(value, path, errors) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => scanForbiddenKeys(item, path + '[' + index + ']', errors));
    return;
  }
  if (!isRecord(value)) return;
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_KEYS.has(key.toLowerCase())) errors.push('forbidden raw or secret key at ' + path + '.' + key);
    scanForbiddenKeys(child, path + '.' + key, errors);
  }
}

function numberOrZero(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function firstStepValue(steps, field) {
  for (const step of steps) {
    if (typeof step?.[field] === 'string' && step[field].trim()) return step[field];
  }
  return null;
}

function reviewDefects(steps) {
  return steps.flatMap((step) => Array.isArray(step?.reviewDefects) ? step.reviewDefects : []).filter((defect) => typeof defect === 'string' && defect.trim());
}

function frontierTokens(steps) {
  return steps.reduce((total, step) => total + (step?.frontierCallKind && step.frontierCallKind !== 'none' ? numberOrZero(step?.cost?.totalTokens) : 0), 0);
}

function cachedTokens(steps) {
  return steps.reduce((total, step) => total + numberOrZero(step?.cost?.cachedInputTokens), 0);
}

function providerUsd(steps) {
  return Number(steps.reduce((total, step) => total + numberOrZero(step?.cost?.providerReportedUsd), 0).toFixed(6));
}

function localWallSeconds(steps) {
  return Number(steps.reduce((total, step) => total + (step?.routeDecision === 'local' ? numberOrZero(step?.wallSeconds) : 0), 0).toFixed(3));
}

export function buildEvidenceCardInput(manifest) {
  const errors = [];
  if (!isRecord(manifest)) return { ok: false, errors: ['manifest must be an object'], card: null };

  scanForbiddenKeys(manifest, 'manifest', errors);

  const steps = Array.isArray(manifest.steps) ? manifest.steps : [];
  if (!Array.isArray(manifest.steps) || steps.length === 0) errors.push('steps must be a non-empty array');
  if (typeof manifest.runId !== 'string' || !manifest.runId.trim()) errors.push('runId is required');
  if (typeof manifest.taskId !== 'string' || !manifest.taskId.trim()) errors.push('taskId is required');
  if (typeof manifest.arm !== 'string' || !manifest.arm.trim()) errors.push('arm is required');
  const finalStatus = manifest.finalVerdict?.status;
  if (!['pass', 'fail'].includes(finalStatus)) errors.push('finalVerdict.status must be pass or fail');
  const oraclePassed = manifest.oracle?.passed;
  if (typeof oraclePassed !== 'boolean') errors.push('oracle.passed must be boolean');
  const defects = reviewDefects(steps);

  if (errors.length > 0) return { ok: false, errors, card: null };
  const clearForResearch = finalStatus === 'pass' && oraclePassed === true && defects.length === 0;

  return {
    ok: true,
    errors: [],
    card: {
      schemaVersion: 'portarium.evidence-card-input.v1',
      source: {
        system: 'prompt-language',
        area: 'harness-arena',
        manifestSchemaVersion: manifest.schemaVersion ?? null,
      },
      workItem: {
        id: manifest.taskId,
        runId: manifest.runId,
        runGroupId: manifest.runGroupId ?? null,
        policyVersion: manifest.policyVersion ?? null,
      },
      route: {
        arm: manifest.arm,
        decision: manifest.arm,
        selectedModel: firstStepValue(steps, 'actualModel') ?? firstStepValue(steps, 'requestedModel'),
        selectedProvider: firstStepValue(steps, 'provider'),
        reason: 'derived-from-harness-manifest',
      },
      gates: {
        finalVerdict: finalStatus,
        privateOracle: oraclePassed ? 'pass' : 'fail',
        blockingReviewDefects: defects,
      },
      cost: {
        frontierTokensTotal: frontierTokens(steps),
        cachedInputTokensTotal: cachedTokens(steps),
        providerUsdTotal: providerUsd(steps),
        localWallSecondsTotal: localWallSeconds(steps),
      },
      actionBoundary: {
        status: clearForResearch ? 'research-only' : 'blocked',
        reason: clearForResearch
          ? 'static evidence-card input only; product runtime ingestion remains blocked'
          : 'manifest is not eligible for product action',
      },
      artifactRefs: {
        manifest: 'hybrid-routing-manifest.json',
        oracleStdout: manifest.oracle.stdoutArtifactRef ?? null,
        oracleStderr: manifest.oracle.stderrArtifactRef ?? null,
      },
    },
  };
}
`;

function parseArgs(argv) {
  const options = { arm: null, step: null, workspace: null };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--workspace') {
      options.workspace = argv[index + 1] ?? null;
      index += 1;
      continue;
    }
    if (arg === '--arm') {
      options.arm = argv[index + 1] ?? null;
      index += 1;
      continue;
    }
    if (arg === '--step') {
      options.step = argv[index + 1] ?? null;
      index += 1;
      continue;
    }
    throw new Error(`Unknown option: ${arg}`);
  }
  if (!options.workspace) throw new Error('--workspace is required');
  if (!options.arm) throw new Error('--arm is required');
  if (!options.step) throw new Error('--step is required');
  return options;
}

const { arm, step, workspace } = parseArgs(process.argv.slice(2));
const policyDir = join(workspace, 'policy');
mkdirSync(policyDir, { recursive: true });

if (step === 'frontier-advice') {
  writeFileSync(
    join(policyDir, 'frontier-advice.md'),
    '# Frontier Advice\n\nAggregate manifest telemetry only. Do not copy raw stdout, stderr, tokens, credentials, or oracle bodies into the card.\n',
  );
  console.error('tokens used\n1,100\ncached tokens\n256\n');
  console.log(`gslr3 deterministic advice complete for ${arm}`);
  process.exit(0);
}

if (step === 'frontier-classify') {
  writeFileSync(
    join(policyDir, 'route-decision.json'),
    JSON.stringify(
      {
        route: 'local-screen',
        reason: 'One-file manifest-to-card transform with public and private gates.',
      },
      null,
      2,
    ),
  );
  console.error('tokens used\n850\ncached tokens\n128\n');
  console.log(`gslr3 deterministic classify complete for ${arm}`);
  process.exit(0);
}

if (step === 'frontier-review') {
  writeFileSync(
    join(policyDir, 'frontier-review.md'),
    '# Frontier Review\n\nblocking findings:\n\nnone\n',
  );
  console.error('tokens used\n1,400\ncached tokens\n320\n');
  console.log(`gslr3 deterministic review complete for ${arm}`);
  process.exit(0);
}

if (['local-bulk', 'local-apply', 'frontier-full'].includes(step)) {
  const target = join(workspace, 'src', 'evidence-card-transform.mjs');
  if (!existsSync(target)) throw new Error('missing src/evidence-card-transform.mjs');
  writeFileSync(target, `${SOLUTION.trim()}\n`, 'utf8');
  const result = spawnSync(process.execPath, ['test/public-gate.mjs'], {
    cwd: workspace,
    encoding: 'utf8',
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) process.exit(result.status ?? 1);
  if (step === 'frontier-full') console.error('tokens used\n2,200\ncached tokens\n512\n');
  console.log(`gslr3 deterministic implementation complete for ${arm}:${step}`);
  process.exit(0);
}

throw new Error(`unsupported step: ${step}`);
