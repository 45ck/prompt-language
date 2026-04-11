/**
 * AuditLogger — port for recording command execution audit entries.
 *
 * H-SEC-006: Provides a trail of all run commands and gate evaluations
 * for security auditing and debugging.
 */

export interface AuditEntry {
  readonly timestamp: string;
  readonly event:
    | 'run_command'
    | 'gate_evaluation'
    | 'node_advance'
    | 'capture'
    | 'condition_evaluation'
    | 'judgment'
    | 'spawn';
  readonly command: string;
  readonly exitCode?: number | undefined;
  readonly timedOut?: boolean | undefined;
  readonly stdout?: string | undefined;
  readonly stderr?: string | undefined;
  readonly nodeId?: string | undefined;
  readonly nodeKind?: string | undefined;
  readonly nodePath?: string | undefined;
  readonly durationMs?: number | undefined;
  readonly condition?: string | undefined;
  readonly outcome?: string | undefined;
  readonly phase?: string | undefined;
  readonly variableName?: string | undefined;
  readonly retryCount?: number | undefined;
  readonly maxRetries?: number | undefined;
  readonly judgeName?: string | undefined;
  readonly childName?: string | undefined;
  readonly pid?: number | undefined;
  readonly reason?: string | undefined;
}

export interface AuditLogger {
  log(entry: AuditEntry): void;
}
