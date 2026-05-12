# Post-GSLR-8 Route-Record Compiler Decision: 2026-05-13

Status: research decision after positive local repeat  
Primary bead: `prompt-language-gslr23`

## Question

Did deterministic scaffold ownership fix the GSLR-7 route-record failure class?

## Conclusion

Yes, for the exact GSLR-8 route-record compiler shape.

GSLR-7 failed when the local model owned normalized policy tables and the
`selectedRoute` envelope. GSLR-8 moved those invariants into PL-owned scaffold
code and left the local model with only two generic predicate hooks.

The result passed three live local runs with zero frontier tokens.

## What Changed

The model-authored surface changed from:

```text
whole route-decision record builder
```

to:

```text
matchesAnyEvidenceTextPattern(value, patterns)
isRelativeArtifactReference(value)
```

The scaffold owns:

- unsafe-key constants;
- unsafe-text patterns;
- route-arm set;
- selected-route envelope;
- route decision;
- escalation reason order;
- artifact-ref raw-dump rule;
- public and hidden-oracle contract.

## What This Proves

It proves that local models can reduce cost when Prompt Language removes whole
classes of invariant work from the model's responsibility.

It does not prove that local models can own broad engineering records or product
runtime decisions.

## System Direction

The engineering system should now use this split:

```text
Codex/frontier plans, advises, and diagnoses first failure.
Prompt Language generates deterministic scaffold code and gates.
Local models fill bounded hooks.
Portarium displays evidence only after the route policy is stable.
```

## Product Boundary

Do not build live Portarium ingestion from this result yet.

The next product-safe step is a static engineering evidence-card projection from
checked-in GSLR policy evidence, not runtime queues or live Cockpit route
decisions.

MacquarieCollege connector payloads, source-system observations, and school data
remain outside this pipeline.

## Sources

- GSLR-8 runbook:
  `experiments/harness-arena/GSLR-8-ROUTE-RECORD-COMPILER-RUNBOOK.md`
- GSLR-8 fake-live result:
  `experiments/harness-arena/results/gslr8-fake-live-2026-05-13/report.md`
- GSLR-8 local result:
  `experiments/harness-arena/results/gslr8-local-repeat-2026-05-13/report.md`
- GSLR-7 decision:
  `docs/evaluation/2026-05-13-post-gslr7-engineering-system-decision.md`

## Execution Record

2026-05-13:

- Added GSLR-8 route-record compiler fixture, public gate, private oracle,
  deterministic lane, local lane, runbook, and result docs.
- Ran deterministic fake-live successfully.
- Ran three live local repeats successfully with zero frontier tokens.
- Promoted the exact GSLR-8 compiler scaffold shape to `local-screen`.
- Kept Portarium runtime ingestion and MacquarieCollege connector movement
  blocked.
