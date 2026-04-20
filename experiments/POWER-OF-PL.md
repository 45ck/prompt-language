# Power of PL — capabilities showcase

Date: 2026-04-20
Scope: what a PL flow can do that a raw coding-agent harness cannot, tied to measurements on this PC. Skeptic-readable in ~5 minutes. Every claim pairs a number or a file reference.

Sibling doc: `experiments/JOURNEY.md` (narrative of how we got here). This doc is the surface view of what the runtime can do *today*, and what we have actually measured doing it.

---

## 1. What PL is, in one sentence

PL is a supervisor layer above coding-agent harnesses (aider, opencode, claude, codex, ollama) that provides deterministic control flow, variables, and verification gates — the model is called only at `prompt` nodes; everything else (retries, branches, shell, gate checks) runs without AI involvement. Source: `README.md` lines 3, 12–15 — "~85% of execution is deterministic; ~15% is AI … `done when: tests_pass` runs real commands and blocks completion until they pass. The AI cannot self-report 'done.'"

---

## 2. Claim 1 — Gate-enforced retry lifts a flaky model into a deterministic one

**Evidence (H2, qwen3-opencode:30b + aider):** solo scored 7/10 TDD tests; the PL flow reached 10/10 in 3 retries. Source: `experiments/aider-vs-pl/SCORECARD.md` lines 12–13, 41–45. H5 (0/3 → 3/3) and H8 (0/4 → 4/4 spec-conformant) reproduce the pattern on different fixtures. Every PL win in H1–H10 carried an oracle the model could not pass on its own.

**The shape of the loop** (lifted from `experiments/aider-vs-pl/rescue-viability/flows/r1-pl-full.flow` lines 8–13):

```
retry max 3
  run: node verify.cjs [timeout 60]
  if command_failed
    prompt: verify.cjs just printed failing assertions to stderr. … Edit csv2json.js with your edit tool to fix only the specific failing assertions.
  end
end
```

No model self-report of "fixed" is consulted. `command_failed` is set by `last_exit_code != 0`. The oracle decides the retry.

---

## 3. Claim 2 — Decomposition beats monolithic prompts

**Evidence (two runs, same model):**
- H3 — solo produced `any`-typed code with 6 tests; PL with per-step prompts produced `unknown`-typed code with 7 tests. `SCORECARD.md` line 13.
- Next.js scaffold, 2026-04-20 — v1 single-prompt added a stray `@emotion/react` dependency and broke `next build` with `f.createContext is not a function`; v2 with six one-file prompts + a `retry max 3` build gate produced a clean `tsconfig.json`. Source: `experiments/aider-vs-pl/SESSION-2026-04-20-OPENCODE-NEXTJS.md` lines 9–11, 68–71.

The PL win in both cases is from *slicing* the work, not from cleverer prompts. The model sees one file at a time with explicit "do not add dependencies" constraints; the orchestrator handles sequencing and verification.

---

## 4. Claim 3 — Rescue at 8B is measurable (with caveats)

**Evidence (R1v3, 2026-04-20):** qwen3:8b on the E-SMALL csv2json fixture — **5/11 assertions pre-retry, 9/11 post-retry**, a +4 assertion lift in a single PL retry+gate cycle. Artefacts: `experiments/aider-vs-pl/rescue-viability/runs/r1/qwen3-8b-pl-full-v3/` (contains `csv2json.js`, `verify.cjs`, `run.log`). Cited in `experiments/aider-vs-pl/rescue-viability/README.md` line 3 ("R1v3 produced +4 assertions on qwen3:8b E-SMALL") and `LIVE-NOTES.md` lines 17–21.

**Caveats (from the same source):** N=1. Pre-retry variance 5–8/11 across runs on the same model and prompt (`LIVE-NOTES.md` line 44). The solo-arm baseline has not been run yet, so "lift vs solo" is not yet defensible — "lift vs pre-retry snapshot within the PL run" is. Replications R1-A/B/C are queued.

---

## 5. Claim 4 — Gates are executable, not advisory

**Evidence:** PL gates run shell commands and let exit codes decide. From `docs/reference/dsl-cheatsheet.md` lines 189–216:

```
done when:
  tests_pass
  file_exists src/index.ts
  gate build_ok: npm run build
```

The r1 flow ends with `gate verify_passes: node verify.cjs` (`r1-pl-full.flow` line 17). The model is never asked "did it work?"

**Hard-stop proof the evaluator is real:** `src/application/evaluate-completion.ts` line 449 — `"Gate evaluation hard-stopped after ${GATE_HARD_STOP_THRESHOLD} consecutive failures. Flow marked as failed."` Triggered as PLO-004 in `experiments/aider-vs-pl/results/h11-phase5-gate-loop/artisan-v5/pl.stderr.txt` and `h14-phase2-stderr/pl-stderr/pl.stderr.txt` — the evaluator aborts after 50 consecutive fails rather than let the model loop forever.

---

## 6. Claim 5 — Multi-agent primitives compose with local runners (with constraints)

**Evidence:** `spawn`, `await`, `race`, `foreach-spawn`, `send`/`receive`, `review` all ship and route to local runners via `PL_SPAWN_RUNNER=aider|opencode|ollama|codex` (`CliProcessSpawner`, per `experiments/aider-vs-pl/MULTI-AGENT-REVIEW.md` §2). Reference docs: `docs/reference/{spawn,race,foreach-spawn,send-receive,review}.md`.

**Example** (from `rescue-viability/flows/r7-foreach-spawn.flow` lines 21–23):

```
foreach-spawn file in ${files} max 3
  prompt: You are scaffolding ONE file … The file to create is exactly ${file} …
end
await all
```

