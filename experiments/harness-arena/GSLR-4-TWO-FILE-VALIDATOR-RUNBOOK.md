# GSLR-4 Two-File Validator Runbook

Status: scaffolded, deterministic fake-live proof only  
Tracking bead: `prompt-language-gslr14`  
Companion Portarium bead: `bead-1239`  
Deterministic result:
`experiments/harness-arena/results/gslr4-fake-live-2026-05-12/report.md`
Live result:
`experiments/harness-arena/results/gslr4-live-2026-05-12/report.md`

## Question

After GSLR-3 routed the evidence-card transform to `frontier-baseline`, does a
narrower validation task recover local usefulness when the work spans two files?

## Why This Task

GSLR-4 keeps the static Portarium evidence-card domain, but it does not ask the
model to invent a whole card from a runner manifest. It asks for a validator and
a separate action-boundary helper.

That matters because it isolates a different boundary:

- GSLR-2: one-file validator, local-screen passed live.
- GSLR-3: one-file transform, local/advisor failed live, frontier passed.
- GSLR-4: two-file static validator, cross-module policy coupling required.

The hypothesis is `advisor-only`: frontier advice may be enough to state the
cross-file contract, then a local implementation can do the mechanical validator
work. Live evidence is still required before that claim is accepted.

## Fixture

Model-visible fixture:

- `fixtures/gslr4-two-file-validator/TASK.md`
- `fixtures/gslr4-two-file-validator/README.md`
- `fixtures/gslr4-two-file-validator/package.json`
- `fixtures/gslr4-two-file-validator/src/action-boundary-policy.mjs`
- `fixtures/gslr4-two-file-validator/src/evidence-card-validator.mjs`
- `fixtures/gslr4-two-file-validator/test/public-gate.mjs`

Private oracle:

- `oracles/gslr4-two-file-validator-oracle.mjs`

Deterministic fake-live lane:

- `live/gslr4-deterministic-lane.mjs`

The model must implement `deriveActionBoundary(card)` and
`validateEngineeringEvidenceCard(card)`. The validator must import the helper
and reject malformed static `portarium.evidence-card-input.v1` cards, raw or
secret payload keys, unsafe artifact refs, negative costs, and action-boundary
mismatches.

## Deterministic Proof

This command proves only harness plumbing. It is not model evidence:

```sh
REPO_ROOT="$(pwd)"

node experiments/harness-arena/runner.mjs \
  --fake-live \
  --arms hybrid-router \
  --fixture experiments/harness-arena/fixtures/gslr4-two-file-validator \
  --fake-step-command "node ${REPO_ROOT}/experiments/harness-arena/live/gslr4-deterministic-lane.mjs --workspace <workspace> --arm <arm> --step <stepId>" \
  --oracle-command "node ${REPO_ROOT}/experiments/harness-arena/oracles/gslr4-two-file-validator-oracle.mjs --workspace <workspace>" \
  --output-root /tmp/prompt-language-gslr4-fake-live \
  --run-id gslr4-two-file-validator-fake-live-2026-05-12 \
  --started-at 2026-05-12T08:10:00.000Z
```

Expected deterministic result:

- public gate passes after the deterministic lane writes both implementation
  files;
- private oracle passes;
- `finalVerdict.status == "pass"`;
- frontier-review artifacts report no blocking findings;
- classifier/review steps emit token and cached-token telemetry-like stderr for
  parser coverage.

## Live Run Shape

The primary live claim route is `advisor-only`.

Recommended sequence:

1. Run `advisor-only` as the hypothesis arm: frontier advice and local
   implementation.
2. If it passes, run `frontier-only` once to price the baseline and compare
   frontier token use.
3. Run `local-only` only as a diagnostic boundary if we need to know whether the
   advice was necessary.
4. Do not run `hybrid-router` unless a governance review needs the full routing
   trace.

## Success Criteria

A positive GSLR-4 advisor-only result requires:

- public gate pass;
- private oracle pass;
- `finalVerdict.status == "pass"`;
- no unresolved blocking review defects;
- validator imports and uses the action-boundary helper;
- failed evidence cards remain valid when their action boundary is `blocked`;
- no raw payload, token, credential, unsafe artifact ref, or hidden oracle
  leakage.

## Product Boundary

This fixture does not create a Portarium product card or runtime ingestion path.
It only tests whether a static evidence-card validator can be implemented under
a two-file contract. Portarium runtime ingestion and live Cockpit cards remain
blocked.

## Live Decision

The live run has now completed:

- `advisor-only` passed public gate, private oracle, and final verdict, but used
  32,862 frontier tokens;
- `frontier-only` passed public gate, private oracle, and final verdict with
  20,579 frontier tokens;
- `local-only` failed the private oracle because the validator threw on `null`.

The current route for this exact two-file validator is therefore
`frontier-baseline`, not local-screen and not advisor-only.
