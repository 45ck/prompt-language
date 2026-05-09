# Team Of Agents Runbook

Status: active HA-HR1 operating procedure; live H14 and H15 route profiles
available.

This runbook is for the local-first/frontier-review pilot. It describes how to
run the team shape without implying that prompt-language has peer-agent
semantics.

The current evidence base now includes HA-HR1 route evidence:

- H14 local-only is promoted for `qwen3-coder:30b` on the checked H14 local
  portfolio routes, including full TDD under the hardened PowerShell stdin route.
- `devstral-small-2:24b` is the promoted full-H14 fallback after three clean
  full-lane passes, the promoted H15 PATCH test-authoring fallback after three
  clean committed-state tests-only passes, and also remains a fallback
  implementer for the bounded H14 implementation subroles.
- `qwen3-opencode:30b` is a fallback local implementer for H14
  implementation-from-tests and API-preservation only.
- H15 API endpoint work is not promoted local-only under `qwen3-coder:30b`; after
  the hybrid and frontier baselines, it is routed as `frontier-baseline`.

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
evidence. Manifests identify the oracle command by hash and
`private/oracle-command.txt`; the raw command must not be copied into public
manifest fields or the model-visible workspace.

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

Command templates also fail before execution when a placeholder is misspelled or
unavailable for the selected route profile. For example, `<workspce>` is rejected
instead of being passed through literally, and `<h15Flow>` is rejected outside an
H15 route context.

Command stdout/stderr artifacts are capped by `--command-output-limit-bytes`
(default `1048576`). Metadata records whether stdout or stderr was truncated plus
the original byte counts, so a noisy local command cannot silently inflate the
run artifact set.

Timed-out commands also record process-tree cleanup metadata. Check
`processTreeCleanupAttempted`, `processTreeCleanupMethod`, and
`processTreeCleanupSucceeded` in step, resource, or oracle metadata before
treating a timeout as contained.

By default, live command templates use `--command-safety-policy deny-high-risk`.
That blocks shell wrappers, network clients, package-manager mutation,
destructive filesystem commands, service/process control, and git mutation before
execution. Add `--command-safety-policy unrestricted` only for trusted
reproduction commands that intentionally need a shell wrapper or PowerShell
resource probe; the manifest records that weaker containment claim.

For the H14 fixture, use the H14-specific local flow instead of the generic
local-bulk flow:

```sh
node experiments/harness-arena/runner.mjs \
  --live \
  --command-safety-policy unrestricted \
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
  --command-safety-policy unrestricted \
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

For current H15 endpoint work, use the H15 route profile. It defaults to
`frontier-only`, so live execution requires only the frontier command template:

```sh
repo=/path/to/prompt-language

node "$repo/experiments/harness-arena/runner.mjs" \
  --live \
  --command-safety-policy unrestricted \
  --h15-qwen-coder-task api-endpoint \
  --live-frontier-command 'bash -lc "repo=/path/to/prompt-language; H15_ROUTE_FLOW=<routeFlow> H15_ROUTE_FLOW_RELATIVE=<routeFlowRelative> H15_STEP_ID=<stepId> H15_ROUTE_DECISION=<routeDecision> node \"$repo/bin/cli.mjs\" run --runner codex --json --file <routeFlow>"' \
  --frontier-provider openai \
  --frontier-runner codex \
  --frontier-model codex-default \
  --run-id HA-HR1-H15-frontier-only-codex-002 \
  --output-root .tmp/harness-arena
```

Replace `/path/to/prompt-language` before running. The frontier command runs the
task-specific H15 worker flow through Codex and references `<routeFlow>` so the
harness can prove the route-specific flow was in scope.

Do not rerun the full H15 local or hybrid lane on this hardware just because the
route exists historically. Local H15 work should be a separate experimental
micro-flow first: validation-only implementation or PATCH test authoring. The
one-defect repair route now resolves to frontier-only through
`--h15-qwen-coder-task repair-short-name`; local repair evidence is negative for
both qwen3-coder and Devstral. The checked-in repair oracle is
`experiments/harness-arena/oracles/h15-validation-repair-short-name-oracle.mjs`;
use it for any future materially different repair-loop evidence instead of
public tests alone. A frontier-assisted follow-up must be labeled as
advisor-only, frontier-only, or hybrid-router in the manifest, not local-only.

For the checked-in validation-only local screen, use the same H15 route profile
with the validation task alias. Run
`HA-HR1-H15-validation-only-qwen-coder-002` passed public tests `14/14` and the
private oracle `8/8` with zero frontier calls, so this is positive local
diagnostic evidence only, not full H15 endpoint ownership:

```sh
repo=/path/to/prompt-language

