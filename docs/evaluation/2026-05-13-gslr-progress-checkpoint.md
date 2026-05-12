# GSLR Progress Checkpoint: 2026-05-13

Status: post-GSLR-12 downstream checkpoint

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

Portarium has now completed four static follow-ups:

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

This makes prompt-language evidence legible to a future Cockpit surface without
creating live ingestion, runtime cards, route-record queues, database tables,
or production decisions.

## Current Progress Update

The current cross-repo state is:

- prompt-language owns the experiment harness, route records, local/frontier
  evidence, and PL-owned scaffolds;
- Portarium owns the static evidence-card contract, Cockpit export, static
  operator view, and static evidence-bundle verifier;
- MacquarieCollege remains a boundary/reference vertical only.

The important learning is that local models are useful where Prompt Language
has made the task narrow enough that policy invariants are not model-owned.
GSLR-8 supports that pattern. GSLR-7 rejects the broader version where the local
model still owns route-record policy logic.

## Next

The next product-safe step is GSLR-13: a manual Cockpit bundle preview. It
should let an operator paste or load a GSLR bundle fixture, run the verifier,
show verification status, render static evidence only when valid, and keep
persistence, queues, tables, SSE, and action controls absent.

Do not build live manifest ingestion or runtime route decisions from this
checkpoint.
