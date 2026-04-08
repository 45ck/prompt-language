/**
 * FileAuditLogger — appends JSON lines to .prompt-language/audit.jsonl.
 *
 * H-SEC-006: Records all command executions for security auditing.
 */

import { appendFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { AuditLogger, AuditEntry } from '../../application/ports/audit-logger.js';

const AUDIT_TRUNCATE_LIMIT = 500;

function truncate(text: string | undefined): string | undefined {
  if (!text) return undefined;
  const trimmed = text.trimEnd();
  if (!trimmed) return undefined;
  if (trimmed.length <= AUDIT_TRUNCATE_LIMIT) return trimmed;
  return trimmed.slice(0, AUDIT_TRUNCATE_LIMIT) + ' [truncated]';
}

export class FileAuditLogger implements AuditLogger {
  private readonly filePath: string;
  private dirEnsured = false;

  constructor(cwd: string, stateDir = '.prompt-language') {
    this.filePath = join(cwd, stateDir, 'audit.jsonl');
  }

  log(entry: AuditEntry): void {
    if (!this.dirEnsured) {
      const dir = join(this.filePath, '..');
      mkdirSync(dir, { recursive: true });
      this.dirEnsured = true;
    }

    const record: AuditEntry = {
      timestamp: entry.timestamp,
      event: entry.event,
      command: entry.command,
      exitCode: entry.exitCode,
      ...(entry.timedOut ? { timedOut: true } : {}),
      ...(truncate(entry.stdout) != null ? { stdout: truncate(entry.stdout) } : {}),
      ...(truncate(entry.stderr) != null ? { stderr: truncate(entry.stderr) } : {}),
    };

    appendFileSync(this.filePath, JSON.stringify(record) + '\n', 'utf-8');
  }
}
