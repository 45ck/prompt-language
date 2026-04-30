# Experiment Catalog

Comprehensive index of all prompt-language experiments. Each experiment tests a specific hypothesis about whether structured flow orchestration improves AI-driven software delivery compared to unstructured prompting.

Last updated: 2026-04-30

## Summary Table

| ID     | Name                         | Domain                         | Status      | Runs                | Key Result                                 |
| ------ | ---------------------------- | ------------------------------ | ----------- | ------------------- | ------------------------------------------ |
| E1     | Repeated Failure Elimination | Eval framework                 | Seeded      | 2 (vanilla + gated) | Gated 1/3 vs Vanilla 0/3                   |
| E4     | CRM Factory (Codex)          | Enterprise SaaS                | Complete    | 16 runs (A02-A19)   | Codex-alone faster; PL better auditability |
| E5     | Maintenance Viability        | Runtime provenance             | Designed    | 0                   | Program designed, not yet executed         |
| E6     | Pure PL CRM Factory          | Enterprise SaaS                | Designed    | 0                   | Parse-verified, not yet executed live      |
| E7     | Enterprise CRM Factory       | Enterprise SaaS (full SDLC)    | Complete    | --                  | Most comprehensive PL factory to date      |
| E7-MK  | Marketing Factory            | Marketing website              | Complete    | 7+ runs             | PL 30/30 x3 (100%) vs Solo 28.3/30 (94%)   |
| E8     | Website Factory              | Marketing website (enterprise) | Complete    | 4 runs              | Factory 3/4, Solo 4/4                      |
| E9     | Full SDLC Factory            | Full lifecycle website         | Complete    | 2 runs + QA variant | Phases 1-5 execute end-to-end              |
| FSCRUD | Full-Stack CRUD Comparison   | Local full-stack CRUD          | Designed    | 0                   | Direct local vs PL factory plan authored   |
| HA-HR1 | Hybrid Model Routing         | Stack/routing comparison       | Planned     | 0                   | Local bulk + frontier escalation designed  |
| SPP    | Senior Pairing Protocol      | Local-model supervision        | Planned     | 0                   | Senior metacognition protocol authored     |
| --     | Aider vs PL                  | Coding assistant comparison    | Complete    | 10 hypotheses       | PL 6 wins, 0 losses, 3 ties                |
| --     | Meta-Factory                 | Self-hosting (PL writes PL)    | In Progress | M1 authored         | M1 flow authored, not yet executed live    |
| --     | Premature Stop Benchmark     | Reliability                    | Scaffold    | 0                   | Experiment designed, not executed          |
| --     | Bounded Feature Benchmark    | Implementation quality         | Scaffold    | 0                   | Experiment designed, not executed          |
| --     | Parallel Planning            | Coordination                   | Scaffold    | 0                   | Experiment designed, not executed          |
| --     | Parallel Isolated Modules    | Build concurrency              | Scaffold    | 0                   | Experiment designed, not executed          |
| --     | Self-Healing CI              | CI repair                      | Scaffold    | 0                   | Experiment designed, not executed          |

---

## E1: Repeated Failure Elimination

**Directory**: [`eval/`](eval/) and [`results/e1-repeated-failure/`](results/e1-repeated-failure/)

**Hypothesis**: Wrapping a prompt in a gated prompt-language flow (with `done when:` checks) eliminates repeated failure patterns that unstructured prompts exhibit -- specifically gaslighting about code state, narrow prompt framing, and review-style prompts that invite commentary instead of repair.

**Status**: Seeded

**Methodology**: A JSONL dataset of 3 failure cases is run through two candidates:

- `vanilla`: raw prompt, no orchestration
- `gated`: same prompt wrapped in a PL flow with `gate fixture_tests: node test.js`

**Key Results**:

- Vanilla: 0/3 cases pass
- Gated: 1/3 cases pass (winning case: `e1.narrow-scope.v1`)
- Runner: Codex with gpt-5.2
- Narrow but real lift for the gated candidate

