# GSLR-3 Policy Manifest Transform Runbook

Status: scaffolded, deterministic fake-live proof only  
Tracking bead: `prompt-language-gslr10`  
Companion Portarium bead: `bead-1235`
Deterministic result:
`experiments/harness-arena/results/gslr3-fake-live-2026-05-12/report.md`

## Question

Does the GSLR-2 `local-screen` policy survive the nearest next task shape:
turning a Harness Arena manifest into a static Portarium evidence-card input?

## Why This Task

GSLR-2 showed that a local model can solve a tiny one-file validator with strong
public and private gates. GSLR-3 keeps the one-file, gated shape but changes the
work from validation to schema-to-schema transformation.

This matters because Portarium's eventual product evidence card will need to
consume route decisions, gate results, private-oracle outcomes, review defects,
local resource telemetry, and frontier token telemetry without ingesting raw
payloads or hidden oracle content.

## Fixture

Model-visible fixture:

- `fixtures/gslr3-policy-manifest-transform/TASK.md`
- `fixtures/gslr3-policy-manifest-transform/README.md`
- `fixtures/gslr3-policy-manifest-transform/package.json`
- `fixtures/gslr3-policy-manifest-transform/src/evidence-card-transform.mjs`
- `fixtures/gslr3-policy-manifest-transform/test/public-gate.mjs`

Private oracle:

- `oracles/gslr3-policy-manifest-transform-oracle.mjs`

Deterministic fake-live lane:

- `live/gslr3-deterministic-lane.mjs`

The model must implement `buildEvidenceCardInput(manifest)`. The transform must
return a static `portarium.evidence-card-input.v1` object with route, gate,
oracle, review, cost, and action-boundary fields.

## Deterministic Proof

This command proves only harness plumbing. It is not model evidence:

```sh
REPO_ROOT="$(pwd)"

node experiments/harness-arena/runner.mjs \
  --fake-live \
  --arms hybrid-router \
  --fixture experiments/harness-arena/fixtures/gslr3-policy-manifest-transform \
  --fake-step-command "node ${REPO_ROOT}/experiments/harness-arena/live/gslr3-deterministic-lane.mjs --workspace <workspace> --arm <arm> --step <stepId>" \
  --oracle-command "node ${REPO_ROOT}/experiments/harness-arena/oracles/gslr3-policy-manifest-transform-oracle.mjs --workspace <workspace>" \
  --output-root /tmp/prompt-language-gslr3-fake-live \
  --run-id gslr3-policy-manifest-transform-fake-live-2026-05-12 \
  --started-at 2026-05-12T07:05:00.000Z
```

Expected deterministic result:

- public gate passes after the deterministic lane writes the transform;
- private oracle passes;
- `finalVerdict.status == "pass"`;
- frontier-review artifacts report no blocking findings;
- classifier/review steps emit token and cached-token telemetry-like stderr for
  parser coverage.

## Live Run Shape

The live run should use all four arms only after this scaffold is reviewed:

- `local-only`
- `frontier-only`
- `advisor-only`
- `hybrid-router`

The hypothesis is `local-screen`: local-only should be tried first because this
is still a one-file, strongly gated policy/schema task. If local-only fails, the
first escalation should be advisor-only before mandatory hybrid review.

## Success Criteria

A positive live GSLR-3 local-screen result requires:

- public gate pass;
- private oracle pass;
- `finalVerdict.status == "pass"`;
- no unresolved blocking review defects;
- no raw payload, token, credential, or hidden oracle leakage in the card;
- correct aggregate frontier token, cached-token, USD, and local wall-time
  telemetry.

## Product Boundary

This fixture does not create a Portarium product card or runtime ingestion path.
It only tests whether a static evidence-card input can be produced safely from a
manifest-shaped input.
