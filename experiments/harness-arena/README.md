# harness-arena — compare whole stacks: vanilla cloud harness + frontier model vs PL + local model + task-tuned flow

**Status:** Planned. HA-E1 and HA-HR1 pilots not yet run; the runner supports
dry-run structure materialization and deterministic fake-live command execution,
but live local/frontier LLM execution is not implemented.
**Last update:** 2026-05-04

## Question

When you compare complete stacks rather than isolated mechanisms — a vanilla cloud harness driving a frontier model vs prompt-language driving a local model through a task-tuned flow — which stack wins on which task shapes, and at what dollar and wall-clock cost? The ladder isolates mechanisms; this area asks the whole-stack question.

## What this area has measured (receipts)

- None yet; pilot HA-E1 has not been run.

Deterministic runner plumbing now exists, but it is not model-performance
evidence:

- `--dry-run` materializes isolated arm workspaces and schema-shaped manifests
  without executing commands.
- `--fake-live` executes deterministic local shell commands only. It captures
  per-step `stdout.txt`, `stderr.txt`, and `metadata.json` artifacts under each
  arm's `artifacts/steps/` directory.
- Fake-live step metadata records `timeoutMs`, `timedOut`, `exitCode`, and
  `wallSeconds` in both artifacts and the manifest.
- The oracle runs only after fake-live steps, from `private/oracle/`, with its
  command stored in `private/oracle-command.txt`. Oracle stdout/stderr artifacts
  stay under `private/oracle/` and are not copied into the model-visible
  workspace.

Adjacent evidence from FSCRUD R28 should inform the first pilot but must not be
counted as harness-arena evidence. R28 showed that local Ollama can perform real
workspace actions and that prompt-language scaffolding can preserve broad artifacts,
but it also exposed export-surface collapse in the local domain implementation lane.
That is a routing signal: local-first is plausible for bulk scaffolded work, while
frontier escalation should be reserved for recorded risk, repeated local failure, or
read-only review.

## What is in flight

- HA-HR1 deterministic runner core — see [runner.mjs](runner.mjs)
- HA-E1 pilot plan — see [../harness-arena-HA-E1-PLAN.md](../harness-arena-HA-E1-PLAN.md)
- HA-HR1 hybrid routing plan — see [hybrid-model-routing.md](hybrid-model-routing.md)
- Synthetic v2 manifest schema smoke coverage — see
  [hybrid-routing-manifest.schema.test.mjs](hybrid-routing-manifest.schema.test.mjs)
- Static-split team-flow scaffolds — see [flows/](flows/)
- Team runbook — see [TEAM-OF-AGENTS-RUNBOOK.md](TEAM-OF-AGENTS-RUNBOOK.md)

## What is next (ordered)

1. Validate the HA-HR1 dry-run manifests with
   `node experiments/harness-arena/runner.mjs --dry-run --run-id HA-HR1-structure-001 --output-root .tmp/harness-arena`
2. Validate deterministic fake-live command/oracle plumbing with
   `node experiments/harness-arena/runner.mjs --fake-live --run-id HA-HR1-fake-live-001 --output-root .tmp/harness-arena`
3. Replace the fake-live lanes with live local/frontier invocations while
   preserving workspace/oracle isolation
4. Run HA-HR1 across local-only, frontier-only, advisor-only, and hybrid-router arms
5. Run HA-E1 pilot under a $5 budget cap
6. Write up findings and decide whether to scale

## Known blockers

- HA-HR1 still depends on live model execution and real verifier/oracle wiring
  before model-quality claims can be made.
- Dry-run manifests intentionally set `oracle.passed=false`; they validate
  structure only and are not model-performance evidence.
- Fake-live manifests may set `oracle.passed=true`, but that only proves local
  harness plumbing. It is not local/frontier model evidence.
- The checked-in flows are scaffolds for orchestration shape, not completed evidence.

## Local tests

Run the deterministic harness tests without live LLMs:

```sh
npm run experiment:harness:test
```

- The frontier lane must not be used to rescue a local-only claim. Any frontier
  advice or patch changes the arm classification to advisor-only, frontier-only, or
  hybrid-router.

## Operator Policy

Use local Ollama by default for cheap bulk work, scaffolded implementation, public
checkpoint repair, and experiments whose purpose is to measure local capability or
GPU cost. Use external frontier models for high-ambiguity reasoning, security or
data-loss review, repeated local gate failure after classification, and final
read-only review of risky diffs. Keep those choices visible in the manifest rather
than implied by prompts.

## Related

- Plan: [../harness-arena-HA-E1-PLAN.md](../harness-arena-HA-E1-PLAN.md)
- Hybrid routing plan: [hybrid-model-routing.md](hybrid-model-routing.md)
- Operator guide: [../../docs/guides/team-of-agents.md](../../docs/guides/team-of-agents.md)
- Sibling areas: [../aider-vs-pl/](../aider-vs-pl/), [../aider-vs-pl/rescue-viability/](../aider-vs-pl/rescue-viability/), [../ecosystem-analysis/](../ecosystem-analysis/)
