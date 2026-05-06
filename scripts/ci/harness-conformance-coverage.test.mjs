import assert from 'node:assert/strict';
import { test } from 'node:test';

import { verifyHarnessCoverage } from './harness-conformance-coverage.mjs';

test('harness conformance coverage stays wired across adapters, scripts, docs, and smoke scenarios', () => {
  const result = verifyHarnessCoverage();

  assert.equal(result.ok, true, result.failures.join('\n'));
  assert.deepEqual(
    result.harnesses.map((harness) => harness.name),
    ['claude', 'codex', 'opencode', 'ollama', 'aider', 'gemini'],
  );
  assert.ok(
    result.smokeFeatureFamilies.length >= 16,
    'expected broad smoke feature-family coverage',
  );
  assert.ok(
    result.smokeReportFields.includes('harness: getEvidenceHarnessName()'),
    'expected smoke reports to retain harness metadata',
  );
  assert.ok(
    result.smokeReportFields.includes("status: 'blocked'"),
    'expected smoke reports to retain blocked-run metadata',
  );
});
