/**
 * AuditLogger — port for recording command execution audit entries.
 *
 * H-SEC-006: Provides a trail of all run commands and gate evaluations
 * for security auditing and debugging.
 */

export interface AuditEntry {
  readonly timestamp: string;
  readonly event: 'run_command' | 'gate_evaluation' | 'node_advance';
  readonly command: string;
  readonly exitCode?: number | undefined;
  readonly timedOut?: boolean | undefined;
  readonly stdout?: string | undefined;
  readonly stderr?: string | undefined;
  readonly nodeId?: string | undefined;
  readonly nodeKind?: string | undefined;
  readonly nodePath?: string | undefined;
  readonly durationMs?: number | undefined;
}

export interface AuditLogger {
  log(entry: AuditEntry): void;
}
