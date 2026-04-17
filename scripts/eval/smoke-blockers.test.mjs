import assert from 'node:assert/strict';
import test from 'node:test';

import { isHarnessAccessBlocked } from './smoke-blockers.mjs';

test('treats Claude auth failures as blocked harness access', () => {
  assert.equal(
    isHarnessAccessBlocked('Claude does not have access to this workspace. Please login again.'),
    true,
  );
});

test('treats Claude quota exhaustion as blocked harness access', () => {
  assert.equal(
    isHarnessAccessBlocked("You're out of extra usage · resets 11am (Australia/Sydney)"),
    true,
  );
});

test('does not classify ordinary readiness mismatches as blocked harness access', () => {
  assert.equal(isHarnessAccessBlocked('unexpected readiness output: maybe'), false);
});
