# Provenance-Bundle Attestation Design

Status: design only (xgav.9). Not yet implemented. Complements the G1
hardening flags (`--expected-run-id`, `--expected-pair-count`,
`--expected-binary-hashes`) that landed after
`docs/security/witness-chain-attacks.md`.

## 1. Why this layer is necessary

F4 found the witness chain cryptographically sound internally but
anchorless: every ingredient a verifier consumes lives inside the
workspace the meta-flow can write to. G1 closes the loop for one
scenario — a trusted harness supplies an out-of-workspace nonce, a
pair-count expectation, and a binary allow-list before launch. G1 still
fails against one adversary model: **a compromised or cooperating
harness**. Whoever runs the harness script can feed whatever values
they want into those flags. The bundle as a whole is still
self-attesting.

Attestation introduces an additional actor — a signer with a key the
meta-flow cannot read — whose detached signature binds the bundle's
critical identifiers together after the run is frozen. The verifier now
consumes (a) the bundle, (b) the G1 expectations, and (c) a signature
that cannot be produced by anyone who merely has workspace write.
Forging a bundle that passes verification now requires signing-key
compromise, not just filesystem writes.

This does not make the run correct. It makes the run's identity
non-repudiable against a named key.

## 2. Threat model

### Actors and access

| Actor              | Workspace write | Can spawn | Holds op-key | Holds CI-key | Reviews harness |
| ------------------ | --------------- | --------- | ------------ | ------------ | --------------- |
| Meta-flow          | yes             | yes       | no           | no           | no              |
| Harness script     | yes (indirect)  | yes       | no           | no           | committed/reviewed |
| Operator           | yes             | yes       | **yes**      | no           | yes             |
| CI                 | ephemeral write | yes       | no           | **yes**      | via PR review   |
| External verifier  | no              | no        | no           | no           | yes             |

### What attestation must prove (ordered by importance)

1. A run identified by `runId`, `commitSha`, and `manifestHash`
   completed and produced a bundle whose final state-chain tip equals
   `finalStateHash`.
2. Those four values (plus `pairCount`, `runtimeFamily`,
   `reviewerFamily`, `createdAt`) were witnessed by a named signer at
   `signedAt`, using a key pinned in `trusted-signers.json`.
3. The signature is unforgeable without the signer's private key
   (ed25519 assumption).
4. Compromise of the CI key does not retroactively invalidate
   operator-signed bundles, because the two keys occupy distinct
   namespaces in the trusted-signers registry and each signature names
   its role.

### What attestation explicitly does not prove

- Run correctness, model truthfulness, reviewer independence, or
  absence of sycophancy.
- That the signer was not coerced or their disk not compromised.
- Freshness beyond the operator's discipline around `createdAt` and
  the verifier's replay window.

## 3. Attestation format

### 3.1 Layout

One file per bundle: `bundle/attestation.json`. Lives next to
`provenance.jsonl`, `session-state.json`, and `manifest-pre.json`.

```jsonc
{
  "version": 1,
  "signer": "operator-45ck-2026-04",
  "signerRole": "operator",           // "operator" | "ci"
  "signedAt": "2026-04-14T12:34:56.000Z",
  "algorithm": "ed25519",
  "signature": "base64(ed25519 detached sig over canonicalJSON(payload))",
  "payload": {
    "version": 1,
    "runId": "pl-meta-7a8b9c...",
    "commitSha": "32f4d20...",
    "manifestHash": "sha256 of manifest-pre.json",
    "finalStateHash": "last entry's stateAfterHash in provenance.jsonl",
    "pairCount": 7,
    "runtimeFamily": "gemma",
    "reviewerFamily": "claude",
    "createdAt": "2026-04-14T12:30:00.000Z"
  }
}
```

### 3.2 Signing rule

The signer signs `canonicalJSON(payload)` using the same
canonicalization the chain uses
(`dist/domain/state-hash.js#canonicalJSON`). No other fields in the
outer envelope are signed. `signature` is base64 (raw ed25519, 64 bytes
decoded). `algorithm` is pinned to `ed25519`; future algorithms bump
`version`.

