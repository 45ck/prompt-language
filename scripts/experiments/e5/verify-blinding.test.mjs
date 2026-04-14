// Self-test for the E5 blinding verifier.
//
// Builds tiny fixture trees under a temp directory and asserts that the
// verifier's violations list matches expectations. Each test builds its own
// fresh tree under os.tmpdir() so tests are independent.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, cp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyBlinding } from './verify-blinding.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesRoot = join(__dirname, '__fixtures__', 'blinding');

/**
 * Copy a committed fixture tree into a temp directory so the verifier can
 * walk it without touching repo contents. Returns the temp root.
 */
async function materializeFixture(name) {
  const dst = await mkdtemp(join(tmpdir(), `e5-blind-fx-${name}-`));
  await cp(join(fixturesRoot, name), dst, { recursive: true });
  return dst;
}

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

// ---------------------------------------------------------------------------
// Fixture-driven suite. Trees live under __fixtures__/blinding/ and are
// copied into a temp dir per test so the verifier walks a realistic layout
// without mutating the repo.

test('fixture: clean/ passes blinding verification', async (t) => {
  const root = await materializeFixture('clean');
  t.after(() => rm(root, { recursive: true, force: true }));
  const report = await verifyBlinding(root);
  assert.equal(
    report.clean,
    true,
    `expected clean, got ${JSON.stringify(report.violations)}`,
  );
  assert.equal(report.violationCount, 0);
});

test('fixture: flow-file/ reports forbidden-filename via kind field', async (t) => {
  const root = await materializeFixture('flow-file');
  t.after(() => rm(root, { recursive: true, force: true }));
  const report = await verifyBlinding(root);
  assert.equal(report.clean, false);
  const flowHit = report.violations.find(
    (v) => v.kind === 'forbidden-filename' && /project\.flow$/.test(v.path.replace(/\\/g, '/')),
  );
  assert.ok(
    flowHit,
    `expected forbidden-filename on project.flow, got ${JSON.stringify(report.violations)}`,
  );
  // Verifier encodes the classifier on the "kind" field (not "class") and the
  // human-readable detail on "reason".
  assert.match(flowHit.reason, /suffix|exact/);
});

test('fixture: content-leak-readme/ reports forbidden-content on README.md', async (t) => {
  const root = await materializeFixture('content-leak-readme');
  t.after(() => rm(root, { recursive: true, force: true }));
  const report = await verifyBlinding(root);
  assert.equal(report.clean, false);
  const hit = report.violations.find(
    (v) => v.kind === 'forbidden-content' && v.path === 'README.md',
  );
  assert.ok(hit, `expected forbidden-content on README.md, got ${JSON.stringify(report.violations)}`);
  assert.match(hit.reason, /content matches/);
});

test('fixture: content-leak-nested/ reports forbidden-content on nested md', async (t) => {
  const root = await materializeFixture('content-leak-nested');
  t.after(() => rm(root, { recursive: true, force: true }));
  const report = await verifyBlinding(root);
  assert.equal(report.clean, false);
  const hit = report.violations.find(
    (v) =>
      v.kind === 'forbidden-content' &&
      v.path.replace(/\\/g, '/') === 'src/lib/phase-1-discovery.md',
  );
  assert.ok(
    hit,
    `expected forbidden-content on src/lib/phase-1-discovery.md, got ${JSON.stringify(
      report.violations,
    )}`,
  );
});

test('fixture: pl-trace-dir/ reports forbidden-directory for .prompt-language', async (t) => {
  const root = await materializeFixture('pl-trace-dir');
  t.after(() => rm(root, { recursive: true, force: true }));
  const report = await verifyBlinding(root);
  assert.equal(report.clean, false);
  const hit = report.violations.find(
    (v) => v.kind === 'forbidden-directory' && /\.prompt-language/.test(v.path),
  );
  assert.ok(
    hit,
    `expected forbidden-directory on .prompt-language, got ${JSON.stringify(report.violations)}`,
  );
  assert.match(hit.reason, /banned/);
});