**Artifacts**: Locked baselines at `results/e1-repeated-failure/v1/codex-vanilla.json` and `codex-gated.json`

**Planned follow-on suites**: E2 (single vs multi-file), E3 (wisdom accumulation), E4 (factory starters), E5 (parallel specialists) -- paths planned but not yet seeded.

---

## E4: CRM Factory (Codex)

**Directory**: [`full-saas-factory/e4-codex-crm-factory/`](full-saas-factory/e4-codex-crm-factory/) and [`results/e4-factory/`](results/e4-factory/)

**Hypothesis**: `prompt-language` improves bounded product delivery when Codex is asked to build a CRM MVP with limited starting context, because the flow pack supplies explicit phase structure, parallel seams, verification gates, and artifact requirements that Codex-alone must reconstruct ad hoc.

**Status**: Complete (16 runs across 5 batches)

**Product Scope**: Bounded CRM MVP -- auth, contacts, companies, opportunities/pipeline, tasks, notes/activities, dashboard reporting.

**PL Patterns Used**: spawn/await, foreach-spawn, race, retry, review

**Key Results**:

- 16 runs total (A02 through A19), organized into batches B01-B06
- Both lanes can build the bounded CRM core slice and pass lint/typecheck/test
- **Direct Codex is faster** on raw throughput: median 719s vs 1514s in the first claim-eligible batch (B02)
- **PL is better** on auditability, experiment structure, and process fidelity (factoryQuality 10 vs 8)
- B02 batch verdict: `codex-alone-better` on throughput
- A06 comparative verdict: `mixed`
- PL reached first relevant workspace write earlier but did not translate to faster verified completion

**Notable Findings**:

1. Product capability is at parity for this scope -- PL does not block or degrade core product completion
2. Direct Codex has simpler setup and faster raw time-to-green
3. PL's advantage is in auditability and structured experiment evidence, not raw speed
4. Windows-specific launcher/path friction affected early PL runs

**Run Evidence**: Each run includes manifest.json, outcome.md, postmortem.md, interventions.md, scorecard.json, and trace-summary.md. See [`results/e4-factory/comparison.md`](results/e4-factory/comparison.md) for the full analysis.

---

## E5: Maintenance Viability

**Directory**: [`results/e5-maintenance/`](results/e5-maintenance/) and [`results/e4-method/`](results/e4-method/)

**Hypothesis**: PL-first lanes produce software that a separate, uninvolved lane can run, extend, and maintain with less rework than codex-first output. If both outputs are equally maintainable, the PL investment is unjustified for this scope.

**Status**: Designed (program document complete, no runs executed)

**Methodology**: Four metric families:

1. Feature completion (gating precondition)
2. Build health (gating precondition)
3. Clone-to-interaction time (gating precondition)
4. Maintenance viability index (primary endpoint)

E5 deliberately demotes E4's process-fidelity signals (`processConformance`, `traceAuthority`, `reuseReadiness`) to supporting context. Only product viability under a second party counts.

**Supporting Documents**:

- `results/e4-method/claim-families.md` -- detailed claim family definitions
- `results/e4-method/artifact-contract.md` -- what each lane must produce
- `results/e4-method/build-verification-contract.md` -- build verification rules
- `results/e4-method/closure-enforcement.md` -- run closure rules
- `results/e4-method/trace-provenance-contract.md` -- trace verification
- `results/e4-method/sdlc-default-gates.md` -- default gate definitions

---

## E6: Pure PL CRM Factory

**Directory**: [`full-saas-factory/e6-pl-crm-factory/`](full-saas-factory/e6-pl-crm-factory/)

**Hypothesis**: If prompt-language is a credible primary engineering medium, a factory for a real product (bounded CRM MVP) should be expressible as one top-level `project.flow`, a small set of phase flows, reusable micro-flow libraries, and nothing else -- no runner-specific prompts, no shell orchestration, no bootstrap directories.

**Status**: Designed (parse-verified, not yet executed live)

**PL Patterns Used**: spawn/await, foreach (CRUD generation), import/use (libraries), remember (persistent state), done when (ship gates)

**Layout**:

- `project.flow` -- top-level orchestration
- `phases/` -- discovery.flow, build.flow, release.flow
- `libraries/` -- scaffold-project.flow, generate-crud-entity.flow, run-acceptance.flow, git-commit.flow, install-dependencies.flow

**Key Difference from E4**: PL is the entire contract. No Codex-specific prompt templates, no shell orchestration, no bootstrap directory. Any PL-capable agent can consume the same flow pack.

**Entities**: 3 core entities (contact, company, opportunity) -- simpler than E7's 15.

---

## E7: Enterprise CRM Factory

**Directory**: [`full-saas-factory/e7-enterprise-crm-factory/`](full-saas-factory/e7-enterprise-crm-factory/)

**Hypothesis**: If prompt-language is a credible engineering medium, an enterprise CRM factory should be expressible with full SDLC phases, parallelism, quality gates, security audits, review loops, and deployment -- the way a real engineering team works.

**Status**: Complete (most comprehensive PL factory to date)

**Scope**: 15 business entities + 5 system features across 6 SDLC phases + scaffold:

- Phase 0: Scaffold
- Phase 1: Discovery (3 parallel spawns + review + approve)
- Phase 2: Architecture (race + 4 parallel spawns + review + approve)
- Phase 3: Implementation (3 foundation spawns, 2 parallel builds, foreach-spawn 4 entity clusters, 5 system features, retry loops, approve)
- Phase 4: QA (4 parallel test suites with retry + review)
- Phase 5: Security (4 parallel tracks + review + approve)
- Phase 6: Release (3 parallel spawns + review + approve + try/catch deployment)

**PL Patterns Used**: Every major DSL primitive -- spawn/await, foreach-spawn, race, review, approve, retry, try/catch/finally, if/else, while/until, send/receive, remember, let/run, import/use, done when (37 ship gates).

**Agent Team**: 14 specialized agents with skill-harness loadouts (research-writer, requirements-analyst, ux-researcher, software-architect, system-modeler, backend-engineer, web-engineer, qa-automation-eng, test-designer, security-reviewer, pentest-reviewer, quality-reviewer, delivery-manager, workflow-engineer).

**Tech Stack**: Next.js 15, React 19, TypeScript, Tailwind CSS, Express/Hono, Prisma, PostgreSQL, Vitest, Playwright, Docker.

---

## E7-MK: Marketing Factory

**Directory**: [`marketing-factory/`](marketing-factory/)

**Hypothesis**: Three sub-hypotheses for marketing website generation:

- **MK-1**: PL gate loops produce websites that pass automated quality checks more reliably than solo prompts
- **MK-2**: PL `foreach` over required sections produces complete marketing sites while solo prompts miss sections
- **MK-3**: PL review loops produce copy that consistently matches brand voice while solo output drifts

**Status**: Complete (7+ runs across 3 versions)

**PL Patterns Used**: retry max 3, inline validation scripts, foreach (section generation), review loops

**Key Results** (V2 Multi-Run, 3 runs):

| Run | Factory (PL) | Solo  | Gap  |
| --- | ------------ | ----- | ---- |
| 2   | **30/30**    | 28/30 | +2   |
| 3   | **30/30**    | 29/30 | +1   |
| 4   | **30/30**    | 28/30 | +2   |
| Avg | **30.0**     | 28.3  | +1.7 |

- Factory: **100% consistency** (30/30 every run)
- Solo: **94.4% average** (28-29/30, variance across runs)
- MK-1 (quality/a11y): Tie -- both handle structural HTML well
- MK-2 (content/SEO): Factory wins -- favicon is a systematic solo failure (3/3 runs)
- MK-3 (brand voice): Factory wins -- product name consistency ("CloudPulse" vs "Cloud Pulse") intermittent solo failure

**Notable Finding**: "Retry-with-validation is the killer pattern -- not complex multi-agent orchestration, not phased workflows, just `retry max 3` with inline validation scripts. Simple, effective, deterministic."

