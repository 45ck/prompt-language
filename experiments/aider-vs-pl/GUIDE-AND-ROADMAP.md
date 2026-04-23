# Local-first coding on this PC: guide and research roadmap

Date: 2026-04-20
Host: Windows 11, `C:\Users\MQCKENC`, ollama local, no cloud API assumed.
Audience: the operator of this PC picking a stack for day-to-day local coding with prompt-language as the top-level orchestrator.
Sources consolidated: [SCORECARD.md](SCORECARD.md), [LOCAL-MODEL-VIABILITY-FINDINGS.md](LOCAL-MODEL-VIABILITY-FINDINGS.md), [EVIDENCE-CONSOLIDATION.md](EVIDENCE-CONSOLIDATION.md), [SESSION-2026-04-20-OPENCODE-NEXTJS.md](SESSION-2026-04-20-OPENCODE-NEXTJS.md), results in [results/](results/).

## 1. Bottom-line recommendation

- **Orchestrator:** prompt-language (PL) at the top. It wins decisively over solo-aider on decomposition, gate enforcement, batch ops, and file scoping (PL 6 – Solo 0 – Tie 3 across H1–H10).
- **Runner:** `aider`. It is the most-tested PL runner on this PC, its philosophy (thin "edit files" wrapper) matches PL's orchestration philosophy, and all existing evidence aims at it.
- **Model:** `qwen3-opencode:30b` with a bumped `num_ctx` (create `qwen3-opencode-big:30b` via Modelfile, `PARAMETER num_ctx 32768`).
- **Avoid:** `opencode` as runner (its inner agent overlaps with PL and fights the orchestrator), and `gemma4-opencode:{e2b,e4b}` (degenerate decoding — rescue-by-PL does not work).

## 2. What we actually know (evidence, not opinion)

### 2.1 Runner comparison

| Runner             | Status on this PC                                              | Notes                                                                                                                                                                                                                    |
| ------------------ | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `aider`            | Heavily tested (H1–H10, E-SMALL, H11 phases 2–5)               | Two P1 defects in PL's aider runtime documented in EVIDENCE-CONSOLIDATION. They block the small-model real-PL arm; they do not affect `qwen3-opencode:30b`.                                                              |
| `opencode`         | Smoke-tested today (v1 Next.js build, v2 split flow in flight) | PL's opencode runner carries a stale progress detector that reports "no progress" against current opencode JSON output. Patched in `dist/.../opencode-prompt-turn-runner.js` this session; **not** yet ported to `src/`. |
| `ollama` direct    | Untested under PL rigor                                        | Lowest ceiling — no tool use, no file edits. Only useful for single-turn generation.                                                                                                                                     |
| `claude` / `codex` | Not local                                                      | Out of scope for a no-API stack.                                                                                                                                                                                         |

### 2.2 Model comparison

| Model                                      | Verdict                                                   | Evidence                                                                                                                                                         |
| ------------------------------------------ | --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `qwen3-opencode:30b`                       | Viable for easy tasks, weak on harder                     | E-SMALL CSV 11/11 solo-aider; H11 multi-file refactor 2/12 solo / 3/12 PL. ~42 tok/s on the AMD RX 7600 XT 16 GB. Modelfile `num_ctx 8192` — needs to be raised. |
| `qwen3-opencode-big:30b` (session-created) | Same model + 32K `num_ctx`                                | Fixes opencode system-prompt truncation and "I have no bash tool" hallucinations. No rigor data yet — needs a fixture replay.                                    |
| `gemma4-opencode:e2b`                      | **Not viable**                                            | 1/11 E-SMALL. Output is the string `"// I'm going to use the file system..."` repeated hundreds of times. Decoding trap, not a reasoning gap.                    |
| `gemma4-opencode:e4b`                      | **Not viable**                                            | 1/11 E-SMALL. 0-byte files, repetition of `"maximally"`. Different pathology, same endpoint.                                                                     |
| `gemma4-opencode-vulkan:31b`               | Runs, attempts tool use, mis-names tools (`bash.execute`) | Session finding 2026-04-20. Modelfile `num_ctx 4096` is way too small. Worth retesting after a `-big` variant is created.                                        |
| `qwen3:30b` (base, non-opencode)           | Untested at rigor                                         | Same parameter count as the opencode fine-tune; hypothesis: fine-tune might actually hurt on non-aider/non-opencode harnesses.                                   |
| `qwen3:8b`                                 | Untested                                                  | Would unlock faster iteration if viable; probably below the literal-syntax threshold per gemma evidence.                                                         |

### 2.3 What PL orchestration actually gives you

From the H1–H10 scorecard (all with `qwen3-opencode:30b` + aider):

