import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..', '..', '..');
const sourceCommit = 'd2602f34ea33504db1d208b3aa68df0ac70a858c';
const createdAtIso = '2026-05-13T01:30:00.000Z';
const notBeforeIso = '2026-05-13T00:00:00.000Z';
const expiresAtIso = '2026-06-13T00:00:00.000Z';

const schemaVersion = 'portarium.gslr-evidence-bundle.v1';
const evidenceSchemaVersion = 'portarium.gslr-engineering-evidence-card-projection-input.v1';
const policyVersion = 'gslr-policy-schema-routing-v2';
const signer = {
  keyId: 'gslr-static-fixture-test-key-2026-05-13',
  algorithm: 'test-ed25519',
};

const fixtures = [
  {
    slug: 'gslr8-route-record-compiler',
    bundleId: 'gslr-bundle-gslr8-route-record-compiler-2026-05-13',
    task: 'gslr8-route-record-compiler',
    policyDecision: 'local-screen',
    run: {
      arm: 'local-only',
      runId: 'gslr8-route-record-compiler-live-2026-05-13-01-local-diagnostic',
      runGroupId: 'gslr8-route-record-compiler-local-repeats',
      finalVerdict: 'pass',
      privateOracle: 'pass',
      blockingReviewDefects: [],
      frontierTokens: 0,
      cachedInputTokens: 0,
      providerUsd: 0,
      localWallSeconds: 22.175,
      selectedModel: 'qwen3-coder:30b',
      selectedProvider: 'ollama',
      reason:
        'PL-owned scaffold owns route-record policy tables and output envelopes; local model filled bounded predicate hooks.',
    },
    reportRef: 'experiments/harness-arena/results/gslr8-local-repeat-2026-05-13/report.md',
    summary:
      'GSLR-8 passed three live local repeats with zero frontier tokens. Promote only the exact PL-owned route-record compiler shape to local-screen.',
    oracleStdout:
      'GSLR-8 oracle summary: selected local diagnostic passed. Static fixture records pass/pass gates and zero frontier spend.',
    oracleStderr: '',
  },
  {
    slug: 'gslr7-scaffolded-route-record',
    bundleId: 'gslr-bundle-gslr7-scaffolded-route-record-2026-05-13',
    task: 'gslr7-scaffolded-route-record',
    policyDecision: 'frontier-baseline',
    run: {
      arm: 'local-only',
      runId: 'gslr7-scaffolded-route-record-live-2026-05-13-v2-01-local-repeat',
      runGroupId: 'gslr7-scaffolded-route-record-local-repeats-v2',
      finalVerdict: 'fail',
      privateOracle: 'fail',
      blockingReviewDefects: [
        'accepted oracle command because normalized input was compared with unnormalized constants',
      ],
      frontierTokens: 0,
      cachedInputTokens: 0,
      providerUsd: 0,
      localWallSeconds: 82.961,
      selectedModel: 'qwen3-coder:30b',
      selectedProvider: 'ollama',
      reason:
        'Local route-record builder still owned too much policy logic and failed the private route-record oracle.',
    },
    reportRef: 'experiments/harness-arena/results/gslr7-local-repeat-2026-05-13/report.md',
    summary:
      'GSLR-7 failed the broader route-record builder shape. Keep this task on frontier-baseline until deterministic PL ownership is stronger.',
    oracleStdout:
      'GSLR-7 oracle summary: selected v2 repeat failed. Static fixture records fail/fail gates and a blocking review defect.',
    oracleStderr:
      'GSLR-7 blocking defect summary: unsafe key class was accepted by local route-record logic.',
  },
];

function canonicalizeJson(value) {
  return JSON.stringify(normalizeJson(value));
}

