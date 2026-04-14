// Tests for the E5 maintenance-viability scorecard aggregator.
//
// Fixtures are hand-built per test rather than loaded from disk so the
// scenarios stay self-documenting.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoreScorecard, CONSTANTS } from './score-scorecard.mjs';

function makeLane({
  lane,
  candidate,
  featuresSpecified = 10,
  featuresShipped = 10,
  featureCompletionRatio = 1,
  journeyPassRate = 1,
  restartSurvivesState = true,
  transactionRollback = true,
  concurrentWrite = true,
  runsFromCleanCheckout = true,
  buildArtifactValid = true,
  timeToFirstInteractionSec = 0,
  changeRequestsAttempted = 5,
  changeRequestsPassed = 5,
  changeRequestPassRate = 1,
  reworkUnits = 0,
  driftDelta = 0,
  preRatio = 1,
  postRatio = 1,
} = {}) {
  return {
    lane,
    candidate,
    familyOne_featureCompletion: {
      featuresSpecified,
      featuresShipped,
      featureCompletionRatio,
      deadCodeRatio: null,
      evidence: {},
    },
    familyTwo_behavioralCorrectness: {
      journeysDeclared: 7,
      journeysPassed: Math.round(7 * journeyPassRate),
      journeyPassRate,
      persistenceIntegrity: {
        restartSurvivesState,
        transactionRollback,
        concurrentWrite,
      },
      contractViolations: 0,
      evidence: {},
    },
    familyThree_deliverability: {
      runsFromCleanCheckout,
      buildArtifactValid,
      timeToFirstInteractionSec,
      cleanCheckoutSteps: null,
      humanFixupsRequired: null,
      evidence: {},
    },
    familyFour_maintenanceViability: {
      changeRequestsAttempted,
      changeRequestsPassed,
      changeRequestPassRate,
      reworkCost: {
        linesOfCodeTouched: null,
        filesModified: null,
        filesCreated: null,
        filesDeleted: null,
        artifactsRewritten: null,
        totalReworkUnits: reworkUnits,
      },
      driftResistance: {
        featureCompletionRatioPreSuite: preRatio,
        featureCompletionRatioPostSuite: postRatio,
        driftDelta,
      },
      maintenanceViabilityIndex: null,
      evidence: {},
    },
    gatingStatus: {
      clearsFamilyOne: false,
      clearsFamilyTwo: false,
      clearsFamilyThree: false,
      eligibleForFamilyFour: false,
    },
    supportingContext: {},
    notes: '',
  };
}

function makeScorecard(plOverrides = {}, coOverrides = {}) {
  return {
    scoreVersion: 'e5-v1',
    runId: 'test-run',
    batch: { batchId: 'E5-B01', pairId: 'P-test' },
    evaluationModel: {},
    blinding: {},
    admissibility: {},
    comparativeVerdict: 'inconclusive',
    lanes: [
      makeLane({ lane: 'pl-first', candidate: 'prompt-language', ...plOverrides }),
      makeLane({ lane: 'codex-first', candidate: 'codex-alone', ...coOverrides }),
    ],
    thesisVerdict: {},
  };
}

test('all-perfect lanes yield maintenanceViabilityIndex = 100 on both lanes', () => {
  const input = makeScorecard();
  const { scorecard, lanes, pair } = scoreScorecard(input);
  for (const l of lanes) {
    assert.equal(l.maintenanceViabilityIndex, 100, `lane ${l.lane} should be 100`);
    assert.equal(l.gating.eligibleForFamilyFour, true);
  }
  assert.equal(pair.verdict, 'inconclusive'); // 100 vs 100 gap = 0
  assert.equal(scorecard.lanes[0].totals.maintenanceViabilityIndex, 100);
  assert.equal(scorecard.lanes[0].familyFour_maintenanceViability.maintenanceViabilityIndex, 100);
});

test('F1 gate failure marks lane build-failed and verdict inconclusive', () => {
  const input = makeScorecard({
    featuresShipped: 5,
    featuresSpecified: 10,
    featureCompletionRatio: 0.5,
  });
  const { lanes, pair } = scoreScorecard(input);
  const pl = lanes.find((l) => l.candidate === 'prompt-language');
  assert.equal(pl.gating.clearsFamilyOne, false);
  assert.equal(pl.maintenanceViabilityIndex, null);
  assert.equal(pl.buildFailedReason, 'f1-gate-fail');
  assert.equal(pair.verdict, 'inconclusive');
  assert.match(pair.reason, /build-failed-pl-first/);
});

