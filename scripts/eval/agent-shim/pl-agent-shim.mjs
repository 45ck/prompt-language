#!/usr/bin/env node
/**
 * pl-agent-shim: independent-witness wrapper for agent binaries.
 *
 * The shim records invocation metadata (argv, cwd, stdin/stdout hashes, pid,
 * exit code, duration) to a chained JSONL trace, then execs the real binary
 * transparently. The PL runtime emits its own trace of what it believes it
 * did; a verifier cross-checks the two sides to catch fabrication.
 *
 * Env contract:
 *   PL_RUN_ID      (required) run id shared with the runtime trace
 *   PL_TRACE_DIR   (optional, default ".prompt-language") directory for provenance.jsonl
 *   PL_REAL_BIN    (required) absolute path to the real binary to exec
 *   PL_SHIM_NAME   (optional) short identity for diagnostics
 */

import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  appendFileSync,
  statSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalJSON, hashEvent } from '../provenance-schema.mjs';

const SHIM_DIR = dirname(fileURLToPath(import.meta.url));
const BINARY_CACHE_PATH = join(SHIM_DIR, '.binary-cache.json');

function fail(code, msg) {
  process.stderr.write(`[pl-agent-shim] ${msg}\n`);
  process.exit(code);
}

function toPosix(p) {
  return p.replace(/\\/g, '/');
}

function readBinaryCache() {
  try {
    const raw = readFileSync(BINARY_CACHE_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') return parsed;
  } catch {
    /* noop */
  }
  return {};
}

function writeBinaryCache(cache) {
  try {
    writeFileSync(BINARY_CACHE_PATH, JSON.stringify(cache, null, 2), 'utf8');
  } catch {
    /* noop — cache is best effort */
  }
}

function binarySha256(absPath) {
  const cache = readBinaryCache();
  let mtimeMs = 0;
  try {
    mtimeMs = statSync(absPath).mtimeMs;
  } catch (err) {
    fail(3, `cannot stat PL_REAL_BIN (${absPath}): ${err.message}`);
  }
  const cached = cache[absPath];
  if (cached && cached.mtimeMs === mtimeMs && typeof cached.sha256 === 'string') {
    return cached.sha256;
  }
  const buf = readFileSync(absPath);
  const digest = createHash('sha256').update(buf).digest('hex');
  cache[absPath] = { mtimeMs, sha256: digest };
  writeBinaryCache(cache);
  return digest;
}

function readStdinToBuffer() {
  return new Promise((resolvePromise) => {
    if (process.stdin.isTTY) {
      resolvePromise(Buffer.alloc(0));
      return;
    }
    const chunks = [];
    process.stdin.on('data', (c) => chunks.push(c));
    process.stdin.on('end', () => resolvePromise(Buffer.concat(chunks)));
    process.stdin.on('error', () => resolvePromise(Buffer.concat(chunks)));
  });
}

function lastEntry(tracePath) {
  if (!existsSync(tracePath)) return null;
  const raw = readFileSync(tracePath, 'utf8');
  if (!raw) return null;
  const lines = raw.split(/\r?\n/).filter((l) => l.length > 0);
  if (lines.length === 0) return null;
  try {
    return JSON.parse(lines[lines.length - 1]);
  } catch {
    return null;
  }
}

function appendEntry(tracePath, entry) {
  mkdirSync(dirname(tracePath), { recursive: true });
  appendFileSync(tracePath, `${canonicalJSON(entry)}\n`, 'utf8');
}

async function main() {
  const runId = process.env.PL_RUN_ID;
  if (!runId) fail(2, 'PL_RUN_ID is required');
  const traceDir = resolve(process.cwd(), process.env.PL_TRACE_DIR || '.prompt-language');
  const tracePath = join(traceDir, 'provenance.jsonl');
  const realBin = process.env.PL_REAL_BIN;
  if (!realBin) fail(2, 'PL_REAL_BIN is required');
  const realBinAbs = resolve(realBin);
  if (!existsSync(realBinAbs)) fail(3, `PL_REAL_BIN not found: ${realBinAbs}`);
  const shimName = process.env.PL_SHIM_NAME || 'pl-agent-shim';

  const argv = process.argv.slice(2);
  const cwd = toPosix(process.cwd());
  const pid = process.pid;

  const stdinBuf = await readStdinToBuffer();
  const stdinSha256 = createHash('sha256').update(stdinBuf).digest('hex');
  const binSha = binarySha256(realBinAbs);

  // ---- begin entry ----
  const prevBegin = lastEntry(tracePath);
  const beginSeq = prevBegin ? prevBegin.seq + 1 : 0;
  const beginEntry = {
    runId,
    seq: beginSeq,
    timestamp: new Date().toISOString(),
    event: 'shim_invocation_begin',
    source: 'shim',
    pid,
    argv,
    cwd,
    stdinSha256,
    binaryPath: toPosix(realBinAbs),
    binarySha256: binSha,
    prevEventHash: prevBegin ? prevBegin.eventHash : null,
    shimName,
  };
  beginEntry.eventHash = hashEvent(beginEntry);
  appendEntry(tracePath, beginEntry);

  // ---- spawn real binary ----
  const started = Date.now();
  const child = spawn(realBinAbs, argv, {
    stdio: ['pipe', 'pipe', 'inherit'],
    windowsHide: true,
  });

  const stdoutHasher = createHash('sha256');
  child.stdout.on('data', (chunk) => {
    stdoutHasher.update(chunk);
    process.stdout.write(chunk);
  });

  if (stdinBuf.length > 0) child.stdin.write(stdinBuf);
  child.stdin.end();

  const exitCode = await new Promise((resolveExit) => {
    child.on('close', (code) => resolveExit(code == null ? 0 : code));
    child.on('error', (err) => {
      process.stderr.write(`[pl-agent-shim] spawn error: ${err.message}\n`);
      resolveExit(127);
    });
  });
  const durationMs = Date.now() - started;
  const stdoutSha256 = stdoutHasher.digest('hex');

  // ---- end entry (re-read tail in case other shims appended in parallel) ----
  const prevEnd = lastEntry(tracePath);
  const endSeq = prevEnd ? prevEnd.seq + 1 : beginSeq + 1;
  const endEntry = {
    runId,
    seq: endSeq,
    timestamp: new Date().toISOString(),
    event: 'shim_invocation_end',
    source: 'shim',
    pid,
    argv,
    cwd,
    stdinSha256,
    stdoutSha256,
    binaryPath: toPosix(realBinAbs),
    binarySha256: binSha,
    exitCode,
    durationMs,
    prevEventHash: prevEnd ? prevEnd.eventHash : beginEntry.eventHash,
    shimName,
  };
  endEntry.eventHash = hashEvent(endEntry);
  appendEntry(tracePath, endEntry);

  process.exit(exitCode);
}

main().catch((err) => {
  fail(1, `uncaught: ${err && err.stack ? err.stack : String(err)}`);
});
