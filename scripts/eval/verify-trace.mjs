#!/usr/bin/env node
/**
 * verify-trace: cross-check the runtime + shim provenance chain.
 *
 * Usage:
 *   node scripts/eval/verify-trace.mjs --trace <provenance.jsonl> [--state <session-state.json>] [--flow <path>] [--json]
 *
 * Checks:
 *   a. Single runId across all entries.
 *   b. seq strictly monotonic starting from the first entry.
 *   c. prevEventHash chain unbroken; every eventHash is reproducible.
 *   d. Every agent_invocation_begin has a matching shim_invocation_begin
 *      with same pid, argv, and stdinSha256; same for _end.
 *   e. (If --state given) the last stateAfterHash in the chain equals
 *      hashState of the state file contents.
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { canonicalJSON, hashEvent, hashState, verifyChain } from './provenance-schema.mjs';

function parseArgs(argv) {
  const out = { trace: null, state: null, flow: null, json: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--trace') out.trace = argv[++i];
    else if (a === '--state') out.state = argv[++i];
    else if (a === '--flow') out.flow = argv[++i];
    else if (a === '--json') out.json = true;
    else if (a === '--help' || a === '-h') {
      process.stdout.write(
        'Usage: verify-trace --trace <provenance.jsonl> [--state <session-state.json>] [--flow <path>] [--json]\n',
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
  // Pair runtime agent_invocation_* with shim_invocation_* by pid + argv + stdinSha256.
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

function findLastStateAfterHash(entries) {
  for (let i = entries.length - 1; i >= 0; i -= 1) {
    const h = entries[i].stateAfterHash;
    if (typeof h === 'string' && h.length > 0) return h;
  }
  return null;
}

function report(result, asJson) {
  if (asJson) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }
  if (result.ok) {
    process.stdout.write(
      `verify-trace OK: ${result.entryCount} entries, ${result.runtimePairs} runtime/shim pairs, runId=${result.runId}\n`,
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
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.trace) {
    process.stderr.write('verify-trace: --trace is required\n');
    process.exit(2);
  }
  const tracePath = resolve(args.trace);
  const result = {
    ok: true,
    entryCount: 0,
    runtimePairs: 0,
    runId: null,
    errors: [],
    orphans: [],
  };

  let entries;
  try {
    entries = loadTrace(tracePath);
  } catch (err) {
    report({ ok: false, errors: [err.message], orphans: [] }, args.json);
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
  result.runtimePairs = entries.filter((e) => e.event === 'agent_invocation_begin').length;

  // (e) optional state cross-check
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
