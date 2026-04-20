# prompt-language research journey

A linear diary of what has been measured about prompt-language (PL) as a local-first orchestration layer for coding agents, in chronological order. Every claim points back to a source file and, where possible, a specific numeric result. Bugs and dead-ends are surfaced, not footnoted.

## At a glance

- Against solo `aider` on `qwen3-opencode:30b`, PL went 6 wins, 0 losses, 3 ties across H1-H10 (`experiments/aider-vs-pl/SCORECARD.md:22`).
- The wins clustered on gate-enforced retry (H2 7/10 -> 10/10, H5 0/3 -> 3/3, H8 0/4 -> 4/4 spec-conformant) and decomposition/file-scoping (`experiments/aider-vs-pl/SCORECARD.md:10-19`).
- At smaller scale, `gemma4-opencode:{e2b,e4b}` cannot emit valid JS literally on this host: solo 1/11 on E-SMALL, PL-manual 4/11 where the +3 is a measurement artefact (broken-JS satisfies three error-exit assertions) with real content delta of 0 (`experiments/aider-vs-pl/LOCAL-MODEL-VIABILITY-FINDINGS.md:16,111-121`).
- On a harder multi-file task (H11, rename `Contact`->`Client` across 5+ files), `qwen3-opencode:30b` drops to 2/12 solo and 3/12 PL, with PL +1 on a single k=1 cell that is not yet claim-eligible (`experiments/aider-vs-pl/LOCAL-MODEL-VIABILITY-FINDINGS.md:75-79`).
- 2026-04-20 session found three new infrastructure defects trying to drive `opencode` through PL on a Next.js build: Modelfile `num_ctx` truncation, the opencode skill-tool flood, and PL's stale `summarizeOpenCodeJsonOutput` progress detector (`experiments/aider-vs-pl/SESSION-2026-04-20-OPENCODE-NEXTJS.md:14-65`).
- First rescue-viability data point landed same day: `qwen3:8b` on E-SMALL pre-retry 5/11, lifted to 9/11 by PL's retry-on-gate-failure loop (`experiments/aider-vs-pl/rescue-viability/LIVE-NOTES.md:17-20`); second retry attempt stalled on an ollama TCP drop, live-reproducing the runner's Defect A.
- A fourth defect surfaced as a side effect: the PL gate evaluator reports `file_exists ".next/BUILD_ID"` false 50 times in a row while the file is on disk (`experiments/aider-vs-pl/rescue-viability/LIVE-NOTES.md:40`).
- Three new artefacts: `RESCUE-VIABILITY-PLAN.md` (R1..R10), `SELF-HOSTING-THEORY.md` (five-rung A..E ladder for PL-develops-PL), `MULTI-AGENT-REVIEW.md` (spawn/race/foreach on single-GPU ollama).
- Ecosystem positioning is now mapped in `experiments/aider-vs-pl/ecosystem-analysis/` across pi-mono, hermes-agent, openclaw, and the adjacent-ecosystem survey.
- Four open infra bugs gate the next set of experiments; a crisp falsification plan tied to R1..R9 is in place to decide thesis direction at end of Run 9 (`experiments/aider-vs-pl/rescue-viability/ROADMAP.md:118-128`).

## 2026-04-14 - does PL lift qwen3-opencode:30b above solo aider?

The first batch (`experiments/aider-vs-pl/SCORECARD.md`) ran H1-H10 head-to-head against `qwen3-opencode:30b` (30B MoE, Q4_K_M, Vulkan on an AMD RX 7600 XT 16GB, Windows 11), N=1 per cell. Solo `aider` was compared to `prompt-language ci --runner aider`. The aggregate was **PL 6 - Solo 0 - Tie 3** (`SCORECARD.md:22`).

The six decisive PL wins, each with its mechanism:

