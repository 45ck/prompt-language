# Helpdesk SDLC low-cost runner execution template and checklist

Use this file as the operator run packet when executing bead `prompt-language-bd5o.2`.

This is intentionally execution-oriented:

- copy it into the target repo as `docs/experiments/helpdesk-sdlc-run-<date>.md`
- fill every field
- keep command output links/paths exact

## 1) Run metadata

- Run date:
- Operator:
- Host label:
- OS + version:
- Shell:
- Target repo path:
- Target repo git SHA:
- Node.js version:
- Package manager + version:

## 2) Lane selection

- Required Lane A (hosted): `--runner opencode --model opencode/gpt-5-nano`
- Optional Lane B (free-model): `--runner opencode --model ollama/gemma4:e2b`

Checklist:

- [ ] Lane A selected
- [ ] Lane B either selected on pre-provisioned host or explicitly skipped
- [ ] Skip reason for Lane B recorded if skipped

Lane B skip reason (if applicable):

## 3) Preconditions checklist

- [ ] OpenCode baseline already documented as usable for low-cost starter experiments
- [ ] `prompt-language`, `skill-harness`, `noslop`, `manual-qa-machine`, `demo-machine` available in target repo
- [ ] Product verification commands exist: `lint`, `typecheck`, `test`
- [ ] `OPENCODE_API_KEY` available for Lane A
- [ ] `mqm` on `PATH`
- [ ] `demo-machine` on `PATH`
- [ ] For Lane B only: Ollama host/model already provisioned (no new local install for this bead)

## 4) Fixture preparation checklist

- [ ] Source starter copied/adapted from `examples/helpdesk-sdlc/`
- [ ] `fixtures/opencode/helpdesk-phase-1-discovery.flow` created
- [ ] `fixtures/opencode/helpdesk-phase-2-build.flow` created
- [ ] `fixtures/opencode/helpdesk-phase-3-release.flow` created
- [ ] Each phase fixture preserves starter prompts/imports/gates and only removes/segments `approve` boundaries

## 5) Validation commands and outputs

Command (starter parse/lint):

```bash
npx @45ck/prompt-language validate --file examples/helpdesk-sdlc/project.flow
```

Output path or paste key result:

Command (expected headless blocker on unchanged coordinator):

```bash
npx @45ck/prompt-language validate --runner opencode --mode headless --json --file examples/helpdesk-sdlc/project.flow
```

Output path or paste key result (must capture `approve` blocker evidence):

## 6) Lane execution log

### Lane A (required)

```bash
npx @45ck/prompt-language run --runner opencode --model opencode/gpt-5-nano --json --file fixtures/opencode/helpdesk-phase-1-discovery.flow
npx @45ck/prompt-language run --runner opencode --model opencode/gpt-5-nano --json --file fixtures/opencode/helpdesk-phase-2-build.flow
npx @45ck/prompt-language run --runner opencode --model opencode/gpt-5-nano --json --file fixtures/opencode/helpdesk-phase-3-release.flow
```

- Phase 1 JSON result path:
- Phase 2 JSON result path:
- Phase 3 JSON result path:
- Phase outcomes summary:

### Lane B (optional)

```bash
npx @45ck/prompt-language run --runner opencode --model ollama/gemma4:e2b --json --file fixtures/opencode/helpdesk-phase-1-discovery.flow
npx @45ck/prompt-language run --runner opencode --model ollama/gemma4:e2b --json --file fixtures/opencode/helpdesk-phase-2-build.flow
npx @45ck/prompt-language run --runner opencode --model ollama/gemma4:e2b --json --file fixtures/opencode/helpdesk-phase-3-release.flow
```

- Phase 1 JSON result path:
- Phase 2 JSON result path:
- Phase 3 JSON result path:
- Phase outcomes summary:

If Lane B skipped, state explicitly: `SKIPPED - <reason>`.

## 7) Verification gate commands (run after phase 2 and again after phase 3)

```bash
pnpm lint
pnpm typecheck
pnpm test
noslop check --tier=fast
noslop check --tier=slow
mqm validate --flow ./qa-flows/helpdesk-smoke.json
mqm run --flow ./qa-flows/helpdesk-smoke.json
demo-machine validate demo/helpdesk.demo.yaml
demo-machine run demo/helpdesk.demo.yaml --output artifacts/demo
```

If non-`pnpm` package manager is used, record substitutions:

- lint command used:
- typecheck command used:
- test command used:

Gate outcomes (phase 2):

- [ ] lint
- [ ] typecheck
- [ ] test
- [ ] noslop fast
- [ ] noslop slow
- [ ] MQM validate
- [ ] MQM run
- [ ] demo validate
- [ ] demo run

Gate outcomes (phase 3):

- [ ] lint
- [ ] typecheck
- [ ] test
- [ ] noslop fast
- [ ] noslop slow
- [ ] MQM validate
- [ ] MQM run
- [ ] demo validate
- [ ] demo run

## 8) Required artifact checklist

- [ ] `docs/prd.md`
- [ ] `docs/research/competitors.md`
- [ ] `docs/architecture/domain-model.md`
- [ ] `docs/api-contracts.md`
- [ ] `qa-flows/helpdesk-smoke.json`
- [ ] `demo/helpdesk.demo.yaml`
- [ ] release/handover docs
- [ ] demo output under `artifacts/demo`

## 9) Intervention log

Use one line per intervention. Approval reviews do not count unless they trigger repair work.

| Timestamp | Phase | Lane | Intervention reason | Action taken | Counted toward rescue budget (Y/N) |
| --------- | ----- | ---- | ------------------- | ------------ | ---------------------------------- |
|           |       |      |                     |              |                                    |

Budget checks:

- [ ] Total rescue interventions <= 12
- [ ] No single phase > 4 rescue interventions

## 10) Closure checklist (bead readiness)

Hosted baseline pass conditions:

- [ ] Lane A completed all 3 phases without non-`approve` profile blockers
- [ ] All required artifacts produced
- [ ] End-state verification gates pass
- [ ] MQM and demo-machine executed successfully from generated product state
- [ ] Intervention budget respected
- [ ] Evidence pack assembled with exact paths

Final verdict (choose one):

- [ ] `usable low-cost starter baseline`
- [ ] `baseline-only, not ready for wider starter use`
- [ ] `not ready`

Bead closure-ready:

- [ ] Yes
- [ ] No

If No, record blockers:
