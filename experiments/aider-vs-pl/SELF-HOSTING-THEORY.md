# Can local models + PL actually develop PL itself?

Date: 2026-04-20
Scope: hypotheses, MVP ladder, and failure modes for a local-model self-hosting program that builds on [`experiments/meta-factory/`](../meta-factory/README.md).
Relationship to prior art: the meta-factory architecture (MD-1 frozen runtime, MD-2 per-run worktree, MD-3 `npm run ci` + `eval:smoke` as sole authoritative gates) already answers the "how do you run this safely" question. This doc asks the separate question: **given that safety envelope, can a local-model arm carry the payload, and if not, what makes it impossible vs fixable?**

## 1. The core recursion

Three levels of self-reference, each more aggressive than the last:

1. **PL orchestrates PL research.** Flows automate the experiment loop: replay fixtures, collect pass rates, write per-run markdown, update SCORECARD. The flow's *subject* is research output; PL itself is unchanged. Low risk, high automation payoff. Arguably what the rescue-viability plan already is, minus the automation layer.

2. **PL authors PL tests.** Meta-factory M1. The flow's *subject* is `scripts/eval/smoke-test.mjs`. Edits a known-safe surface (tests, CLAUDE.md catalog); does not mutate the interpreter. Frozen-runtime gates keep the subject and tool separated.

3. **PL authors PL source.** The flow's *subject* is `src/**/*.ts`. The same interpreter that runs the flow is what the flow is editing (in `src/`; `dist/` is frozen per MD-1). Every editing primitive, every parser token, every transition in the DSL is now a dependency of the edit. Highest risk, highest payoff.

The user's ask is level 3. Meta-factory is built to support it but has only launched M1 (level 2), and not successfully.

## 2. What's different now (2026-04-20 evidence that wasn't available 2026-04-17)

- **Opencode runner drift bug diagnosed and patched** (`dist/infrastructure/adapters/opencode-prompt-turn-runner.js :: summarizeOpenCodeJsonOutput`). This is *exactly* the kind of bug a self-hosting run should be able to find and fix — the defect report is already written, the patch is tiny, the regression test is obvious.
- **`qwen3-opencode-big:30b`** (32K `num_ctx` ollama variant) removes the system-prompt truncation that killed local-model tool calling. A self-hosting run against the ported-to-`src` version of today's fix is finally viable context-wise.
- **Two catalogued P1 defects in PL's aider runner** from `EVIDENCE-CONSOLIDATION.md §3`. Named, scoped, with reproducer fixtures. Another "ready to attack" target.
- **H11 ceiling data (2–3/12 at 30B)** tells us the hardest fixture we have is already above the local model's solo capability. "Edit this one TS file" style tasks are in-scope; "refactor three files + keep tests green" probably isn't. That narrows the MVP design.

## 3. Hypothesis and null