---

## E8: Website Factory

**Directory**: [`website-factory/`](website-factory/)

**Hypothesis**: An enterprise multi-phase website build (discovery, architecture, design system, implementation, QA, release) using 22 flow files, 8 reusable libraries, and specialized agent assignments produces higher-quality output than a solo prompt.

**Status**: Complete (Run 1 done for both lanes)

**Product**: NightOwl -- a sleep tracking platform for knowledge workers.

**PL Patterns Used**: spawn/await, foreach-spawn, race, retry, review, approve, try/catch, if/else, remember, import

**Key Results**:

| Check                                         | Factory R1 (Astro) | Solo R1 (Next.js) | Solo R2 (Next.js) |
| --------------------------------------------- | ------------------ | ----------------- | ----------------- |
| Build passes                                  | PASS               | PASS              | PASS              |
| Lint clean                                    | FAIL               | PASS              | PASS              |
| Structure (>=5 src, >=3 components, >=3 dirs) | PASS               | PASS              | PASS              |
| Content (>=6/8 sections)                      | PASS (8/8)         | PASS (8/8)        | PASS (8/8)        |
| **Score**                                     | **3/4**            | **4/4**           | **4/4**           |

**Notable Findings**:

1. **PL runtime hooks did NOT activate** -- Claude interpreted the flow text as structured instructions and followed it faithfully, but without the runtime's auto-advance, state persistence, or gate enforcement
2. Factory produced 12 research/design documents that solo did not (personas, competitor analysis, ADRs, code review, a11y audit, security review)
3. Factory chose Astro via race pattern (evaluated Astro vs Next.js against criteria)
4. Factory produced 30 source files vs solo's 14; 11 directories vs 4
5. Solo was 4x faster (~3 min vs ~12 min) and lint-clean
6. Framework choice (Astro lacks default ESLint) caused the factory's lint failure

**Key Insight**: "Structured prompts produce qualitatively different output. Process structure != PL runtime."

---

## E9: Full SDLC Factory

**Directory**: [`full-sdlc-factory/`](full-sdlc-factory/)

**Hypothesis**: A single PL flow can orchestrate the complete Software Development Lifecycle -- requirements elicitation, design, task planning, implementation, QA, and iterative review -- producing a production-quality marketing website in one unattended session. Structured SDLC phases yield higher quality because each phase constrains the next.

**Status**: Complete (2 standard runs + QA-heavy variant)

**Product**: CloudPulse -- a cloud monitoring SaaS marketing website (single `index.html`).

**PL Patterns Used**: let = prompt (3 captures), foreach (task loop), run (4 QA checks), until (review loop max 3), if/else (branch on APPROVED), break, done when (3 composite gates)

**Standard Flow** (5 phases):

1. Requirements and Design (3 `let = prompt` captures producing brand.md, requirements.md, design.md)
2. Task Planning (1 capture producing tasks.md)
3. Implementation (`foreach task` loop building index.html)
4. QA (4 automated checks: structure, a11y, SEO, brand compliance producing qa-report.md)
5. Review Loop (`until requirements_met max 3`)

**QA-Heavy Variant** (7 phases, adds):

- Phase 4: Playwright E2E test generation and execution with `retry max 3`
- Phase 5: Lighthouse audit (a11y, SEO, performance, best-practices scores)
- Phase 6: Cyclomatic complexity and CSS metrics analysis
- Phase 7: Visual snapshot capture at 3 viewports (375px, 768px, 1280px)

**Scoring Rubric**: 100 points total -- Phase Completion (25), Quality Gates (15), Artifact Quality (30), SDLC Process Fidelity (30).

**Run Outputs**:

- Run 1: brand.md, requirements.md, design.md, tasks.md, index.html (67KB)
- Run 2: All of the above plus qa-report.md

---

## FSCRUD: Full-Stack CRUD Comparison

**Directory**: [`fullstack-crud-comparison/`](fullstack-crud-comparison/)

