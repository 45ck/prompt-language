# Team Of Agents Runbook

Status: active HA-HR1 operating procedure; live H14 and H15 route profiles
available.

This runbook is for the local-first/frontier-review pilot. It describes how to
run the team shape without implying that prompt-language has peer-agent
semantics.

The current evidence base now includes HA-HR1 route evidence:

- H14 local-only is promoted for `qwen3-coder:30b` on the checked H14 local
  portfolio routes, including full TDD under the hardened PowerShell stdin route.
- `devstral-small-2:24b` and `qwen3-opencode:30b` are fallback local
  implementers for H14 implementation-from-tests and API-preservation only.
- H15 API endpoint work is not promoted local-only under `qwen3-coder:30b`; it is
  routed as `hybrid-required`.

FSCRUD R28 remains adjacent evidence only. It showed that local Ollama plus
prompt-language scaffolding can improve artifact coverage over solo local prompting,
but it also exposed domain export-surface collapse. Use that as routing evidence,
not as proof that every local-first route works.

## Prerequisites

- Ollama is running and the selected local model is already pulled.
- Codex or another frontier runner is available for review/escalation lanes.
- The oracle stays outside the model-visible worktree.
- The run writes a `hybrid-routing-manifest.json` that validates against
  `hybrid-routing-manifest.schema.json`.

## Dry-Run Structure Check

Use the runner skeleton before any live model work:

```powershell
node experiments/harness-arena/runner.mjs --dry-run --run-id HA-HR1-structure-001 --output-root .tmp/harness-arena
```

Expected output artifacts per arm:

- `workspace/`
- `private/oracle-command.txt`
- `arm-plan.json`
- `hybrid-routing-manifest.json`

The dry run is structure-only. Its manifests intentionally set
`oracle.passed=false`, so they must not be cited as local/frontier model
evidence.

## Team Shape

Use the team as a supervised work queue, not as autonomous peers:

- Parent/operator owns scope, file ownership, budgets, stop conditions, and final
  classification.
- Local bulk worker owns bounded implementation, artifact generation, deterministic
  test repair, and public-checkpoint fixes.
- Frontier classifier/reviewer is read-only by default and owns risk classification,
  escalation diagnosis, and final review comments.
- Frontier repair may edit only in a separately labeled hybrid arm and only after the
  parent records why local repair is no longer the measured path.

Do not let local and frontier lanes edit the same files concurrently. If frontier
authored code enters the workspace, the result is no longer local-only evidence.

## Local Bulk Lane

Use local inference for bulk work:

```powershell
$env:PL_SPAWN_RUNNER = 'ollama'
$env:PROMPT_LANGUAGE_OLLAMA_BASE_URL = 'http://127.0.0.1:11434'
$env:PROMPT_LANGUAGE_OLLAMA_TIMEOUT_MS = '600000'
$env:PROMPT_LANGUAGE_OLLAMA_ACTION_ROUNDS = '16'
node bin/cli.mjs run --runner ollama --model qwen3-opencode-big:30b --file experiments/harness-arena/flows/local-bulk-worker.flow
```

When WSL cannot reach the Windows Ollama HTTP listener, use the explicit
PowerShell transport. It asks Windows PowerShell to call the Windows-local Ollama
HTTP API and still records provider telemetry with `metadata.transport=powershell`:

```sh
PROMPT_LANGUAGE_OLLAMA_TRANSPORT=powershell \
PROMPT_LANGUAGE_OLLAMA_TIMEOUT_MS=600000 \
PROMPT_LANGUAGE_OLLAMA_ACTION_ROUNDS=16 \
node bin/cli.mjs run --runner ollama --model qwen3-coder:30b --file experiments/harness-arena/flows/local-bulk-worker.flow
```

Expected output artifact:

- `local-worker-summary.md`

Local Ollama is appropriate when:

- the task has explicit file boundaries and deterministic public checks
- the experiment is measuring local capability, local GPU cost, or local repair loops
- failures can be classified from stdout/stderr without private oracle disclosure
- the work is repetitive, scaffolded, or low ambiguity

Local Ollama is not enough by itself when it repeatedly times out, produces no edits,
collapses required public interfaces, or touches files outside the assigned root. In
those cases, classify the local result before deciding whether to run a hybrid arm.

## Live Runner Lane

Use `--live` only with explicit lane command templates and a private oracle command:

