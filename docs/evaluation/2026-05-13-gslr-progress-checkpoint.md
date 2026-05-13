# GSLR Progress Checkpoint: 2026-05-13

Status: post-GSLR-19 downstream checkpoint

## Conclusion

The current evidence supports a mixed engineering system:

```text
Codex/frontier -> planning, advising, diagnosis, hard or ambiguous work
Prompt Language -> deterministic scaffold, gates, policy, and evidence shape
Local models -> bounded hook filling where PL removes invariant risk
Portarium -> operator-visible evidence and governance boundary
```

The strongest local result remains GSLR-8: the PL-owned route-record compiler
passed three live local repeats with zero frontier tokens. That result does not
promote broad route-record generation. It promotes the exact pattern where PL
owns the policy tables and output envelope while the local model fills small
predicate hooks.

## Downstream Progress

Portarium has now completed twelve static follow-ups:

- GSLR-9: checked-in route evidence can project into a docs/test-only
  `EngineeringEvidenceCardInputV1`.
- GSLR-10: a validated static card can export to a frozen Cockpit-facing view
  model with route, model, gate, cost, artifact-ref, and boundary-warning
  fields.
- GSLR-11: Cockpit can render checked-in static GSLR-8 and GSLR-7 evidence
  fixtures at `/engineering/evidence-cards/static` without live ingestion or
  action controls.
- GSLR-12: static GSLR evidence bundles can verify payload hash, signature,
  provenance cross-links, artifact hashes, validity window, and static-only
  constraints before projection.
- GSLR-12.5: prompt-language now publishes checked-in static
  `GslrEvidenceBundleV1` fixtures for GSLR-8 and GSLR-7, and Portarium verifies
  those sibling fixtures through the GSLR-12 verifier when both repos are
  present.
- GSLR-13: Cockpit now has an internal manual bundle preview route that can load
  those fixtures or accept pasted bundle JSON, run the verifier with an explicit
  `nowIso`, show verification status, and render the static evidence card only
  after verification passes.
- GSLR-14: Cockpit now has an adversarial static bundle corpus covering expired,
  not-yet-valid, payload-hash-tampered, invalid-signature, missing-artifact,
  raw-payload, provenance-mismatch, runtime-authority, and action-controls
  rejection cases through the same manual preview path.
- GSLR-15: Portarium now has a static import readiness gate requiring
  production keyring trust, artifact byte verification, append-only static
  storage, no runtime authority, no action controls, operator review states,
  and structured rejection codes before persistent import work can start.
- GSLR-16: verifier failures now expose stable rejection code/category fields,
  Cockpit maps rejection rows from those categories instead of UI regexes, and
  the adversarial corpus is materialized as portable `.bundle.json` files plus
  a manifest.
- GSLR-17: Portarium now has a docs/test-only static imported-record contract
  for verified and quarantined static bundles, preserving signer trust,
  artifact byte-verification status, review state, source refs, rejection
  code/category, timestamps, and fixed no-runtime authority.
- GSLR-18: Portarium now has a docs/test-only append-only static
  imported-record repository contract with idempotency behavior, duplicate
  rejection, constrained review-state transitions, audit events, and no runtime
  operation surface.
- GSLR-19: Portarium now has a docs/test-only static importer planner that turns
  manual verified/rejected outcomes into repository append plans only when
  artifact byte policy, production keyring requirement, review defaults,
  structured failure reporting, and no-runtime authority pass.

This makes prompt-language evidence legible to a future Cockpit surface without
creating live ingestion, runtime cards, route-record queues, database tables,
or production decisions.

## Current Progress Update

The current cross-repo state is:

- prompt-language owns the experiment harness, route records, local/frontier
  evidence, PL-owned scaffolds, and now the static GSLR bundle fixture handoff;
- Portarium owns the static evidence-card contract, Cockpit export, static
  operator view, static evidence-bundle verifier, sibling-fixture compatibility
  test, manual Cockpit bundle preview, adversarial rejection corpus, and static
  import readiness gate, structured rejection corpus contract, and static
  imported-record contract, repository contract, and importer planning contract;
- MacquarieCollege remains a boundary/reference vertical only.

The important learning is that local models are useful where Prompt Language
has made the task narrow enough that policy invariants are not model-owned.
GSLR-8 supports that pattern. GSLR-7 rejects the broader version where the local
model still owns route-record policy logic.

## Next

The next product-safe step is GSLR-20: static importer dry-run fixture. It
should exercise the planner against checked-in verified and rejected bundle
fixtures and repository contracts without writing persistent state.

Do not build live manifest ingestion, runtime route decisions, or production
trust promotion from this checkpoint.

## Static Bundle Fixtures

The handoff fixtures live at:

```text
experiments/harness-arena/bundles/gslr-static-evidence-bundles/
```

They are generated by:

```sh
node experiments/harness-arena/bundles/gslr-static-evidence-bundles/generate.mjs
```

They use deterministic test signatures only. Together with the GSLR-14
adversarial corpus, GSLR-15 readiness gate, GSLR-16 structured rejection
contract, GSLR-17 imported-record contract, and GSLR-18 repository contract,
they prove fixture shape, verifier compatibility, static rejection behavior,
accepted/quarantined record shape, append-only repository behavior, and the
GSLR-19 manual append-planning boundary. They do not prove production
persistence, production trust, live ingestion, importer runtime, or runtime
authority.
