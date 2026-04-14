// Self-test for the E5 blinding verifier.
//
// Builds tiny fixture trees under a temp directory and asserts that the
// verifier's violations list matches expectations. Each test builds its own
// fresh tree under os.tmpdir() so tests are independent.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { verifyBlinding } from './verify-blinding.mjs';

async function makeCleanTree() {
  const root = await mkdtemp(join(tmpdir(), 'e5-blind-'));
  await writeFile(join(root, 'package.json'), '{"name":"maint-sample"}');
  await mkdir(join(root, 'src'), { recursive: true });
  await writeFile(join(root, 'src', 'index.js'), 'export const n = 1;\n');
  await writeFile(join(root, 'README.md'), '# Sample\n\nSee [src](src/index.js).\n');
  return root;
}

test('clean tree passes blinding verification', async (t) => {
  const root = await makeCleanTree();
  t.after(() => rm(root, { recursive: true, force: true }));
  const report = await verifyBlinding(root);
  assert.equal(report.clean, true, `expected clean, got ${JSON.stringify(report.violations)}`);
  assert.equal(report.violationCount, 0);
});

test('project.flow file triggers forbidden-filename violation', async (t) => {
  const root = await makeCleanTree();
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(join(root, 'project.flow'), 'flow:\n  prompt: hi\n');
  const report = await verifyBlinding(root);
  assert.equal(report.clean, false);
  assert.ok(
    report.violations.some((v) => v.kind === 'forbidden-filename' && v.path === 'project.flow'),
    `expected forbidden-filename violation, got ${JSON.stringify(report.violations)}`,
  );
});

test('README mentioning prompt-language triggers content violation', async (t) => {
  const root = await makeCleanTree();
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(join(root, 'README.md'), '# Sample\n\nBuilt with prompt-language lanes.\n');
  const report = await verifyBlinding(root);
  assert.equal(report.clean, false);
  assert.ok(
    report.violations.some((v) => v.kind === 'forbidden-content' && v.path === 'README.md'),
    `expected forbidden-content on README.md, got ${JSON.stringify(report.violations)}`,
  );
});

test('nested phase-1-discovery file is caught by content regex', async (t) => {
  const root = await makeCleanTree();
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, 'lib'), { recursive: true });
  await writeFile(join(root, 'lib', 'phase-1-discovery.txt'), 'notes from phase-1-discovery run\n');
  const report = await verifyBlinding(root);
  assert.equal(report.clean, false);
  assert.ok(
    report.violations.some(
      (v) =>
        v.kind === 'forbidden-content' &&
        v.path.replace(/\\/g, '/') === 'lib/phase-1-discovery.txt',
    ),
    `expected content violation on lib/phase-1-discovery.txt, got ${JSON.stringify(report.violations)}`,
  );
});
