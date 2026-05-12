# GSLR-8 Local Route-Record Compiler Result: 2026-05-13

Status: live local evidence, exact scaffold shape only  
Model: `ollama/qwen3-coder:30b`  
Endpoint class: local  
Frontier call limit: `0`  
USD limit: `0`

## Runs

| Run                                                               | Final verdict | Private oracle | Frontier tokens | Provider USD | Step wall seconds |
| ----------------------------------------------------------------- | ------------- | -------------- | --------------- | ------------ | ----------------- |
| `gslr8-route-record-compiler-live-2026-05-13-01-local-diagnostic` | `pass`        | `pass`         | `0`             | `0`          | `22.175`          |
| `gslr8-route-record-compiler-live-2026-05-13-02-local-repeat`     | `pass`        | `pass`         | `0`             | `0`          | `9.044`           |
| `gslr8-route-record-compiler-live-2026-05-13-03-local-repeat`     | `pass`        | `pass`         | `0`             | `0`          | `17.547`          |

All three runs used the same frozen fixture and local-lane prompt.

## Conclusion

GSLR-8 is the first positive generalization after GSLR-7.

It does not prove that local models should own route-record generation. It proves
the narrower and more useful claim:

```text
When PL owns policy tables, route selection, escalation order, artifact-ref
rules, and output envelopes, a local model can fill tiny generic predicates for
this route-record screen with zero frontier tokens.
```

## Route Decision

Promote the exact `gslr8-route-record-compiler` shape to `local-screen`.

Keep these routes blocked:

- broad route-record generation;
- route-record builders where the model owns normalized policy tables;
- route-record builders where the model owns `selectedRoute`;
- Portarium live ingestion;
- MacquarieCollege connector data movement.

## Evidence Boundary

The result is exciting because it turns GSLR-7's failure into an engineering
design rule:

```text
Use frontier/Codex for planning and first-failure diagnosis.
Use PL-generated deterministic scaffolds for invariants.
Use local models only for bounded predicate hooks.
```