**H-SH1 (self-hosting at small scale):** A PL flow running on the frozen dist/ against `qwen3-opencode-big:30b` via `aider` can author a conformant src-side fix for a named, scoped defect (e.g. port today's opencode progress-detector patch from dist/ to src/), passing `npm run ci` + `npm run eval:smoke` without human intervention.

**Null:** The model proposes syntactically invalid TS, or passes types but regresses existing tests, or repeatedly proposes the same wrong patch across 3 retries. No green run materialises after N ≤ 5 attempts.

**What it takes to refute H-SH1:** one green run, reproducible from the frozen snapshot. N=1 is enough because the gates (ci + eval:smoke) are unfakeable.

**What it takes to confirm the null:** N=5 attempts (fresh worktree each) all red, with failure modes documented. Not "it sometimes works."

## 4. MVP ladder (ordered by payoff-to-cost)

### Level A — PL automates the existing research loop (no code mutation)

**Flow job:** take `rescue-viability/flows/r1-pl-full.flow`, a fixture path, a model, and an arm label. Run it. Write `runs/<exp>/<arm>/<ts>/result.md` with pass count, wall time, tokens, retry count. Append a row to `SCORECARD.md`.

**Subject edited by the flow:** only results artefacts. No `src/`, no `dist/`.

**Payoff:** every future experiment becomes one command. R1's three-cell sweep becomes one invocation that produces three markdown rows, not three manual runs.

**Risks:** almost none. This is a shell harness in flow form.

**Why start here:** proves PL-over-PL ergonomics before the frozen-runtime dance. Catches ergonomic defects cheaply (missing variables, gate edge cases).

### Level B — Port today's opencode-runner patch src-side under meta-factory gates

**Flow job:** given a repo worktree pinned to the frozen snapshot, and the defect writeup in `SESSION-2026-04-20-OPENCODE-NEXTJS.md §3.3`, propose the equivalent TypeScript in `src/infrastructure/adapters/opencode-prompt-turn-runner.ts`, add a Vitest test that feeds a canned JSON stream and asserts `madeProgress === true` when a write tool_use lands, run `npm run ci`, retry up to 3× on failure.

**Subject edited by the flow:** `src/.../opencode-prompt-turn-runner.ts`, one new `.test.ts`, nothing else.

**Authoritative gates (MD-3):** `npm run ci` + a scoped new smoke test that exercises the runner.

**Payoff:** if this works, it is the first end-to-end success of meta-factory level 3. If it fails, the failure mode is diagnosable: we have the correct patch in `dist/`, so post-mortem comparison of model-proposed vs human-authored patch is trivial.

**Risks:** model proposes invalid TS (class A); model proposes TS that compiles but regresses other tests (class B); retry loop loops on the same wrong patch (class C). Each class has a known mitigation (class A: add a typecheck gate inside the retry; class B: gate is already `npm run ci`; class C: inject the last failure's diff into the fix prompt).

### Level C — Attack one of the two P1 aider-runner defects

**Flow job:** given the defect writeup in `EVIDENCE-CONSOLIDATION.md §3` and the repro fixture, produce a fix in `src/infrastructure/adapters/aider-prompt-turn-runner.ts` plus a regression test.

**Why harder than Level B:** the aider runner is older and has more callers. Smaller blast radius is hard to guarantee.

**Payoff:** unblocks the small-model real-PL arm of the rescue-viability sweep.

### Level D — PL proposes a new fixture and runs it end-to-end

**Flow job:** read `GUIDE-AND-ROADMAP.md §4.4 open questions`, pick one, design a fixture (input + oracle), write it into `experiments/aider-vs-pl/fixtures/<new-id>/`, then run R1-style solo vs PL and write the result doc.

**Subject edited by the flow:** fixtures + results + flow files. Optionally `SCORECARD.md` to register the new experiment.

**Payoff:** this is where self-hosting starts paying research dividends. The bottleneck on this research has been experiment-design labour, not compute.

**Risks:** model proposes a fixture whose oracle is gameable (most common small-model failure: "any non-empty file passes"). Must be gated against a smoke check that an empty or stub implementation fails the oracle — a meta-oracle.

### Level E — PL proposes a hypothesis, designs the fixture, and updates the ROADMAP

**Flow job:** consume `GUIDE-AND-ROADMAP.md`, detect an unanswered open question, produce a new hypothesis H-X with prediction, design matching fixture, run it, append findings to the roadmap.

**This is the capstone.** It is also the most likely level at which local-model capability bites — generating well-formed research prose that actually advances the plan (as opposed to restating it) is above what H11 evidence suggests qwen3-opencode:30b can do.

## 5. Design constraints specific to the local-model arm

### 5.1 Context budget

Full `src/` tree is ~40K TS lines. No local model on this PC can hold it in context. Every flow must:

- **Scope aggressively.** Name the exact files the model may read. Use `file_exists` gates and `ls path/` `run:` captures rather than "you may search the tree."
- **Pre-chew dependencies.** Use `let x = run "grep -n <symbol> src/..."` to pre-extract call sites as flat text before asking the model to reason over them.
- **Never ask the model to summarize the codebase.** Attempts to do so empirically degrade into generic boilerplate.

### 5.2 Action space

The model's action space inside a PL flow = `edit` on specific files + `run` on specific commands. PL's decomposition discipline **is** the action-space restriction. This is actually a rescue advantage: the model cannot wander.

### 5.3 Retry loop discipline

`retry max N + if command_failed + prompt: fix the specific failure` is the meta-factory M1 design and it is load-bearing. Specific additions for self-hosting:

- Always include the failing command's stdout/stderr tail in the fix prompt (PL automatically surfaces `${last_stdout}` / `${last_stderr}`).
- Include the current file's contents pre-fix, not just "please fix." Observation from H5 (file scoping).
- Forbid adding new dependencies in the fix prompt. Top model-quality failure mode on this PC (v1 `@emotion/react` incident).

### 5.4 Confirmation budget

The model will sometimes say "fixed" when it has not edited anything. Always gate on a deterministic post-condition, never on the model's assertion. MD-3 is non-negotiable.

## 6. Anti-patterns

- **Running level C/D against a small-model (≤ 8B) arm.** E-SMALL evidence says this burns real clock for zero expected rescue. Local-arm MVP must be `qwen3-opencode-big:30b`.
- **Letting the flow propose runtime edits to `dist/`.** MD-1 exists precisely to forbid this. If the flow's first move is to patch its own interpreter, we're in `halt` territory.
- **Grading by "the model said it's done."** MD-3 again. The number of hours lost to this across ML research as a whole is staggering.
- **Chaining five level-B-style tasks into a single meta-flow.** Each hop multiplies compound failure probability; one level-B run at a time.

## 7. Research bets this would let us place

If Level B lands (one green run on the opencode-runner port):

- We have our first data point on `local-model + PL + meta-factory-gates → real src/ delta`. That calibrates every later claim.
- The SCORECARD gets a new axis: *can the same pairing that wins on H8 also self-host?* This is a stronger claim than "PL decomposes well."
- The meta-factory design (which already exists on paper) graduates from "sketched" to "demonstrated."

If Level B fails even with the correct patch handed to the model as a hint:

- Refutes the "local model + PL rescues self-hosting" thesis for qwen3-opencode:30b specifically.
- Does *not* refute meta-factory as a design — only the model arm.
- Points at the next experiment: run the same flow under Sonnet or Haiku via `claude`-runner as an arm, to decouple the PL-flow defect from the model-capability defect.

## 8. Concrete next step

If the user wants one concrete thing to kick off after the in-flight R1 run and opencode v2 flow finish: **set up Level B**. The ingredients exist:

- Defect writeup: `SESSION-2026-04-20-OPENCODE-NEXTJS.md §3`
- Reference patch (the correct answer): already in `dist/infrastructure/adapters/opencode-prompt-turn-runner.js`
- Frozen-runtime + worktree harness: `experiments/meta-factory/m1-pl-writes-smoke-test/run.sh` (adaptable)
- Gate: `npm run ci` exists; a scoped test can be authored alongside the patch

A flow for Level B would be ~30 lines of DSL. That's small enough to draft and review before spending compute on it.

## 9. What this document does not claim

- Does not claim local models *will* self-host PL. It claims the problem has been *underspecified* until now and enumerates what a decisive test looks like.
- Does not claim meta-factory is broken — only that its first live attempt got stuck at preflight rather than at the meta-flow itself. The envelope may still be sound.
- Does not argue against cloud-model self-hosting as an immediate shipping path. Cloud-arm can probably do Level B today; local-arm is the research question.
