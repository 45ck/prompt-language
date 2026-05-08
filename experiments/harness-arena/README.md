# harness-arena — compare whole stacks: vanilla cloud harness + frontier model vs PL + local model + task-tuned flow

**Status:** Active. Full HA-E1 is still planned, but HA-HR1 now has live local
evidence, checked-in H11/H14/H15 routing policies, and runner profiles for
promoted, frontier-baseline, local-screen, and experimental hybrid routes. The
runner supports dry-run structure materialization, deterministic fake-live
command execution, and explicit `--live` lane command execution with private
oracle artifacts.
**Last update:** 2026-05-09

## Question

When you compare complete stacks rather than isolated mechanisms — a vanilla cloud harness driving a frontier model vs prompt-language driving a local model through a task-tuned flow — which stack wins on which task shapes, and at what dollar and wall-clock cost? The ladder isolates mechanisms; this area asks the whole-stack question.

## What this area has measured (receipts)

- H14 local-only with `qwen3:8b` failed. Advisor-only and static hybrid did not
  rescue that model; failure-aware hybrid eventually passed but was
  frontier-repair dominated.
- H14 local portfolio evidence promoted `qwen3-coder:30b` for full H14 TDD under
  the hardened PowerShell stdin route. It also promoted `devstral-small-2:24b`
  as a full-H14 fallback after three clean full-lane passes and as an H15
  PATCH-test-authoring fallback after three clean committed-state tests-only
  passes.
  `qwen3-opencode:30b` remains promoted only for the narrower
  implementation-from-tests and API-preservation subroles.
- H15 endpoint evidence did not promote `qwen3-coder:30b` for local-only
  ownership. The local model produced near-complete endpoint work, but repeated
  API-preservation drift, validation drift, a failed one-defect validation repair
  screen, failed alternative validation-model screens, and the latest hybrid
  resource failure make `frontier-only` the current baseline route.
- H11 multi-file refactor now has a Harness Arena fixture, private oracle,
  worker flow, and promoted `qwen3-coder:30b` local route. It is currently
  `4/6`: live screens 003 through 006 passed the private oracle after explicit
  deletion instructions and a public behavior-preservation gate.
- The current H15 runner profile is executable with
  `node experiments/harness-arena/runner.mjs --h15-qwen-coder-task api-endpoint`;
  in live mode it requires a frontier lane command for the current baseline route.

Primary evidence records:

- [H14 live local evidence](../../docs/evaluation/2026-05-08-ha-hr1-h14-live-local.md)
- [H11 live local evidence](../../docs/evaluation/2026-05-09-ha-hr1-h11-live-local.md)
- [H15 live local evidence](../../docs/evaluation/2026-05-08-ha-hr1-h15-live-local.md)
- [Local coding model selection](../../docs/evaluation/2026-05-08-local-coding-model-selection.md)

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
- Local Ollama lane commands may set
  `PROMPT_LANGUAGE_OLLAMA_TRANSPORT=powershell` when WSL cannot reach the Windows
  Ollama HTTP listener. This keeps the normal HTTP transport as the default while
  allowing Windows PowerShell to call the Windows-local Ollama API.
- `--h14-local-subrole` applies the checked-in H14 local-model portfolio routing
  policy. Promoted subroles default to `local-only` with the selected local model;
  non-promoted subroles default to `frontier-only`, with the matching fixture,
  oracle, policy version, timeout, and flow identity recorded by the runner.
- `--h14-qwen-coder-subrole` remains available for the older qwen-coder-only
  route profile when reproducing historical evidence.
- `--h11-qwen-coder-task multi-file-refactor` applies the checked-in H11
  multi-file rename route policy. It defaults to a local-only screening arm and
  tests cross-file rename completeness, import resolution, app smoke behavior,
  timeout/no-edit handling, and API-surface drift.
- `--h15-qwen-coder-task api-endpoint` applies the checked-in H15 route policy.
  The current route is `frontier-only`, with `qwen3-coder:30b` retained only as
  an experimental local draft candidate for narrower micro-flow screens.
