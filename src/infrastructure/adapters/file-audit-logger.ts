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
      ...(entry.exitCode !== undefined ? { exitCode: entry.exitCode } : {}),
      ...(entry.timedOut ? { timedOut: true } : {}),
      ...(truncate(entry.stdout) != null ? { stdout: truncate(entry.stdout) } : {}),
      ...(truncate(entry.stderr) != null ? { stderr: truncate(entry.stderr) } : {}),
      ...(entry.nodeId != null ? { nodeId: entry.nodeId } : {}),
      ...(entry.nodeKind != null ? { nodeKind: entry.nodeKind } : {}),
      ...(entry.nodePath != null ? { nodePath: entry.nodePath } : {}),
      ...(entry.durationMs != null ? { durationMs: entry.durationMs } : {}),
      ...(entry.condition != null ? { condition: entry.condition } : {}),
      ...(entry.outcome != null ? { outcome: entry.outcome } : {}),
      ...(entry.phase != null ? { phase: entry.phase } : {}),
      ...(entry.variableName != null ? { variableName: entry.variableName } : {}),
      ...(entry.retryCount != null ? { retryCount: entry.retryCount } : {}),
      ...(entry.maxRetries != null ? { maxRetries: entry.maxRetries } : {}),
      ...(entry.judgeName != null ? { judgeName: entry.judgeName } : {}),
      ...(entry.childName != null ? { childName: entry.childName } : {}),
      ...(entry.pid != null ? { pid: entry.pid } : {}),
      ...(entry.reason != null ? { reason: entry.reason } : {}),
    };

    appendFileSync(this.filePath, JSON.stringify(record) + '\n', 'utf-8');
  }
}
