# Thesis verification

Short operator note on how tracing and the independent-witness shim plug
into the E5 maintenance-viability experiment. For setup details see
[`docs/tracing-and-provenance.md`](tracing-and-provenance.md).

## What E5 is trying to show

E5 claims that the PL runtime drives maintenance-style flows across
multiple agent backends at comparable cost and reliability. The claim
is falsifiable only if each measured run can be shown to have actually
executed under the runtime, against the declared flow, with the agent
processes the run reports.

A plain smoke-test pass does not carry that evidential weight. The
harness itself writes the log; nothing forces the log to match reality.

## How tracing closes the gap

For every E5 run the pipeline collects three artifacts and rejects the
run unless they agree:

1. `session-state.json` — the final SessionState the runtime persisted.
2. `provenance.jsonl` — the Merkle-chained trace, co-written by the
   runtime and by the out-of-process shim that wraps every agent CLI.
3. `verify-trace --json` report — exit 0 only if the chain is intact,
   runtime and shim records pair on `(pid, argv, stdinSha256)`, and the
   last `stateAfterHash` matches `hashState(session-state.json)`.

The shim is the critical piece: it observes the real subprocess
boundary from outside the runtime. A runtime that fabricated calls
would produce `agent_invocation_*` records with no matching
`shim_invocation_*` counterpart, and the verifier would flag orphans.
A harness that bypassed the shim would produce the inverse orphan.

## Differential smoke tests (Z-series)

The Z-series smoke tests (Z1 through Z7, see
[`CLAUDE.md`](../CLAUDE.md)) are written so a stub harness cannot pass
them. They depend on live variable propagation, capture-gated
branching, runtime-assigned PIDs, and hash-matched send/receive
content. Each Z-series test is run with tracing enabled, and a run is
only counted as a pass when both the test itself and
`verify-trace` succeed.

This is what lets E5 distinguish "the runtime reports success" from
"the runtime actually executed the flow".

## What a valid E5 record looks like

For each run published in the E5 dataset, the archive contains:

- The flow source that was executed.
- `provenance.jsonl` plus `session-state.json`.
- The verifier JSON report (exit 0).
- The shim binary hashes recorded in the trace, resolvable against a
  pinned build.

Runs without all four artifacts are not eligible for thesis claims.
Runs where the verifier rejects the chain are discarded and the
underlying cause is investigated; the trace is not edited.

## Failure modes that invalidate a result

- Orphan invocations in either direction (harness bypassed shim, or
  runtime fabricated a call).
- Chain break: `prevEventHash` does not match, or `eventHash` is not
  reproducible from canonical JSON.
- State mismatch: the persisted state file does not hash to the last
  `stateAfterHash`.
- Multiple `runId` values in a single trace file.

Any of these is treated as a run that cannot be cited as evidence,
regardless of how the downstream task outcome looks.

## See also

- [`docs/tracing-and-provenance.md`](tracing-and-provenance.md) — full
  operator guide.
- `scripts/eval/verify-trace.mjs` — the verifier CLI.
- `scripts/eval/agent-shim/README.md` — shim installation.
