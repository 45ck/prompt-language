# GSLR-2 Policy Schema Runbook

Status: scaffolded, deterministic fake-live proof only  
Tracking bead: `prompt-language-gslr6`  
Companion Portarium bead: `bead-1231`
Deterministic result:
`experiments/harness-arena/results/gslr2-fake-live-2026-05-12/report.md`
Live result:
`experiments/harness-arena/results/gslr2-live-2026-05-12/report.md`

## Question

Can a governed local/frontier route solve a tiny code/schema task with public
tests, hidden policy checks, manifest final verdict, and token telemetry, while
using less matched frontier work than a frontier-only control?

## Why This Task

GSLR-1 was useful but too easy: local-only solved the docs projection, and the
hybrid arm used more frontier work than frontier-only while carrying a blocking
review defect. GSLR-2 moves to a small implementation task so the experiment can
test bounded local coding under policy gates rather than prose generation.

The fixture represents a Portarium-style engineering action policy envelope. It
does not integrate with Portarium runtime code. The goal is evidence design:
schema rules, raw-payload rejection, public gate, hidden oracle, and manifest
truth.

## Fixture

Model-visible fixture:

- `fixtures/gslr2-policy-schema/TASK.md`
- `fixtures/gslr2-policy-schema/README.md`
- `fixtures/gslr2-policy-schema/package.json`
- `fixtures/gslr2-policy-schema/src/action-policy-schema.mjs`
- `fixtures/gslr2-policy-schema/test/public-gate.mjs`

Private oracle:

- `oracles/gslr2-policy-schema-oracle.mjs`

Deterministic fake-live lane:

- `live/gslr2-deterministic-lane.mjs`

The model must implement `validateActionPolicyEnvelope(envelope)`. It must accept
only the GSLR v1 policy envelope shape, require public/private/review gates,
require final-verdict and token-telemetry evidence, and recursively reject raw or
secret payload keys such as `sourcePayload`, `studentPayload`, `token`, and
`credential`.

## Arms

Run the same fixture across:

- `local-only`: local model attempts the implementation.
- `frontier-only`: frontier model performs the full implementation.
- `advisor-only`: frontier gives advice, local applies.
- `hybrid-router`: frontier classifies, local implements, frontier reviews.

The live evidence report must distinguish:

- public gate pass/fail;
- private oracle pass/fail;
- `finalVerdict.status`;
- unresolved blocking review defects;
- frontier call count and provider-reported token telemetry;
- local wall time and local resource observations where available.

## Matched Cost Rule

If final frontier review is mandatory for the hybrid arm, the frontier-only
control must either include the same final review or the report must split:

- implementation frontier tokens;
- mandatory review frontier tokens;
- total frontier tokens.

Without this split, the cost comparison is not interpretable.

## Deterministic Proof

This command proves only harness plumbing. It is not model evidence:

```sh
REPO_ROOT="$(pwd)"

node experiments/harness-arena/runner.mjs \
  --fake-live \
  --arms hybrid-router \
  --fixture experiments/harness-arena/fixtures/gslr2-policy-schema \
  --fake-step-command "node ${REPO_ROOT}/experiments/harness-arena/live/gslr2-deterministic-lane.mjs --workspace <workspace> --arm <arm> --step <stepId>" \
  --oracle-command "node ${REPO_ROOT}/experiments/harness-arena/oracles/gslr2-policy-schema-oracle.mjs --workspace <workspace>" \
  --run-id gslr2-policy-schema-fake-live
```

Expected deterministic result:

- public gate passes after the deterministic lane writes the implementation;
- private oracle passes;
- `finalVerdict.status == "pass"`;
- frontier-review artifacts report no blocking findings;
- frontier-classify and frontier-review steps emit token telemetry-like stderr
  for parser coverage.

## Live Run Shape

The live run must use operator-supplied lane commands. A valid live command must
provide the fixture, private oracle, local lane, and frontier lane:

```sh
node experiments/harness-arena/runner.mjs \
  --live \
  --arms local-only,frontier-only,advisor-only,hybrid-router \
  --fixture experiments/harness-arena/fixtures/gslr2-policy-schema \
  --oracle-command "node experiments/harness-arena/oracles/gslr2-policy-schema-oracle.mjs --workspace <workspace>" \
  --live-local-command "<local runner command using <workspace> <arm> <stepId>>" \
  --live-frontier-command "<frontier runner command using <workspace> <arm> <stepId>>" \
  --frontier-call-limit 6 \
  --usd-limit 5 \
  --run-id gslr2-policy-schema-live-001
```

The live report should not count a run as positive unless every arm has the same
fixture, no hidden human repair, and a manifest that validates against the
harness schema.

## Success Criteria

The GSLR-2 hybrid-routing claim is positive only if:

- `hybrid-router` passes the public gate and private oracle;
- `hybrid-router` has `finalVerdict.status == "pass"`;
- `hybrid-router` has no unresolved blocking review defects;
- frontier step telemetry is present for every frontier call;
- hybrid has lower matched frontier implementation cost than the frontier-only
  control while preserving quality.

If local-only also passes, that is useful local-model evidence, but it weakens
the need for a hybrid route on this exact task. If frontier-only passes and
hybrid fails, the route policy is not ready for Portarium evidence-card work.

The 2026-05-12 live run hit the first case: local-only passed the hardened
fixture, advisor-only passed with fewer frontier tokens than frontier-only, and
hybrid-router passed but used more frontier tokens than frontier-only. The
result supports local-only screening for this task shape, not hybrid promotion.

## What This Can Prove

GSLR-2 can prove that Prompt Language can make a small governed code task
executable, measurable, and reviewable across local/frontier route arms.

It cannot prove production Portarium ingestion, broad local autonomy, or
readiness for school operations. Those remain blocked behind positive manifests
and separate product integration work.
