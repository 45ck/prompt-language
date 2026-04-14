/**
 * TraceLogger — port for recording verifiable execution trace entries.
 *
 * Distinct from AuditLogger: the trace is a Merkle-chained record of
 * SessionState transitions plus agent-binary invocations, used to
 * independently prove that a flow ran as the runtime claims. Any tamper with
 * a mid-chain entry invalidates prevEventHash on the next entry.
 *
 * One runId per PL flow invocation; seq is strictly increasing within a run.
 */

export type TraceEvent =
  | 'node_advance'
  | 'state_mutation'
  | 'hook_fire'
  | 'hook_complete'
  | 'agent_invocation_begin'
  | 'agent_invocation_end'
  | 'shim_invocation_begin'
  | 'shim_invocation_end'
  | 'gate_evaluation'
  | 'run_command';

export type TraceSource = 'runtime' | 'hook' | 'shim' | 'adapter';

export interface TraceEntry {
  readonly runId: string;
  readonly seq: number;
  readonly timestamp: string;
  readonly event: TraceEvent;
  readonly source: TraceSource;
  readonly pid: number;
  readonly nodeId?: string | undefined;
  readonly nodeKind?: string | undefined;
  readonly nodePath?: string | undefined;
  readonly stateBeforeHash?: string | undefined;
  readonly stateAfterHash?: string | undefined;
  readonly argv?: readonly string[] | undefined;
  readonly cwd?: string | undefined;
  readonly stdinSha256?: string | undefined;
  readonly stdoutSha256?: string | undefined;
  readonly binaryPath?: string | undefined;
  readonly binarySha256?: string | undefined;
  readonly exitCode?: number | undefined;
  readonly durationMs?: number | undefined;
  readonly prevEventHash?: string | undefined;
  readonly eventHash?: string | undefined;
  readonly detail?: Readonly<Record<string, string | number | boolean>> | undefined;
}

export interface TraceLogger {
  log(entry: TraceEntry): void;
}

export const NULL_TRACE_LOGGER: TraceLogger = {
  log: () => {
    // no-op; used when tracing is disabled
  },
};
