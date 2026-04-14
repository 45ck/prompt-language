# Tracing and provenance

Operator documentation for the Merkle-chained execution trace and
independent-witness shim. Covers enabling tracing, reading the output,
running the verifier, and interpreting failures.

## Why this exists

The thesis claims the PL runtime drove an evaluation run, not the harness
that launched it. That claim is only credible if a third party can
reproduce, from on-disk artifacts, which nodes advanced, which agent
processes were spawned, and what state was in effect at each step. The
tracing system produces those artifacts.

Unit tests and smoke tests prove the runtime behaves correctly under its
own measurement. Tracing and the shim together prove the runtime was
actually the thing measuring, by forcing two independent observers to
agree before a run is accepted.

## Trust model

Two independent recorders write into the same hash-chained log, and a
verifier refuses to pass unless both sides line up.

- **Runtime recorder.** The PL runtime writes `node_advance`,
  `state_mutation`, `agent_invocation_begin/end`, `run_command`, and gate
  events with `source: "runtime"`. Each entry carries `stateBeforeHash`
  and `stateAfterHash` for the SessionState transition, plus the full
  Merkle chain (`prevEventHash` -> `eventHash`).
- **Shim recorder.** The `pl-agent-shim` wraps every real agent CLI
  (`claude`, `codex`, `gemini`, `ollama`, `opencode`). For each
  invocation it writes `shim_invocation_begin` and `shim_invocation_end`
  with `source: "shim"`, carrying argv, cwd, pid, exit code, binary path
  plus sha256, and sha256 of stdin and stdout. The shim is outside the
  runtime process, so it cannot be bypassed by runtime-only tampering.
- **Verifier.** `scripts/eval/verify-trace.mjs` loads the combined
  JSONL, rebuilds the event chain, and cross-checks runtime and shim
  records by `(pid, argv, stdinSha256)`. It optionally rehashes the
  current state file and requires it to match the last `stateAfterHash`
  in the trace.

An adversary that controls only the runtime cannot add or remove agent
calls without desynchronizing the shim side. An adversary that controls
only the shim cannot fabricate state transitions. The hash chain makes
mid-chain edits detectable.

## Enabling tracing

The runtime emits the trace only when `PL_TRACE=1` is set. Related env
vars:

| Var            | Required                        | Meaning                                                                                        |
| -------------- | ------------------------------- | ---------------------------------------------------------------------------------------------- |
| `PL_TRACE`     | yes (when tracing is wanted)    | Any truthy value enables `FileTraceLogger`. Absence falls back to `NULL_TRACE_LOGGER`.         |
| `PL_RUN_ID`    | recommended                     | Ties shim and runtime entries to the same run. If unset the runtime generates one per flow.    |
| `PL_TRACE_DIR` | no (default `.prompt-language`) | Override the state directory used for `provenance.jsonl`. Path is relative to the runtime cwd. |

For shim-specific env (`PL_REAL_BIN`, `PL_REAL_BIN_<NAME>`,
`PL_SHIM_NAME`) see [`scripts/eval/agent-shim/README.md`](../scripts/eval/agent-shim/README.md).
That README is the source of truth for shim installation; this doc does
not duplicate it.

## Where files land

Under the state root resolved by `resolveStateRoot(cwd, PL_TRACE_DIR)`:

- `provenance.jsonl` — append-only JSONL, one `TraceEntry` per line.
  Both runtime and shim write to the same file.
- `session-state.json` — the authoritative SessionState at the moment
  the runtime last persisted. `verify-trace --state` compares
  `hashState(file)` against the last `stateAfterHash` in the chain.

Both files are stable across runs only if `PL_RUN_ID` is pinned; new
run ids start a fresh chain.

## Event schema

The canonical schema is `src/application/ports/trace-logger.ts`
(runtime side) and `scripts/eval/provenance-schema.mjs` (shim and
verifier side). They are kept byte-identical on purpose: any drift in
canonical-JSON encoding breaks cross-verification.

