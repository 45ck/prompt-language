#!/usr/bin/env node
// E5 journey-suite harness.
//
// Runs the 7 CRM journeys (plus 3 persistence probes) defined in
// harness/crm-journeys.md against a given workspace. The runner is
// lane-agnostic: it reads only the workspace's published README / docs to
// discover entrypoints.
//
// For v1, journeys are classified in crm-journeys.json as either:
//   - "http"                   — attempt to exercise via documented HTTP contract
//   - "requires-manual-review" — record as pending; do NOT mark pass/fail
//
// Emits a JSON report matching the `familyTwo_behavioralCorrectness` shape
// of the scorecard template.

import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bootApp } from './app-boot.mjs';
import { probeJourney, discoverEndpoints } from './documented-endpoint-probe.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..', '..');
const JOURNEYS_JSON = join(
  repoRoot,
  'experiments',
  'results',
  'e5-maintenance',
  'harness',
  'crm-journeys.json',
);

export async function runJourneySuite({ workspace, reportPath } = {}) {
  if (!workspace) throw new Error('runJourneySuite: --workspace is required');
  if (!existsSync(workspace)) {
    throw new Error(`workspace does not exist: ${workspace}`);
  }
  if (!existsSync(JOURNEYS_JSON)) {
    throw new Error(`journeys manifest missing: ${JOURNEYS_JSON}`);
  }

  const journeysDoc = JSON.parse(await readFile(JOURNEYS_JSON, 'utf8'));
  const journeys = journeysDoc.journeys ?? [];
  const probes = journeysDoc.persistenceProbes ?? [];

  // v1 contract discovery: look for a README and an OpenAPI / contract file.
  const readme = await findReadme(workspace);
  const contract = await findContract(workspace);

  // v2: attempt to boot the app and probe HTTP journeys if readme+contract exist
  let appHandle = null;
  let endpoints = {};
  let bootError = null;
  const httpJourneys = journeys.filter((j) => j.automation === 'http');

  if (httpJourneys.length > 0 && readme) {
    endpoints = await discoverEndpoints(workspace);
    appHandle = await bootApp({ workspace, timeoutMs: 30_000 });
    if (!appHandle.ok) {
      bootError = appHandle.error ?? 'App failed to boot';
    }
  }

  const journeyResults = [];
  for (const j of journeys) {
    if (j.automation === 'http') {
      if (!readme) {
        journeyResults.push({
          id: j.id,
          status: 'requires-manual-review',
          reason:
            'No README discovered in the workspace. The runner refuses to probe by reading ' +
            'source — that is a family-3 deliverability failure for the lane, not a journey pass.',
        });
        continue;
      }
      if (bootError) {
        journeyResults.push({
          id: j.id,
          status: 'failed',
          reason: `App boot failed: ${bootError}`,
        });
        continue;
      }
      if (appHandle?.ok) {
        // v2: actually probe the endpoint
        const probeResult = await probeJourney({
          journeyId: j.id,
          port: appHandle.port,
          endpoints,
        });
        journeyResults.push(probeResult);
      } else {
        journeyResults.push({
          id: j.id,
          status: 'requires-manual-review',
          reason: 'App not booted and no contract file found.',
        });
      }
    } else {
      journeyResults.push({
        id: j.id,
        status: 'requires-manual-review',
        reason: j.reason ?? 'manual journey',
      });
    }
  }

  // Shut down the app if we booted it
  if (appHandle?.shutdown) {
    await appHandle.shutdown();
  }

  const probeResults = probes.map((p) => ({
    id: p.id,
    status: 'requires-manual-review',
    reason: p.reason ?? 'manual probe',
  }));

  const journeysPassed = journeyResults.filter((r) => r.status === 'passed').length;
  const journeysFailed = journeyResults.filter((r) => r.status === 'failed').length;
  const journeysManual = journeyResults.filter((r) => r.status === 'requires-manual-review').length;

  const report = {
    journeysDeclared: journeys.length,
    journeysPassed,
    journeysFailed,
    journeysRequiringManualReview: journeysManual,
    journeyPassRate:
      journeys.length === 0 ? null : Number((journeysPassed / journeys.length).toFixed(3)),
    persistenceIntegrity: {
      restartSurvivesState:
        probeResults.find((p) => p.id === 'P1')?.status === 'passed'
          ? true
          : probeResults.find((p) => p.id === 'P1')?.status === 'failed'
            ? false
            : null,
      transactionRollback:
        probeResults.find((p) => p.id === 'P2')?.status === 'passed'
          ? true
          : probeResults.find((p) => p.id === 'P2')?.status === 'failed'
            ? false
            : null,
      concurrentWrite:
        probeResults.find((p) => p.id === 'P3')?.status === 'passed'
          ? true
          : probeResults.find((p) => p.id === 'P3')?.status === 'failed'
            ? false
            : null,
    },
    contractViolations: null,
    journeyResults,
    probeResults,
    gateStatus:
      journeysFailed > 0
        ? 'failed'
        : journeysManual === journeys.length
          ? 'pending-manual-review'
          : 'passed',
    evidence: {
      workspace,
      readme,
      contract,
      journeysManifest: JOURNEYS_JSON,
    },
    notes:
      'v1 journey harness. Journeys are not faked: manual-review entries mean the runner cannot ' +
      'yet prove pass or fail. A gate of pending-manual-review should NOT be treated as a pass.',
  };

  if (reportPath) {
    await mkdir(dirname(reportPath), { recursive: true });
    await writeFile(reportPath, JSON.stringify(report, null, 2));
  }
  return report;
}

async function findReadme(workspace) {
  for (const name of ['README.md', 'README', 'readme.md']) {
    const p = join(workspace, name);
    if (existsSync(p)) return p;
  }
  return null;
}

async function findContract(workspace) {
  const candidates = [
    'openapi.yaml',
    'openapi.yml',
    'openapi.json',
    'docs/openapi.yaml',
    'docs/openapi.json',
    'contracts/openapi.yaml',
    'api.yaml',
  ];
  for (const c of candidates) {
    const p = join(workspace, c);
    try {
      const s = await stat(p);
      if (s.isFile()) return p;
    } catch {
      // not present
    }
  }
  return null;
}

// CLI entrypoint.
if (process.argv[1]?.endsWith('run-journey-suite.mjs')) {
  const args = parseFlags(process.argv.slice(2));
  try {
    const report = await runJourneySuite({
      workspace: args.workspace,
      reportPath: args.report,
    });
    if (args.json === 'true' || args.json === '1') {
      process.stdout.write(JSON.stringify(report, null, 2) + '\n');
    } else {
      process.stdout.write(JSON.stringify(report, null, 2) + '\n');
    }
  } catch (err) {
    process.stderr.write(`[run-journey-suite] ${err.message}\n`);
    process.exit(1);
  }
}

function parseFlags(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (!argv[i].startsWith('--')) continue;
    const key = argv[i].slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) out[key] = 'true';
    else {
      out[key] = next;
      i += 1;
    }
  }
  return out;
}
