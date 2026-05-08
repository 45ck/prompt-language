# harness-arena — compare whole stacks: vanilla cloud harness + frontier model vs PL + local model + task-tuned flow

**Status:** Planned. HA-E1 and full HA-HR1 pilots have not yet run; the runner
supports dry-run structure materialization, deterministic fake-live command
execution, and explicit `--live` lane command execution with private oracle
artifacts.
**Last update:** 2026-05-08

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
- `--live` executes operator-supplied lane command templates. The runner records
  requested/actual model, provider, endpoint, command artifacts, timeout metadata,
  and private oracle artifacts in a claim-grade manifest.
- `--h14-local-subrole` applies the checked-in H14 local-model portfolio routing
  policy. Promoted subroles default to `local-only` with the selected local model;
  non-promoted subroles default to `frontier-only`, with the matching fixture,
  oracle, policy version, timeout, and flow identity recorded by the runner.
- `--h14-qwen-coder-subrole` remains available for the older qwen-coder-only
  route profile when reproducing historical evidence.
- H14 route-profile live commands must reference the routed flow. Use
  `<h14Flow>` for the absolute flow path or `<h14FlowRelative>` for the repo-relative
  flow path in `--live-local-command` / `--live-frontier-command`.
- `--local-resource-snapshot-command` optionally records before/after local-step
  resource probes, such as `ollama ps`, as manifest artifact refs. Add
  `--local-resource-snapshot-interval-ms` to sample the same probe while a local
  live step is running. Each step also records `resourceSnapshotSummary` counts
  so reviewers can see sample volume, probe failures, and non-empty sample output
  without manually opening every artifact.
- Fake-live step metadata records `timeoutMs`, `timedOut`, `exitCode`, and
  `wallSeconds` in both artifacts and the manifest.
- The oracle runs only after fake-live or live steps, from `private/oracle/`, with
  its command stored in `private/oracle-command.txt`. Oracle stdout/stderr
  artifacts stay under `private/oracle/` and are not copied into the model-visible
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
- HA-HR1 H14 fixture and oracle — see [fixtures/h14-tdd-red-green/](fixtures/h14-tdd-red-green/)
  and [oracles/h14-tdd-red-green-oracle.mjs](oracles/h14-tdd-red-green-oracle.mjs)
- HA-E1 pilot plan — see [../harness-arena-HA-E1-PLAN.md](../harness-arena-HA-E1-PLAN.md)
- HA-HR1 hybrid routing plan — see [hybrid-model-routing.md](hybrid-model-routing.md)
- HA-HR1 live pilot readiness plan — see
  [HA-HR1-LIVE-PILOT-PLAN.md](HA-HR1-LIVE-PILOT-PLAN.md)
- Synthetic v2 manifest schema smoke coverage — see
  [hybrid-routing-manifest.schema.test.mjs](hybrid-routing-manifest.schema.test.mjs)
- Static-split team-flow scaffolds — see [flows/](flows/)
- Team runbook — see [TEAM-OF-AGENTS-RUNBOOK.md](TEAM-OF-AGENTS-RUNBOOK.md)

## What is next (ordered)

1. Validate the HA-HR1 dry-run manifests with
   `node experiments/harness-arena/runner.mjs --dry-run --run-id HA-HR1-structure-001 --output-root .tmp/harness-arena`
2. Validate deterministic fake-live command/oracle plumbing with
   `node experiments/harness-arena/runner.mjs --fake-live --run-id HA-HR1-fake-live-001 --output-root .tmp/harness-arena`
3. Run a local-only live lane against a WSL-reachable Ollama endpoint with
   `--live-local-command`, `--oracle-command`, and `--arms local-only`
4. Use `--h14-local-subrole api-preservation` or
   `--h14-local-subrole implementation-from-tests` to route the promoted H14
   subroles through the local-only lane without manually restating fixture/oracle
   paths. Use `--h14-qwen-coder-subrole` only when reproducing the original
   qwen-coder-only overlay.
5. Add budgeted frontier command templates for frontier-only, advisor-only, and
   hybrid-router arms
6. Run HA-HR1 across local-only, frontier-only, advisor-only, and hybrid-router arms
7. Run HA-E1 pilot under a $5 budget cap
8. Write up findings and decide whether to scale

## Known blockers

- HA-HR1 full-arm claims still depend on budgeted frontier command templates.
- H14 task-specific oracle wiring exists, and the first local-only H14 run is a
  local model failure, not a pass.
- Dry-run manifests intentionally set `oracle.passed=false`; they validate
  structure only and are not model-performance evidence.
- Fake-live manifests may set `oracle.passed=true`, but that only proves local
  harness plumbing. It is not local/frontier model evidence.
- Live manifests are model evidence only for the route commands actually supplied
  by the operator. A local-only live run is not frontier or hybrid evidence.
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
- Live pilot plan: [HA-HR1-LIVE-PILOT-PLAN.md](HA-HR1-LIVE-PILOT-PLAN.md)
- Operator guide: [../../docs/guides/team-of-agents.md](../../docs/guides/team-of-agents.md)
- Sibling areas: [../aider-vs-pl/](../aider-vs-pl/), [../aider-vs-pl/rescue-viability/](../aider-vs-pl/rescue-viability/), [../ecosystem-analysis/](../ecosystem-analysis/)
