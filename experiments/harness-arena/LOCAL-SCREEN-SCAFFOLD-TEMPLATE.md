# Local-Screen Scaffold Template

Status: current local-screen scaffold primitive after GSLR-8
Latest evidence: `gslr8-route-record-compiler`

## Why

GSLR-6 passed because the task was not left as a free-form prompt. The scaffold
made helper boundaries explicit and the hidden oracle enforced them.

GSLR-7 then failed on a different scaffolded task. The failures were not model
endpoint failures:

- the output envelope missed `selectedRoute.arm`;
- the unsafe-key table kept unnormalized constants, so `oracle command` passed.

That means the reusable primitive is not "write a clearer prompt." It is:

```text
PL deterministically owns policy tables, output envelopes, and gates.
The local model fills only small predicates.
Codex/frontier diagnoses the first failure or takes the route.
```

## Template

Use this shape for the next local-screen candidate:

1. Deterministic scaffold code owns:
   - normalized policy sets;
   - output envelope construction;
   - allowed top-level fields;
   - artifact-ref traversal rules;
   - stable escalation reason order.
2. The local model owns only:
   - one or two predicate bodies;
   - small mapping functions;
   - no top-level record/card assembly.
3. The public gate checks:
   - named exports;
   - no self-import;
   - malformed input no-throw;
   - at least one positive and one negative case per predicate.
4. The private oracle checks:
   - separator-insensitive unsafe-key cases;
   - hidden-oracle/text leakage cases;
   - required output fields;
   - non-mutation;
   - exact route decision and escalation reasons.
5. Route policy:
   - one local failure stops the local-screen candidate;
   - Codex/frontier advisor explains the failure class;
   - local promotion requires N=3 clean repeats after the scaffold is frozen.

## Decision Boundary

GSLR-6 remains exact `local-screen`.

GSLR-7 remains `frontier-baseline`.

GSLR-8 supplied that positive result for the exact route-record compiler shape:
deterministic scaffold ownership, not prompt prose, prevented the GSLR-7 failure
classes across three live local repeats.
