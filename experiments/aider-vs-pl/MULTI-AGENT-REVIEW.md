# Prompt-language multi-agent primitives: review for local-model use

Date: 2026-04-20
Scope: all of PL's multi-agent primitives (`spawn`, `await`, `race`, `foreach-spawn`, `send`/`receive`, `review`) evaluated for use with local models on this PC, plus experiment designs that actually exercise them.
Prior art: `experiments/full-saas-factory/e4-codex-crm-factory/` uses `spawn` + `await all` heavily — but with `codex` runner against cloud models, not ollama. The local-arm use of multi-agent primitives is uncharted on this PC.

## 1. The primitives, as built

Source: `docs/reference/{spawn,await,race,foreach-spawn,send-receive,review}.md`, `src/application/ports/process-spawner.ts`, `src/infrastructure/adapters/cli-process-spawner.ts`.

| Primitive       | What it does                                                                       | Variable flow                                    |
| --------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------ |
| `spawn N ... end` | Launches a child flow in a separate process. Parent continues immediately.         | Parent vars copied into child at spawn time.     |
| `spawn N with vars a, b` | As above, but only named vars are passed.                                          | Explicit subset.                                 |
| `spawn N in "path"` | Child `cwd` is `path`.                                                             | Same as above.                                   |
| `spawn N model "m"` | Overrides model for that child.                                                    | Same as above.                                   |
| `await "N"` / `await all` | Blocks parent until child(ren) complete. Child vars become `N.varname` in parent.  | Prefix-namespaced import.                        |
| `race ... end` | Parallel spawns, first success wins. Non-winners keep running to completion. | Winner's vars imported with name prefix.        |
| `foreach-spawn item in ${list} max N` | Fan-out per item, bounded concurrency.                                       | Each child gets `${item}`.                       |
| `send "N" "msg"` / `receive var from "N"` | Parent-child inbox message passing.                                            | Free-form string.                                |
| `review max N ... end` | Generator-evaluator loop on the SAME process. Evaluator critique re-runs body. | In-process — not a multi-agent primitive, strictly speaking. |

## 2. Runner compatibility

The `ProcessSpawner` abstraction ships with two implementations:

- **`ClaudeProcessSpawner`** (default). Spawns `claude -p <prompt>` subprocesses. Requires the Claude CLI + an API key.
- **`CliProcessSpawner`** (used when `PL_SPAWN_RUNNER` is set). Spawns `prompt-language run --runner <runner>` subprocesses. This is the path for aider, opencode, ollama, and codex.

Env var to activate: `PL_SPAWN_RUNNER=aider` (or `opencode`, `ollama`, `codex`). Otherwise spawns route to claude and fail without an API key.

This is undocumented in the user-facing guides. The local-model operator needs to know this or every `spawn` node fails with `claude: command not found` or `401`.

## 3. Local-model-specific concerns

### 3.1 Single-GPU serialisation of ollama calls

Ollama holds one model at a time per ollama server. On this PC there is one server, one GPU. If `race` spawns two children both requesting `qwen3-opencode-big:30b`, ollama queues the second call behind the first. The "race" becomes sequential; the first completion also happens to be the first start. No parallelism.

If the two children request *different* models (e.g. one qwen3:8b, one qwen3-opencode-big:30b), ollama must unload the previous model to load the other — repeated thrashing, each swap ~20–40 s on this hardware.

Implication: `race` adds value only when (a) model weights already fit in VRAM together, or (b) the cost of serialised runs is still cheaper than sequential runs because the first winner can short-circuit the flow.

### 3.2 Process memory footprint multiplies with every spawn

Each `spawn` invokes a new `node bin/cli.mjs run`. Each such process loads PL's runtime (~60 MB resident here from tasklist), the runner binary process (aider ~150 MB, opencode ~700 MB), and reads the fixture. With four concurrent spawns and opencode runner, we are looking at 3–4 GB of orchestration RAM before any model inference. Affordable on this PC; not affordable on older laptops.

