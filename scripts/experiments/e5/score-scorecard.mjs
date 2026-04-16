#!/usr/bin/env node
// E5 maintenance-viability aggregator.
//
// Consumes a filled-in scorecard.json (shape defined by
// experiments/results/e5-maintenance/templates/scorecard.template.json) and
// computes the per-lane family scores plus the composite
// maintenanceViabilityIndex. Writes the numbers back into the scorecard and
// updates the top-level comparativeVerdict.
//
// Formula spec: docs/strategy/e5-scoring.md. If you change a weight or
// threshold here, update that doc in the same change.
//
// Usage:
//   node scripts/experiments/e5/score-scorecard.mjs <scorecard.json> [--json]
//
// Programmatic callers should import { scoreScorecard }.

import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// ---------------------------------------------------------------------------
// Constants. Kept in one block so the formula doc and the code are trivially
// diff-able.

export const WEIGHTS = Object.freeze({ f1: 0.15, f2: 0.2, f3: 0.15, f4: 0.5 });
export const GATES = Object.freeze({
  f1MinRatio: 0.8,
  f2MinJourneyPassRate: 0.85,
});
export const CONSTANTS = Object.freeze({
  probeFailurePenalty: 0.9,
  timeToInteractionTargetSec: 300,
  reworkNormalizerUnits: 500,
  pairVerdictMarginPoints: 5,
});

export const CROSS_FAMILY_REVIEWER_STATUSES = Object.freeze([
  'pass',
  'downgrade',
  'fail',
  'not-requested',
]);

// ---------------------------------------------------------------------------
// Pure helpers.

function clamp(n, lo, hi) {
  if (!Number.isFinite(n)) return null;
  return Math.min(Math.max(n, lo), hi);
}

function requireField(obj, path, laneLabel) {
  let cursor = obj;
  for (const key of path) {
    if (cursor === undefined || cursor === null || !(key in cursor)) {
      throw new Error(`score-scorecard: missing required field ${path.join('.')} on ${laneLabel}`);
    }
    cursor = cursor[key];
  }
  return cursor;
}

function countFailedProbes(persistence) {
  if (!persistence || typeof persistence !== 'object') return 0;
  let failed = 0;
  for (const key of ['restartSurvivesState', 'transactionRollback', 'concurrentWrite']) {
    if (persistence[key] === false) failed += 1;
  }
  return failed;
}

function countMissingProbes(persistence) {
  if (!persistence || typeof persistence !== 'object') return 3;
  let missing = 0;
  for (const key of ['restartSurvivesState', 'transactionRollback', 'concurrentWrite']) {
    if (persistence[key] !== true) missing += 1;
  }
  return missing;
}

export function normalizeCrossFamilyReviewerStatus(value) {
  if (typeof value === 'string' && CROSS_FAMILY_REVIEWER_STATUSES.includes(value)) {
    return value;
  }
  if (
    value &&
    typeof value === 'object' &&
    typeof value.status === 'string' &&
    CROSS_FAMILY_REVIEWER_STATUSES.includes(value.status)
  ) {
    return value.status;
  }
  return 'not-requested';
}

// ---------------------------------------------------------------------------
// Family scores. Each returns a number in [0, 1] or null.

export function scoreFamilyOne(fam1) {
  const specified = fam1.featuresSpecified;
  const shipped = fam1.featuresShipped;
  if (specified === null || specified === undefined) return null;
  if (specified === 0) return 1;
  if (shipped === null || shipped === undefined) return null;
  return clamp(shipped / specified, 0, 1);
}

export function scoreFamilyTwo(fam2) {
  const rate = fam2.journeyPassRate;
  if (rate === null || rate === undefined) return null;
  const failed = countFailedProbes(fam2.persistenceIntegrity);
  return clamp(rate * Math.pow(CONSTANTS.probeFailurePenalty, failed), 0, 1);
}

export function scoreFamilyThree(fam3) {
  const clean = fam3.runsFromCleanCheckout === true;
  const build = fam3.buildArtifactValid === true;
  if (!clean || !build) return 0;
  const time = fam3.timeToFirstInteractionSec;
  if (time === null || time === undefined) return 1;
  if (!Number.isFinite(time) || time < 0) return null;
  return clamp(1 / (1 + time / CONSTANTS.timeToInteractionTargetSec), 0, 1);
}

export function scoreFamilyFour(fam4) {
  const warnings = [];
  const attempted = fam4.changeRequestsAttempted;
  const passed = fam4.changeRequestsPassed;
  let crRate = fam4.changeRequestPassRate;
  if ((crRate === null || crRate === undefined) && Number.isFinite(attempted) && attempted > 0) {
    crRate = passed / attempted;
  }
  if (crRate === null || crRate === undefined) return { score: null, warnings };

  const reworkUnits = fam4?.reworkCost?.totalReworkUnits;
  let reworkTerm;
  if (reworkUnits === null || reworkUnits === undefined) {
    warnings.push(
      'reworkCost.totalReworkUnits is null; F4 computed without the rework penalty. ' +
        'This biases the score upward.',
    );
    reworkTerm = 1;
  } else {
    reworkTerm = 1 - Math.min(reworkUnits / CONSTANTS.reworkNormalizerUnits, 1);
  }

  const drift = fam4?.driftResistance?.driftDelta;
  const driftTerm = drift === null || drift === undefined ? 1 : 1 + drift;

  const raw = crRate * reworkTerm * driftTerm;
  return { score: clamp(raw, 0, 1), warnings };
}

