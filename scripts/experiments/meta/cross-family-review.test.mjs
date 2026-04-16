import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  FAMILY_TABLE_VERSION,
  inferFamily,
  parseVerdict,
  runCrossFamilyReview,
  validateFamilySeparation,
} from './cross-family-review.mjs';

async function makeBundle(report = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'cross-family-review-'));
  await writeFile(join(dir, 'report.json'), JSON.stringify(report, null, 2), 'utf8');
  return dir;
}

test('inferFamily recognizes the documented family taxonomy', () => {
  assert.equal(inferFamily('claude-sonnet-4-6'), 'anthropic');
  assert.equal(inferFamily('gpt-5.2'), 'openai');
  assert.equal(inferFamily('gemini-2.5-pro'), 'google');
  assert.equal(inferFamily('llama-3.3-70b'), 'meta-llama');
  assert.equal(inferFamily('qwen2.5-coder-32b'), 'qwen');
  assert.equal(inferFamily('deepseek-r1'), 'deepseek');
  assert.equal(inferFamily('codestral-latest'), 'mistral');
  assert.equal(inferFamily('gemma-3-27b'), 'gemma');
  assert.equal(inferFamily('grok-4'), 'xai');
  assert.equal(inferFamily('mystery-model'), 'unknown');
});

test('validateFamilySeparation rejects missing, unknown, and same-family pairings', () => {
  assert.equal(validateFamilySeparation('', 'anthropic').valid, false);
  assert.equal(validateFamilySeparation('unknown', 'anthropic').valid, false);
  assert.equal(validateFamilySeparation('openai', 'openai').valid, false);
  assert.equal(validateFamilySeparation('openai', 'anthropic').valid, true);
});

test('parseVerdict handles JSON and legacy reviewer outputs', () => {
  assert.deepEqual(parseVerdict('{"verdict":"pass","risks":[]}'), {
    verdict: 'approve',
    reviewVerdict: 'pass',
    reasons: [],
    format: 'json',
  });

  const failed = parseVerdict(
    JSON.stringify({
      verdict: 'fail',
      rationale: 'Security issue present',
      risks: [{ summary: 'SQL injection risk' }],
    }),
  );
  assert.equal(failed.verdict, 'veto');
  assert.equal(failed.reviewVerdict, 'fail');
  assert.deepEqual(failed.reasons, ['SQL injection risk']);

  const partial = parseVerdict('review notes\nVERDICT: PARTIAL missing tests; docs drift');
  assert.equal(partial.verdict, 'partial');
  assert.equal(partial.reviewVerdict, 'partial');
  assert.deepEqual(partial.reasons, ['missing tests', 'docs drift']);

  const legacyApprove = parseVerdict('all good\nVERDICT: APPROVE');
  assert.equal(legacyApprove.verdict, 'approve');
  assert.equal(legacyApprove.reviewVerdict, 'pass');
});

test('runCrossFamilyReview succeeds with a stubbed reviewer and persists the artifact', async () => {
  const bundleDir = await makeBundle({
    factory: {
      model: 'gpt-5.2',
      family: 'openai',
      modelVersion: '2026-04-01',
    },
  });

  const result = await runCrossFamilyReview({
    bundleDir,
    reviewerFamily: 'anthropic',
    reviewerModel: 'claude-sonnet-4-6',
    spawnReview: async () =>
      JSON.stringify({
        schemaVersion: '1.0.0',
        verdict: 'pass',
        rationale: 'Looks good.',
        risks: [],
        reviewerModel: 'claude-sonnet-4-6',
        reviewerFamily: 'anthropic',
      }),
  });

  assert.equal(result.verdict, 'approve');
  assert.equal(result.reviewVerdict, 'pass');
  assert.equal(result.rulePassed, true);
  assert.equal(result.familySeparationValid, true);
  assert.equal(result.familyTableVersion, FAMILY_TABLE_VERSION);
  assert.equal(result.factory.family, 'openai');
  assert.equal(result.reviewer.family, 'anthropic');

  const persisted = JSON.parse(await readFile(join(bundleDir, 'cross-family-review.json'), 'utf8'));
  assert.equal(persisted.verdict, 'approve');
  assert.equal(persisted.rulePassed, true);
});

test('runCrossFamilyReview rejects declared/inferred reviewer family mismatches', async () => {
  const bundleDir = await makeBundle({
    factory: {
      model: 'gpt-5.2',
      family: 'openai',
    },
  });

  const result = await runCrossFamilyReview({
    bundleDir,
    reviewerFamily: 'openai',
    reviewerModel: 'claude-sonnet-4-6',
    spawnReview: async () => 'VERDICT: APPROVE',
  });

  assert.equal(result.verdict, 'error');
  assert.equal(result.rulePassed, false);
  assert.equal(result.familySeparationValid, false);
  assert.match(result.reasons.join('\n'), /reviewer family mismatch/i);
});
