# GSLR Static Evidence Bundles

Status: checked-in static fixtures for Portarium GSLR-12 compatibility

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

The next Portarium-safe step is a manual Cockpit bundle preview that verifies one
of these checked-in fixtures and renders a static card only after verification.
Do not treat these files as permission to build live prompt-language ingestion,
route-record queues, runtime evidence cards, database tables, SSE streams, or
action controls.