// ---------------------------------------------------------------------------
// Gating.

export function evaluateGates(lane) {
  const fam1 = lane.familyOne_featureCompletion;
  const fam2 = lane.familyTwo_behavioralCorrectness;
  const fam3 = lane.familyThree_deliverability;

  const f1Ratio = fam1?.featureCompletionRatio;
  const f1Pass =
    Number.isFinite(f1Ratio) &&
    f1Ratio >= GATES.f1MinRatio &&
    Number.isFinite(fam1?.featuresSpecified) &&
    fam1.featuresSpecified > 0;

  const f2Rate = fam2?.journeyPassRate;
  const f2ProbesClean = countMissingProbes(fam2?.persistenceIntegrity) === 0;
  const f2Pass = Number.isFinite(f2Rate) && f2Rate >= GATES.f2MinJourneyPassRate && f2ProbesClean;

  const f3Pass = fam3?.runsFromCleanCheckout === true;

  return {
    clearsFamilyOne: f1Pass,
    clearsFamilyTwo: f2Pass,
    clearsFamilyThree: f3Pass,
    eligibleForFamilyFour: f1Pass && f2Pass && f3Pass,
  };
}

// ---------------------------------------------------------------------------
// Lane scoring.

export function scoreLane(lane) {
  if (!lane || typeof lane !== 'object') {
    throw new Error('score-scorecard: lane entry is not an object');
  }
  const label = lane.lane ?? lane.candidate ?? '(unnamed lane)';
  requireField(lane, ['familyOne_featureCompletion'], label);
  requireField(lane, ['familyTwo_behavioralCorrectness'], label);
  requireField(lane, ['familyThree_deliverability'], label);
  requireField(lane, ['familyFour_maintenanceViability'], label);

  const f1 = scoreFamilyOne(lane.familyOne_featureCompletion);
  const f2 = scoreFamilyTwo(lane.familyTwo_behavioralCorrectness);
  const f3 = scoreFamilyThree(lane.familyThree_deliverability);
  const { score: f4, warnings: f4Warnings } = scoreFamilyFour(lane.familyFour_maintenanceViability);

  const gating = evaluateGates(lane);
  const warnings = [...f4Warnings];
  let index = null;
  let buildFailedReason = null;

  if (!gating.clearsFamilyOne) buildFailedReason = 'f1-gate-fail';
  else if (!gating.clearsFamilyTwo) buildFailedReason = 'f2-gate-fail';
  else if (!gating.clearsFamilyThree) buildFailedReason = 'f3-gate-fail';

  if (!buildFailedReason) {
    if (f1 === null || f2 === null || f3 === null || f4 === null) {
      warnings.push('score is null because at least one family score is null');
    } else {
      index = 100 * (WEIGHTS.f1 * f1 + WEIGHTS.f2 * f2 + WEIGHTS.f3 * f3 + WEIGHTS.f4 * f4);
      index = Math.round(index * 100) / 100;
    }
  }

  return {
    label,
    familyScores: { f1, f2, f3, f4 },
    gating,
    maintenanceViabilityIndex: index,
    buildFailedReason,
    warnings,
  };
}

// ---------------------------------------------------------------------------
// Pair verdict.

export function computePairVerdict(laneScores) {
  const byCandidate = new Map();
  for (const s of laneScores) {
    byCandidate.set(s.candidate, s);
  }
  const pl = byCandidate.get('prompt-language');
  const co = byCandidate.get('codex-alone');

  if (!pl || !co) {
    return {
      verdict: 'inconclusive',
      reason: 'both prompt-language and codex-alone lanes required for verdict',
    };
  }
  if (pl.buildFailedReason) {
    return {
      verdict: 'inconclusive',
      reason: `build-failed-${pl.lane} (${pl.buildFailedReason})`,
    };
  }
  if (co.buildFailedReason) {
    return {
      verdict: 'inconclusive',
      reason: `build-failed-${co.lane} (${co.buildFailedReason})`,
    };
  }
  const plIdx = pl.maintenanceViabilityIndex;
  const coIdx = co.maintenanceViabilityIndex;
  if (plIdx === null || coIdx === null) {
    return {
      verdict: 'inconclusive',
      reason: 'at least one lane has a null maintenanceViabilityIndex',
    };
  }
  const delta = plIdx - coIdx;
  const margin = CONSTANTS.pairVerdictMarginPoints;
  if (delta > margin) {
    return {
      verdict: 'prompt-language-better',
      reason: `PL-first exceeds codex-first by ${delta.toFixed(2)} points (margin ${margin})`,
    };
  }
  if (-delta > margin) {
    return {
      verdict: 'codex-alone-better',
      reason: `codex-first exceeds PL-first by ${(-delta).toFixed(2)} points (margin ${margin})`,
    };
  }
  return {
    verdict: 'inconclusive',
    reason: `gap ${delta.toFixed(2)} points within margin ${margin}`,
  };
}