node "$repo/experiments/harness-arena/runner.mjs" \
  --live \
  --command-safety-policy unrestricted \
  --h15-qwen-coder-task validation-only \
  --live-local-command 'bash -lc "repo=/path/to/prompt-language; PROMPT_LANGUAGE_OLLAMA_TRANSPORT=powershell PROMPT_LANGUAGE_OLLAMA_TIMEOUT_MS=600000 PROMPT_LANGUAGE_OLLAMA_ACTION_ROUNDS=16 node \"$repo/bin/cli.mjs\" run --runner ollama --model qwen3-coder:30b --json --file <routeFlow>"' \
  --local-resource-snapshot-command 'powershell.exe -NoProfile -Command "ollama ps"' \
  --local-resource-snapshot-interval-ms 2000 \
  --local-endpoint ollama-powershell-stdin \
	  --run-id HA-HR1-H15-validation-only-qwen-coder-001 \
	  --output-root .tmp/harness-arena
```

For the checked-in PATCH test-authoring local screen, use the test-authoring
task alias. This is a tests-only diagnostic; the local model may edit only
`src/test.js`, and the private oracle rejects implementation edits and shallow
tests that do not catch broken PATCH validation mutants:

```sh
repo=/path/to/prompt-language

node "$repo/experiments/harness-arena/runner.mjs" \
  --live \
  --command-safety-policy unrestricted \
  --h15-qwen-coder-task test-authoring \
  --live-local-command 'bash -lc "repo=/path/to/prompt-language; PROMPT_LANGUAGE_OLLAMA_TRANSPORT=powershell PROMPT_LANGUAGE_OLLAMA_TIMEOUT_MS=600000 PROMPT_LANGUAGE_OLLAMA_ACTION_ROUNDS=12 node \"$repo/bin/cli.mjs\" run --runner ollama --model qwen3-coder:30b --json --file <routeFlow>"' \
  --local-resource-snapshot-command 'powershell.exe -NoProfile -Command "ollama ps"' \
  --local-resource-snapshot-interval-ms 2000 \
  --local-endpoint ollama-powershell-stdin \
  --run-id HA-HR1-H15-patch-test-authoring-qwen-coder-001 \
  --output-root .tmp/harness-arena
```

For the promoted Devstral fallback on this same tests-only route, also pass
`--local-model devstral-small-2:24b` and use
`--model devstral-small-2:24b` inside the live local command. The H15 profile
rejects Devstral on validation-only, Devstral has negative H15 validation-repair
evidence, and the profile rejects local-arm overrides for the full endpoint route.

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
- validate the manifest after the oracle runs

Budget limits are now runner inputs, not just prose. Use these flags on live
claim runs so each manifest records the allowed frontier calls, local repair
attempts, wall-clock budget, cost budget, and retry policy:

```sh
--frontier-call-limit 4 \
--local-repair-attempt-limit 1 \
--wall-seconds-limit 3600 \
--usd-limit 0 \
--retry-policy first-local-failure
```

The runner rejects live runs whose selected arms require more planned frontier
steps than `--frontier-call-limit`. Set `--local-repair-attempt-limit 0` when a
hybrid-router run should diagnose local failure without inserting a frontier
repair step.

## Stop Conditions

Stop and classify the run as harness failure when:

- the oracle command appears in model-visible context
- the raw oracle command appears in public manifest fields instead of only
  `private/oracle-command.txt`
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

The first smaller local screen used `devstral-small-2:24b`. It stayed resident
at 16 GB on GPU and made partial PATCH progress, but timed out at 900s and failed
the private oracle because validation rules and PATCH test coverage were
incomplete.

The smaller installed Gemma OpenCode fallback `gemma4-opencode:e2b` was also
screened with the explicit 4K-context Prompt Language smoke. It loaded at
`7.7 GB`, `75%/25% CPU/GPU`, and `4096` context, but failed PLR-007 through the
PowerShell bridge before writing a result artifact. Do not use it as the cheap
classifier/reviewer route on this transport.

The Vulkan-tagged `gemma4-opencode-vulkan:e2b` package reached the same residency
and explicit context, but failed PLR-007 after exhausting the default
8 action-round budget. It is also not a cheap classifier/reviewer route under the
current smoke contract.

The first frontier-only baseline passed the same H15 task with one Codex call in
328.917s. That is currently stronger than the hybrid route for H15: fewer frontier
calls, less wall time, and no local runtime failure.

Do not repeat the same 30B H15 local lane on the same hardware unless the local
runtime or model quantization changes. Do not promote `devstral-small-2:24b` for
H15 local-only. Use frontier-only as the current H15 baseline. The next useful
local decision point is:

- screen another smaller code-focused model with a narrower validation/test
  micro-flow before another full H15 local-only attempt.
