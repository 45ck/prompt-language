---
title: Operator signer provisioning playbook (§3a gate 5)
status: actionable playbook — execute when ready to clear claim-eligibility gate 5
operator: 45ck
date: 2026-05-11
related-bead: prompt-language-f5kg
---

# Operator signer provisioning playbook

Step-by-step procedure for provisioning a real operator signer to
clear §3a gate 5 per `docs/strategy/program-status.md`. Output of
research agent dispatched 2026-05-11; verify the steps against
current code before relying on them.

**Estimated time: ~30 minutes** for a careful one-time provisioning.

## Pre-flight check

The agent caught a real **security gap** during this research:
`docs/security/provenance-attestation.md:289` claims that
`scripts/eval/.attest-keys/` is gitignored, but it was NOT in
`.gitignore` until this commit. Fixed in the same commit that
banked this playbook. Verify `.attest-keys/` is gitignored before
running keygen.

## 1. Generate the ed25519 keypair

The repo ships its own keygen:

```bash
node scripts/experiments/meta/attest.mjs --keygen --signer operator-<handle>-<yyyy>-<mm>
```

Implementation: `scripts/experiments/meta/attest.mjs:146-184`
(`runKeygen`).

**Default output**: `scripts/eval/.attest-keys/`. Writes:

- `<signer>.key` — PEM PKCS#8 ed25519 private key, mode 0600
- `<signer>.pub` — base64 raw 32-byte public key, one line

**Use `--json`** to capture the `publicKeyBase64` for the registry edit.

**Manual alternative** (if you prefer offline OpenSSL):

```bash
openssl genpkey -algorithm ed25519 -out op.key
```

Documented at `docs/security/provenance-attestation.md:233-236`.
The loader at `attestation-lib.mjs:475-516` accepts PEM PKCS#8,
raw DER PKCS#8, or 32-byte base64 seed.

## 2. Register the public key

Edit `docs/security/trusted-signers.json`. Required shape per
`attestation-lib.mjs:374-397` and `trusted-signers.example.json:5-12`:

```json
{
  "version": 1,
  "signers": [
    {
      "signerId": "operator-<handle>-2026-05",
      "role": "operator",
      "publicKey": "<base64 32-byte raw pubkey from .pub file>",
      "validFrom": "2026-05-11T00:00:00Z",
      "validUntil": null,
      "notes": "Operator key for §3a gate 5; private key offline."
    }
  ]
}
```

Required fields:

- `signerId` — non-empty string
- `role` — must be `operator` or `ci` (`dev` is rejected per
  `attestation-lib.mjs:44`)
- `publicKey` — base64 decoding to exactly 32 bytes
  (`attestation-lib.mjs:386-390`)
- `validFrom` — RFC3339 timestamp
- `validUntil` — RFC3339 or `null`

## 3. Rebuild the trust-root pin

After editing the registry:

```bash
npm run build
```

This regenerates `dist/eval/attestation-trust-root.js` via
`scripts/build/emit-attestation-trust-root.mjs:45-66`. The
verifier refuses to proceed when on-disk sha256 ≠ pinned sha256
(`verify-trace.mjs:111-152`).

**Verify**: confirm `dist/eval/attestation-trust-root.js` exists
and contains a sha256 hex value. If `npm run build` doesn't
trigger this script, run it directly:

```bash
node scripts/build/emit-attestation-trust-root.mjs
```

## 4. Move the private key OUTSIDE the workspace

**Critical step.** Per the threat model in
`docs/security/provenance-attestation.md:88-95` and `:233-236`
and `:451-455`:

- **Recommended location**: `~/.pl/op.key` (the docs' canonical
  path) or any path outside the repo tree
- **Mode**: `0600` (POSIX-only; on Windows verify NTFS ACLs
  restrict to the current user)
- **Plus encrypted backup** on a separate device

Move the key BEFORE running anything else, in case
`scripts/eval/.attest-keys/` ends up tracked despite the
.gitignore fix.

