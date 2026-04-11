# CRM SDLC low-cost runner experiment plan

## Experiment name

Phased CRM SDLC starter run on the low-cost OpenCode baseline, with an optional free-model comparison lane.

## Decision this plan must answer

Can the CRM starter produce a bounded, reviewable CRM delivery pack on a lower-cost runner surface without collapsing into constant manual rescue?

This plan is intentionally narrower than the full thesis run:

- Lane A is the required hosted low-cost baseline: `--runner opencode --model opencode/gpt-5-nano`
- Lane B is optional and only runs if a free-model host already exists: `--runner opencode --model ollama/gemma4:e2b`
- The plan does not claim full headless parity with Claude, because the checked-in coordinator currently contains two `approve` nodes

## Preconditions

Do not run this experiment until all of the following are true:

1. The OpenCode minimal gate subset has already classified Lane A as usable for cheap experiments.
2. The target repo already has the required stack available: `prompt-language`, `skill-harness`, `noslop`, `manual-qa-machine`, and `demo-machine`.
3. The target repo already exposes real product verification commands: `lint`, `typecheck`, and `test`.
4. The operator agrees to a phased protocol instead of a single end-to-end headless run, because `approve` is blocked in headless mode.

If those conditions are not met, keep this as a planning artifact and do not report the CRM starter as executed.

## Product under test

A bounded CRM MVP for Newcastle and Hunter SMEs with:

- auth
- contacts
- companies
- opportunities and pipeline stages
- tasks
- notes and activities
- dashboard reporting

## Fixed source fixtures

These repo fixtures are the authority for the starter itself:

- `examples/crm-sdlc/project.flow`
- `examples/crm-sdlc/libraries/discovery.flow`
- `examples/crm-sdlc/libraries/architecture.flow`
- `examples/crm-sdlc/libraries/implementation.flow`
- `examples/crm-sdlc/libraries/quality.flow`
- `examples/crm-sdlc/libraries/release.flow`
- `examples/crm-sdlc/qa-flows/crm-smoke.json`
- `examples/crm-sdlc/demo/crm.demo.yaml`

## Run fixtures to prepare in the target repo

Because the checked-in coordinator has two `approve` checkpoints, the lower-cost runner plan uses three temporary phase fixtures in the target repo. These are experiment fixtures, not source-of-truth replacements.

1. `fixtures/opencode/crm-phase-1-discovery.flow`
   Covers bootstrap, research, requirements, architecture synthesis, and stops immediately before the first approval boundary.
2. `fixtures/opencode/crm-phase-2-build.flow`
   Starts from the already-reviewed scope pack, runs backend, frontend, engineering docs, local verification, MQM, and demo generation, and stops immediately before the second approval boundary.
3. `fixtures/opencode/crm-phase-3-release.flow`
   Starts from the already-reviewed QA and demo artifacts, runs release preparation, and evaluates the ship gates.

Each phase fixture should preserve the same prompts, imports, and gates from the starter, but omit the `approve` node that would otherwise block headless execution.

## Environment notes

Record the environment for every run:

- date
- host label
- OS
- shell
- git SHA of the target repo
- runner
- exact model
- Node.js version
- package manager

Lane-specific notes:

- Lane A is required on the main workstation: `opencode/gpt-5-nano`
- Lane B is optional and only allowed on a host where Ollama plus `gemma4:e2b` is already provisioned
- Do not install local models on the main workstation just to satisfy Lane B
- Do not count native Windows live-smoke limitations as experiment failure for this plan; this is a headless runner experiment, not a Claude hook-loop proof

Required secrets and tools:

- `OPENCODE_API_KEY` for Lane A
- `OLLAMA_HOST` or equivalent local-model environment only if Lane B already exists
- `mqm` on `PATH`
- `demo-machine` on `PATH`

## Commands

### 1. Validate the checked-in starter before creating any run fixture

```bash
npx @45ck/prompt-language validate --file examples/crm-sdlc/project.flow
```

### 2. Confirm the unchanged coordinator is not headless-safe

This command should be captured as an expected blocker because `approve` is unsupported in headless mode:

```bash
npx @45ck/prompt-language validate --runner opencode --mode headless --json --file examples/crm-sdlc/project.flow
```

### 3. Run the three phase fixtures on the required hosted baseline

```bash
npx @45ck/prompt-language run --runner opencode --model opencode/gpt-5-nano --json --file fixtures/opencode/crm-phase-1-discovery.flow
npx @45ck/prompt-language run --runner opencode --model opencode/gpt-5-nano --json --file fixtures/opencode/crm-phase-2-build.flow
npx @45ck/prompt-language run --runner opencode --model opencode/gpt-5-nano --json --file fixtures/opencode/crm-phase-3-release.flow
```