### 3.3 Schema (informal)

| Field        | Type   | Rule                                                           |
| ------------ | ------ | -------------------------------------------------------------- |
| version      | int    | Must be 1                                                      |
| signer       | string | `signerId` from `trusted-signers.json`                         |
| signerRole   | enum   | `operator` or `ci`                                             |
| signedAt     | RFC3339| Must be >= `payload.createdAt`                                 |
| algorithm    | enum   | `ed25519` (only allowed value for v1)                          |
| signature    | string | base64; decodes to exactly 64 bytes                            |
| payload      | object | All fields required, extra fields rejected (strict canonical)  |

### 3.4 Worked example

See 3.1. Canonical payload bytes (illustrative):

```
{"commitSha":"32f4d20","createdAt":"2026-04-14T12:30:00.000Z","finalStateHash":"sha256:aa..","manifestHash":"sha256:bb..","pairCount":7,"reviewerFamily":"claude","runId":"pl-meta-7a8b9c","runtimeFamily":"gemma","version":1}
```

The verifier recomputes this exactly from the on-disk bundle and
compares the signature before trusting any field.

## 4. Key management

### 4.1 Registry files (both committed, outside bundle)

`docs/security/trusted-signers.json`

```jsonc
{
  "version": 1,
  "signers": [
    {
      "signerId": "operator-45ck-2026-04",
      "role": "operator",
      "publicKey": "base64 ed25519 pubkey (32 bytes)",
      "validFrom": "2026-04-01T00:00:00Z",
      "validUntil": null,
      "notes": "Primary operator signing key, offline-generated"
    },
    {
      "signerId": "ci-main-2026-04",
      "role": "ci",
      "publicKey": "base64 ed25519 pubkey",
      "validFrom": "2026-04-10T00:00:00Z",
      "validUntil": null,
      "notes": "GitHub Actions secret PL_CI_ATTEST_KEY"
    }
  ]
}
```

`docs/security/revoked-signers.json`

```jsonc
{
  "version": 1,
  "revoked": [
    { "signerId": "ci-main-2025-12", "revokedAt": "2026-01-15T00:00:00Z",
      "reason": "suspected leak in CI log" }
  ]
}
```

### 4.2 Generation

- **Operator**: generates offline on a trusted machine
  (`openssl genpkey -algorithm ed25519 -out op.key`, convert to raw or
  PKCS8 as the signer expects). Private key lives only on that machine
  plus an encrypted backup; never in the repo.
- **CI**: a GitHub Actions secret populated once; the public half goes
  into `trusted-signers.json` via a PR. The CI key's role is narrower
  (see Section 5) so leakage has smaller blast radius.

### 4.3 Rotation and revocation

- Rotation: add a new `signerId` with its own `validFrom`; leave the
  old entry in place so historical bundles still verify against their
  contemporary pubkey. Past signatures are not re-signed.
- Revocation: add the old `signerId` to `revoked-signers.json`. The
  verifier rejects any bundle whose `signer` appears in the revocation
  list, regardless of `validFrom`. This is intentionally blunt — a
  compromised key poisons every bundle that was or could have been
  signed under it.
- Blast-radius limit for CI: restrict CI-signed bundles to runs on
  `main` with clean verify-trace (see 5.3). Operator promotion is
  still required for thesis-eligible bundles.

## 5. Signing workflow

### 5.1 Operator sign (Option B)

Separate, explicit command. Runs after the operator has manually
inspected the bundle and decided to promote it to claim-eligible.

```
node scripts/experiments/meta/attest.mjs \
  --bundle experiments/meta-factory/results/<runId>/ \
  --signer operator-45ck-2026-04 \
  --key ~/.pl/op.key
```

Behavior:
1. Loads `provenance.jsonl`, `session-state.json`, `manifest-pre.json`
   from the bundle.
2. Computes `manifestHash`, `finalStateHash` from disk; reads
   `runId`, `commitSha`, `pairCount`, family names from bundle
   metadata.
3. Assembles `payload`, canonicalizes, ed25519-signs with `--key`.
4. Writes `attestation.json`. Refuses if one already exists unless
   `--force-replace` is passed.

Environment: `PL_ATTEST_KEY_PATH` may override `--key`. Key passphrases
are read from stdin, never argv.

### 5.2 CI auto-sign (Option C)

A `post-meta-live` job in the workflow, gated on:
- The triggering ref is `main` (or a protected branch list).
- `verify-trace` exited 0 with all G1 flags supplied.
- `npm run ci` green on that commit.

The job runs the same `attest.mjs` with `--signer ci-main-2026-04`
and the key loaded from `secrets.PL_CI_ATTEST_KEY`. The signed bundle
is uploaded as a workflow artifact.

### 5.3 Role separation

| Claim level        | Minimum attestation                             |
| ------------------ | ----------------------------------------------- |
| Development / dev  | none (soft mode still OK)                       |
| CI-promoted        | `signerRole: "ci"`                              |
| Thesis / publishable | `signerRole: "operator"` (or both)            |

CI-signed bundles are a weaker claim on purpose: the CI key is online
and automation-accessible. Operator signatures are the strong promise.

## 6. Verification workflow

### 6.1 New verify-trace flags

| Flag                          | Behavior                                                                  |
| ----------------------------- | ------------------------------------------------------------------------- |
| `--attestation <path>`        | When present, verify signature and cross-check payload vs bundle          |
| `--require-attestation`       | Fail if `--attestation` absent or signature invalid                       |
| `--trusted-signers <path>`    | Default `docs/security/trusted-signers.json`                              |
| `--revoked-signers <path>`    | Default `docs/security/revoked-signers.json`                              |
| `--require-role <role>`       | Optional; e.g. `--require-role operator` for thesis-eligible checks       |

### 6.2 Verification steps (in order)

1. Existing chain verification (unchanged).
2. Existing G1 checks (`--expected-run-id`, `--expected-pair-count`,
   `--expected-binary-hashes`, freshness, state hash).
3. If `--attestation` set:
   a. Parse `attestation.json`; schema-check strictly.
   b. Look up `signer` in `trusted-signers.json`; reject if missing
      or if the current time is outside `validFrom`/`validUntil`.
   c. Reject if `signer` appears in `revoked-signers.json`.
   d. Reject if `--require-role` set and `signerRole` does not match.
   e. Verify ed25519 signature over `canonicalJSON(payload)` using the
      pinned public key.
   f. Recompute `manifestHash`, `finalStateHash` from bundle disk;
      reject on mismatch.
   g. Cross-check `payload.runId` against `--expected-run-id`, against
      `runId` fields in the chain, and against every entry.
   h. Cross-check `payload.pairCount` against `--expected-pair-count`
      and the actual pair count in the chain.
   i. Reject if `payload.createdAt` is outside the freshness window.
4. If `--require-attestation` and no `--attestation`: exit 1 with
   `attestation required but absent`.

### 6.3 Exit codes and messages

- `0`: `verify-trace OK: N entries, M pairs, attested-by=<signerId> role=<role>`
- `1`: one of `attestation invalid signature`,
  `attestation signer revoked`, `attestation payload mismatch: <field>`,
  `attestation required but absent`, plus existing chain failures.
- `2`: argument error (unchanged).

Claim-eligible callers pass `--require-attestation --require-role
operator`. Dev callers pass nothing new.

## 7. Composition with G1

Attestation strengthens G1 rather than replacing it. The design
deliberately requires both.

| G1 flag                     | Attestation interaction                                                                 |
| --------------------------- | --------------------------------------------------------------------------------------- |
| `--expected-run-id`         | `payload.runId` must equal the flag value; chain runId must equal both                  |
| `--expected-pair-count`     | `payload.pairCount` must equal the flag value; chain pair count must equal both         |
| `--expected-binary-hashes`  | Payload carries no binary list; the allow-list is verified per-entry as today, and any mismatch fails before signature check is reached |
| `--freshness-window-ms`     | Both `payload.createdAt` and the first chain entry's timestamp must fall inside window  |