**Hypothesis**: Prompt-language improves local-model full-stack CRUD delivery when
the target has multiple entities, deterministic gates, and explicit cross-layer
contracts.

**Status**: Diagnostic probes running; no claim-grade paired batch yet

**Task**: FSCRUD-01 field-service work order tracker -- customers, assets, and work
orders with relationship validation, status rules, UI flows, seed data, tests, and
verification artifacts.

**Arms**:

- `solo-local-crud`: direct local-model prompt through aider or an equivalent local
  edit runner.
- `pl-local-crud-factory`: same local model controlled by
  `flows/pl-fullstack-crud-v1.flow`.

**Why this is next**: Existing E4/E7/E9/Aider/SPP results show PL's likely advantage
is governed quality, retries, exact requirements, and traceability, not speed. This
experiment directly tests the missing comparison: "build a full-stack CRUD app" with
and without prompt-language control on local inference.

---

## HA-HR1: Hybrid Model Routing

**Directory**: [`harness-arena/hybrid-model-routing.md`](harness-arena/hybrid-model-routing.md)

**Hypothesis**: A Prompt Language supervisor can reduce frontier-model usage by sending bulk work to local Ollama models while escalating only high-ambiguity, high-risk, or stuck repair steps to Codex/GPT-5.5-class models.

**Status**: Planned

**Arms**:

- Local-only: aider + Ollama under a task-tuned PL flow
- Frontier-only: Codex/GPT-5.5-class model for the whole task
- Advisor-only: frontier model plans/reviews, local model performs all edits
- Hybrid-router: local default, frontier escalation on explicit policy triggers

**Primary Metrics**: oracle pass rate, wall time, frontier calls per success, estimated USD cost per success, local GPU active minutes, and final review defect count.

**Key Design Point**: The router must be able to change the runner/model for the next unit of work. A pure advisor is only a baseline because advice can be ignored or mistranslated by the local model.

---

## SPP: Senior Pairing Protocol

**Directory**: [`senior-pairing-protocol/`](senior-pairing-protocol/)

**Hypothesis**: Prompt Language can encode senior-engineer metacognition and supervision strongly enough to improve local-model coding outcomes versus a solo local prompt.

**Status**: Planned (protocol, rubrics, task families, result templates, and parse-verified flow arms authored)

**Arms**:

- `solo-local`: local model receives the task directly
- `persona-only-control`: local model receives a senior-engineer persona prompt without PL checkpoints
- `pl-senior-pairing-local`: same local model runs under senior-pairing PL control
- `pl-senior-pairing-full-local`: exploratory full-feature PL probe with spawned reviewers
- `pl-hybrid-judge`: local model performs bulk work and a stronger external judge reviews high-risk decisions

**Primary Metrics**: deterministic oracle correctness, ambiguity handling, risk classification, test quality, minimality, repair discipline, and escalation judgment.

**Runtime Policy**: Runtime is telemetry, not a primary score. Local inference is expected to be slow; this experiment prioritizes decision quality and final artifact quality.

**Next Run**: SP01 ambiguous-priority merge across all three arms.

---

## Aider vs Prompt Language

**Directory**: [`aider-vs-pl/`](aider-vs-pl/)

**Hypothesis**: Prompt Language orchestration compensates for local model weaknesses through decomposition, verification gates, retry loops, and file scoping. The orchestrator does the thinking; the model does the typing.

**Status**: Phase 1 complete; Phase 2 partially run on local Ollama

**Model**: Qwen3 30B (Q4_K_M, local, Vulkan, AMD RX 7600 XT, ~42 tok/s)

**Phase 1 Results** (10 hypotheses):

