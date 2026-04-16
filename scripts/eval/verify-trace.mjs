#!/usr/bin/env node
/**
 * verify-trace: cross-check the runtime + shim provenance chain.
 *
 * Usage:
 *   node scripts/eval/verify-trace.mjs --trace <provenance.jsonl> --state <session-state.json> [options]
 *
 * Required flags:
 *   --trace <path>                  Provenance JSONL file to verify.
 *   --state <path>                  Session state file. Mandatory unless
 *                                   --allow-missing-state is explicitly passed.
 *
 * Hardening flags (see docs/security/witness-chain-attacks.md):
 *   --allow-missing-state           Explicit opt-out for --state. The OK line
 *                                   will include "(state-check-skipped)".
 *   --expected-run-id <id>          Reject if any entry's runId differs.
 *   --freshness-window-ms <N>       Reject if first entry's timestamp is
 *                                   outside now() +/- N ms.
 *   --expected-pair-count <N>       Reject if count of runtime/shim pairs != N.
 *   --min-entries <N>               Reject if total entry count < N.
 *   --expected-reviewer-family <id> Reject unless trace evidence carries a
 *                                   consistent reviewer.family matching <id>.
 *   --expected-binary-hashes <file> JSON file { binaryName: [sha256, ...] }.
 *                                   Reject shim_invocation_* entries whose
 *                                   binarySha256 is not in the allow-list.
 *   --attestation <path>            Detached attestation.json for the bundle.
 *   --require-attestation           Reject unless --attestation verifies.
 *   --trusted-signers <path>        Trusted signer registry. Defaults to
 *                                   docs/security/trusted-signers.json.
 *   --revoked-signers <path>        Revoked signer registry. Defaults to
 *                                   docs/security/revoked-signers.json.
 *   --require-role <role>           Require attestation signerRole to match.
 *
 * Misc:
 *   --flow <path>                   Informational only (reserved).
 *   --json                          Emit machine-readable JSON result.
 *
 * Checks:
 *   a. Single runId across all entries; optionally == --expected-run-id.
 *   b. seq strictly monotonic starting from the first entry.
 *   c. prevEventHash chain unbroken; every eventHash is reproducible.
 *   d. Every agent_invocation_begin has a matching shim_invocation_begin
 *      with same pid, argv, stdinSha256; same for _end. If both sides of
 *      a pair happen to carry a binarySha256, they must agree.
 *   e. (Default) the last stateAfterHash in the chain equals hashState of
 *      the supplied state file contents.
 *   f. (Optional) first entry timestamp within --freshness-window-ms.
 *   g. (Optional) exactly --expected-pair-count runtime/shim pairs.
 *   h. (Optional) at least --min-entries total entries.
 *   i. (Optional) trace evidence carries reviewer.family == --expected-reviewer-family.
 *   j. (Optional) every shim binarySha256 is in --expected-binary-hashes.
 *   k. (Optional) detached attestation signature verifies, signer is trusted,
 *      non-revoked, and payload matches bundle artifacts.
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve, basename } from 'node:path';
import { canonicalJSON, hashEvent, hashState, verifyChain } from './provenance-schema.mjs';
import {
  buildBundlePayload,
  DEFAULT_REVOKED_SIGNERS_PATH,
  DEFAULT_TRUSTED_SIGNERS_PATH,
  verifyAttestationAgainstBundle,
} from '../experiments/meta/attestation-lib.mjs';

function parseArgs(argv) {
  const out = {
    trace: null,
    state: null,
    allowMissingState: false,
    expectedRunId: null,
    freshnessWindowMs: null,
    expectedPairCount: null,
    minEntries: null,
    expectedReviewerFamily: null,
    expectedBinaryHashes: null,
    attestation: null,
    requireAttestation: false,
    trustedSigners: DEFAULT_TRUSTED_SIGNERS_PATH,
    revokedSigners: DEFAULT_REVOKED_SIGNERS_PATH,
    requireRole: null,
    flow: null,
    json: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--trace') out.trace = argv[++i];
    else if (a === '--state') out.state = argv[++i];
    else if (a === '--allow-missing-state') out.allowMissingState = true;
    else if (a === '--expected-run-id') out.expectedRunId = argv[++i];
    else if (a === '--freshness-window-ms') out.freshnessWindowMs = Number(argv[++i]);
    else if (a === '--expected-pair-count') out.expectedPairCount = Number(argv[++i]);
    else if (a === '--min-entries') out.minEntries = Number(argv[++i]);
    else if (a === '--expected-reviewer-family') out.expectedReviewerFamily = argv[++i];
    else if (a === '--expected-binary-hashes') out.expectedBinaryHashes = argv[++i];
    else if (a === '--attestation') out.attestation = argv[++i];
    else if (a === '--require-attestation') out.requireAttestation = true;
    else if (a === '--trusted-signers') out.trustedSigners = argv[++i];
    else if (a === '--revoked-signers') out.revokedSigners = argv[++i];
    else if (a === '--require-role') out.requireRole = argv[++i];
    else if (a === '--flow') out.flow = argv[++i];
    else if (a === '--json') out.json = true;
    else if (a === '--help' || a === '-h') {
      process.stdout.write(
        'Usage: verify-trace --trace <provenance.jsonl> --state <session-state.json> [options]\n' +
          '       (pass --allow-missing-state to opt out of --state)\n' +
          'Options:\n' +
          '  --expected-run-id <id>\n' +
          '  --freshness-window-ms <N>\n' +
          '  --expected-pair-count <N>\n' +
          '  --min-entries <N>\n' +
          '  --expected-reviewer-family <family>\n' +
          '  --expected-binary-hashes <file>\n' +
          '  --attestation <file>\n' +
          '  --require-attestation\n' +
          `  --trusted-signers <file> (default ${DEFAULT_TRUSTED_SIGNERS_PATH})\n` +
          `  --revoked-signers <file> (default ${DEFAULT_REVOKED_SIGNERS_PATH})\n` +
          '  --require-role <operator|ci>\n' +
          '  --json\n',
      );
      process.exit(0);
    }
  }
  return out;
}

function loadTrace(path) {
  if (!existsSync(path)) throw new Error(`trace file not found: ${path}`);
  const raw = readFileSync(path, 'utf8');
  const entries = [];
  const lines = raw.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line) continue;
    try {
      entries.push(JSON.parse(line));
    } catch (err) {
      throw new Error(`trace line ${i + 1} is not valid JSON: ${err.message}`);
    }
  }
  return entries;
}

function pairKey(entry) {
  // Pair runtime agent_invocation_* with shim_invocation_* by
  // pid + argv + stdinSha256. binarySha256 is enforced separately
  // (AP-3) via --expected-binary-hashes plus a per-pair agreement check
  // (checkBinaryAgreement). Including binarySha256 in pairKey unconditionally
  // is not yet safe because the runtime-side adapter does not populate it;
  // see the TODO noted in docs/security/witness-chain-attacks.md patch #4.
  return JSON.stringify({
    pid: entry.pid,
    argv: entry.argv || null,
    stdinSha256: entry.stdinSha256 || null,
  });
}

function checkWitnessPairing(entries) {
  const orphans = [];
  const runtimeBegins = new Map();
  const shimBegins = new Map();
  const runtimeEnds = new Map();
  const shimEnds = new Map();

  const push = (map, key, entry) => {
    const arr = map.get(key) || [];
    arr.push(entry);
    map.set(key, arr);
  };

  for (const e of entries) {
    const key = pairKey(e);
    if (e.event === 'agent_invocation_begin') push(runtimeBegins, key, e);
    else if (e.event === 'shim_invocation_begin') push(shimBegins, key, e);
    else if (e.event === 'agent_invocation_end') push(runtimeEnds, key, e);
    else if (e.event === 'shim_invocation_end') push(shimEnds, key, e);
  }

  const compare = (left, right, leftLabel, rightLabel) => {
    for (const [key, arr] of left.entries()) {
      const counter = right.get(key) || [];
      if (counter.length !== arr.length) {
        orphans.push({
          key,
          leftLabel,
          leftCount: arr.length,
          rightLabel,
          rightCount: counter.length,
          sampleSeq: arr[0]?.seq,
        });
      }
    }
    for (const [key, arr] of right.entries()) {
      if (!left.has(key)) {
        orphans.push({
          key,
          leftLabel,
          leftCount: 0,
          rightLabel,
          rightCount: arr.length,
          sampleSeq: arr[0]?.seq,
        });
      }
    }
  };

  compare(runtimeBegins, shimBegins, 'agent_invocation_begin', 'shim_invocation_begin');
  compare(runtimeEnds, shimEnds, 'agent_invocation_end', 'shim_invocation_end');
  return orphans;
}

function checkBinaryAgreement(entries) {
  // For each pair-key, if BOTH a runtime-side entry and a shim-side entry
  // carry a binarySha256, they must agree. This closes the AP-3 gap when
  // the runtime adapter eventually emits binarySha256, while keeping
  // compatibility with the current runtime that does not.
  const byKey = new Map();
  for (const e of entries) {
    if (
      e.event !== 'agent_invocation_begin' &&
      e.event !== 'agent_invocation_end' &&
      e.event !== 'shim_invocation_begin' &&
      e.event !== 'shim_invocation_end'
    ) {
      continue;
    }
    const key = pairKey(e);
    const bucket = byKey.get(key) || { runtime: new Set(), shim: new Set() };
    const side = e.event.startsWith('shim_') ? 'shim' : 'runtime';
    if (typeof e.binarySha256 === 'string' && e.binarySha256.length > 0) {
      bucket[side].add(e.binarySha256);
    }
    byKey.set(key, bucket);
  }
  const mismatches = [];
  for (const [key, bucket] of byKey.entries()) {
    if (bucket.runtime.size === 0 || bucket.shim.size === 0) continue;
    const runtime = [...bucket.runtime];
    const shim = [...bucket.shim];
    if (runtime.length !== 1 || shim.length !== 1 || runtime[0] !== shim[0]) {
      mismatches.push({ key, runtime, shim });
    }
  }
  return mismatches;
}

function findLastStateAfterHash(entries) {
  for (let i = entries.length - 1; i >= 0; i -= 1) {
    const h = entries[i].stateAfterHash;
    if (typeof h === 'string' && h.length > 0) return h;
  }
  return null;
}

function getReviewerFamilyEvidence(entry) {
  const candidates = [
    entry?.evidence?.reviewer?.family,
    entry?.reviewer?.family,
    entry?.review?.reviewerFamily,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      return candidate.trim();
    }
  }
  return null;
}

function checkExpectedReviewerFamily(entries, expectedFamily) {
  const observed = new Set();
  for (const entry of entries) {
    const family = getReviewerFamilyEvidence(entry);
    if (family) observed.add(family);
  }
  if (observed.size === 0) {
    return {
      ok: false,
      error: 'expected-reviewer-family-missing: no reviewer.family evidence found in trace entries',
    };
  }
  if (observed.size > 1) {
    return {
      ok: false,
      error: `expected-reviewer-family-conflict: multiple reviewer.family values present (${[...observed].join(', ')})`,
    };
  }
  const [actual] = observed;
  if (actual !== expectedFamily) {
    return {
      ok: false,
      error: `expected-reviewer-family-mismatch: trace carries reviewer.family=${actual}, expected ${expectedFamily}`,
    };
  }
  return { ok: true, reviewerFamily: actual };
}

function loadBinaryAllowList(filePath) {
  if (!existsSync(filePath)) {
    throw new Error(`binary allow-list file not found: ${filePath}`);
  }
  const raw = readFileSync(filePath, 'utf8');
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(`binary allow-list is not valid JSON: ${err.message}`);
  }
  if (parsed == null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('binary allow-list must be a JSON object mapping binary names to hash arrays');
  }
  const out = new Map();
  for (const [name, hashes] of Object.entries(parsed)) {
    if (name.startsWith('_')) continue; // allow-list may carry _comment etc.
    if (!Array.isArray(hashes)) {
      throw new Error(`binary allow-list entry for "${name}" must be an array of sha256 strings`);
    }
    out.set(name, new Set(hashes));
  }
  return out;
}

function shimBinaryName(entry) {
  if (typeof entry.binaryPath === 'string' && entry.binaryPath.length > 0) {
    const base = basename(entry.binaryPath);
    return base.replace(/\.(exe|cmd|bat)$/i, '');
  }
  if (typeof entry.shimName === 'string') return entry.shimName;
  return null;
}

function checkBinaryHashes(entries, allowList) {
  const failures = [];
  for (const e of entries) {
    if (e.event !== 'shim_invocation_begin' && e.event !== 'shim_invocation_end') continue;
    const name = shimBinaryName(e);
    const hash = e.binarySha256;
    if (!hash) {
      failures.push({ seq: e.seq, name, reason: 'missing-binarySha256' });
      continue;
    }
    if (!name) {
      failures.push({ seq: e.seq, name: null, hash, reason: 'missing-binary-name' });
      continue;
    }
    const allowed = allowList.get(name);
    if (!allowed || !allowed.has(hash)) {
      failures.push({ seq: e.seq, name, hash, reason: 'binary-hash-not-allowed' });
    }
  }
  return failures;
}

function report(result, asJson) {
  if (asJson) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }
  if (result.ok) {
    const suffix = result.stateCheckSkipped ? ' (state-check-skipped)' : '';
    const attestationSuffix = result.attestation
      ? `, attested-by=${result.attestation.signer} role=${result.attestation.signerRole}`
      : '';
    process.stdout.write(
      `verify-trace OK: ${result.entryCount} entries, ${result.runtimePairs} runtime/shim pairs, runId=${result.runId}${attestationSuffix}${suffix}\n`,
    );
    return;
  }
  process.stderr.write(`verify-trace FAILED\n`);
  for (const err of result.errors) {
    process.stderr.write(`  - ${err}\n`);
  }
  for (const o of result.orphans || []) {
    process.stderr.write(
      `  orphan: ${o.leftLabel}=${o.leftCount} vs ${o.rightLabel}=${o.rightCount} (seq~${o.sampleSeq}) key=${o.key}\n`,
    );
  }
  for (const b of result.binaryHashFailures || []) {
    process.stderr.write(
      `  binary: ${b.reason} seq=${b.seq} name=${b.name ?? '?'} hash=${b.hash ?? '?'}\n`,
    );
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.trace) {
    process.stderr.write('verify-trace: --trace is required\n');
    process.exit(2);
  }
  if (args.requireRole && args.requireRole !== 'operator' && args.requireRole !== 'ci') {
    process.stderr.write('verify-trace: --require-role must be "operator" or "ci"\n');
    process.exit(2);
  }
  if (args.requireAttestation && !args.attestation) {
    report(
      {
        ok: false,
        errors: ['attestation required but absent'],
        orphans: [],
        binaryHashFailures: [],
      },
      args.json,
    );
    process.exit(1);
  }

  // AP-1/AP-2: --state mandatory unless explicitly opted out.
  if (!args.state && !args.allowMissingState) {
    process.stderr.write(
      'verify-trace: --state is required; pass --allow-missing-state to opt out explicitly\n',
    );
    process.exit(2);
  }

  const tracePath = resolve(args.trace);
  const result = {
    ok: true,
    entryCount: 0,
    runtimePairs: 0,
    runId: null,
    stateCheckSkipped: false,
    errors: [],
    orphans: [],
    binaryHashFailures: [],
    attestation: null,
  };

  let entries;
  try {
    entries = loadTrace(tracePath);
  } catch (err) {
    report({ ok: false, errors: [err.message], orphans: [], binaryHashFailures: [] }, args.json);
    process.exit(1);
  }
  result.entryCount = entries.length;
  if (entries.length === 0) {
    result.ok = false;
    result.errors.push('trace is empty');
  }

  // (a) single runId
  const runIds = new Set(entries.map((e) => e.runId));
  if (runIds.size > 1) {
    result.ok = false;
    result.errors.push(`multiple runIds present: ${[...runIds].join(', ')}`);
  } else if (runIds.size === 1) {
    result.runId = [...runIds][0];
  }

  // AP-5: expected runId nonce
  if (args.expectedRunId !== null) {
    for (const e of entries) {
      if (e.runId !== args.expectedRunId) {
        result.ok = false;
        result.errors.push(
          `expected-runId-mismatch: entry seq=${e.seq} has runId=${e.runId}, expected ${args.expectedRunId}`,
        );
        break;
      }
    }
  }

  // AP-5: freshness window
  if (
    args.freshnessWindowMs !== null &&
    !Number.isNaN(args.freshnessWindowMs) &&
    entries.length > 0
  ) {
    const first = entries[0];
    const ts = Date.parse(first.timestamp);
    if (Number.isNaN(ts)) {
      result.ok = false;
      result.errors.push(
        `freshness-window: first entry timestamp "${first.timestamp}" is not parseable`,
      );
    } else {
      const now = Date.now();
      const delta = Math.abs(now - ts);
      if (delta > args.freshnessWindowMs) {
        result.ok = false;
        result.errors.push(
          `freshness-window-exceeded: first entry timestamp is ${delta}ms from now (window=${args.freshnessWindowMs}ms)`,
        );
      }
    }
  }

  // (b, c) chain verification
  const chain = verifyChain(entries);
  if (!chain.ok) {
    result.ok = false;
    result.errors.push(`chain: ${chain.error}`);
  }

  // (d) witness pairing
  const orphans = checkWitnessPairing(entries);
  if (orphans.length > 0) {
    result.ok = false;
    result.errors.push(`witness pairing has ${orphans.length} orphan group(s)`);
    result.orphans = orphans;
  }
  const binaryDisagreements = checkBinaryAgreement(entries);
  if (binaryDisagreements.length > 0) {
    result.ok = false;
    result.errors.push(
      `binary-hash-disagreement: ${binaryDisagreements.length} pair(s) with mismatched runtime vs shim binarySha256`,
    );
    result.binaryDisagreements = binaryDisagreements;
  }
  result.runtimePairs = entries.filter((e) => e.event === 'agent_invocation_begin').length;

  // AP-8: expected pair count
  if (args.expectedPairCount !== null && !Number.isNaN(args.expectedPairCount)) {
    if (result.runtimePairs !== args.expectedPairCount) {
      result.ok = false;
      result.errors.push(
        `expected-pair-count-mismatch: trace has ${result.runtimePairs} runtime/shim pairs, expected ${args.expectedPairCount}`,
      );
    }
  }

  // AP-8: min entries
  if (args.minEntries !== null && !Number.isNaN(args.minEntries)) {
    if (result.entryCount < args.minEntries) {
      result.ok = false;
      result.errors.push(
        `min-entries-not-met: trace has ${result.entryCount} entries, need at least ${args.minEntries}`,
      );
    }
  }

  if (args.expectedReviewerFamily !== null) {
    const reviewerFamilyCheck = checkExpectedReviewerFamily(entries, args.expectedReviewerFamily);
    if (!reviewerFamilyCheck.ok) {
      result.ok = false;
      result.errors.push(reviewerFamilyCheck.error);
    } else {
      result.reviewerFamily = reviewerFamilyCheck.reviewerFamily;
    }
  }

  // AP-3: binary hash allow-list
  if (args.expectedBinaryHashes) {
    try {
      const allowList = loadBinaryAllowList(resolve(args.expectedBinaryHashes));
      const failures = checkBinaryHashes(entries, allowList);
      if (failures.length > 0) {
        result.ok = false;
        result.errors.push(
          `binary-hash-not-allowed: ${failures.length} shim entr${failures.length === 1 ? 'y' : 'ies'} failed allow-list`,
        );
        result.binaryHashFailures = failures;
      }
    } catch (err) {
      result.ok = false;
      result.errors.push(`binary-allow-list: ${err.message}`);
    }
  }

  // (e) state cross-check (AP-1/AP-2)
  if (args.state) {
    const statePath = resolve(args.state);
    if (!existsSync(statePath)) {
      result.ok = false;
      result.errors.push(`state file not found: ${statePath}`);
    } else {
      try {
        const raw = readFileSync(statePath, 'utf8');
        const state = JSON.parse(raw);
        const computed = hashState(state);
        const claimed = findLastStateAfterHash(entries);
        if (!claimed) {
          result.ok = false;
          result.errors.push('no stateAfterHash present in trace to compare against --state');
        } else if (claimed !== computed) {
          result.ok = false;
          result.errors.push(
            `state hash mismatch: trace claims ${claimed}, state file hashes to ${computed}`,
          );
        }
      } catch (err) {
        result.ok = false;
        result.errors.push(`cannot read/parse state file: ${err.message}`);
      }
    }
  } else if (args.allowMissingState) {
    result.stateCheckSkipped = true;
  }

  if (args.attestation) {
    try {
      const attestationPath = resolve(args.attestation);
      if (!existsSync(attestationPath)) {
        throw new Error(`attestation file not found: ${attestationPath}`);
      }
      const bundleDir = dirname(attestationPath);
      const attestation = JSON.parse(readFileSync(attestationPath, 'utf8'));
      const { payload: bundlePayload } = buildBundlePayload({
        bundleDir,
        tracePath,
        statePath: args.state ? resolve(args.state) : resolve(bundleDir, 'session-state.json'),
      });
      result.attestation = verifyAttestationAgainstBundle({
        attestation,
        bundlePayload,
        trustedSignersPath: resolve(args.trustedSigners),
        revokedSignersPath: resolve(args.revokedSigners),
        requireRole: args.requireRole,
        expectedRunId: args.expectedRunId,
        expectedPairCount:
          args.expectedPairCount !== null && !Number.isNaN(args.expectedPairCount)
            ? args.expectedPairCount
            : null,
        freshnessWindowMs:
          args.freshnessWindowMs !== null && !Number.isNaN(args.freshnessWindowMs)
            ? args.freshnessWindowMs
            : null,
      });
    } catch (err) {
      result.ok = false;
      result.errors.push(err.message);
    }
  }

  report(result, args.json);
  process.exit(result.ok ? 0 : 1);
}

main().catch((err) => {
  process.stderr.write(`verify-trace: uncaught ${err.stack || err.message}\n`);
  process.exit(1);
});

// Suppress unused import warning; canonicalJSON and hashEvent are kept exported
// for future inline recomputation/debugging scenarios.
void canonicalJSON;
void hashEvent;