- **Gate-enforced retry is the killer feature.** H2 (7/10 → 10/10), H5 (0/3 → 3/3), H8 (0/4 → 4/4 spec-conformant). Solo aider has no recovery mechanism.
- **Decomposition beats monolithic prompts.** H3 (`any` → `unknown`, more tests), H9 (4/5 vs 1/5 structure score), today's v1 vs v2 (v1 bloated tsconfig with `@emotion/react`, v2 clean).
- **File scoping prevents cross-file breakage.** H5 — retrying the whole set of affected files instead of just one.
- **Variable capture improves structured output.** H4 — pre-digested grep captures outperform raw-file reads (7 → 9 docs).
- **Tie zones:** trivial tasks (H1 retry, H6 branching, H7 simple-edit speed). PL is 1.5–3.5× slower but at $0 API cost.

### 2.4 Infrastructure defects found so far

1. **PL aider runner, 2 × P1** — EVIDENCE-CONSOLIDATION §3. Flow aborts mid-step on small models; blocks the E-SMALL real-PL arm entirely. Fixing these is prerequisite for any small-model rescue claim.
2. **PL opencode runner progress detector (today, 2026-04-20)** — `dist/infrastructure/adapters/opencode-prompt-turn-runner.js :: summarizeOpenCodeJsonOutput` only detects progress via `step_start/finish.part.snapshot` fields that current opencode no longer emits. Patched in `dist/`, needs `src/` port + test.
3. **Ollama Modelfile `num_ctx` is silent** — defaults often 4K/8K. Opencode's system prompt exceeds that, tools get truncated, model hallucinates. The `"limit": { "context": 32768 }` in `opencode.json` does **not** override the Modelfile.
4. **Opencode skill-tool flood** — 300+ skills in `~/.claude/skills/**` + `~/.agents/skills/**` become 300+ actions on the `skill` tool. A small-ctx local model treats them as its entire action space. Fix: disable the `skill` tool in the active opencode agent.
5. **Opencode prompt turn can monopolize the flow** — session v1 took 13 min in a single prompt turn because the model decided to do its own `npm install` and `next build` instead of letting PL's `run:` handle them. Split prompts per file and keep `run:` for shell.

## 3. Practical setup (recipe)

### 3.1 One-time model prep

```
# From a terminal on this PC
ollama cp qwen3-opencode:30b qwen3-opencode-big:30b
# or create a Modelfile:
#   FROM qwen3-opencode:30b
#   PARAMETER num_ctx 32768
#   PARAMETER temperature 0.3
ollama create qwen3-opencode-big:30b -f Modelfile.qwen3-big
curl -s http://127.0.0.1:11434/api/ps   # verify context_length=32768
```

### 3.2 Flow-writing rules for a 30B local model

1. One prompt ≈ one file. Big multi-file prompts take >10 min and exceed default runner timeouts.
2. Keep shell commands out of prompts. Use `run:` for `npm install`, `npm run build`, `pytest`, etc. PL's gate-evaluation depends on seeing the command result.
3. Wrap build/test `run:` in `retry max 3 { run: ...; if command_failed { prompt: fix only the offending file } }`. This is where PL earns its keep.
4. Give exact file contents where possible ("Content exactly: {...}"). Smaller attack surface for model hallucination.
5. Explicit "do not add dependencies" / "do not modify X" constraints for each fix prompt. Today's v1 model inserted `@emotion/react` without being asked; v2 with explicit constraints did not.

### 3.3 Environment variables worth knowing

| Variable                              | Purpose                              | This-PC recommended                                                               |
| ------------------------------------- | ------------------------------------ | --------------------------------------------------------------------------------- |
| `PROMPT_LANGUAGE_OPENCODE_TIMEOUT_MS` | per-turn timeout for opencode runner | `600000` (10 min) for split flows, `1200000` if you insist on a single big prompt |
| `PROMPT_LANGUAGE_OPENCODE_AGENT`      | override agent                       | `build` for max-permission                                                        |
| `OLLAMA_API_KEY`                      | shared secret the runner sends       | `ollama-local` is fine                                                            |
| `OPENCODE_SERVER_PASSWORD`            | headless opencode server auth        | set if exposing the server                                                        |

### 3.4 Minimal working flow skeleton (save as `scaffold.flow`)

```
Goal: one-liner describing the outcome

flow:
  prompt: Create <file 1>. Content exactly: <blob>. Use write tool. Reply "ok".
  prompt: Create <file 2>. Content exactly: <blob>. Use write tool. Reply "ok".
  run: <install cmd> [timeout 600]
  retry max 3
    run: <build or test cmd> [timeout 600]
    if command_failed
      prompt: The last command failed. Fix only the offending file. Do not add dependencies. Reply "fixed".
    end
  end

done when:
  all(file_exists "<file 1>", file_exists "<file 2>", file_exists "<build marker>")
```

Run with `node /c/Projects/prompt-language/bin/cli.mjs run --file scaffold.flow --runner aider --mode headless`.

## 4. Research roadmap (ranked)

### 4.1 Engineering debt (do first — unblocks measurement)