### 3.3 State dir contention

Every child writes to its own `.prompt-language-<name>/` directory under the parent's cwd. Two concurrent children do not collide, but `opencode`'s workspace-scoped env also writes `.prompt-language/opencode-home/` — which *is* shared unless explicit envs override it. Need to confirm the opencode runner's isolation holds under concurrent spawns before scaling up.

### 3.4 Variable serialisation boundary

Variables cross the parent/child boundary via JSON stringification. Complex values (command stdout blobs, large JSON) cost `O(size)` to serialise. Today's PL does this by writing the child's flow text + inherited vars to a temp file (see `cli-process-spawner.ts :: buildChildFlow`). There is an implicit size limit on inherited state; large-repo stdout captures may need explicit `with vars` filtering.

## 4. When multi-agent helps locally, and when it does not

### 4.1 Helpful patterns

- **Heterogeneous-model race.** Fast small model (e.g. qwen3:8b) races slow-but-strong model (qwen3-opencode:30b). Winner ships. Model weights must both fit in VRAM simultaneously, otherwise ollama serialises and the benefit evaporates. This PC's 16 GB can hold qwen3:8b (~6 GB) + gemma-opencode-vulkan:e4b (~5 GB) together, but not two 30B variants.
- **Work-partitioning with `foreach-spawn`.** When a task decomposes into genuinely independent subtasks (e.g. scaffold six unrelated files), concurrent spawns do not add speed on a single-model-at-a-time ollama, but they isolate failures cleanly — one bad file does not poison five good ones.
- **Specialised agents via `spawn model` + `spawn in "path"`.** A coder agent in the src tree, a reviewer agent in a read-only worktree, communicating via `send`/`receive`. This is the pattern the `e4-codex-crm-factory` uses; on local models it is bottlenecked by serialisation but the separation of concerns still pays off in clearer failure attribution.

### 4.2 Unhelpful or counter-productive patterns

