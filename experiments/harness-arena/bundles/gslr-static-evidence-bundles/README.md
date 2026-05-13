# GSLR Static Evidence Bundles

Status: checked-in static fixtures for Portarium GSLR-15 import-readiness boundary

This directory publishes deterministic `GslrEvidenceBundleV1` fixtures for the
current positive and negative route-record evidence:

- `gslr8-route-record-compiler.bundle.json` records the GSLR-8 `local-screen`
  result: PL owned route-record policy tables and output envelopes, and the
  local model filled bounded predicate hooks.
- `gslr7-scaffolded-route-record.bundle.json` records the GSLR-7
  `frontier-baseline` result: the broader local route-record builder failed the
  private oracle and stays blocked.

These bundles are not live ingestion artifacts. They use the Portarium
docs/test-only bundle schema, repository-relative artifact refs, SHA-256 payload
and artifact hashes, and a deterministic test signature:

```text
base64("sig:" + canonicalPayload.length)
```

The fixture signer is not a production key. The constraints intentionally stay:

```json
{
  "importMode": "manual-static-only",
  "runtimeAuthority": "none",
  "actionControls": "absent"
}
```

Regenerate the fixtures after changing this file set with:

```sh
node experiments/harness-arena/bundles/gslr-static-evidence-bundles/generate.mjs
```

Then run:

```sh
npm run experiment:harness:test
```

Portarium has now consumed this handoff through a manual Cockpit bundle preview
and an adversarial static rejection corpus. Portarium also added a GSLR-15
static import readiness gate that keeps persistent import blocked until a
separate design satisfies production trust/keyring requirements, artifact byte
verification, append-only static storage, no runtime authority, no action
controls, operator review states, and structured rejection codes. Do not treat
these files as permission to build live prompt-language ingestion, route-record
queues, runtime evidence cards, database tables, SSE streams, or action
controls.