- `--h15-qwen-coder-task validation-only` applies the checked-in H15 validation
  micro-flow. It defaults to a local-only screening arm and is not full H15
  endpoint evidence. The route is `1/2`; the latest repeat exhausted action
  rounds and failed the private oracle.
- `--h15-qwen-coder-task test-authoring` applies the checked-in H15 PATCH
  test-authoring micro-flow. It defaults to a promoted local-only arm where the
  local model may edit only `src/test.js`; `devstral-small-2:24b` is promoted as
  the fallback for this tests-only route.
- `--h15-qwen-coder-task repair-short-name` applies the checked-in one-defect
  H15 validation repair route. It defaults to `frontier-only`; local evidence is
  negative after qwen3-coder and Devstral both drifted broader API behavior.
- H15 route profiles enforce their evidence boundary. The endpoint task must stay
  on the frontier-only arm, repair-short-name must stay on the frontier-only arm,
  validation-only accepts only its selected local model, and
  `devstral-small-2:24b` is accepted only as the PATCH test-authoring fallback.
- `fixtures/h15-validation-repair-short-name` and
  `flows/h15-validation-repair-short-name-worker.flow` exist as a generic H15
  repair screen, with
  `oracles/h15-validation-repair-short-name-oracle.mjs` enforcing unchanged
  public tests, the single intended app repair, and hidden validation edges.
  Current model evidence is negative: qwen3-coder regressed hidden validation
  semantics, then timed out after public-gate hardening; Devstral also failed
  the repair screen twice by rewriting broader seed and 404 behavior.
- H14 route-profile live commands must reference the routed flow. Use
  `<h14Flow>` for the absolute flow path or `<h14FlowRelative>` for the repo-relative
  flow path in `--live-local-command` / `--live-frontier-command`.
- H11 and H15 route-profile live commands must reference the routed flow. Use
  `<h11Flow>`, `<h15Flow>`, or the generic `<routeFlow>` placeholder for the
  absolute path, and `<h11FlowRelative>`, `<h15FlowRelative>`, or
  `<routeFlowRelative>` for the repo-relative path.
- Command templates fail before execution when they contain an unknown
  placeholder, such as a misspelled `<workspace>`, or a route-specific placeholder
  that is unavailable for the selected profile.
- `--local-resource-snapshot-command` optionally records before/after local-step
  resource probes, such as `ollama ps`, as manifest artifact refs. Add
  `--local-resource-snapshot-interval-ms` to sample the same probe while a local
  live step is running. Each step also records `resourceSnapshotSummary` counts
  so reviewers can see sample volume, probe failures, and non-empty sample output
  without manually opening every artifact.
- Fake-live step metadata records `timeoutMs`, `timedOut`, `exitCode`, and
  `wallSeconds` in both artifacts and the manifest.
- Command stdout/stderr artifacts are capped by `--command-output-limit-bytes`
  (default 1048576). Step, resource, and oracle metadata record the cap,
  truncation flags, and original byte counts.
- The oracle runs only after fake-live or live steps, from `private/oracle/`, with
  its raw command stored only in `private/oracle-command.txt`. Public manifests
  record `oracle.commandSha256` plus `oracle.commandArtifactRef`, not the raw
  command. Oracle stdout/stderr artifacts stay under `private/oracle/` and are
  not copied into the model-visible workspace.
- Live and fake-live manifests declare `evidencePolicy.commandEnvironmentPolicy`.
  The current runner records `parent-env-inherited`, so claim reviews must treat
  environment containment as explicit metadata rather than an unstated guarantee.
  Use `--command-environment-policy minimal-allowlist` for lanes that should strip
  unrelated parent environment variables from step, resource, and oracle commands.
