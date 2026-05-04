# Team Of Agents Runbook

Status: planned HA-HR1 operating procedure; dry-run structure runner available.

This runbook is for the local-first/frontier-review pilot. It describes how to
run the team shape without implying that prompt-language has peer-agent
semantics.

The current evidence base is adjacent, not completed HA-HR1 evidence. FSCRUD R28
showed that local Ollama plus prompt-language scaffolding can improve artifact
coverage over solo local prompting, but it also showed a concrete local failure mode:
domain export-surface collapse under natural-language micro-contract edits. Use that
as routing evidence, not as proof that hybrid routing works.

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

Stop and classify the run as model or route failure, not harness failure, when:

- local work stays inside its sandbox but cannot satisfy public gates
- the local model preserves artifacts but collapses a required public API
- frontier review finds defects after local completion
- the router escalates too early or too late while still preserving manifests and
  oracle isolation

## Next Measurement

Run one fixture across four arms before claiming anything:

- local-only
- frontier-only
- advisor-only
- hybrid-router

The hybrid-router arm needs fewer frontier calls than frontier-only and an equal
or better oracle result than local-only before the policy is worth scaling.