- **H2 gate enforcement TDD** - 7/10 -> 10/10 after three gate-loop retries. Retry-on-failing-test loop carried the win (`SCORECARD.md:12`).
- **H3 decomposition** - solo produced `any` types and 6 tests; PL produced `unknown` (correct) and 7 tests. One prompt per task, not one monolithic prompt (`SCORECARD.md:13`).
- **H4 variable-capture pipeline** - 7/10 docs solo vs 9/10 PL. Pre-digested grep output beat raw-file reads (`SCORECARD.md:14`).
- **H5 file scoping** - 0/3 tests passing after refactor solo vs 3/3 after one retry in PL. Explicitly adding all touched files to the retry prompt (`SCORECARD.md:15`).
- **H8 foreach batch ops** - 0/4 spec-conformant solo vs 4/4 PL. Foreach over distinct targets produced uniformly correct output (`SCORECARD.md:18`).
- **H9 code structure quality** - tests crash solo (missing vitest import, 1/5 separation), tests pass PL (4/5 separation). Gate loop caught the missing-import defect (`SCORECARD.md:19`).

The three ties were H1 (trivial retry), H6 (both missed the same subtle NaN), H7 (PL 84% slower on trivial edits). PL's speed penalty ran 1.5-3.5x at zero API cost (`SCORECARD.md:48`).

Scrutiny finding of the Phase-1 batch (`experiments/aider-vs-pl/EVIDENCE-CONSOLIDATION.md:40-51`): zero pre-declared fixtures for H1-H10, no blinding, no cross-family reviewer, no reproducibility manifest, N=1 per cell. The 6-0-3 outcome is informal dev-time evidence, not §3a claim-eligible under the repo's own rules (`EVIDENCE-CONSOLIDATION.md:11`). It should be read as "PL orchestration appears to help on gate-heavy tasks at this model tier", not "PL wins".

## 2026-04-17 - does the lift survive at smaller or harder scales?

The rigor probe (`experiments/aider-vs-pl/LOCAL-MODEL-VIABILITY-FINDINGS.md`) added two pressures: smaller models on an easier task (E-SMALL CSV->JSON) and the same 30B model on a harder task (H11 multi-file refactor). Both directions exposed ceilings.

**Small-model arm (E-SMALL).** The fixture at `experiments/aider-vs-pl/e-small-fixtures/verify.js` is an 11-assertion objective oracle. Solo results for the two small `gemma4-opencode` variants were catastrophic: `e2b` wrote 28,592 bytes of the single comment `"// I'm going to use the file system to read the file."` repeated hundreds of times, scoring 1/11; `e4b` wrote 0 bytes because aider could not extract a valid edit block, also 1/11 (`LOCAL-MODEL-VIABILITY-FINDINGS.md:32-34`). Under PL-manual decomposition (a direct-Ollama runner substituted because aider+litellm wedged on 600s timeouts), both scored 4/11. The delta looks like +3 but all three extra passes are error-exit assertions that a syntactically-broken JS file incidentally satisfies; real delta on content-producing assertions is **0** (`LOCAL-MODEL-VIABILITY-FINDINGS.md:119`). Retry made it worse, not better: `e4b` retry-2 produced a `1. 2. 3. ... 500.` numbered list (`LOCAL-MODEL-VIABILITY-FINDINGS.md:112`). These models fall below the literal-code-emission threshold; decomposition cannot rescue them.

**Harder-task arm (H11).** `qwen3-opencode:30b` solo scored 2/12 and under PL 3/12 on renaming `Contact`->`Client` across 5+ files (`LOCAL-MODEL-VIABILITY-FINDINGS.md:77-78`). PL edged out solo by one assertion; both cells effectively failed the task. PL introduced ES-module syntax into a CommonJS app. This was the first §3a-shaped cell pair in the programme, satisfying 4 of 10 rigor rules (`LOCAL-MODEL-VIABILITY-FINDINGS.md:84-96`); it is k=1, not blinded, and has a known oracle-contamination issue (`verify.js` scans the aider chat history).

**Two P1 PL aider-runner defects surfaced during measurement** (`LOCAL-MODEL-VIABILITY-FINDINGS.md:57-62`): `prompt-qtn7` crashes the second aider invocation with a prompt-toolkit xterm-256color error on Windows git-bash (workaround: `TERM=dumb`, now coded into `buildAiderEnv`); `prompt-khm1` marks prompt nodes `completed` at dispatch time with no subprocess-output verification, defeating the gate-based recovery loop for prompt-node failures. These two defects, not model capability, blocked the E-SMALL real-PL arm from measuring anything.