// ---------------------------------------------------------------------------
// Full scorecard scoring. Mutates a copy of the input and returns it plus
// a side-channel summary structure.

export function scoreScorecard(scorecard) {
  if (!scorecard || typeof scorecard !== 'object') {
    throw new Error('score-scorecard: input is not an object');
  }
  if (!Array.isArray(scorecard.lanes) || scorecard.lanes.length === 0) {
    throw new Error('score-scorecard: scorecard.lanes must be a non-empty array');
  }

  const out = JSON.parse(JSON.stringify(scorecard));
  const laneSummaries = [];

  for (let i = 0; i < out.lanes.length; i += 1) {
    const lane = out.lanes[i];
    const scored = scoreLane(lane);

    lane.familyFour_maintenanceViability.maintenanceViabilityIndex =
      scored.maintenanceViabilityIndex;
    lane.gatingStatus = scored.gating;
    lane.totals = {
      maintenanceViabilityIndex: scored.maintenanceViabilityIndex,
      familyScores: scored.familyScores,
      buildFailedReason: scored.buildFailedReason,
      warnings: scored.warnings,
    };

    laneSummaries.push({
      lane: lane.lane,
      candidate: lane.candidate,
      maintenanceViabilityIndex: scored.maintenanceViabilityIndex,
      familyScores: scored.familyScores,
      gating: scored.gating,
      buildFailedReason: scored.buildFailedReason,
      warnings: scored.warnings,
    });
  }

  const pair = computePairVerdict(laneSummaries);
  out.comparativeVerdict = pair.verdict;
  out.comparativeSummary = pair.reason;
  if (!out.admissibility) out.admissibility = {};
  out.admissibility.crossFamilyReviewer = normalizeCrossFamilyReviewerStatus(
    out.admissibility.crossFamilyReviewer,
  );
  out.admissibility.buildGatesPassed = laneSummaries.every((s) => s.gating.eligibleForFamilyFour);
  out.admissibility.reason = pair.reason;

  return { scorecard: out, lanes: laneSummaries, pair };
}

// ---------------------------------------------------------------------------
// CLI.

function formatHuman({ scorecard, lanes, pair }) {
  const lines = [];
  lines.push(`pairId: ${scorecard?.batch?.pairId ?? '(unknown)'}`);
  lines.push(`batchId: ${scorecard?.batch?.batchId ?? '(unknown)'}`);
  lines.push('');
  for (const lane of lanes) {
    lines.push(`lane: ${lane.lane} (${lane.candidate})`);
    lines.push(
      `  F1=${fmtNum(lane.familyScores.f1)}  F2=${fmtNum(lane.familyScores.f2)}  ` +
        `F3=${fmtNum(lane.familyScores.f3)}  F4=${fmtNum(lane.familyScores.f4)}`,
    );
    lines.push(
      `  gates: f1=${lane.gating.clearsFamilyOne} f2=${lane.gating.clearsFamilyTwo} ` +
        `f3=${lane.gating.clearsFamilyThree}`,
    );
    lines.push(
      `  maintenanceViabilityIndex: ${
        lane.maintenanceViabilityIndex === null
          ? 'null (build-failed)'
          : lane.maintenanceViabilityIndex
      }`,
    );
    if (lane.buildFailedReason) lines.push(`  buildFailedReason: ${lane.buildFailedReason}`);
    for (const w of lane.warnings) lines.push(`  warning: ${w}`);
    lines.push('');
  }
  lines.push(`comparativeVerdict: ${pair.verdict}`);
  lines.push(`reason: ${pair.reason}`);
  return lines.join('\n');
}

function fmtNum(n) {
  if (n === null || n === undefined) return 'null';
  return Number(n).toFixed(3);
}

async function main() {
  const args = process.argv.slice(2);
  const positional = args.filter((a) => !a.startsWith('--'));
  const flags = new Set(args.filter((a) => a.startsWith('--')));
  if (positional.length === 0) {
    process.stderr.write(
      'Usage: node scripts/experiments/e5/score-scorecard.mjs <scorecard.json> [--json]\n',
    );
    process.exit(2);
  }
  const scorecardPath = resolve(process.cwd(), positional[0]);
  if (!existsSync(scorecardPath)) {
    process.stderr.write(`score-scorecard: file not found: ${scorecardPath}\n`);
    process.exit(1);
  }
  const raw = await readFile(scorecardPath, 'utf8');
  const input = JSON.parse(raw);
  const result = scoreScorecard(input);
  await writeFile(scorecardPath, JSON.stringify(result.scorecard, null, 2));

  if (flags.has('--json')) {
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  } else {
    process.stdout.write(formatHuman(result) + '\n');
  }
}

const invokedDirectly =
  process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (invokedDirectly) {
  await main();
}
