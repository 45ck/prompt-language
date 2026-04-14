# Witness-Chain Attack-Path Report

**Verdict: RESIDUAL — 6 attack paths at Severity ≥ 3.**

The chain is structurally sound (Merkle hashes, dual recorder, pair-matching).
But several design choices leave the "green verify-trace" claim achievable by
an adversary who has the workspace write access that meta-flows already have.

The most exploitable weaknesses:

- The verifier never hashes the shim binary or checks the shim identity.
- The state-file cross-check is optional and trivially bypassable.
- Both recorders can be forged together offline because nothing binds a trace
  to an external observer.
- The shim's `.binary-cache.json` is an unsigned trust cache keyed on
  `mtimeMs`.

## Attack paths

### AP-1 — Forged-from-scratch chain (offline fabrication)

- **Preconditions**: workspace write; knowledge of `provenance-schema.mjs`
  (open source).
- **Exploit**: Write a script that emits a paired runtime+shim sequence for
  a fictional run. Compute each
  `eventHash = sha256(canonicalJSON(entry-without-eventHash))`, wire
  `prevEventHash` sequentially, pick any `runId`, write to
  `provenance.jsonl`. Omit `--state` from the verifier invocation.
- **Observable**: `verify-trace OK: N entries, M runtime/shim pairs`.
- **Severity**: 5 **Likelihood**: 4
- **Guard**: Require `--state` by default; refuse the run if the trace has
  zero `stateAfterHash` anywhere. Couple the trace to a `session-state.json`
  that itself is hashed into the chain.

### AP-2 — State-file silent omission