| #   | Hypothesis                | Solo                 | PL                         | Winner |
| --- | ------------------------- | -------------------- | -------------------------- | ------ |
| H1  | Retry recovery            | Compiled 1st try     | Compiled 1st try           | TIE    |
| H2  | Gate enforcement TDD      | 7/10 tests           | 10/10 tests (3 retries)    | **PL** |
| H3  | Decomposed vs monolithic  | `any` types, 6 tests | `unknown` correct, 7 tests | **PL** |
| H4  | Variable capture pipeline | 7/10 docs            | 9/10 docs                  | **PL** |
| H5  | File scoping              | 0/3 after refactor   | 3/3 after refactor         | **PL** |
| H6  | Conditional branching     | Caught obvious error | Same + extra feature       | TIE    |
| H7  | Simple edit speed         | 172s avg             | 317s avg                   | TIE    |
| H8  | Foreach batch ops         | 0/4 spec-conformant  | 4/4 spec-conformant        | **PL** |
| H9  | Code structure quality    | Tests crash, 1/5 sep | Tests pass, 4/5 sep        | **PL** |
| H10 | Quality ceiling           | --                   | Grade B (A on impl)        | --     |

**Phase 1 Score**: PL 6 wins, Solo 0 wins, 3 ties.

**Key Findings**:

1. Gate loops are the killer feature (7/10 to 10/10 via retry)
2. Decomposition beats monolithic prompts (more type-correct, spec-conformant code)
3. File scoping prevents cross-file breakage
4. Variable capture improves output quality
5. Ties happen when the task is trivial
6. Speed tradeoff is real (1.5-3.5x slower) but acceptable at zero API cost

**Phase 2 update**: H11-H15 now have partial local-model evidence. The clean 2026-04-28 reruns show H12 tied at `8/9`, H14 favored solo at `8/8` vs PL `6/8`, and H15 favored PL at `10/10` vs solo `6/10`. The current conclusion is narrower than the Phase 1 headline: PL helps when the flow is task-fit and verifier-fed, but over-staging can make local models slower and less reliable.

**PL Runtime Verified**: `prompt-language ci --runner aider` successfully executed a .flow file end-to-end with full DSL parsing, gate evaluation, and audit trail.

---

## Meta-Factory

**Directory**: [`meta-factory/`](meta-factory/)

**Hypothesis**: Can prompt-language develop prompt-language? A meta-flow, running on a frozen snapshot of the DSL, should be able to author genuine, novel, runnable improvements to the DSL's own test corpus and source tree.

**Status**: In Progress (M1 flow authored, not yet executed live)

**Design Pillars**:

1. MD-1: Frozen runtime -- meta-flows execute against a frozen `dist/`
2. MD-2: Isolated worktree -- every run gets its own git worktree
3. MD-3: Authoritative gate -- only `npm run ci` and `npm run eval:smoke` decide success
4. MD-4: Trace-first -- every meta-run under `PL_TRACE=1 PL_TRACE_STRICT=1`
5. MD-5: One-target-per-run -- each meta-flow targets exactly one concrete addition

**Acceptance Criteria**:

- O1 PARSE: generated `.flow` parses cleanly
- O2 NOVELTY: grep-safe keyword absent before run, present after
- O3 RUNNABLE: targeted smoke test passes
- O4 TRACED: `verify-trace` exits 0
- O5 CATALOG: CLAUDE.md updated

**M1 Milestone**: "PL writes a smoke test" -- the first runnable meta-flow (`m1.flow`) that should produce a novel smoke test entry.

**Progress**:

- [x] Program scaffolded
- [x] M1 (PL-writes-smoke-test) authored as runnable DSL
- [ ] M1 executed live and accepted
- [ ] MF-2 through MF-9 authored
- [ ] Phases 1-4 fleshed out

---

## Premature Stop Benchmark

**Directory**: [`premature-stop-benchmark/`](premature-stop-benchmark/)

**Hypothesis**: A PL flow stops more quickly when it has enough evidence (via gate enforcement) compared to unstructured prompts that continue running unnecessarily.

**Status**: Scaffold (experiment directory created, no runs executed)

**PL Patterns**: stop hook

---

## Bounded Feature Benchmark

**Directory**: [`bounded-feature-benchmark/`](bounded-feature-benchmark/)

**Hypothesis**: A bounded implementation can complete a target feature faster or more reliably than a broader alternative when orchestrated through PL.