### 4. Run the optional free-model comparison lane only on a pre-provisioned host

```bash
npx @45ck/prompt-language run --runner opencode --model ollama/gemma4:e2b --json --file fixtures/opencode/crm-phase-1-discovery.flow
npx @45ck/prompt-language run --runner opencode --model ollama/gemma4:e2b --json --file fixtures/opencode/crm-phase-2-build.flow
npx @45ck/prompt-language run --runner opencode --model ollama/gemma4:e2b --json --file fixtures/opencode/crm-phase-3-release.flow
```

### 5. Capture the target repo verification outputs separately

These commands must be run in the target repo after phase 2 and again after phase 3:

```bash
pnpm lint
pnpm typecheck
pnpm test
noslop check --tier=fast
noslop check --tier=slow
mqm validate --flow ./qa-flows/crm-smoke.json
mqm run --flow ./qa-flows/crm-smoke.json
demo-machine validate demo/crm.demo.yaml
demo-machine run demo/crm.demo.yaml --output artifacts/demo
```

If the target repo uses another package manager, record the substitution explicitly and keep it consistent across all lanes.

## Success metrics

The hosted baseline lane is considered successful only if all of the following are true:

1. All three phase fixtures finish with executable runner results rather than profile blockers.
2. The target repo contains all required delivery artifacts:
   - `docs/prd.md`
   - `docs/research/competitors.md`
   - `docs/architecture/domain-model.md`
   - `docs/api-contracts.md`
   - `qa-flows/crm-smoke.json`
   - `demo/crm.demo.yaml`
   - release or handover docs
3. `lint`, `typecheck`, `test`, `noslop check --tier=fast`, and `noslop check --tier=slow` all pass at the end of the run.
4. MQM validates and executes at least one smoke flow successfully.
5. Demo-machine validates the demo spec and produces `artifacts/demo`.
6. Human intervention stays within the budget:
   - at most 12 interventions total
   - no more than 4 interventions in any single phase
   - approval reviews do not count as rescue interventions, but any post-review repair loop does
7. The operator can point to flow- or fixture-level fixes for recurring failures instead of relying mainly on hand-editing generated code.

Lane B is informative only. It does not replace Lane A as the decision surface.

## Failure conditions

Classify the hosted baseline as failed for this bead if any of the following happen:

- a phase fixture is blocked by runner limitations other than the already-known `approve` boundary
- the repo reaches implementation but cannot pass verification gates
- MQM or demo generation cannot validate from the generated product state
- more than 12 manual rescue interventions are needed
- the resulting docs and code drift outside the bounded CRM scope
- the free-model lane is the only lane that works; that does not rescue a failed hosted baseline

## What to measure

### Quantitative

- phase completion count out of 3
- artifact completion count out of 7 required delivery groups
- pass or fail counts for `lint`, `typecheck`, `test`, fast noslop, slow noslop, MQM validate, MQM run, demo validate, and demo run
- total runner wall-clock time per phase
- total human interventions
- reruns needed per phase

### Qualitative

- scope discipline
- coherence between PRD, domain model, API contracts, implementation, QA flow, and demo flow
- whether `spawn` seams helped or just multiplied repair work
- whether the phase-fixture split feels like a practical lower-cost protocol or an awkward workaround
- whether recurring failures are better fixed in orchestration files or in downstream code

## Follow-up evidence expectations

Store or link all of the following when the experiment is run:

- the three runner JSON outputs for each lane
- exact shell commands used for every lane
- a short note explaining why the unchanged `project.flow` could not run headlessly
- the final target repo tree
- copies or paths for the generated docs pack
- final gate outputs
- MQM report paths
- demo artifact paths
- intervention log with timestamps and reasons
- a short retrospective with one of these verdicts:
  - `usable low-cost starter baseline`
  - `baseline-only, not ready for wider starter use`
  - `not ready`

## Review questions

After the run, answer these:

1. Did the phased lower-cost runner protocol reduce cost without hiding meaningful failure modes?
2. Did the approval boundaries belong where they are, or should the starter be refactored for cleaner headless segmentation?
3. Were the spawned worker seams real enough to justify the coordination overhead?
4. Did QA and demo generation remain grounded in the actual product state?
5. Would you trust this lower-cost lane to screen future starter experiments before a more expensive thesis-grade run?
