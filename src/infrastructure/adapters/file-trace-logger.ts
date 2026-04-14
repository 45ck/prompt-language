/**
 * FileTraceLogger — appends trace entries as JSON lines to
 * `.prompt-language/provenance.jsonl`.
 *
 * Mirrors FileAuditLogger: sync append to preserve ordering, directory
 * created lazily on first write. Distinct from the audit log: this captures
 * the Merkle-chained trace of SessionState transitions and agent/shim
 * invocations used for independent verification.
 */

import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { TraceEntry, TraceLogger } from '../../application/ports/trace-logger.js';
import { resolveStateRoot } from './resolve-state-root.js';

export class FileTraceLogger implements TraceLogger {
  private readonly filePath: string;
  private dirEnsured = false;

  constructor(cwd: string, stateDir = '.prompt-language') {
    this.filePath = join(resolveStateRoot(cwd, stateDir), 'provenance.jsonl');
  }

  log(entry: TraceEntry): void {
    if (!this.dirEnsured) {
      mkdirSync(dirname(this.filePath), { recursive: true });
      this.dirEnsured = true;
    }

    // Drop undefined fields so downstream parsers don't see explicit nulls.
    const record: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(entry)) {
      if (value === undefined) continue;
      record[key] = value;
    }

    appendFileSync(this.filePath, JSON.stringify(record) + '\n', 'utf-8');
  }
}