**Status**: Scaffold (experiment directory created, no runs executed)

**PL Patterns**: Various

---

## Parallel Planning

**Directory**: [`parallel-planning/`](parallel-planning/)

**Hypothesis**: Explicit parallel decomposition and coordination via PL `spawn/await` produces better plans than single-threaded planning.

**Status**: Scaffold (experiment directory created, no runs executed)

**PL Patterns**: spawn/await

---

## Parallel Isolated Modules

**Directory**: [`parallel-isolated-modules/`](parallel-isolated-modules/)

**Hypothesis**: Splitting work across isolated modules or workstreams via PL spawn and measuring coordination overhead reveals whether parallel execution improves build throughput.

**Status**: Scaffold (experiment directory created, no runs executed)

**PL Patterns**: spawn/await

---

## Self-Healing CI

**Directory**: [`self-healing-ci/`](self-healing-ci/)

**Hypothesis**: PL retry and try/catch patterns can repair failing CI checks or infrastructure issues with minimal human intervention.

**Status**: Scaffold (experiment directory created, no runs executed)

**PL Patterns**: retry, try/catch

---

## Shared Infrastructure

### Eval Framework

**Directory**: [`eval/`](eval/)

The shared evaluation bank includes:

- **Datasets**: `datasets/e1-repeated-failures.jsonl` (3 failure cases)
- **Context-Adaptive Benchmark Pack**: `context-adaptive-benchmark-pack/` with fixture categories and renderer reference artifacts
- **Comparative Pattern Coverage**: H101-H108 in `scripts/eval/comparative-eval.mjs` covering approval checkpoints, retry with backoff, reflection artifacts, parallel fan-out, variable pipeline, remember/memory, long-flow stress, and nested control stress

### Results Store

**Directory**: [`results/`](results/)

Canonical home for locked baselines and saved comparison reports:

- `e1-repeated-failure/` -- E1 locked baselines
- `e4-factory/` -- E4 run evidence (16 runs, scorecards, comparisons, batch summaries)
- `e4-method/` -- E4/E5 methodological contracts (claim families, artifact contracts, closure enforcement)
- `e5-maintenance/` -- E5 program design and templates

### Templates

**Directory**: [`templates/`](templates/)

Reusable experiment design document templates:

- `hypothesis.md`
- `methodology.md`
- `metrics.md`
- `results.md`

---

## Cross-Experiment Findings

### Where PL Wins

1. **Retry-with-validation** is the highest-value pattern. Simple `retry max 3` with inline validation scripts eliminates the last 3-6% of quality variance that solo prompts cannot reach (E7-MK: 100% vs 94%).
2. **Gate enforcement** turns 7/10 into 10/10 (Aider H2) and 0/3 into 3/3 (Aider H5).
3. **Decomposition** produces more type-correct, spec-conformant code than monolithic prompts (Aider H3, H8, H9).
4. **Auditability and structure** -- PL produces richer artifact trails (E4, E8).
5. **Brand/style consistency** -- PL catches subtle edge cases like product name spelling and heading capitalization (E7-MK MK-3).

### Where PL Does Not Win

1. **Raw throughput** -- PL is 1.5-3.5x slower than unstructured prompts (Aider, E4 B02).
2. **Trivial tasks** -- when the task is simple enough that the model gets it right on the first try, orchestration adds overhead without benefit (Aider H1, H6, H7).
3. **Quality/a11y basics** -- Claude handles structural HTML quality without orchestration (E7-MK MK-1).

### Open Questions

1. PL runtime hooks do not activate in `claude -p` subprocesses (E8) -- flow text is interpreted as prompt instructions, not executed by the PL state machine. This means gate enforcement and retry loops were not tested in E8.
2. E5's maintenance viability thesis has not been executed -- the critical question of whether PL's extra investment translates to maintainable software remains unanswered.
3. Meta-factory (M1) has not been executed live -- the self-hosting claim remains unproven.
4. Phase 2 of Aider comparison (harder tasks, multiple models) is designed but not executed.