- **Race of two children requesting the same 30B local model.** Pure serialisation, no parallel benefit, twice the wall time of solo.
- **Deeply nested spawns (>2 levels).** Each level adds another `prompt-language run` process hop; debug latency compounds.
- **`review max N` as a stand-in for retry.** `review` injects an evaluator critique that is itself a model call. With local models, the evaluator step is another 2–5 minute round-trip on this hardware. `retry max N + if command_failed + prompt: fix` is both cheaper and more grounded (it consumes the actual command output, not a model's critique of the output).

## 5. New experiments targeting multi-agent primitives

Additive to `RESCUE-VIABILITY-PLAN.md §3`. Each is scoped so one data point is actionable.

### R6 — Heterogeneous race on E-SMALL

**Setup.** `race` over two spawns:
- `fast`: qwen3:8b + PL-full flow (we already have R1 data on this cell)
- `strong`: qwen3-opencode-big:30b + same flow

Both target the same fixture. Winner sets `race_winner`. VRAM budget: ~6 GB + ~16 GB = 22 GB — exceeds this PC's 16 GB → expected serialisation. The prediction is that `race` does *not* help on this hardware until someone runs it on a 24 GB+ GPU. Worth confirming empirically before designing flows around it.

**Prediction:** `race_winner == "strong"` always, because the 30B model produces fewer retries and fewer retries on this hardware wins the serialised race despite higher per-turn latency. If the prediction fails, the VRAM thrash story is wrong and parallelism cost is less than we think. Either outcome is informative.

### R7 — Split-workload `foreach-spawn` on Next.js scaffold

**Setup.** Take today's v2 split flow (six scaffold prompts, then install + build). Replace the six sequential prompts with a single `foreach-spawn file in ${files} max 2` that delegates each file to a child. Run sequential baseline vs foreach-spawn=2 vs foreach-spawn=6.

**Prediction:**
- Sequential: ~30 minutes wall time on this PC (we measured ~4.5 min per prompt avg).
- `foreach-spawn max 2` on ollama single-slot: ~30 minutes (serialisation cost matches sequential).
- `foreach-spawn max 6`: ~30 minutes + thrash overhead.

If all three land within the same time band, the win from multi-agent on this PC is "failure isolation," not speed. That reframes the recommendation.

### R8 — Specialist-reviewer pattern

**Setup.** Implementer agent (`qwen3-opencode-big:30b`) writes the csv2json.js. Reviewer agent (`qwen3:8b`) reads the implementer's output plus the oracle (`verify.cjs`) and returns a critique list. Implementer gets the critique via `receive` and re-edits. One round.

**Why it is interesting.** The reviewer is a different model, so its biases differ from the implementer's. This is a weak form of ensembling. H2 in SCORECARD already shows `review max N` in-process lifts 7/10 → 10/10 on one model — R8 asks whether a *different* cheaper model doing the review does as well or better.

**Prediction:** small lift, maybe 5/11 → 7–8/11 over solo-implementer. Weaker than just retrying the same implementer with retry-on-gate. If so, the "specialist reviewer" pattern does not pay for its complexity on local models.

### R9 — `review max N` cost probe

**Setup.** Repeat R1 PL-full with `review grounded-by "node verify.cjs" max 3` replacing the `retry max 3 + if command_failed` block. Measure wall time + retries.

**Prediction:** similar pass rate, ~30% higher wall time due to the evaluator's extra turn per round.

### R10 — Parent-supervised `send`/`receive` coordination loop

**Setup.** Parent sends "scaffold files" message to child; child scaffolds and sends "done" back; parent runs `npm install` + `next build`; sends failure output back to child if build fails; child fixes and sends new files; parent re-builds. Explicit orchestration via messages instead of implicit via file-system state.

**Prediction:** no measurable pass-rate lift but a cleaner failure-attribution log. May be more valuable for *debugging* flows than for running production work.

## 6. Anti-patterns specific to multi-agent + local models

- **`race` two spawns of the same model.** Wastes compute, gains nothing.
- **`spawn model "haiku"` in a local-only flow.** The `haiku` identifier is Claude-family; if the runner is aider/opencode/ollama, the model override silently routes to wherever the runner's default points.
- **Nested `foreach-spawn` with no concurrency cap.** 10 × 10 = 100 child processes on ollama = queue-saturated and OOM on this PC.
- **Forgetting `PL_SPAWN_RUNNER`.** Every spawn will try to launch Claude and fail. The error surface is poor (the child dies, the parent timeouts on await).

## 7. Recommendation for the next multi-agent probe

Given the rescue-viability R1 data is landing in minutes and is the top-priority signal: queue **R7** next. It reuses the v2 fixture, tests the most-used primitive (`foreach-spawn`), and will tell us whether multi-agent primitives add any speed or reliability on this PC's single-GPU ollama constraint. If R7 shows no gain, the conclusion is a published negative result ("multi-agent primitives are failure-isolation tools on single-GPU ollama, not speed tools") — useful, actionable, and cheap.

R6 is a tempting first target because `race` is exciting, but the VRAM math predicts boring serialisation. Do it after R7 as a confirmation probe, not a headline experiment.

R8 (specialist reviewer) is the most interesting-if-it-works but least likely to add measurable value — defer to after R1/R7/R6 land.

## 8. Open engineering questions

- Does `CliProcessSpawner` inherit env vars correctly, specifically `PROMPT_LANGUAGE_OPENCODE_TIMEOUT_MS` and `OLLAMA_API_KEY`? If not, spawned children hit the 90 s default and die silently. Need to check `cli-process-spawner.ts :: spawn() :: env` composition.
- Does opencode's isolated workspace config (`.prompt-language/opencode-home/`) get created per-spawn or per-parent? Concurrent spawns writing the same path would race.
- Is `race` tested in CI against a non-claude runner? A quick grep of `src/**/*.test.ts` will answer.