Narrowed thesis the evidence supports (`LOCAL-MODEL-VIABILITY-FINDINGS.md:163`): *PL decomposition + gate loops help models that can already emit valid syntactically-correct output; they do not rescue models below the literal-code-emission threshold.*

## 2026-04-20 morning - the opencode detour

The session (`experiments/aider-vs-pl/SESSION-2026-04-20-OPENCODE-NEXTJS.md`) set out to drive `qwen3-opencode:30b` through PL + `opencode` to scaffold a Next.js 15 App Router app end-to-end. Three infrastructure defects emerged before a single turn succeeded:

1. **Ollama Modelfile `num_ctx` silently truncates opencode's system prompt.** `qwen3-opencode:30b` ships with `PARAMETER num_ctx 8192`; opencode's prompt + tool definitions + skill catalogue exceed that. The model denied having `bash`, or hallucinated `bash.execute`. `"limit": { "context": 32768 }` in `opencode.json` is metadata only; the Modelfile wins. Fix: create `qwen3-opencode-big:30b` with `PARAMETER num_ctx 32768` (`SESSION-2026-04-20-OPENCODE-NEXTJS.md:16-29`).
2. **Opencode's skill catalogue bloats the prompt for local models.** 300+ skills in `~/.claude/skills/**` and `~/.agents/skills/**` each register as an action on the `skill` tool. The 30B model treated the skill flood as its entire action space and forgot `bash` and `write` existed. Fix: disable the `skill` tool for the default agent in `opencode.json` (`SESSION-2026-04-20-OPENCODE-NEXTJS.md:31-51`).
3. **PL's opencode runner progress detector is stale.** `dist/infrastructure/adapters/opencode-prompt-turn-runner.js :: summarizeOpenCodeJsonOutput` looked for `step_start.part.snapshot` and `step_finish.part.snapshot` fields that current opencode no longer emits; the runner killed opencode within ~1s of its first stdout chunk. Patched in `dist/` to return `madeProgress = undefined` until a `step_finish reason: "stop"`, and to treat completed `tool_use` events for `write`/`edit`/`patch` as progress evidence. Not yet ported to `src/` (`SESSION-2026-04-20-OPENCODE-NEXTJS.md:53-65`).

Once these were patched, the build succeeded end-to-end after ~13 minutes per six-file scaffold prompt, but `qwen3-opencode:30b` inserted an unrequested `@emotion/react` dependency and set `compilerOptions.jsxImportSource: "@emotion/react"` in `tsconfig.json`, breaking `next build`. A human removed it; flow v2 was split into one prompt per file with `retry max 3 { run: next build; if command_failed { prompt: fix it } }` to let PL self-heal (`SESSION-2026-04-20-OPENCODE-NEXTJS.md:67-73`).

The strategic shift that followed is in `experiments/aider-vs-pl/GUIDE-AND-ROADMAP.md`: PL+opencode is architecturally fraught because opencode wants to be an agent itself, its inner agent partially duplicates PL's orchestration, and the thick runner can monopolise a prompt turn (13 min inside opencode instead of one prompt-per-file + `run:` for shell). The recommended stack is now PL + aider + `qwen3-opencode-big:30b`, with opencode avoided as a runner (`GUIDE-AND-ROADMAP.md:8-13`).

## 2026-04-20 afternoon - the rescue-viability turn

With the opencode detour parked, the session reframed the research question more crisply (`experiments/aider-vs-pl/RESCUE-VIABILITY-PLAN.md:5`): does PL's top-level wisdom lift lower-capability models above their solo ceiling, and if so, which PL feature is carrying the rescue? The formalism: `rescue(T, M, φ) = pl(T, M, φ) - solo(T, M)`, varied on three orthogonal axes (model capability, task difficulty, PL-intensity φ with levels solo/lite/medium/full) (`RESCUE-VIABILITY-PLAN.md:8-12,27-40`).

The first data point landed live in `experiments/aider-vs-pl/rescue-viability/LIVE-NOTES.md`. R1 Run B, `qwen3:8b` + PL-full on the E-SMALL CSV fixture (oracle renamed to `verify.cjs` to escape a parent-directory `"type": "module"` trap in Run A): **pre-retry 5/11, lifted by PL's retry loop to 9/11** (`LIVE-NOTES.md:17-20`). qwen3:8b is above the literal-code-emission floor that gemma e2b/e4b failed, and sits in the "near but not at one-shot correct" band where gate-on-failure is meant to earn its keep.