**Constraint, measured not theoretical:** on a single-GPU ollama host, two spawns requesting the same 30B model serialise — the model slot is a queue. `MULTI-AGENT-REVIEW.md` §3.1, §4.2 treats `foreach-spawn` on this PC as a **failure-isolation primitive**, not a speed primitive ("a bad child's write tool error does not mutate siblings' scratch state", `r7-foreach-spawn.flow` lines 25–28).

---

## 7. Claim 6 — The fix PL just shipped is the shape of PL's own next patches

**Evidence:** today (2026-04-20) the opencode-runner progress-detection defect was patched in `dist/infrastructure/adapters/opencode-prompt-turn-runner.js :: summarizeOpenCodeJsonOutput`, then ported to `src/` with Vitest coverage. `SESSION-2026-04-20-OPENCODE-NEXTJS.md` §3 describes the exact defect (missing `part.snapshot` emission + incorrect short-circuit on `madeProgress`). The patch type — a single-file adapter fix with unit-test coverage — is the "Level B ladder MVP" shape that a PL flow would author for future patches of this class. Concrete, not aspirational: the same flow template that rescued csv2json could author this fix given `npm test -- opencode-prompt-turn-runner` as the oracle.

---

## 8. Claim 7 — Cross-runner portability, with a caveat

**Evidence:** five runners enumerated in `src/application/execution-preflight.ts` line 13 — `type RunnerName = 'claude' | 'codex' | 'opencode' | 'ollama' | 'aider'`. A `.flow` written for one is re-invokable against another via `--runner <x> --model <m>`. `experiments/aider-vs-pl/rescue-viability/flows/level-a-harness.flow` parameterises runner and model at the CLI boundary (lines 11–14, 57, 65).

**Caveat:** runner-specific prompt shape still matters. `GUIDE-AND-ROADMAP.md` §2.4 records two P1 aider-runner defects, an opencode progress-detector drift, and an ollama `num_ctx` silent-truncation trap. Portability is at the DSL level; runner-specific quirks leak at the integration level and each added runner has historically added one P1 defect.

---

## 9. What PL is not claiming

PL does not make a small model smarter inside a single turn. It adds retries, gates, decomposition, variable capture, and structural control — all outside the model call. If the model is below the "literal syntactically valid code" threshold, PL cannot rescue it: `gemma4-opencode:e2b` scored 1/11 on E-SMALL by emitting the string `"// I'm going to use the file system..."` repeated hundreds of times; `gemma4-opencode:e4b` scored 1/11 with 0-byte files and `"maximally"` repeated. These are decoding traps, not reasoning gaps, and PL retry+gate cannot rescue them. Source: `experiments/aider-vs-pl/GUIDE-AND-ROADMAP.md` §2.2 lines 32–33; `LOCAL-MODEL-VIABILITY-FINDINGS.md`.

---

## 10. Try it — reproduce the strongest measurable claim (R1v3, +4 assertions)

Three commands, copy-pasteable, from a bash shell on this PC:

```bash
cd /c/Projects/prompt-language/experiments/aider-vs-pl/rescue-viability

# 1. stage a fresh run dir with the fixture + oracle
RUN_DIR=runs/r1/qwen3-8b-pl-full-$(date -u +%Y%m%dT%H%M%SZ) && \
  mkdir -p "$RUN_DIR" && cp -R fixtures/e-small/. "$RUN_DIR"/ && \
  cp flows/r1-pl-full.flow "$RUN_DIR"/subject.flow && \
  (cd "$RUN_DIR" && git init -q && git add -A && git commit -q -m fixture --allow-empty)

# 2. run the PL flow (qwen3:8b via aider, retry+gate on verify.cjs)
(cd "$RUN_DIR" && node /c/Projects/prompt-language/bin/cli.mjs ci subject.flow \
  --runner aider --model ollama_chat/qwen3:8b > pl.log 2>&1 || true)

# 3. grade with the oracle, count PASS/FAIL lines
(cd "$RUN_DIR" && node verify.cjs 2>&1 | tee oracle.log | grep -c '^PASS')
```

Expected: pre-retry `csv2json.js` scores somewhere in 5–8/11 (model stochasticity, `LIVE-NOTES.md` line 19); post-retry score ≥ 9/11 with the +4 lift coming from the `retry max 3 + if command_failed` block. Known gotchas: aider's parent-git-repo quirk needs the `git init` step (`LIVE-NOTES.md` §aider P1 defect Layer 2); the ollama TCP-drop failure mode (Layer 1) can force a rerun.

---

## Source index

- `experiments/aider-vs-pl/SCORECARD.md` — H1–H10 PL 6 / Solo 0 / Tie 3
- `experiments/aider-vs-pl/GUIDE-AND-ROADMAP.md` — consolidated recommendations, runner/model matrix, engineering debt
- `experiments/aider-vs-pl/SESSION-2026-04-20-OPENCODE-NEXTJS.md` — Next.js scaffold v1 vs v2
- `experiments/aider-vs-pl/MULTI-AGENT-REVIEW.md` — multi-agent primitive review against local runners
- `experiments/aider-vs-pl/rescue-viability/{LIVE-NOTES.md,README.md}` — R1v3 +4 assertion receipt
- `experiments/aider-vs-pl/rescue-viability/flows/{r1-pl-full,r7-foreach-spawn,level-a-harness}.flow`
- `docs/reference/{dsl-cheatsheet,review,race,foreach-spawn,send-receive}.md`
- `src/application/execution-preflight.ts` (runner enum, line 13)
- `src/application/evaluate-completion.ts` (PLO-004 hard-stop, line 449)
