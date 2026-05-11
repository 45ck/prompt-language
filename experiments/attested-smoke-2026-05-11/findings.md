---
title: Attested smoke — findings
status: ad-hoc evidence — non-claim-eligible per program-status §3a
operator: 45ck
date: 2026-05-11 night
related-bead: prompt-language-j0je
purpose: first attempt at a unified attested run via local Ollama after operator signer provisioning
---

# Attested smoke findings

## Headline

**The first end-to-end PL flow execution against local Ollama on
this rig completed successfully.** A single-turn smoke flow that
asks qwen3-coder:30b to emit `write_file` + `done` actions ran
exit 0, wrote the file, produced a valid `.prompt-language/`
bundle.

```
flow:
  prompt: Use the write_file action to create hello.txt with
    content "hello world from prompt-language". Then emit a done
    action. Reply ONLY with strict JSON like
    {"actions":[{"type":"write_file","path":"hello.txt",
    "content":"hello world from prompt-language"},
    {"type":"done","message":"file written"}]}.
```

Resulting bundle:
- `.prompt-language/provenance.jsonl` (with PL_TRACE=1)
- `.prompt-language/session-state.json`
- `.prompt-language/audit.jsonl`
- `.prompt-language/ollama-turns.jsonl`
- `hello.txt` (the written file)

This proves: **the PL ollama runner DOES work end-to-end on this
rig when the flow uses the action protocol the runner expects**
(write_file + done actions). The day's earlier "PL ollama runner
hangs" finding was specific to flows that asked for prose output
without invoking the action protocol.

## However — bundle could not be signed

After running the flow, attempted to sign the bundle with the
newly-provisioned operator signer. **Sign failed with `bundle
finalStateHash mismatch`**:

```
attest: Error: bundle finalStateHash mismatch:
  trace claims c5ce51d20f94daa508a724d11b7fb1c8ed3bede4e0ba292a89c52ec16d1fba12,
  state hashes to 24b8b379b13b731558119de2d4dc3cde8980de939051acb041fcb625ffd04260
```

## Root cause (third runtime bug found tonight)

Looking at the trace: there are exactly 2 entries.

- **seq=0**: `node_advance` for n1 (the prompt node), with
  `stateAfterHash: c5ce51d2...`
- **seq=1**: `agent_invocation_begin` (no `stateAfterHash`; this
  is an adapter event)

After the prompt node executes (model emits actions, runner
executes write_file, session state updates with the workspace
action results), **no further `node_advance` or `flow_complete`
event is emitted with the post-node state hash**. So the trace's
last `stateAfterHash` is the state BEFORE the prompt ran, but
`session-state.json` now contains the state AFTER the prompt
ran. They don't match — by design, but the verifier can't tell
which is "right."

`attestation-lib.mjs:251` enforces:
```js
if (claimedFinalStateHash && claimedFinalStateHash !== computedStateHash) {
  throw new Error(`bundle finalStateHash mismatch: ...`);
}
```

So as currently shipped, **a single-prompt flow cannot produce a
signable bundle** because the trace's last `node_advance` happens
before the prompt's effects land in `session-state.json`.

## What needs to change

The runtime needs to emit a `flow_complete` (or a final
`node_complete`) trace event with `stateAfterHash` matching the
post-execution state. Estimated 5-15 LOC in
`src/application/run-flow-headless.ts` or wherever the flow loop
terminates.

This is the **third** real runtime bug found tonight (after #1
default-gemma4 issue, #2 system-prompt action-protocol issue
that case-A short-circuit only partially fixes). All three are
documented obstacles that prevented the unified attested run.

## Has anyone successfully signed a bundle?

The repo's git log shows several `factory-runtime-proof` bundles
under `experiments/results/factory-runtime-proof/` from April. Per
`program-status.md`, the most-clean is
`20260418-083500/codex-medium`. If those bundles signed
successfully, the issue might be flow-specific (multi-node flows
emit `node_advance` between each node, so the last one captures
the final state). Single-prompt flows like mine are degenerate.

A multi-node test flow (e.g. prompt + run + done) might sign
cleanly even today because the `run:` step would emit its own
`node_advance` with updated state. Worth trying.

## What this session DID accomplish

Even though the bundle didn't sign, the session produced:

1. **Operator signer provisioned** (commit 6f821f3) — public key in
   trusted-signers.json, trust-root pinned, signer ID
   operator-45ck-2026-05.
2. **First end-to-end PL flow run against local Ollama** —
   exit 0, flow_completed message, file written, bundle produced.
3. **Third runtime bug identified and documented** — single-prompt
   flow trace doesn't capture post-execution state hash.
4. **Cross-family review prerequisite identified** — gate 4 of §3a
   requires `runtimeFamily != reviewerFamily`. Both qwen and
   gemma are local, qwen3-coder works as runtime, but gemma had
   thinking-token issues earlier. Devstral (Mistral family) might
   work as reviewer.

## What this session did NOT accomplish

- A signed, verify-trace-passing bundle. j0je remains open.
- A claim-eligible run. Three §3a gates still unsatisfied for
  this specific bundle: (3) attestation rejected; (4) cross-
  family review not run; (5) signer is in registry but bundle
  isn't actually signed.
- A multi-node flow test (would likely sign successfully).

## Bead status update

- `prompt-language-j0je` (P1, unified attested run): partially
  unblocked. Single-prompt flows blocked by runtime bug #3
  (no post-execution stateAfterHash). Multi-node flows likely
  work — try next.
- `prompt-language-5io5` (P1, ollama runner): partial fix shipped
  but case B (model emits JSON without done) and case C (no
  post-execution trace event) both remain.
- New finding: **runtime bug #3 deserves its own bead** for the
  no-final-stateAfterHash issue.

## Files

- `smoke.flow` — the minimal flow that completed
- `.prompt-language/` — the bundle (gitignored / kept for
  inspection but not committed)
- `findings.md` — this file