- **[P1] Port today's opencode-runner fix from `dist/` to `src/infrastructure/adapters/opencode-prompt-turn-runner.ts`** and add a regression test that replays a real opencode JSON stream. Without this, `npm run build` wipes the patch.
- **[P1] Fix the 2 aider-runner P1 defects** from EVIDENCE-CONSOLIDATION §3. They block the real-PL small-model arm entirely.
- **[P2] Add a PL `preflight` check for Modelfile `num_ctx` vs the flow's predicted token budget.** Warn when system-prompt + tool definitions + first prompt will exceed the model's context.
- **[P2] Add a pre-warm-model flag or hook** so cold-load latency (20–40 s) doesn't count against the first turn's timeout.

### 4.2 Near-term experiments (days, replay existing fixtures)

- **H12–H20 on `qwen3-opencode:30b` + aider.** Fixtures exist in `fixtures/h1{2..9}-*/` and `fixtures/h20-doc-generation/`. Run solo vs PL on each; extend the SCORECARD table. Priority order: h14 (TDD partial data already in `results/h14-tdd-fixed/`), h12 (security fix — closer to real work), h15 (API endpoint), then the rest.
- **`qwen3-opencode-big:30b` replay of H11 phase-2.** Does the 32K `num_ctx` change the 2/12 → 3/12 ceiling? Hypothesis: **no meaningful change**, because H11 failures are reasoning/code-quality failures, not context overflow.
- **Head-to-head `aider` vs `opencode` (with src-ported patch) on the same fixture.** Single data point to test the "thin-runner beats thick-runner under PL" hypothesis. Fixture: h12 security fix. Measure: wall time, pass rate, retries used.

### 4.3 Medium-term (week, new ground)

- **`qwen3:30b` base, non-opencode.** Does the opencode fine-tune actually help when the runner is aider? Re-run E-SMALL + H11 phase-2.
- **`gemma4-opencode-vulkan:31b` after bumping `num_ctx` to 32K.** Session-2026-04-20 showed it _attempts_ tool use — retesting with context headroom and skill-tool disabled will distinguish "capability missing" from "context starved."
- **PL `spawn` / `review` / `race` primitives with local models.** These are unmapped. Fixture idea: spawn 2 parallel scaffolding attempts on the same task, race for first to pass gates, discard loser.
- **Streaming-stall detection.** Today's v1 opencode run stalled for minutes with no stdout. Add a heartbeat check that distinguishes a genuinely working model from a hung stream.

### 4.4 Longer (month, real-world ground truth)

- **Bug-fix workflow on a real repo.** Pick a closed bug from a repo on this PC with a known patch; run PL+aider+qwen3-opencode-big against it blind; compare the produced patch to the merged one. Measure semantic equivalence, time, retries.
- **Can a small model be made viable?** LORA fine-tune `qwen3:8b` on PL traces from H1–H10 wins. Narrow the action space; see if reliability recovers inside PL's decomposition. Bets against this working are the default outcome given E-SMALL evidence, but the experiment is cheap.
- **Sonnet-4.6 or Haiku-4.5 via claude-runner as ceiling comparator.** Not a local model, but gives a numeric "cost of local-only" on the same fixture.
- **Cost model.** Wall-time × local-electricity vs tokens × API-price on an identical fixture. Frames the entire local-vs-cloud debate for this PC quantitatively.

### 4.5 Anti-experiments (do not run)

- **Gemma4 e2b / e4b rescue retries.** Already falsified. They do not emit valid JS under PL even with maximum decomposition. Moving on.
- **Running PL-over-opencode multi-file scaffolds without timeout knob.** Today's v1 proved the default 90 s runner timeout plus opencode's monopolistic prompt turn is a guaranteed failure.
- **Relying on `"limit": { "context": X }` in `opencode.json` to enlarge model context.** It's metadata. Ollama Modelfile wins.

## 5. What this replaces / supersedes

- Nothing is retracted from SCORECARD.md or LOCAL-MODEL-VIABILITY-FINDINGS.md. This document sits above them as synthesis + forward plan.
- The "use opencode for local coding" implicit assumption from the initial session is refuted for this PC — see §1 avoid.
- The "any 30B MoE is enough for serious work" prior is falsified by H11 2-3/12. For serious multi-file work the current recommendation is PL+aider+qwen3 **for easy tasks**, and cloud for everything else — pending the H12–H20 sweep.

## 6. Open questions this document does not answer

- Is the H11 ceiling (2-3/12) truly a reasoning limit of qwen3-opencode:30b, or partly the aider "edit block" extraction brittleness? Needs an opencode-vs-aider head-to-head on the same fixture.
- Does `retry max 3` actually converge the model on hard tasks, or does it loop forever proposing the same broken patch? Need per-retry diff measurement on H11-class fixtures.
- What fraction of PL's wins in H1–H10 survive when the underlying model is held constant and the task difficulty is dialed up (H11+)? We have 1 data point (H11) showing the win evaporates.