The first retry fix landed cleanly; the second retry stalled because ollama dropped the TCP connection mid-inference (`wsarecv: An existing connection was forcibly closed by the remote host`), litellm entered an infinite retry loop, aider did not surface the error, and PL killed the subprocess at the 600s timeout (`LIVE-NOTES.md:41-42`). This is a **live reproduction of the runner's Defect A** (ollama TCP drop + litellm infinite retry) triaged the same day in `experiments/aider-vs-pl/AIDER-P1-TRIAGE.md:10-39`. Suspected trigger: concurrent opencode + aider requests on the single ollama server, or model-swap thrash.

A second new runner defect was captured during triage. **Defect B**: aider resolves file edits against the parent git working directory even when invoked with `--no-git`, because PL's `hasGitRepo(cwd)` is shallow and does not walk ancestors (`AIDER-P1-TRIAGE.md:84-108`). Every PL run under `experiments/**` is structurally exposed. Recommended fix is a `GIT_CEILING_DIRECTORIES=<parentOf(cwd)>` env entry in `buildAiderEnv` (one-line diff, aider-version-agnostic).

A fourth defect surfaced as a side effect of the opencode work: **the PL gate evaluator** reports `file_exists ".next/BUILD_ID"` false 50 times in a row while the file is on disk (`LIVE-NOTES.md:40`). Likely the same class of cwd/path-resolution problem as Defect B but in the gate evaluator, not the runner - the two must be fixed together if the user-visible symptom ("gates do not see files that exist") is to go away (`AIDER-P1-TRIAGE.md:167`).

Inter-run variance was 5-8/11 on qwen3:8b pre-retry across two runs with the same prompt and model (`LIVE-NOTES.md:18,44`). This drives an explicit N>=3 repeats-per-cell discipline in the roadmap.

## Three new artefacts that emerged today

1. **`RESCUE-VIABILITY-PLAN.md`** - R1..R10, each experiment sized in wall-time and arms, with per-experiment stop conditions (e.g. R2: if pl-lite >= pl-full, retry/gate are cosmetic; stop and do not run R5/R9) (`RESCUE-VIABILITY-PLAN.md:124-126`).
2. **`SELF-HOSTING-THEORY.md`** - a five-rung A..E ladder for PL-develops-PL, from "PL automates the research loop" (A, minimal risk, only edits results/) through "PL ports the opencode-runner patch src-side under meta-factory gates" (B, Hypothesis H-SH1) up to "PL proposes a hypothesis, designs the fixture, updates the roadmap" (E). Level B is the concrete next step because the reference patch already exists in `dist/` and `npm run ci` is the unfakeable gate (`SELF-HOSTING-THEORY.md:38-58,133-141`).
3. **`MULTI-AGENT-REVIEW.md`** - PL's `spawn` / `await` / `race` / `foreach-spawn` / `send` / `receive` / `review` primitives audited for single-GPU ollama use. Key constraint: ollama holds one model at a time per server, so `race` on two spawns of the same 30B model is pure serialisation with no parallel benefit. The new R6-R10 designs are sized around that constraint, with predictions that most multi-agent primitives are "failure-isolation tools, not speed tools" on this PC (`MULTI-AGENT-REVIEW.md:36-44,70-114`).

## Ecosystem positioning

`experiments/aider-vs-pl/ecosystem-analysis/` now contains four write-ups: `adjacent-ecosystem.md` (the broader coding-agent landscape: aider, opencode, OpenHands, Cline, Continue, Claude Code, Codex CLI, smol-developer, gpt-engineer), `pi-mono.md`, `hermes-agent.md`, `openclaw.md`. The framing places PL as a verification-first DSL orchestrator that wraps harnesses rather than replacing them (`experiments/EXPERIMENT-AREAS.md:26-28`).

The proposed codename for this area is **atlas**, with integration priorities drawn from the survey and a threat assessment that treats LangGraph as the closest competitor in the orchestration-DSL niche. Integration claims are not run-backed yet - this is medium-evidence positioning, not a measurement (`EXPERIMENT-AREAS.md:28`).

