/**
 * AuditLogger — port for recording command execution audit entries.
 *
 * H-SEC-006: Provides a trail of all run commands and gate evaluations
 * for security auditing and debugging.
 */

export interface AuditEntry {
  readonly timestamp: string;
  readonly event: 'run_command' | 'gate_evaluation';
  readonly command: string;
  readonly exitCode: number;
  readonly stdout?: string | undefined;
  readonly stderr?: string | undefined;
}

export interface AuditLogger {
  log(entry: AuditEntry): void;
}