test('cross-lane comparison: PL=80, codex=70 -> prompt-language-better', () => {
  // Tune inputs so indices come out near 80 and 70.
  // With all gates passing: index = 100*(0.15*F1 + 0.2*F2 + 0.15*F3 + 0.5*F4)
  // Pick F4=0.6 pl vs F4=0.4 codex, others perfect:
  //   pl = 100*(0.15+0.2+0.15+0.5*0.6) = 100*(0.5+0.3) = 80
  //   co = 100*(0.15+0.2+0.15+0.5*0.4) = 100*(0.5+0.2) = 70
  // Drive F4 via changeRequestPassRate with rework=0 and driftDelta=0.
  const input = makeScorecard(
    { changeRequestPassRate: 0.6, changeRequestsPassed: 3 },
    { changeRequestPassRate: 0.4, changeRequestsPassed: 2 },
  );
  const { lanes, pair } = scoreScorecard(input);
  const pl = lanes.find((l) => l.candidate === 'prompt-language');
  const co = lanes.find((l) => l.candidate === 'codex-alone');
  assert.equal(pl.maintenanceViabilityIndex, 80);
  assert.equal(co.maintenanceViabilityIndex, 70);
  assert.equal(pair.verdict, 'prompt-language-better');
});

test('narrow gap within margin -> inconclusive', () => {
  // pl F4=0.44 -> 72, codex F4=0.4 -> 70. Gap=2, under margin of 5.
  const input = makeScorecard(
    { changeRequestPassRate: 0.44, changeRequestsPassed: 2 },
    { changeRequestPassRate: 0.4, changeRequestsPassed: 2 },
  );
  const { pair } = scoreScorecard(input);
  assert.equal(pair.verdict, 'inconclusive');
  assert.match(pair.reason, /within margin/);
});

test('missing familyFour on a lane raises a loud error with the field path', () => {
  const input = makeScorecard();
  delete input.lanes[0].familyFour_maintenanceViability;
  assert.throws(() => scoreScorecard(input), /familyFour_maintenanceViability/);
});

test('reworkCost null triggers partial-formula warning but still scores', () => {
  const input = makeScorecard({
    reworkUnits: null,
  });
  const { lanes } = scoreScorecard(input);
  const pl = lanes.find((l) => l.candidate === 'prompt-language');
  assert.equal(pl.maintenanceViabilityIndex, 100); // rework term drops to 1
  assert.ok(
    pl.warnings.some((w) => /reworkCost.*null/.test(w)),
    `expected a rework-null warning, got ${JSON.stringify(pl.warnings)}`,
  );
});

test('probe failures apply the 0.9^n penalty to F2', () => {
  const input = makeScorecard({
    restartSurvivesState: false,
    transactionRollback: false,
  });
  const { lanes } = scoreScorecard(input);
  const pl = lanes.find((l) => l.candidate === 'prompt-language');
  // Probe failures also trip the F2 gate (requires all probes true).
  assert.equal(pl.gating.clearsFamilyTwo, false);
  assert.equal(pl.maintenanceViabilityIndex, null);
  assert.equal(pl.buildFailedReason, 'f2-gate-fail');
  // F2 raw score still computed: 1 * 0.9^2 = 0.81
  assert.ok(
    Math.abs(pl.familyScores.f2 - 0.81) < 1e-9,
    `expected F2 ~ 0.81, got ${pl.familyScores.f2}`,
  );
});

test('timeToFirstInteractionSec = target halves F3', () => {
  const input = makeScorecard({
    timeToFirstInteractionSec: CONSTANTS.timeToInteractionTargetSec,
  });
  const { lanes } = scoreScorecard(input);
  const pl = lanes.find((l) => l.candidate === 'prompt-language');
  assert.ok(
    Math.abs(pl.familyScores.f3 - 0.5) < 1e-9,
    `expected F3 = 0.5 at target time, got ${pl.familyScores.f3}`,
  );
});

test('runsFromCleanCheckout=false zeroes F3 and fails gate', () => {
  const input = makeScorecard({ runsFromCleanCheckout: false });
  const { lanes } = scoreScorecard(input);
  const pl = lanes.find((l) => l.candidate === 'prompt-language');
  assert.equal(pl.familyScores.f3, 0);
  assert.equal(pl.gating.clearsFamilyThree, false);
  assert.equal(pl.buildFailedReason, 'f3-gate-fail');
});

test('codex lane winning by large margin -> codex-alone-better', () => {
  const input = makeScorecard(
    { changeRequestPassRate: 0.3, changeRequestsPassed: 1 },
    { changeRequestPassRate: 0.9, changeRequestsPassed: 4 },
  );
  const { pair } = scoreScorecard(input);
  assert.equal(pair.verdict, 'codex-alone-better');
});

test('rework units at the normalizer ceiling zero out the rework term', () => {
  // F4 = crRate * (1 - min(reworkUnits/500,1)) * (1+drift) = 1 * 0 * 1 = 0
  const input = makeScorecard({ reworkUnits: 500 });
  const { lanes } = scoreScorecard(input);
  const pl = lanes.find((l) => l.candidate === 'prompt-language');
  assert.equal(pl.familyScores.f4, 0);
  // Index = 100*(0.15+0.2+0.15+0.5*0) = 50
  assert.equal(pl.maintenanceViabilityIndex, 50);
});