## Open questions (evidence-forward)

Four infrastructure bugs are still open and each gates specific experiments:

- **aider Defect A** (ollama TCP drop + litellm infinite retry, live-reproduced 2026-04-20) - blocks R1 at N>=3 until PL adds an inner turn timeout + transient-failure classification so transient network errors do not burn the retry budget (`AIDER-P1-TRIAGE.md:60-75`).
- **aider Defect B** (parent-git-dir path resolution, `hasGitRepo(cwd)` is shallow) - silently corrupts output location for every experiment under `experiments/**`. Recommended fix: `GIT_CEILING_DIRECTORIES` in `buildAiderEnv` (`AIDER-P1-TRIAGE.md:128-136`). Cheaper and higher-priority than Defect A.
- **PL gate evaluator `file_exists` false-negative** - reported 50 times in a row on `.next/BUILD_ID` while file was on disk. Silently invalidates pass rate in any flow using `done when` and must close before any locked R-result (`experiments/aider-vs-pl/rescue-viability/ROADMAP.md:116`).
- **opencode-home shared-state concurrency** - opencode writes `.prompt-language/opencode-home/` which is shared unless explicit envs override it; two concurrent children could race. Open engineering question for all R5/R6/R7/R8/R10 multi-agent probes (`MULTI-AGENT-REVIEW.md:50,131`).

Epic bead `prompt-gysa` tracks the rescue programme; `prompt-l1xz` tracks the opencode src-port; `prompt-nba9` tracks the child-index DSL required for `foreach-spawn` result aggregation (`ROADMAP.md:7-13,110-115`).

## What would falsify the thesis

Stop conditions are pre-registered in `experiments/aider-vs-pl/rescue-viability/ROADMAP.md:74-84,118-128`:

- **R1 refutation**: median `rescue(qwen3:8b, E-SMALL, pl-full) <= 0` with tight variance (range spans <= 2 assertions) -> thesis fails at 8B on this task. Pivot to mapping the working band on 30B only.
- **R2 narrowing**: pl-lite >= pl-full within noise -> all the rescue is just decomposition; retry/gate/review machinery is overhead. Publish as "decomposition only, not universal wisdom".
- **R3 decay**: `rescue(H11, 30B) < rescue(H8, 30B) < rescue(E-SMALL, 30B)` monotonically decreasing to zero at H11 -> PL's value shrinks with task difficulty. Publish as "boilerplate smoother, not universal wisdom".

The falsification milestone is end of Run 9 (R2-D complete). After that, no further arm can rescue the thesis as stated; it can only refine it. Publish-positive, publish-negative, or pivot is decided then, not later (`ROADMAP.md:128`).

## What is next

Three immediate moves from `GUIDE-AND-ROADMAP.md §6` and the in-flight rescue programme:

1. **Close the two aider P1 defects** (A: ollama TCP drop, B: parent-git-dir resolution) and port the opencode progress-detector patch from `dist/` to `src/`. These are the engineering-debt blockers on every subsequent measurement (`GUIDE-AND-ROADMAP.md:113-115`).
2. **R1 baseline at N=3** on qwen3:8b on E-SMALL - Runs 1-5 of the roadmap (`ROADMAP.md:55-59`). This retires the baseline and makes the rescue delta interpretable.
3. **HA-E1 pilot** in the proposed new `harness-arena` area: all five arms on H11 (Claude Code + Sonnet, Codex + GPT, aider solo local, aider + PL local, opencode + PL local), 1 run each, to shake out the runner, oracle-isolation check, cost-tracking plumbing, and grader rubric calibration before scaling to HA-E2 at k=3 across three tasks (`experiments/EXPERIMENT-AREAS.md:184-199`).

The existing scorecard stays live; the new areas (**ladder** for H1-H20, **rescue** for R1-R10, **atlas** for the ecosystem survey, **forge** for meta-factory, **foundry** for the product factories, **crucible** for the bounded stress tests, **harness-arena** for the stack bake-off) are a proposed naming scheme, not yet adopted on disk (`EXPERIMENT-AREAS.md:3`).