- **Preconditions**: same as AP-1.
- **Exploit**: Operators running verify-trace without `--state` (default in
  most CI invocations and in the troubleshooting doc's recovery paths) get
  a green result with no state cross-check at all.
- **Observable**: `verify-trace OK`, no state check performed.
- **Severity**: 4 **Likelihood**: 5
- **Guard**: Make `--state` mandatory unless `--allow-missing-state` is
  explicitly passed, and surface that flag in the OK message so downstream
  CI can gate on it.

### AP-3 — Shim-binary identity never verified

- **Preconditions**: workspace write.
- **Exploit**: Runtime records `binaryPath` only when the inner runner's
  introspection provides it; never hashes it. The verifier's `pairKey` is
  `{pid, argv, stdinSha256}` — `binarySha256` is not part of it. An attacker
  replaces the shim with a program that appends fake shim entries and
  never actually execs a real binary. Pairing passes.
- **Observable**: `verify-trace OK`.
- **Severity**: 5 **Likelihood**: 4
- **Guard**: Cross-check every `shim_invocation_*` entry's `binarySha256`
  against a pinned allow-list via `--expected-binaries <file>`. Reject any
  shim script whose own hash is not pinned. Add `binarySha256` to
  `pairKey`.

### AP-4 — `.binary-cache.json` mtime trust

- **Preconditions**: workspace write on the shim install dir (same trust
  zone as the meta-flow).
- **Exploit**: Attacker swaps `PL_REAL_BIN` but preserves `mtimeMs` via
  `utimes`. Shim returns the cached (old, honest) digest while the new
  binary runs.
- **Observable**: `verify-trace OK` with the honest cached sha.
- **Severity**: 4 **Likelihood**: 3
- **Guard**: Remove the cache entirely, or gate it behind
  `PL_SHIM_TRUST_CACHE=1` (default off). Always recompute the full hash
  in verification-critical mode.

### AP-5 — Replay of an older honest chain

- **Preconditions**: workspace write; access to any prior honest
  `provenance.jsonl`.
- **Exploit**: Attacker sets `PL_RUN_ID` to the runId of a prior honest
  run, copies that run's `provenance.jsonl` into the current trace dir,
  deletes `session-state.json`, and exits the meta-flow without actually
  running PL. RunIds have no binding to wall-clock, cryptographic nonce,
  or external witness.
- **Observable**: `verify-trace OK`.
- **Severity**: 4 **Likelihood**: 4
- **Guard**: Require a verifier-supplied `--expected-run-id` matching an
  externally-generated nonce (harness writes to a read-only path before
  launching). Require the first entry's `timestamp` to be within a supplied
  freshness window.

### AP-6 — Canonical-JSON drift exploit

- **Preconditions**: attacker can edit either `src/domain/state-hash.ts`
  or `scripts/eval/provenance-schema.mjs` (meta-flow targets).
- **Exploit**: Both use handwritten canonical-JSON. The verifier uses only
  the shim-side implementation. An attacker can corrupt the runtime side
  (changing on-the-fly hashes) while verify-trace still accepts because it
  re-verifies with the shim side.
- **Observable**: `verify-trace OK`.
- **Severity**: 3 **Likelihood**: 2
- **Guard**: Have the verifier import canonicalization from the compiled
  `dist/domain/state-hash.js` instead of duplicating the algorithm. Add
  a fuzz-contract test asserting byte-identical output from both
  implementations on 10k inputs.

### AP-7 — seq counter reuse across parallel shim writers

- **Preconditions**: race between parallel shim invocations to the same
  trace dir.
- **Exploit**: Two shim processes race, both read the same `prevBegin`,
  both compute the same `beginSeq`, both append. Duplicate seq values
  cause `verifyChain` to fail with "seq X expected Y", so the accidental
  case is defended. Deliberate craft + partial file rewrite is possible
  but bounded.
- **Severity**: 2 **Likelihood**: 2
- **Guard**: Adequate as-is for accidental races. Consider advisory file
  locking around `appendEntry`. Document that the shim must not be invoked
  in parallel for the same trace file.

### AP-8 — Truncation / mid-file drop

- **Preconditions**: workspace write.
- **Exploit**: Remove paired runtime/shim entries and renumber the
  remainder. Rebuild `prevEventHash` downstream (algorithm is public).
  Chain is internally valid, pairing balanced, runId single. Claim "N
  prompts were processed" becomes false while verify-trace passes.
- **Observable**: `verify-trace OK: (N-k) entries, (M-k) runtime/shim pairs`.
- **Severity**: 4 **Likelihood**: 4
- **Guard**: Require `--expected-pair-count` (supplied by the harness)
  and fail on mismatch. Write an expectations file under a path the
  meta-flow cannot write.

### AP-9 — Embedded newline in a trace value

- **Well-defended.** Both writers use `JSON.stringify` for strings; the
  verifier splits on raw `\n`. Embedded newlines are escaped and cannot
  split a record.

### AP-10 — Truncated last line

- **Integrity-defended** (fails closed on partial JSON). Availability
  concern only — attacker can cause a refusal, not a green fabrication.

## Ranked patches (payoff order, Sev ≥ 3)

| Rank | AP         | File                                        | Fix                                                                                                                             |
| ---- | ---------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| 1    | AP-5       | `scripts/eval/verify-trace.mjs`             | Mandatory `--expected-run-id` (from nonce outside workspace) + `--freshness-window-ms`. Reject on mismatch or stale timestamp.  |
| 2    | AP-1, AP-2 | `scripts/eval/verify-trace.mjs`             | Make `--state` non-optional unless `--allow-missing-state` is explicit; surface the flag in the OK message.                     |
| 3    | AP-8       | `scripts/eval/verify-trace.mjs`             | `--expected-pair-count` + `--min-entries` supplied by harness.                                                                  |
| 4    | AP-3       | `scripts/eval/verify-trace.mjs`             | `--expected-binary-hashes <file>` allow-list. Reject shim entries with unknown `binarySha256`. Add `binarySha256` to `pairKey`. |
| 5    | AP-4       | `scripts/eval/agent-shim/pl-agent-shim.mjs` | Remove `.binary-cache.json` or gate behind `PL_SHIM_TRUST_CACHE=1` (default off).                                               |
| 6    | AP-6       | `scripts/eval/provenance-schema.mjs`        | Delete duplicated canonicalJSON/hashEvent; re-export from `dist/domain/state-hash.js`. Add fuzz-contract test.                  |

## What is already well-defended

- Embedded newlines in values (AP-9) — `JSON.stringify` escapes cleanly.
- Truncated tail (AP-10) — `loadTrace` fails closed on partial JSON.
- Mid-chain silent edits — Merkle chain catches single-entry tampering
  without shortcut.
- Runtime-only tampering without shim complicity — dual recorder design
  forces forging both sides.

## Residual-risk summary

The witness chain is cryptographically well-constructed internally but
lacks an external trust anchor. Every ingredient a verifier uses — the
JSONL, the state file, the shim binary hash, the runId — lives inside the
workspace that the meta-flow can write to. The fixes above all converge
on one design change: **the verifier must consume at least one input
that originated outside the workspace and cannot be rewritten by the
meta-flow** — a nonce, an expected pair count, a signed binary manifest,
or ideally all three.

## Status of the ranked patches (2026-04-14)

| Rank | AP                                       | Status                                                                                                                                                                                                                                                                                                                                                                          | Commit                            |
| ---- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| 1    | AP-5 (external nonce)                    | **Partially shipped, real fix pending**. G1 (`ec086e8`) added `--expected-run-id` but the nonce is written to `os.tmpdir()` which is readable by any same-user process. The attack "write nonce offline, pass matching runId in forged trace" still works if the attacker has read access. K2b will move the nonce to `~/.pl-meta-nonces/<64-hex-random>.nonce` with mode 0600. | `ec086e8` (partial) + K2b pending |
| 2    | AP-1 / AP-2 (mandatory `--state`)        | Shipped                                                                                                                                                                                                                                                                                                                                                                         | `ec086e8`                         |
| 3    | AP-8 (expected-pair-count + min-entries) | Shipped                                                                                                                                                                                                                                                                                                                                                                         | `ec086e8`                         |
| 4    | AP-3 (binary hash allow-list + pairKey)  | Shipped; allow-list populated                                                                                                                                                                                                                                                                                                                                                   | `ec086e8` + J1                    |
| 5    | AP-4 (shim cache hardening)              | Shipped                                                                                                                                                                                                                                                                                                                                                                         | `2ba45ec`                         |
| 6    | AP-6 (canonicalJSON dedup)               | Shipped                                                                                                                                                                                                                                                                                                                                                                         | `60c5c40`                         |
| —    | AP-9 (Ed25519 attestation)               | **Design only**; implementation (K1) agent-quota-blocked. This is the only fix that places trust outside the workspace entirely.                                                                                                                                                                                                                                                | `0cccfbd` (design)                |

## Honest claim-eligibility position

Until AP-5 lands the real out-of-workspace nonce (K2b) AND AP-9 ships a
verified attestation (K1), every "claim-eligible" run in this repo is
locally trustable but not externally defensible. A motivated adversary
with workspace-write access can still produce a bundle that makes
`verify-trace OK` exit 0. That is adequate for dev confidence; it is
not adequate for publishable thesis evidence.
