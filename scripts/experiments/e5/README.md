# E5 Maintenance-Viability Pair Runner

Orchestrates an E5-B01 pair end-to-end:

```
factory-codex -> factory-pl -> gate -> blind-handoff
  -> maintenance-codex-tree -> maintenance-pl-tree -> scorecard
```

## Files

- `run-pair.mjs` — orchestrator, reads the pair manifest, runs stages in order.
- `spawn-factory-codex.mjs` — launches codex-alone against the frozen baseline prompt.
- `spawn-factory-pl.mjs` — launches the prompt-language CLI against the e4 CRM `project.flow` + phase pack.
- `run-journey-suite.mjs` — runs the 7 CRM journeys and 3 persistence probes defined in `experiments/results/e5-maintenance/harness/crm-journeys.md` (machine-readable mirror at `crm-journeys.json`).
- `run-change-request.mjs` — spawns a blind cold-start maintenance lane, applies one change request, re-runs the journey suite, captures rework + drift.

All modules are node-stdlib only. No new dependencies. No `src/` touched.

## Running a real pair

Prereqs:

- `npm run build` in the repo root (produces `bin/cli.mjs`).
- `codex` binary on PATH, or `CODEX_BIN` env var pointing at an absolute path.
- `gpt-5.2` reachable through your codex CLI auth (or override via `--model`).
- A clean working tree (for `git diff --stat` rework accounting inside maintenance lanes).

Then:

```
node scripts/experiments/e5/run-pair.mjs \
  experiments/results/e5-maintenance/batches/e5-b01-mv-gpt52-pilot/pairs/p01-codex-first.json \
  --run-id my-run-id
```

Dry-run (lists stages, does not spawn anything):

```
node scripts/experiments/e5/run-pair.mjs \
  experiments/results/e5-maintenance/batches/e5-b01-mv-gpt52-pilot/pairs/p01-codex-first.json \
  --dry-run
```

Run an individual module manually:

```
node scripts/experiments/e5/spawn-factory-codex.mjs --workspace /tmp/e5-codex --timeBudgetMin 120
node scripts/experiments/e5/spawn-factory-pl.mjs    --workspace /tmp/e5-pl    --timeBudgetMin 360
node scripts/experiments/e5/run-journey-suite.mjs   --workspace /tmp/e5-codex --json
node scripts/experiments/e5/run-change-request.mjs  --workspace /tmp/e5-codex-stripped --cr CR-01
```

## Failure discipline

- Missing `codex` binary: both factory invokers and the maintenance invoker refuse to run and print a clear error. They do NOT fake success.
- Journey suite is honest about v1 scope: journeys it cannot automate yet are recorded as `requires-manual-review`, NOT as pass. The suite's `gateStatus` returns `pending-manual-review` in that case — treat that as "blocked", not "passed".
- Blinding: `run-change-request.mjs` refuses to send a maintenance prompt that mentions prompt-language, `.flow` files, or factory-lane identity. It asserts this before any codex invocation.

## What's live vs stub

| Stage                        | Status |
| ---------------------------- | ------ |
| `factory-codex`              | Live. Spawns codex; requires `codex` binary. |
| `factory-pl`                 | Live. Spawns `bin/cli.mjs run --runner codex`; PL-slower expected, budget-consumption is not a failure. |
| `gate-family-1-2-3`          | Live. Spawns `run-journey-suite.mjs`. Currently returns `pending-manual-review` for HTTP journeys until a contract-driven probe is added (see journey manifest). |
| `blind-handoff`              | Live. Copies workspace to `-stripped` and removes patterns per manifest. |
| `maintenance-*-tree`         | Live. Applies `CR-01..CR-05` sequentially via blind cold-start codex sessions; records rework + drift. |
| `scorecard`                  | Live. Renders the template with run metadata; filling per-lane metrics from maintenance run output is a future enhancement. |

## Known limitations (v1)

- `run-journey-suite.mjs` does not yet boot the app and drive HTTP. The scaffolding is in place; the next change is to plug in `app-boot` + `documented-endpoint-probe` for the journeys marked `automation: "http"` in `crm-journeys.json`.
- `scorecard` stage does not yet aggregate per-lane `maintenanceViabilityIndex` from the maintenance run JSON; wire that after the first live pair produces stable shapes.
- Rework accounting assumes the stripped workspace is a git repo. If it isn't, `reworkCost` fields fall back to `null` with a `raw` note.