function normalizeJson(value) {
  if (value === null) return null;
  if (typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('Non-finite number in fixture payload');
    return value;
  }
  if (Array.isArray(value)) return value.map(normalizeJson);
  if (typeof value === 'object') {
    const entries = Object.entries(value)
      .filter(([, child]) => child !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return Object.fromEntries(entries.map(([key, child]) => [key, normalizeJson(child)]));
  }
  throw new Error(`Unsupported value in fixture payload: ${typeof value}`);
}

function sha256Hex(input) {
  return createHash('sha256').update(input).digest('hex');
}

function repoRef(absolutePath) {
  return relative(repoRoot, absolutePath).split('\\').join('/');
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function writeText(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${value}\n`, 'utf8');
}

function artifactPaths(fixture) {
  const base = join(here, 'artifacts', fixture.run.runId);
  return {
    manifest: join(base, 'manifest.json'),
    oracleStdout: join(base, 'oracle', 'stdout.txt'),
    oracleStderr: join(base, 'oracle', 'stderr.txt'),
  };
}

function writeArtifacts(fixture) {
  const paths = artifactPaths(fixture);
  const sourceReportText = readFileSync(join(repoRoot, fixture.reportRef), 'utf8');
  const reportHashSha256 = sha256Hex(sourceReportText);
  const manifest = {
    schemaVersion: 2,
    fixtureKind: 'gslr-static-evidence-bundle-artifact',
    task: fixture.task,
    sourceReport: {
      ref: fixture.reportRef,
      sha256: reportHashSha256,
    },
    sourceCommit,
    selectedRun: fixture.run,
    policyDecision: fixture.policyDecision,
    policyVersion,
    summary: fixture.summary,
    constraints: {
      importMode: 'manual-static-only',
      runtimeAuthority: 'none',
      actionControls: 'absent',
      containsLivePayload: false,
    },
  };

  writeJson(paths.manifest, manifest);
  writeText(paths.oracleStdout, fixture.oracleStdout);
  writeText(paths.oracleStderr, fixture.oracleStderr);
  return paths;
}

function buildBundle(fixture, artifacts) {
  const artifactRefs = {
    manifest: repoRef(artifacts.manifest),
    oracleStdout: repoRef(artifacts.oracleStdout),
    oracleStderr: repoRef(artifacts.oracleStderr),
  };
  const artifactHashes = Object.values(artifacts).map((path) => ({
    ref: repoRef(path),
    sha256: sha256Hex(readFileSync(path)),
  }));
  const evidence = {
    schemaVersion: evidenceSchemaVersion,
    source: {
      manifestSchemaVersion: 2,
    },
    policyVersion,
    route: {
      task: fixture.task,
      policyDecision: fixture.policyDecision,
      selectedRun: fixture.run,
    },
    artifactRefs,
  };
  const draft = {
    schemaVersion,
    bundleId: fixture.bundleId,
    createdAtIso,
    source: {
      system: 'prompt-language',
      repo: '45ck/prompt-language',
      commit: sourceCommit,
      runId: fixture.run.runId,
      runGroupId: fixture.run.runGroupId,
    },
    subject: {
      task: fixture.task,
      policyVersion,
    },
    evidence,
    artifactHashes,
    constraints: {
      importMode: 'manual-static-only',
      runtimeAuthority: 'none',
      actionControls: 'absent',
    },
  };
  const canonicalPayload = canonicalizeJson(draft);
  return {
    ...draft,
    verification: {
      payloadHashSha256: sha256Hex(canonicalPayload),
      signatureBase64: Buffer.from(`sig:${canonicalPayload.length}`).toString('base64'),
      signer,
      notBeforeIso,
      expiresAtIso,
    },
  };
}

const index = {
  schemaVersion: 'prompt-language.gslr-static-evidence-bundle-index.v1',
  generatedAtIso: createdAtIso,
  sourceCommit,
  bundles: [],
};

for (const fixture of fixtures) {
  const artifacts = writeArtifacts(fixture);
  const bundle = buildBundle(fixture, artifacts);
  const bundlePath = join(here, `${fixture.slug}.bundle.json`);
  writeJson(bundlePath, bundle);
  index.bundles.push({
    task: fixture.task,
    policyDecision: fixture.policyDecision,
    bundleRef: repoRef(bundlePath),
    bundleId: bundle.bundleId,
    runId: fixture.run.runId,
  });
}

writeJson(join(here, 'index.json'), index);
