# Team Of Agents Runbook

Status: planned HA-HR1 operating procedure; dry-run structure runner available.

This runbook is for the local-first/frontier-review pilot. It describes how to
run the team shape without implying that prompt-language has peer-agent
semantics.

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

## Local Bulk Lane

Use local inference for bulk work:

```powershell
$env:PL_SPAWN_RUNNER = 'ollama'
$env:PROMPT_LANGUAGE_OLLAMA_BASE_URL = 'http://127.0.0.1:11434'
$env:PROMPT_LANGUAGE_OLLAMA_TIMEOUT_MS = '600000'
$env:PROMPT_LANGUAGE_OLLAMA_ACTION_ROUNDS = '16'
node bin/cli.mjs run --runner ollama --model qwen3-opencode-big:30b --file experiments/harness-arena/flows/local-bulk-worker.flow
```

Expected output artifact:

- `local-worker-summary.md`

## Frontier Review Lane

Use frontier reasoning for final review or escalation diagnosis:

```powershell
$env:PL_SPAWN_RUNNER = 'codex'
node bin/cli.mjs run --runner codex --file experiments/harness-arena/flows/frontier-reviewer.flow
```

Expected output artifact:

- `hybrid-review.json`

## Parent Pilot

The static-split pilot flow is:

```powershell
node bin/cli.mjs validate --runner codex --mode headless --file experiments/harness-arena/flows/hybrid-router-v0.flow
```

The dry-run runner already prepares isolated workspaces, keeps private verifier
material outside those workspaces, and emits schema-shaped manifests. A real
HA-HR1 runner still needs to wrap this flow so it can:

- invoke live local/frontier lanes
- capture per-lane runner/model/cwd metadata
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

## Next Measurement

Run one fixture across four arms before claiming anything:

- local-only
- frontier-only
- advisor-only
- hybrid-router

The hybrid-router arm needs fewer frontier calls than frontier-only and an equal
or better oracle result than local-only before the policy is worth scaling.
