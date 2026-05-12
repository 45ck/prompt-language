# GSLR-8 Route Record Compiler Fixture

This fixture tests the next local-screen primitive after GSLR-7.

GSLR-7 left normalized policy tables and the `selectedRoute` envelope in the
model-authored file. The local lane failed those invariants.

GSLR-8 changes the boundary:

- `src/route-decision-scaffold.mjs` is generated scaffold code and owns policy
  constants, route selection, output envelopes, validation order, and artifact
  rules.
- `src/route-predicate-hooks.mjs` is the only model-authored file. It fills two
  generic predicate bodies and must not own route policy constants.

Passing this fixture would not promote broad route-record generation. It tests
whether PL-owned deterministic scaffolds can make a narrow route-record screen
repeatable.
