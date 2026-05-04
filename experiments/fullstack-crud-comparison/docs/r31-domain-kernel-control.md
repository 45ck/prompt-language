<!-- cspell:ignore FSCRUD fscrud -->

# R31 Domain-Kernel Control

Date: 2026-05-04

## Purpose

R30 showed that stronger local natural-language domain control still left
`src/domain.js` as executable stubs. R31 removes that blocker with a deterministic
domain kernel, then tests the next question: can local PL complete the non-domain
product surface without corrupting protected domain artifacts?

## Hypotheses

H31-A, deterministic domain kernel isolates the R30 bottleneck: the static kernel
control should pass public domain checks, `npm test`, and the hidden FSCRUD verifier.

H31-B, local PL can perform bulk non-domain work: with domain behavior already green,
the local model should create server, UI, README, manifest, and verification-report
files that pass verifier checks.

H31-C, protected-file policy is necessary: if the local model edits domain tests,
contracts, seed data, package scripts, or `src/domain.js`, the run is a control
failure even if the final score improves.

## Arms

| Arm                                | Flow                                                | Provider boundary         | Purpose                                                  |
| ---------------------------------- | --------------------------------------------------- | ------------------------- | -------------------------------------------------------- |
| `r30-solo-local`                   | `../flows/solo-local-crud-r30-domain-control.flow`  | Local only                | Reuse the R30 direct baseline shape.                     |
| `r31-static-domain-kernel-control` | `../flows/static-domain-kernel-r31.flow`            | Deterministic only        | Prove scaffold plus kernel can satisfy the verifier.     |
| `r31-pl-domain-kernel-bulk`        | `../flows/pl-fullstack-crud-domain-kernel-r31.flow` | Local only after scaffold | Local model owns only server, UI, docs, manifest report. |

Run with:

```sh
npm run experiment:fscrud -- --arms r31-domain-kernel --runner ollama --model qwen3-opencode-big:30b
```

## Control Rules

The deterministic setup owns:

- `workspace/fscrud-01/src/domain.js`
- `workspace/fscrud-01/package.json`
- `workspace/fscrud-01/CONTRACT.md`
- `workspace/fscrud-01/DOMAIN_API.md`
- `workspace/fscrud-01/contracts/domain-exports.json`
- `workspace/fscrud-01/__tests__/domain.contract.test.js`
- `workspace/fscrud-01/data/seed.json`
- `workspace/fscrud-01/scripts/check-domain-*.cjs`

The local model may edit only:

- `workspace/fscrud-01/src/server.js`
- `workspace/fscrud-01/public/index.html`
- `workspace/fscrud-01/README.md`
- `workspace/fscrud-01/run-manifest.json`
- `workspace/fscrud-01/verification-report.md`

## Decision Rules

If the static kernel control fails, R31 is invalid until the deterministic kernel or
verifier is fixed.

If the static kernel passes but the PL bulk lane fails non-domain hard failures,
the next work should target server/UI/docs control rather than domain prompts.

If both static and PL bulk lanes pass, R30 was isolated to the local model's domain
implementation capability. The next model-use experiment should be a hybrid lane
where only `src/domain.js` is frontier-authored and the remaining bulk work stays
local.

If the PL bulk lane passes only after protected files are edited, classify it as a
policy failure, not a local PL product success.

## Result

Run: `live-fscrud-r31-domain-kernel-20260504-1247`

Runner/model: native Ollama with `qwen3-opencode-big:30b`

| Arm                                | Score     | Outcome         | Hard failures                                                              |
| ---------------------------------- | --------- | --------------- | -------------------------------------------------------------------------- |
| `r30-solo-local`                   | `35/100`  | `flow_failed`   | `ui_surface_incomplete`, `seed_integrity_failed`, `domain_behavior_failed` |
| `r31-static-domain-kernel-control` | `100/100` | `verified_pass` | none                                                                       |
| `r31-pl-domain-kernel-bulk`        | `93/100`  | `flow_failed`   | `ui_surface_incomplete`                                                    |

Observed interpretation:

- H31-A passed. The deterministic scaffold plus domain kernel satisfied public
  gates and the hidden verifier.
- H31-B partially passed. The local PL bulk lane preserved green domain behavior and
  reached `93/100`, but did not complete the full UI/product surface.
- H31-C passed for this diagnostic. The protected-domain control did not collapse
  back into the R30 domain-stub failure.

R31 moves the local-model bottleneck from executable domain behavior to surrounding
server/UI surface completeness. The next local-only experiment is R32
`r32-pl-ui-surface-control`: keep the protected kernel and tighten browser/server UI
coverage gates before considering a hybrid frontier-domain lane.