Key property: an attacker with workspace write can fabricate a bundle
that internally agrees with its own attestation (just sign their own
payload), but the verifier rejects because the signer is not in
`trusted-signers.json`. An attacker with a stolen signing key can
produce a bundle that names any run; they still have to make the chain
verify, state hashes match, and pair counts agree with whatever
harness-supplied expectations are enforced at verify time. Attestation
does not bypass G1; it adds an irrevocable witness.

## 8. Failure modes

| Failure                                              | Detection                                                                 |
| ---------------------------------------------------- | ------------------------------------------------------------------------- |
| Bundle content mutated after signing                 | `manifestHash` / `finalStateHash` recompute diverges from payload         |
| Signing key stolen, signer unaware                   | `revoked-signers.json` update; verifier blanket-rejects that signerId     |
| Signing key stolen, signer unaware, no revocation yet| Unmitigated. Attestation monitoring (alerting on unexpected signerId in bundles)|
| Replay of older valid signed bundle                  | Freshness window on `payload.createdAt`; runId must match harness-supplied `--expected-run-id` |
| Cross-family mis-claim (same family both sides)      | Verifier enforces `runtimeFamily != reviewerFamily` when `--require-role operator` |
| Downgrade: attacker strips `attestation.json`        | `--require-attestation` forces hard failure; dev mode is softer by choice |
| Algorithm downgrade                                  | `algorithm` is pinned to `ed25519` for v1; any other value rejected       |
| Schema-extension smuggling                           | Strict canonical payload rejects unknown fields                           |

## 9. Staged rollout

| Phase | Scope                                           | Beads / effort                          | Risk                                           |
| ----- | ----------------------------------------------- | --------------------------------------- | ---------------------------------------------- |
| 1     | This design doc                                 | xgav.9 (done)                           | Design gap persists                            |
| 2     | `attest.mjs` + verify-trace flags, backwards-compat | xgav.10 - xgav.12; ~2 days. Generate first operator keypair. | Tooling bugs; soft-mode still valid. Key-handling mistakes. |
| 3     | Meta-factory bundles ship `attestation.json`; docs mark operator-promoted runs | xgav.13; ~1 day | Operator workflow friction; sign-fatigue        |
| 4     | CI auto-attestation for `main` runs; GitHub secret provisioned | xgav.14 - xgav.15; ~1 day plus secret rotation setup | CI key exposure; workflow mis-scoping          |
| 5     | Claim-eligible gate flips to `--require-attestation --require-role operator` | xgav.16; ~0.5 day | Hard-gate breaks unattested historical bundles; grandfather policy needed |

Each phase is independently revertable; no later phase is required for
earlier ones to add value.

## 10. Limits (honest)

- **Attestation proves who signed, not what they signed is correct.**
  An operator can sign a bad run. The chain proves consistency; the
  signer proves identity; neither proves truth.
- **Operator discipline is the bottleneck.** If the operator signs
  every bundle reflexively, the role distinction collapses.
- **Cryptography does not address the sycophancy / self-confirming
  bias surface.** Reviewer-family outputs can still be fabricated at
  the model level; signed traces still document fabrication faithfully.
- **AP-5 replay is only partially addressed.** A valid signed bundle
  from a prior legitimate run can still be re-presented verbatim; only
  the freshness window + out-of-band `--expected-run-id` prevent this,
  and both are harness-supplied. An attacker who controls both the
  harness and the workspace has not been shut out.
- **Key compromise is real.** Ed25519 is the easy part. Key handling,
  backup, rotation cadence, and off-machine storage dominate risk.
- **Timing trust.** `signedAt` and `createdAt` are asserted by the
  signer; the verifier cannot cross-check beyond ordering and window.
  A signer with a wrong clock or a hostile signer can game freshness
  up to the window size.

## One-line attestation rule

A bundle is claim-eligible if and only if `verify-trace` exits 0 with
`--require-attestation --require-role operator` against a signature
produced by a non-revoked `operator` key listed in
`docs/security/trusted-signers.json` over a payload whose
`runId`, `commitSha`, `manifestHash`, `finalStateHash`, and
`pairCount` all match the on-disk bundle at verification time.