```sh
node experiments/harness-arena/runner.mjs \
  --live \
  --arms local-only \
  --live-local-command 'node scripts/eval/smoke-test.mjs --harness ollama --quick --only E' \
  --oracle-command 'node private/ha-hr1-oracle.mjs --workspace <workspace>' \
  --local-model qwen3:8b \
  --local-endpoint "$PROMPT_LANGUAGE_OLLAMA_BASE_URL" \
  --run-id HA-HR1-live-local-001 \
  --output-root .tmp/harness-arena
```

The runner interpolates `<workspace>`, `<arm>`, `<stepId>`, `<routeDecision>`,
`<attempt>`, and `<taskId>` in lane command templates. It records command
stdout/stderr/metadata under `artifacts/steps/` and runs the oracle from
`private/oracle/` after the live lane completes. A selected arm that contains a
frontier route also requires `--live-frontier-command`; otherwise `--live` fails
before creating a run.

For the H14 fixture, use the H14-specific local flow instead of the generic
local-bulk flow:

```sh
node experiments/harness-arena/runner.mjs \
  --live \
  --arms local-only \
  --fixture experiments/harness-arena/fixtures/h14-tdd-red-green \
  --task-id HA-HR1-H14-tdd-red-green \
  --live-local-command 'bash -lc "PROMPT_LANGUAGE_OLLAMA_BASE_URL=$PROMPT_LANGUAGE_OLLAMA_BASE_URL PROMPT_LANGUAGE_OLLAMA_TIMEOUT_MS=600000 PROMPT_LANGUAGE_OLLAMA_ACTION_ROUNDS=24 node /path/to/prompt-language/bin/cli.mjs run --runner ollama --model qwen3:8b --json --file /path/to/prompt-language/experiments/harness-arena/flows/h14-local-bulk-worker.flow"' \
  --oracle-command 'node /path/to/prompt-language/experiments/harness-arena/oracles/h14-tdd-red-green-oracle.mjs --workspace <workspace>' \
  --local-model qwen3:8b \
  --local-endpoint "$PROMPT_LANGUAGE_OLLAMA_BASE_URL" \
  --step-timeout-ms 900000 \
  --oracle-timeout-ms 30000 \
  --run-id HA-HR1-H14-local-ollama-001 \
  --output-root .tmp/harness-arena
```

For current H14 local-model evidence, prefer the portfolio route profile so the
runner selects the checked-in fixture, oracle, flow identity, selected local model,
policy version, and default arm from `h14-local-routing-policy.v1.json`:

```sh
node experiments/harness-arena/runner.mjs \
  --live \
  --h14-local-subrole api-preservation \
  --live-local-command 'bash -lc "PROMPT_LANGUAGE_OLLAMA_TRANSPORT=powershell PROMPT_LANGUAGE_OLLAMA_TIMEOUT_MS=900000 PROMPT_LANGUAGE_OLLAMA_ACTION_ROUNDS=24 node /path/to/prompt-language/bin/cli.mjs run --runner ollama --model qwen3-coder:30b --json --file <h14Flow>"' \
  --local-resource-snapshot-command 'ollama ps' \
  --local-resource-snapshot-interval-ms 2000 \
  --local-endpoint "ollama-cli" \
  --run-id HA-HR1-H14-api-preservation-routed-001 \
  --output-root .tmp/harness-arena
```

Use `--h14-qwen-coder-subrole` instead only when reproducing the older
qwen-coder-only evidence profile.

`implementation-from-tests`, `api-preservation`, `test-authoring`, and `full-tdd`
route to `local-only` by default for the current H14 local portfolio. H14
route-profile live commands must reference the routed flow; use `<h14Flow>` for
the absolute path or `<h14FlowRelative>` for the repo-relative path.

For current H15 evidence, use the H15 route profile. It defaults to
`hybrid-router`, so live execution requires both local and frontier command
templates:

```sh
repo=/path/to/prompt-language

node "$repo/experiments/harness-arena/runner.mjs" \
  --live \
  --h15-qwen-coder-task api-endpoint \
  --live-local-command 'bash -lc "repo=/path/to/prompt-language; PROMPT_LANGUAGE_OLLAMA_TRANSPORT=powershell PROMPT_LANGUAGE_OLLAMA_TIMEOUT_MS=900000 PROMPT_LANGUAGE_OLLAMA_ACTION_ROUNDS=24 node \"$repo/bin/cli.mjs\" run --runner ollama --model qwen3-coder:30b --json --file <routeFlow>"' \
  --live-frontier-command 'bash -lc "repo=/path/to/prompt-language; H15_ROUTE_FLOW=<routeFlow> H15_ROUTE_FLOW_RELATIVE=<routeFlowRelative> H15_STEP_ID=<stepId> H15_ROUTE_DECISION=<routeDecision> node \"$repo/bin/cli.mjs\" run --runner codex --json --file \"$repo/experiments/harness-arena/flows/frontier-reviewer.flow\""' \
  --live-frontier-repair-command 'bash -lc "repo=/path/to/prompt-language; H15_ROUTE_FLOW=<routeFlow> H15_ROUTE_FLOW_RELATIVE=<routeFlowRelative> H15_STEP_ID=<stepId> H15_ROUTE_DECISION=<routeDecision> node \"$repo/bin/cli.mjs\" run --runner codex --json --file <routeFlow>"' \
  --local-resource-snapshot-command 'powershell.exe -NoProfile -Command "ollama ps"' \
  --local-resource-snapshot-interval-ms 2000 \
  --local-endpoint ollama-powershell-stdin \
  --frontier-provider openai \
  --frontier-runner codex \
  --frontier-model codex-default \
  --run-id HA-HR1-H15-hybrid-qwen-coder-001 \
  --output-root .tmp/harness-arena
```

Replace `/path/to/prompt-language` before running. The local command runs the
task-specific H15 worker flow through Ollama. The normal frontier command runs the
read-only reviewer flow but still references `<routeFlow>` so the harness can
prove the route-specific flow was in scope. The repair command is separate and may
run the H15 worker flow through Codex only after the local step fails; that turns
the result into hybrid evidence, not local-only evidence.

Use `--local-resource-snapshot-command` for live local runs when host diagnostics
matter. The runner records before/after stdout, stderr, and metadata artifact refs
on each local step so `ollama ps`, GPU probes, or OS memory probes stay attached
to the manifest without changing the model-visible workspace. Add
`--local-resource-snapshot-interval-ms` when residency or utilization needs
during-step samples instead of edge-only snapshots. Check
`resourceSnapshotSummary` before inspecting raw artifacts; it reports how many
sample ticks were captured, how many probe commands failed, and whether sampled
stdout or stderr had output.

## Frontier Review Lane

Use frontier reasoning for final review or escalation diagnosis:

```powershell
$env:PL_SPAWN_RUNNER = 'codex'
node bin/cli.mjs run --runner codex --file experiments/harness-arena/flows/frontier-reviewer.flow
```

Expected output artifact:

- `hybrid-review.json`

External frontier calls are justified when at least one policy trigger is recorded:

- final read-only review of a high-risk diff
- security, permissions, auth, migration, or data-loss risk
- ambiguous architecture or cross-layer responsibility boundaries
- repeated local gate failure after the configured repair budget
- local no-edit, timeout, or export/interface collapse that needs root-cause
  diagnosis
- conflicting evidence between tests, verifier output, and user intent

Do not use frontier calls to rescue a local-only claim batch. A frontier-assisted run
must be labeled as advisor-only, frontier-only, or hybrid-router in the manifest.

## Parent Pilot

The static-split pilot flow is:

```powershell
node bin/cli.mjs validate --runner codex --mode headless --file experiments/harness-arena/flows/hybrid-router-v0.flow
```

The HA-HR1 runner prepares isolated workspaces, keeps private verifier material
outside those workspaces, emits schema-shaped manifests, and can wrap explicit live
local/frontier lane commands. Full pilot runs still need task-specific commands
that:

- invoke the intended local/frontier flows
- record local GPU active minutes when available
- enforce frontier budget limits
- validate the manifest after the oracle runs

## Stop Conditions

Stop and classify the run as harness failure when:

- the oracle command appears in model-visible context
- the manifest is missing route, risk, ambiguity, artifact, or runner metadata
- local and frontier lanes edit the same files without parent approval
- a local timeout/no-edit is not classified
- frontier calls exceed the configured budget

Stop and classify the run as model or route failure, not harness failure, when:

- local work stays inside its sandbox but cannot satisfy public gates
- the local model preserves artifacts but collapses a required public API
- frontier review finds defects after local completion
- the router escalates too early or too late while still preserving manifests and
  oracle isolation

## Next Measurement

The first H15 hybrid-router measurement is recorded in
`docs/evaluation/2026-05-08-ha-hr1-h15-hybrid.md`. It reached
`qwen3-coder:30b`, then failed local inference with an Ollama runtime resource
limit before frontier repair passed the private oracle.

Do not repeat that same 30B H15 local lane on the same hardware unless the local
runtime or model quantization changes. The next useful decision point is:

- run a smaller H15-capable local candidate through the same hybrid profile; or
- run a frontier-only H15 baseline and compare wall time, frontier-call count, and
  estimated cost against the hybrid run.
