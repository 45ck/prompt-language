---
title: First signed PL bundle on this rig — milestone + 3 next blockers
status: ad-hoc evidence — non-claim-eligible per program-status §3a
operator: 45ck
date: 2026-05-11 night
related-bead: prompt-language-j0je
---

# Milestone: first signed PL bundle on this rig

## What happened

Following operator signer provisioning (commit 6f821f3), tonight's
deeper push **produced the first cryptographically-signed PL
bundle in the repo's history** on this rig. The chain:

1. Operator signer `operator-45ck-2026-05` provisioned (gate 5).
2. Multi-node flow (`prompt + run`) ran end-to-end via
   `prompt-language ci --runner ollama --model qwen3-coder:30b`.
   Exit 0. Workspace artifact written. `.pl-multi/` bundle has
   4-entry trace, valid session state.
3. Bootstrap-preflight + manifest-pre + cross-family-review (stub)
   placed in bundle.
4. `attest.mjs --bundle .pl-multi --signer operator-45ck-2026-05`
   returned `{"ok": true, ...}` with signed `attestation.json`.

```
{
  "ok": true,
  "attestationPath": ".pl-multi/attestation.json",
  "signer": "operator-45ck-2026-05",
  "signerRole": "operator",
  "runId": "bd1d6aafb7bed997-b01a-4ea8-7fdf-264a7766cd86",
  "payloadSha256": "4ba4c2c2308a793c825489a1523e7d2c795dda0ff0bb450e305d07702bb67ee9"
}
```

The bundle exists, it's signed, the operator key is real, the
trust-root is pinned, and the registry recognises the signer. **Five
of the eight intermediate gates needed for an attested run are now
passing**.

## What still blocks claim-eligibility

`verify-trace --require-attestation --require-role operator` failed
with three NEW concrete findings — each a separate bug or missing
piece. None of these blocked signing, but all block the verifier:

### Bug #4: trace entry 0 has malformed `prevEventHash`

```
chain: entry 0: prevEventHash must be string or null
```

The first event in the trace doesn't serialise `prevEventHash` in
the form the verifier expects. Probably emitted as `undefined`
when the verifier wants explicit `null`. Same family as bug
documented in `program-status.md` "live-smoke falsifier" finding
(2): "verify-trace rejects entry 0 when prevEventHash is not
serialized as null".

### Bug #5: witness shim never invoked → 2 orphan groups

```
orphan: agent_invocation_begin=1 vs shim_invocation_begin=0
orphan: agent_invocation_end=1 vs shim_invocation_end=0
```

Per AP-1/AP-2 in `docs/security/witness-chain-attacks.md`, the
verifier expects `agent_invocation_*` (runtime-side) events to be
paired with `shim_invocation_*` (out-of-process witness) events.
The shim is presumably `pl-claude.cmd` for Claude or some
equivalent for ollama. **No ollama-side shim exists today**, so
the witness chain has 1-sided coverage and the verifier rejects.

This is architectural: full claim-eligibility against ollama
requires building an `pl-ollama` shim that wraps each
`/api/generate` call from outside the runtime.

### Bug #6: `--state` flag finds session-state at wrong path

```
state file not found: C:\projects\prompt-language\experiments\attested-smoke-2026-05-11\.pl-multi\session-state.json
```

…but I passed `--state "$(pwd)/.pl-multi/session-state.json"` as
the absolute path. Some CLI flag-resolution issue. Probably a
trivial fix.

## Bundle preserved for inspection

The signed bundle is at:
`experiments/attested-smoke-2026-05-11/.pl-multi/`

Contents:
- `provenance.jsonl` — 4-entry trace
- `session-state.json` — final state (hash matches trace)
- `audit.jsonl`, `ollama-turns.jsonl`, `provider-telemetry.jsonl`
- `manifest-pre.json` — preflight inventory
- `bootstrap-preflight.json` — preflight envelope
- `cross-family-review.json` — STUB (qwen=factory, mistral=reviewer
  declared; no real reviewer model invoked)
- **`attestation.json`** — the signed payload (this is the new
  artifact)

## Bug status across all of tonight's runtime findings

| # | Bug | Status |
|---|-----|--------|
| 1 | Default model `gemma4:31b` returns empty visible output | Open (workaround: `--model qwen3-coder:30b`) |
| 2 | Ollama runner is action-protocol; case A short-circuit shipped, case B (model emits actions but never `done`) and case C (verbose responses) remain | Partial fix shipped; bead `5io5` open |
| 3 | Single-prompt flows lack final `stateAfterHash` in trace | Open; bead `j1xa` filed |
| 4 | Trace entry 0 prevEventHash not serialised as `null` | New finding tonight; needs bead |
| 5 | No ollama-side witness shim → orphan agent_invocation events | New finding tonight; needs bead |
| 6 | `verify-trace --state` flag path resolution issue | New finding tonight; needs bead |

## What this milestone IS evidence for

Even with the verify-trace failure, this bundle is the **first**
to exist in this state:

- Real ed25519 operator signature (not placeholder)
- Generated against current trust-root pin
- Bundle structure complete enough to sign
- Single-author-but-honest cross-family stub declared

This proves the **signer infrastructure works** end-to-end. The
remaining bugs are about the witness chain and trace serialisation,
not about whether attestation can happen at all.

## Next concrete steps to fully clear §3a

1. Fix bug #4 (trace entry 0 serialisation) — likely 1-line fix in
   the trace logger
2. Fix bug #6 (--state path resolution) — debug the verify-trace
   flag handler
3. Build an `pl-ollama` witness shim (or document why ollama-side
   shim isn't required for read-only runs)
4. Run a real cross-family review against the bundle (devstral as
   mistral-family reviewer; or claude as anthropic-family reviewer)

After all four: a single clean `verify-trace` exit 0 against a
PL flow run. That run becomes the program's first
**claim-eligible** evidence per §3a.

## Commit referenced

Operator signer provisioning: `6f821f3`
First end-to-end PL flow on local Ollama: `aab465c` (smoke flow
checked in)
This milestone (signed bundle + new bug findings): TBD by this
commit