**Never** pass the key on argv. Tools should accept `--key`
with a path.

## 5. Run an attested experiment

Required env vars for the harness to auto-sign and run the
attestation-required verifier:

```bash
export PL_TRACE=1
export PL_TRACE_STRICT=1
export PL_META_SIGN=1
export PL_META_SIGNER_ID=operator-<handle>-2026-05
export PL_ATTEST_SIGNER=operator-<handle>-2026-05
export PL_ATTEST_KEY_PATH=$HOME/.pl/op.key
export PL_REQUIRE_ATTESTATION=1
export PL_REQUIRE_ROLE=operator
```

Then:

```bash
npm run experiment:meta:live -- experiments/meta-factory/m1-pl-writes-smoke-test/m1.flow
```

Bundle lands in `experiments/meta-factory/results/<runId>/`.

## 6. Verify §3a gate 5 is satisfied

The harness already runs verify-trace, but the canonical check is:

```bash
node scripts/eval/verify-trace.mjs \
  --trace experiments/meta-factory/results/<runId>/provenance.jsonl \
  --state experiments/meta-factory/results/<runId>/session-state.json \
  --attestation experiments/meta-factory/results/<runId>/attestation.json \
  --require-attestation \
  --require-role operator \
  --expected-run-id <runId> \
  --freshness-window-ms 86400000
```

Flags defined at `verify-trace.mjs:154-222`. Exit 0 with an OK
line containing `attested-by=<signerId> role=operator,
trust-root=sha256:<hex8>` (per `provenance-attestation.md:376`
and §6.2 ordering at `attestation-lib.mjs:612-744`).

For operator role, the verifier also enforces
`runtimeFamily != reviewerFamily`
(`attestation-lib.mjs:727-736`) — so the bundle must include
cross-family review evidence.

## 7. Rotation procedure (if key leaks)

Per `provenance-attestation.md:241-253`:

1. Add to `docs/security/revoked-signers.json`:
   ```json
   {
     "version": 1,
     "revoked": [
       {
         "signerId": "...",
         "revokedAt": "<RFC3339>",
         "reason": "..."
       }
     ]
   }
   ```
   (validated at `attestation-lib.mjs:400-420`)
2. **Do NOT delete** the original entry from
   `trusted-signers.json` — historical bundles stay inspectable.
3. **Rotate**: add a new entry with a fresh `signerId` and its
   own `validFrom`.
4. **After any registry edit, re-run `npm run build`**.

## What this playbook cannot determine without execution

These are gaps the agent flagged that need on-the-ground
verification:

1. **Whether `npm run build` actually wires
   `emit-attestation-trust-root.mjs` into the build script** —
   confirm by checking `package.json` scripts before relying on
   `npm run build` alone.
2. **Whether `meta:preflight` returns `ready` on Windows host** —
   `program-status.md:281-283` lists live-agent auth blocker
   (`prompt-language-040u`). Gate 5 also requires gate 2
   (preflight `ready`).
3. **Cross-family review wiring** for the chosen flow —
   `--require-role operator` triggers
   `validateFamilySeparation`; the bundle's
   `cross-family-review.json` must show distinct families.
4. **Whether to also commit a CI-role entry now** — gate 5 only
   requires `operator`. CI provisioning is separate.
5. **PEM passphrase support** — docs claim passphrases are read
   from stdin but `--keygen` writes unencrypted PEM. If you need
   passphrase encryption, generate with `openssl genpkey ...
-aes-256-cbc` and verify the loader handles it.

## Cross-references

- Bead: `prompt-language-f5kg` (P2)
- Threat model: `docs/security/witness-chain-attacks.md`
- AP-9 hardening: `docs/security/provenance-attestation.md`
- Attestation library: `scripts/experiments/meta/attestation-lib.mjs`
- Signer registry example: `docs/security/trusted-signers.example.json`
