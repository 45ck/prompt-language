# GSLR-8 Route-Record Compiler Runbook

Status: deterministic scaffold compiler experiment  
Tracking bead: `prompt-language-gslr23`

## Question

Can the GSLR-7 route-record failure be fixed by moving invariant ownership out
of the local model lane?

GSLR-7 failed because the model still owned:

- normalized unsafe-key policy constants;
- the `selectedRoute` output envelope.

GSLR-8 tests a narrower contract: PL-generated scaffold code owns policy tables,
route selection, escalation ordering, artifact-ref rules, and the record
envelope. The local model edits only `src/route-predicate-hooks.mjs`.

## Fixture

```text
experiments/harness-arena/fixtures/gslr8-route-record-compiler
```

Model-visible write target:

```text
src/route-predicate-hooks.mjs
```

Scaffold-owned implementation:

```text
src/route-decision-scaffold.mjs
```

## Gates

- public gate imports the scaffold and hooks;
- hidden oracle verifies the hook file does not own scaffold policy constants;
- hidden oracle checks separator-insensitive unsafe-key rejection;
- hidden oracle checks unsafe text rejection;
- hidden oracle checks safe relative artifact references;
- hidden oracle checks `selectedRoute` envelope and stable escalation order;
- hidden oracle checks malformed input no-throw and non-mutation.

## Commands

Deterministic proof:

```sh
REPO_ROOT=$(pwd)
node experiments/harness-arena/runner.mjs \
  --fake-live \
  --arms hybrid-router \
  --fixture experiments/harness-arena/fixtures/gslr8-route-record-compiler \
  --fake-step-command "node ${REPO_ROOT}/experiments/harness-arena/live/gslr8-deterministic-lane.mjs --workspace <workspace> --arm <arm> --step <stepId>" \
  --oracle-command "node ${REPO_ROOT}/experiments/harness-arena/oracles/gslr8-route-record-compiler-oracle.mjs --workspace <workspace>" \
  --output-root /tmp/prompt-language-gslr8-fake-live \
  --run-id gslr8-route-record-compiler-fake-live-2026-05-13 \
  --started-at 2026-05-13T09:10:00.000Z
```

Live local repeat shape:

```sh
PROMPT_LANGUAGE_OLLAMA_TRANSPORT=powershell \
PROMPT_LANGUAGE_OLLAMA_TIMEOUT_MS=900000 \
EVAL_MODEL=ollama/qwen3-coder:30b \
node experiments/harness-arena/runner.mjs \
  --live --arms local-only \
  --fixture experiments/harness-arena/fixtures/gslr8-route-record-compiler \
  --task-id gslr8-route-record-compiler \
  --run-group-id gslr8-route-record-compiler-local-repeats \
  --run-id gslr8-route-record-compiler-live-2026-05-13-02-local-repeat \
  --local-model qwen3-coder:30b --local-endpoint http://127.0.0.1:11434 \
  --live-local-command "node /home/mqckenc/projects/prompt-language/experiments/harness-arena/live/gslr8-local-lane.mjs --workspace <workspace> --arm <arm> --step <stepId>" \
  --oracle-command "node /home/mqckenc/projects/prompt-language/experiments/harness-arena/oracles/gslr8-route-record-compiler-oracle.mjs --workspace <workspace>" \
  --local-resource-snapshot-command "node /home/mqckenc/projects/prompt-language/experiments/harness-arena/live/gslr5-resource-snapshot.mjs" \
  --output-root /tmp/prompt-language-gslr8-live \
  --frontier-call-limit 0 --usd-limit 0 \
  --step-timeout-ms 900000 --oracle-timeout-ms 60000 --wall-seconds-limit 1200
```

## Promotion Boundary

Promote only this exact scaffolded compiler shape to `local-screen`.

Do not promote:

- broad route-record generation;
- Portarium runtime ingestion;
- live Cockpit cards;
- MacquarieCollege connector data movement.

The product meaning is narrower: deterministic scaffold ownership can make local
route-record hooks viable when the local model no longer owns policy tables or
record envelopes.