- Live and fake-live manifests also declare `evidencePolicy.commandSafetyPolicy`.
  The default `deny-high-risk` policy rejects operator command templates that use
  shell wrappers, network clients, package-manager mutation, destructive
  filesystem commands, service/process control, or git mutation. Use
  `--command-safety-policy unrestricted` only for operator-trusted reproduction
  commands; those runs are marked explicitly in the manifest and step metadata.

Adjacent evidence from FSCRUD R28 remains useful context but must not be counted
as harness-arena evidence. R28 showed that local Ollama can perform real
workspace actions and that prompt-language scaffolding can preserve broad
artifacts, but it also exposed export-surface collapse in the local domain
implementation lane. That remains a routing signal: local-first is plausible for
bulk scaffolded work, while frontier escalation should be reserved for recorded
risk, repeated local failure, or read-only review.

## What is in flight

- HA-HR1 deterministic runner core — see [runner.mjs](runner.mjs)
- HA-HR1 H14 fixture and oracle — see [fixtures/h14-tdd-red-green/](fixtures/h14-tdd-red-green/)
  and [oracles/h14-tdd-red-green-oracle.mjs](oracles/h14-tdd-red-green-oracle.mjs)
- HA-E1 pilot plan — see [../harness-arena-HA-E1-PLAN.md](../harness-arena-HA-E1-PLAN.md)
- HA-HR1 hybrid routing plan — see [hybrid-model-routing.md](hybrid-model-routing.md)
- HA-HR1 live pilot readiness plan — see
  [HA-HR1-LIVE-PILOT-PLAN.md](HA-HR1-LIVE-PILOT-PLAN.md)
- H14 local portfolio route policy — see
  [h14-local-routing-policy.v1.json](h14-local-routing-policy.v1.json)
- H15 qwen-coder route policy — see
  [h15-qwen3-coder-routing-policy.v1.json](h15-qwen3-coder-routing-policy.v1.json)
- H11 qwen-coder route policy — see
  [h11-qwen3-coder-routing-policy.v1.json](h11-qwen3-coder-routing-policy.v1.json)
- Synthetic v2 manifest schema smoke coverage — see
  [hybrid-routing-manifest.schema.test.mjs](hybrid-routing-manifest.schema.test.mjs)
- Static-split team-flow scaffolds — see [flows/](flows/)
- Team runbook — see [TEAM-OF-AGENTS-RUNBOOK.md](TEAM-OF-AGENTS-RUNBOOK.md)

## What is next (ordered)

1. Keep H15 endpoint work on the frontier-only baseline route until local
   micro-flows show reliable value.
2. Keep H11 on the promoted local route for this exact flow/oracle contract, and
   watch for timeout, no-edit, stale-file, or API-drift regressions.
3. Promote a local H15 candidate back into a hybrid full-task route only after the
   micro-flow passes with claim-grade manifests and sampled resource evidence.
4. Run HA-E1 under a budget cap after one H15 baseline, one H15 local micro-flow,
   and one multi-file route have claim-grade manifests.

## Known blockers

- H15 hybrid claim runs are paused behind micro-flow evidence; the current route
  profile intentionally defaults to frontier-only.
- H14 local-only claims are no longer blocked for promoted `qwen3-coder:30b`
  routes. Devstral Small 2 is promoted as the full-H14 fallback, while Qwen3
  OpenCode remains limited to bounded implementation subroles.
- H15 local-only is a negative promotion result, not an open blocker.
- H11 local-only is promoted only for the checked-in `qwen3-coder:30b`
  multi-file refactor route. Do not generalize that to unrelated multi-file
  tasks without fresh evidence.
- Dry-run manifests intentionally set `oracle.passed=false`; they validate
  structure only and are not model-performance evidence.
- Fake-live manifests may set `oracle.passed=true`, but that only proves local
  harness plumbing. It is not local/frontier model evidence.
- Live manifests are model evidence only for the route commands actually supplied
  by the operator. A local-only live run is not frontier or hybrid evidence.
- The checked-in flows are evidence only for the specific route, model, runtime,
  command, and oracle contract recorded in their manifests.

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