Do not restate field lists here. The one rule worth repeating: the
fields `_checksum`, `stateHash`, and `prevStateHash` are excluded from
state-hash input, and `eventHash` is excluded from event-hash input. See
`src/domain/state-hash.ts` for the exact canonicalization.

## Running the verifier

```bash
node scripts/eval/verify-trace.mjs \
  --trace .prompt-language/provenance.jsonl \
  --state .prompt-language/session-state.json \
  --json
```

Flags:

- `--trace <path>` (required) — JSONL chain to verify.
- `--state <path>` (optional) — rehash and compare against last
  `stateAfterHash`. Omit only when the run crashed before persisting
  state.
- `--flow <path>` (optional) — reserved for future flow-source hashing.
- `--json` — machine-readable report. Without it the output is a single
  `verify-trace OK` line on success, or an error list on stderr.

Exit codes: `0` pass, `1` verification failure, `2` argument error.

## Troubleshooting

| Symptom                                                           | Likely cause                                                                                                          | Action                                                                                  |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `orphan: agent_invocation_begin=N vs shim_invocation_begin=0`     | Harness bypassed the shim. PATH is not ahead of real binaries, or the harness resolved the real binary directly.      | Confirm shim directory is on PATH first and `PL_REAL_BIN_*` resolves. Rerun.            |
| `orphan: ... shim_invocation_begin=N vs agent_invocation_begin=0` | Runtime did not observe an invocation the shim saw. Likely a side-channel spawn or a runtime path that forgot to log. | Inspect the orphan argv; fix the runtime emitter or the harness, do not edit the trace. |
| `entry N: prevEventHash ... does not match previous eventHash`    | Chain break. Trace was appended to after an edit, a parallel writer interleaved, or a file was concatenated.          | Treat the run as tampered. Re-run from clean state; investigate concurrent writers.     |
| `entry N: eventHash ... does not match recomputed`                | Record was edited without updating its hash, or canonical JSON drifted between writer and verifier.                   | Confirm writer and verifier share canonicalization. Do not manually patch hashes.       |
| `state hash mismatch: trace claims X, state file hashes to Y`     | `session-state.json` was modified after the last trace entry, or crash happened mid-persist.                          | Compare file timestamps. If run crashed, rerun; if edited, reject as tampered.          |
| `multiple runIds present`                                         | Two runs wrote into the same trace file without rotating.                                                             | Set `PL_RUN_ID` per run and isolate `PL_TRACE_DIR`.                                     |
| `trace is empty`                                                  | `PL_TRACE` not set, or the runtime never reached the first node.                                                      | Re-run with `PL_TRACE=1`. Check the harness log for pre-run failures.                   |

A fast-fail on agent auth or login is a host limitation, not a trace
failure. The chain will simply be short. See
[`docs/operations/troubleshooting.md`](operations/troubleshooting.md).

## Recommended CI usage

For any run that participates in the maintenance-viability thesis, wire
three things together:

1. Export `PL_TRACE=1`, a stable `PL_RUN_ID`, and a per-run
   `PL_TRACE_DIR` before launching the harness.
2. Put the shim directory first on `PATH` and set `PL_REAL_BIN_*` for
   every agent the run may invoke. See the shim README for
   Windows `.cmd` stubs and Unix symlink setup.
3. After the run, invoke `verify-trace --trace ... --state ... --json`
   and fail the job on non-zero exit. Archive
   `provenance.jsonl`, `session-state.json`, and the verifier JSON
   report as build artifacts.

Runs that pass verify-trace are admissible as evidence for thesis
claims. Runs that do not pass are discarded, not patched.

## See also

- `src/application/ports/trace-logger.ts` — TraceEntry schema.
- `src/domain/state-hash.ts` — canonicalization and hashing.
- `src/infrastructure/adapters/file-trace-logger.ts` — append semantics.
- `scripts/eval/agent-shim/README.md` — shim install and env contract.
- `scripts/eval/provenance-schema.mjs` — shared verification helpers.
- `docs/thesis-verification.md` — how tracing plugs into the E5 experiment.
