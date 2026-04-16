# Aider-vs-PL Evidence Consolidation

Consolidated ledger of Phase 1 (H1-H10), E-SMALL small-model probe, and the methodology scrutiny audit.

Date: 2026-04-17
Scope: a single authoritative record of where the aider-vs-PL line of evidence stands today. Replaces nothing; cross-references everything.
Audience: operators deciding whether this experiment is ready to be cited as thesis evidence.

## 1. Executive summary

As of 2026-04-17, the aider-vs-PL line of evidence consists of: (a) a 10-hypothesis informal Phase 1 batch run against `qwen3-opencode:30b` on a single host with N=1 per lane ([`experiments/aider-vs-pl/SCORECARD.md`](SCORECARD.md)), (b) a one-line end-to-end proof that `prompt-language ci --runner aider` executes a .flow file against the real runtime ([`experiments/aider-vs-pl/results/real-pl-flow.md`](results/real-pl-flow.md)), and (c) an E-SMALL small-model probe using a single pre-declared CSV-to-JSON fixture with an 11-test `verify.js` oracle targeting `gemma4-opencode:e2b`, `gemma4-opencode:e4b`, and `qwen3-opencode:30b` in both solo and PL modes ([`experiments/aider-vs-pl/e-small-fixtures/verify.js`](e-small-fixtures/verify.js)). The raw Phase 1 narrative outcome is PL 6 - Solo 0 - Tie 3 ([`experiments/aider-vs-pl/SCORECARD.md:22`](SCORECARD.md)). The methodology scrutiny in [`docs/security/aider-vs-pl-scrutiny.md`](../../docs/security/aider-vs-pl-scrutiny.md) concludes this is narrative dev-time evidence and **not §3a claim-eligible**: four severity-4 findings — no pre-declared fixtures, no blinding, no independent reviewer, no reproducibility manifest, N=1 per cell. The Phase 2 rigor-artifact design ([`experiments/aider-vs-pl/phase2-design.md`](phase2-design.md)) specifies pre-declared fixtures, k=3 per cell, blinded scoring, and cross-family reviewer; H11-H20 fixtures are committed at [`experiments/aider-vs-pl/fixtures/h{11..20}-*/`](fixtures/) but none have been run. A `phase2-h11-rigor` background agent is currently producing the first rigor-artifact H11 run in parallel to this consolidation; its results are not yet in scope. **Honest verdict**: informal dev-time evidence that PL orchestration helps small local models on gate-heavy tasks (decomposition, verification loops, file scoping); not yet claim-eligible under the project's own §3a rules; should not be cited as thesis-level evidence until Phase 2 produces signed, reproducible, k>=3 bundles.

## 2. Phase 1 claim in full

Source: [`experiments/aider-vs-pl/SCORECARD.md`](SCORECARD.md), lines 9-20. All ten hypotheses were run against `qwen3-opencode:30b` (30B MoE, Q4_K_M, Vulkan on AMD RX 7600 XT 16GB, Windows 11) on a single host, N=1 per lane.

| ID  | Task (one-liner)                | Solo outcome                                   | PL outcome                                      | Phase-1 winner | Pre-declared fixture committed? | Source                                       |
| --- | ------------------------------- | ---------------------------------------------- | ----------------------------------------------- | -------------- | ------------------------------- | -------------------------------------------- |
| H1  | Retry recovery                  | Compiled first try                             | Compiled first try                              | TIE            | No                              | [`h1-retry.md`](results/h1-retry.md)         |
| H2  | Gate enforcement TDD (slugify)  | 7/10 tests pass                                | 10/10 tests pass after 3 gate-loop retries      | PL             | No                              | [`h2-tdd.md`](results/h2-tdd.md)             |
| H3  | Decomposed vs monolithic prompt | `any` types, 6 tests, 3/5 quality (subjective) | `unknown` correct, 7 tests, 4/5 quality (subj.) | PL             | No                              | [`h3-decompose.md`](results/h3-decompose.md) |
| H4  | Variable capture pipeline       | 7/10 docs, missing return types                | 9/10 docs, full signatures, module-grouped      | PL             | No                              | [`h4-pipeline.md`](results/h4-pipeline.md)   |
| H5  | File scoping prevents breakage  | 0/3 tests after refactor                       | 3/3 tests after 1 retry                         | PL             | No                              | [`h5-scoping.md`](results/h5-scoping.md)     |
| H6  | Conditional branching           | Caught obvious error, missed subtle NaN        | Same + extra debug feature, also missed NaN     | TIE            | No                              | [`h6-branching.md`](results/h6-branching.md) |
| H7  | Simple edit speed               | 172s avg                                       | 317s avg (1.84x slower)                         | TIE            | No                              | [`h7-speed.md`](results/h7-speed.md)         |
| H8  | Foreach batch operations        | 4/4 files created, 0/4 spec-conformant, 164s   | 4/4 files created, 4/4 spec-conformant, 585s    | PL             | No                              | [`h8-batch.md`](results/h8-batch.md)         |
| H9  | Code structure quality          | Separation 1/5, tests crash (missing import)   | Separation 4/5, tests pass 5/5                  | PL             | No                              | [`h9-quality.md`](results/h9-quality.md)     |
| H10 | Quality ceiling (Result<T,E>)   | not run                                        | Grade B overall (A on impl, C on tests)         | n/a            | No                              | [`h10-ceiling.md`](results/h10-ceiling.md)   |

Aggregate: **PL 6 - Solo 0 - Tie 3** ([`SCORECARD.md:22`](SCORECARD.md)).

Fixture-presence note: of H1-H10, **zero have a pre-declared `verify.js` or `TASK.md` fixture committed before the run**. The only pre-declared oracle in the repo for an aider-vs-PL task is the E-SMALL `test-input.csv` + 11-test `verify.js` at [`experiments/aider-vs-pl/e-small-fixtures/`](e-small-fixtures/), which does not correspond to any of H1-H10 (it is the CSV-to-JSON probe landed in framework commit `3664ab0`, per [`docs/security/aider-vs-pl-scrutiny.md:25`](../../docs/security/aider-vs-pl-scrutiny.md)).

Subjective-grade flag: H3 ("3/5 quality" solo vs "4/5 quality" PL, from [`h3-decompose.md`](results/h3-decompose.md)), H4 ("7/10 docs" vs "9/10 docs", from [`h4-pipeline.md`](results/h4-pipeline.md)), H9 (5-point rubric rows in [`h9-quality.md`](results/h9-quality.md)), and H10 ("Grade B overall" in [`h10-ceiling.md`](results/h10-ceiling.md)) are **subjective human grades without a committed rubric**. These cells are not replicable and should not be treated as numeric evidence.

## 3. Methodology scrutiny — what is broken and why

Source: [`docs/security/aider-vs-pl-scrutiny.md`](../../docs/security/aider-vs-pl-scrutiny.md), §3 "Per-question verdict" (lines 40-51). Abbreviated verdict table follows.

| #   | Question                        | Finding (abbreviated)                                                                                                                                    | Severity     |
| --- | ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| 1   | Tasks declared before running?  | No. No `TASK.md`/fixture for H1-H10.                                                                                                                     | 4 / critical |
| 2   | Scorer blinded?                 | No. Results authored in same commit as narrative.                                                                                                        | 4 / critical |
| 3   | Reviewer independence?          | No. Same author/agent designed PL flows, ran both lanes, and scored.                                                                                     | 4 / critical |
| 4   | Objective oracle?               | Partial. H2/H5/H8 cite test counts but scripts not checked in. H3/H4/H6/H9/H10 use subjective grades with no committed rubric.                           | 3 / high     |
| 5   | Sample size / variance?         | N=1 per hypothesis per lane. No CIs, no repetition even where variance was called out (H1 "too easy", H6 "seed data too weak", H7 "variance-dominated"). | 4 / critical |
| 6   | Counterbalance / order effects? | Not addressed. No randomized order, no cache/context-reset protocol. Qwen3 MoE routing is non-deterministic.                                             | 3 / high     |
| 7   | Reproducibility?                | Not reproducible. No pinned model revision, no aider version, no PL commit SHA per run, no command line, no seed.                                        | 4 / critical |
| 8   | What does "tie" mean?           | Ambiguous. H1 tie = trivial. H6 tie = both missed. H7 tie = PL 84% slower but still "tie".                                                               | 3 / high     |
| 9   | Adjudication provenance?        | Absent. No signed scorecard, no trace bundle, no invocation log.                                                                                         | 4 / critical |
| 10  | Claim-eligible per §3a?         | No. Zero of the five §3a gates hold (strict trace, preflight ready, verify-trace, cross-family reviewer, signed attestation).                            | 4 / critical |

### Severity-4 critical findings — plain-English explanation

**#1 No pre-declared fixture.** For H1-H10 there is no `verify.js` or `TASK.md` in a commit that predates the run commit. The task was described only by a one-line entry in the scorecard. In plain terms: the bar for "success" was written in the same breath as the result. An independent reviewer cannot confirm that the goalposts did not move after the run, because there are no goalposts in the git history prior to the score. This invalidates every "PL wins" cell as controlled evidence — they degrade to anecdote.

**#2 No blinding.** The scorer was the same author/agent that designed the PL flows and ran both lanes, and the score was committed in the same diff as the narrative. There is no evidence of workspace anonymization, label stripping, or independent review. Confirmation bias is the default outcome, not a possibility. This is the exact failure mode the repo's own §3a rule 4 calls out.

**#3 No reviewer independence.** Same author = same agent = same family. Even if blinding had been attempted, a single-author judgment on their own experiment fails the cross-family rule ([`docs/strategy/cross-family-reviewer.md`](../../docs/strategy/cross-family-reviewer.md)). The PL-lane designer is structurally incentivized to see PL win; this is not a character claim, it is a methodology constraint.

**#5 N=1 per cell.** Each hypothesis was run exactly once per lane. Given that the scorecard itself calls out H1 as "too easy / deterministic", H6 as "seed data too weak", and H7 as "variance-dominated", these are precisely the cells where repetition was needed and was not performed. Without k>=3 you cannot distinguish a real effect from a single favorable roll. Qwen3 30B MoE routing is non-deterministic at the expert level; one sample is not enough.

**#7 Not reproducible.** The result files cite "Qwen3 30B Q4_K_M" but not the Ollama model SHA, aider version, PL commit, command-line invocation, seed, or wall-clock start. An independent operator on different hardware cannot re-run H2 and check whether the 10/10 PL result replicates. Reproducibility is the minimum bar for empirical evidence, and it is not met.

**#9 No adjudication provenance.** No signed scorecard JSON, no `run-manifest.json`, no trace bundle. Every record is a prose blurb authored in the same commit as the run. There is no attestation that the run actually produced the artifact that the prose describes. A single post-hoc edit of the result file would be undetectable.

**#10 Not §3a-eligible.** The repo's own claim-eligibility rule ([`docs/strategy/program-status.md:53-74`](../../docs/strategy/program-status.md)) requires strict trace mode, preflight ready, verify-trace, cross-family reviewer, and a signed attestation. Phase 1 satisfies none of these. The project's own rule says these results do not count toward thesis verdicts.

### Why this matters for the thesis

The thesis ([`docs/strategy/thesis.md`](../../docs/strategy/thesis.md)) is that prompt-language is a higher-order engineering medium that engineers edit first, with code as a downstream artifact agents produce and maintain. A claim like "PL beats solo aider 6-0-3" would be direct evidence for the thesis if it held up. Under the scrutiny it does not hold up as evidence. It may still be true — the scrutiny explicitly says the outcome is not disputed ([`docs/security/aider-vs-pl-scrutiny.md:68`](../../docs/security/aider-vs-pl-scrutiny.md)) — but the repo contains no artifact that proves it at thesis level.

## 4. E-SMALL small-model hypothesis

**Thesis under test (verbatim user statement)**: "with prompt language on top of the harness we can use much less powerful models like SML locally and see good results with it and working software".

**Why this matters**: if PL-orchestrated small models produce working software where solo small models do not, PL's value proposition is strongest exactly where open-source local-only inference matters — on commodity hardware with sub-10B models that would otherwise be too weak for autonomous coding work. The scrutiny does not invalidate this claim; it only says Phase 1 does not prove it.

### E-SMALL experiment design

Fixture: [`experiments/aider-vs-pl/e-small-fixtures/`](e-small-fixtures/)

- **Task**: CSV-to-JSON converter. Write a `csv2json.js` script that reads a CSV file path from argv, parses it (including quoted fields with embedded commas and empty fields coerced to null), and writes the JSON array to stdout. Missing or empty input files must exit 1.
- **Oracle**: [`verify.js`](e-small-fixtures/verify.js) — 11 self-contained Node tests exercising file existence, valid-CSV parsing, 4-row output, header keys, simple row values, quoted-field-with-comma handling, empty-field-to-null, empty-quoted-field-to-null, no-argument exit-1, missing-file exit-1, empty-file exit-1. Test runner emits `Results: N/11 passed` and `VERDICT: PASS` or `VERDICT: FAIL (k failed)` and exits 0/1 accordingly ([`verify.js:91-99`](e-small-fixtures/verify.js)).
- **Input data**: 4-row CSV including quoted-comma-containing fields, empty fields, and an empty quoted city ([`test-input.csv`](e-small-fixtures/test-input.csv)).
- **Models under test** (3): `gemma4-opencode:e2b` (5.1B), `gemma4-opencode:e4b` (8.0B), `qwen3-opencode:30b` (30B MoE Q4_K_M).
- **Modes** (2): solo aider via `aider --message <prompt>` and PL via `prompt-language ci --runner aider` against a .flow file. Both modes point at the same Ollama endpoint.
- **Cells**: 3 models × 2 modes = 6 cells.
- **Oracle-vs-Phase-1 improvement**: unlike H1-H10, the E-SMALL verify.js is committed before the run and produces an objective pass/fail via exit code. This is the first aider-vs-PL task in the repo that meets the scrutiny's §3a rule 1 (pre-declared fixture) and rule 4 (objective oracle).

### E-SMALL results

**E-SMALL results pending, not included in this consolidation.** Three background agents are currently executing the 6-cell matrix against the E-SMALL fixture. No result files exist under [`experiments/aider-vs-pl/results/`](results/) matching `esmall-*.md` or under [`experiments/aider-vs-pl/e-small-fixtures/`](e-small-fixtures/) beyond the input CSV and verify.js at time of writing. This consolidation will need to be updated once the agents land their result files.

Residual scrutiny caveats even when results land: E-SMALL addresses §3a rule 1 (pre-declared fixture) and rule 4 (objective oracle), but it does **not by itself** address blinding, cross-family reviewer, k>=3 repetition, strict-trace, or signed attestation. A positive E-SMALL result would still be informal evidence for the small-model thesis — stronger than Phase 1, but not yet §3a claim-eligible.

## 5. What Phase 2 is meant to do

Source: [`experiments/aider-vs-pl/phase2-design.md`](phase2-design.md).

### Phase 2 protocol

- **Hypothesis set (H11-H20)**: ten harder hypotheses, each mapped to an E5 change-request family. Tasks include multi-file refactor (H11, CR-02), SQL injection fix (H12, CR-04), N+1 query optimization (H13, CR-03), TDD red-green-refactor (H14, CR-01), PATCH endpoint with validation and 8+ tests (H15, CR-01), bug reproduction from issue (H16, CR-05), Express v4-to-v5 upgrade (H17, maintenance core), config centralization (H18, CR-03), error handling overhaul (H19, CR-04), and API reference generation from code (H20, CR-05) ([`phase2-design.md:23-91`](phase2-design.md)).
- **Per-hypothesis fixture shipped**: every H11-H20 directory under [`experiments/aider-vs-pl/fixtures/`](fixtures/) contains a committed `TASK.md`, `task.flow`, `verify.js`, `package.json`, and `src/` seed. Spot-checked for H11, H12, H20 — structure matches. This is the first pre-declared-fixture batch in the aider-vs-PL line.
- **Execution protocol** ([`phase2-design.md:95-100`](phase2-design.md)): per hypothesis, fresh workspace, solo run with timeout, PL run with 2x timeout budget, automated gate check + rubric scoring.
- **Scoring rubric** ([`phase2-design.md:104-109`](phase2-design.md)): Correctness 40%, Completeness 25%, Quality 20%, Speed 15%. Correctness is pass/fail via verify.js exit code; the other three remain partly subjective but are weighted less.
- **Sample size**: k=3 per model × mode combination ([`phase2-design.md:113-116`](phase2-design.md)).
- **Randomization**: run order randomized within each model block.
- **Blinding**: scoring script evaluates workspace artifacts without knowing which mode produced them.
- **Model matrix**: Qwen3 30B (local), Claude Sonnet 4 (frontier), GPT-4.1 (cross-family frontier), DeepSeek V3 (open-weight frontier) ([`phase2-design.md:12-19`](phase2-design.md)).

### Which §3a rules Phase 2 claims to address

| §3a rule                                              | Phase 2 addresses? | Evidence in phase2-design.md                                                                                                |
| ----------------------------------------------------- | ------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| 1. Strict trace (`PL_TRACE=1 PL_TRACE_STRICT=1`)      | Not explicitly     | Not mentioned in phase2-design; must be set operationally                                                                   |
| 2. Preflight envelope `ready`                         | Not explicitly     | Not mentioned; inherited from repo-wide gating                                                                              |
| 3. `verify-trace` with attestation + operator role    | TBD                | Signed attestation not in design; must be added at run time                                                                 |
| 4. Cross-family reviewer distinct from factory family | Partially          | Blinded scoring script is promised ([`phase2-design.md:115`](phase2-design.md)); cross-family reviewer not explicitly named |
| 5. Signed bundle via `trusted-signers.json`           | TBD                | Not in design; must be added at bundle creation time                                                                        |

Pre-declared fixtures: yes (H11-H20 all have TASK.md + verify.js committed). Blinded scoring: yes (design). k=3 per cell: yes (design). Cross-family reviewer: partial — design mentions blinded scoring but does not name the reviewer-family constraint; the general repo pattern via [`docs/strategy/cross-family-reviewer.md`](../../docs/strategy/cross-family-reviewer.md) would need to be wired in. Signed attestation: TBD — must be produced by the `attest.mjs` pathway ([`docs/strategy/program-status.md:48`](../../docs/strategy/program-status.md)) at bundle creation.

### H11 rigor-artifact run in flight

A `phase2-h11-rigor` background agent is currently producing the first Phase 2 rigor-artifact run — H11 multi-file refactor (rename `Contact` → `Client` across 5+ files). This run is scoped to the H11 fixture at [`experiments/aider-vs-pl/fixtures/h11-multi-file-refactor/`](fixtures/h11-multi-file-refactor/) and is the first aider-vs-PL run designed to be §3a-shaped end-to-end. This consolidation does **not** depend on or report H11 results; the background agent is noted here only so a reader understands the timeline. Do not contact or race that agent.

## 6. What would flip the verdict

### 6a. What would make this evidence thesis-eligible

All five §3a gates ([`docs/strategy/program-status.md:53-74`](../../docs/strategy/program-status.md)) must hold:

1. **Strict trace**: `PL_TRACE=1 PL_TRACE_STRICT=1` set for every run in the bundle.
2. **Preflight ready**: bootstrap-envelope returns `overall: ready` (not `degraded` or `blocked`).
3. **verify-trace passes**: `verify-trace` exits 0 with `--require-attestation --require-role operator`.
4. **Cross-family reviewer veto-eligible and non-vetoing**: factoryFamily != reviewerFamily per [`docs/strategy/cross-family-reviewer.md`](../../docs/strategy/cross-family-reviewer.md).
5. **Signed attestation**: `attestation.json` in bundle, signed by a non-placeholder operator key in [`docs/security/trusted-signers.json`](../../docs/security/trusted-signers.json).

Plus the Phase 2 protocol requirements ([`phase2-design.md:95-116`](phase2-design.md)):

- Pre-declared fixture per hypothesis (shipped for H11-H20).
- k>=3 runs per cell.
- Blinded scoring via artifact-only script.
- Randomized run order.
- Run manifest per cell: aider version, Ollama model SHA, PL commit, command line, seed, wall-clock bounds.

When a bundle meets all of the above and the verdict still favors PL, the aider-vs-PL line graduates from "informal" to "claim-eligible" under the repo's own rules. Not before.

### 6b. What would invalidate the thesis (or narrow it)

The Phase 2 design lists three invalidation paths ([`phase2-design.md:135-139`](phase2-design.md)). Expanded and sharpened:

1. **Frontier-model equivalence**: if Phase 2 at k>=3 on Claude Sonnet 4 and GPT-4.1 shows solo-mode quality matching PL-mode quality (within scoring epsilon), the thesis narrows from "PL orchestration is generally beneficial" to "**PL compensates for small-model weakness**". Specifically: if on a frontier model solo aider achieves >= 90% of PL's correctness score on H11-H20 while spending < 50% of the wall-clock time, PL's frontier-model value is primarily discipline (gate loops, file scoping as explicit contract) rather than capability uplift.
2. **Speed-cost inversion**: if PL's speed penalty exceeds 3x on harder tasks (vs the 1.5-3.5x range reported in [`SCORECARD.md:48`](SCORECARD.md)) and correctness lift does not compensate, the cost-benefit inverts for anything but gate-critical work.
3. **Creative-task failure**: if PL loses on creative/architectural tasks (H14 TDD discipline, H20 doc generation) while still winning on gate-heavy tasks (H11 refactor, H17 upgrade), the thesis narrows to "**PL helps on verify-loop tasks, not on generation tasks**".

**Pivot pattern to watch for**: a matrix where PL advantage is monotonically decreasing with model size would be the clearest signal that the thesis should pivot to small-model compensation rather than general orchestration uplift. In that case, the honest framing becomes: "PL lets sub-10B local models produce working software on tasks where solo-aider-at-same-model-size cannot" — which is exactly the E-SMALL hypothesis, and a strong claim in its own right.

## 7. Reproducibility appendix

An independent reviewer reproducing any aider-vs-PL run needs the following.

### Inputs

- **Models** (pull exactly):
  - `qwen3-opencode:30b` (Phase 1 + E-SMALL) — 30B MoE, Q4_K_M quantization. Phase 1 ran on Vulkan via an AMD RX 7600 XT 16GB. No Ollama model SHA is recorded in [`SCORECARD.md`](SCORECARD.md) or in any result blurb — this is a Severity-4 reproducibility gap (scrutiny finding #7).
  - `gemma4-opencode:e2b` (5.1B, E-SMALL only).
  - `gemma4-opencode:e4b` (8.0B, E-SMALL only).
- **Aider version**: not recorded in any Phase 1 artifact (scrutiny finding #7). For Phase 2 a version pin must be captured in the per-run manifest.
- **PL commit**: not recorded per Phase 1 run. For this consolidation the relevant commit range is the set between the Phase 1 result commits `7127476`, `0aceba7`, `847fd8b`, `94e1f72` (cited in [`docs/security/aider-vs-pl-scrutiny.md:26`](../../docs/security/aider-vs-pl-scrutiny.md)).
- **Ollama endpoint**: the aider adapter hardcodes `OLLAMA_API_BASE=http://127.0.0.1:11434` ([`docs/security/aider-adapter-audit.md:32`](../../docs/security/aider-adapter-audit.md), finding #4). Reviewers cannot redirect aider to a remote Ollama via env variable with the shipped adapter.

### Fixture paths

- Phase 1 H1-H10: **no fixtures committed**. Reviewers cannot reproduce H1-H10 because the task specifications exist only as one-line scorecard entries.
- E-SMALL: [`experiments/aider-vs-pl/e-small-fixtures/test-input.csv`](e-small-fixtures/test-input.csv) and [`experiments/aider-vs-pl/e-small-fixtures/verify.js`](e-small-fixtures/verify.js).
- Phase 2 H11-H20: [`experiments/aider-vs-pl/fixtures/h{11..20}-*/`](fixtures/) each containing `TASK.md`, `task.flow`, `verify.js`, `package.json`, `src/`.

### Commands

End-to-end runtime path (verified in [`real-pl-flow.md`](results/real-pl-flow.md)):

```bash
PYTHONUTF8=1 OLLAMA_API_BASE=http://127.0.0.1:11434 \
  PROMPT_LANGUAGE_AIDER_TIMEOUT_MS=300000 \
  node bin/cli.mjs ci --runner aider build.flow
```

For a §3a-shaped run the operator additionally sets `PL_TRACE=1`, `PL_TRACE_STRICT=1`, and `PL_TRACE_DIR=<per-run-dir>`. See [`docs/strategy/program-status.md:53-74`](../../docs/strategy/program-status.md) for the full gate list.

### Security-relevant invocation details

Security-relevant details of the aider adapter invocation live in [`docs/security/aider-adapter-audit.md`](../../docs/security/aider-adapter-audit.md). Key points for reproducibility:

- Argv shape: `python -m aider --message <prompt>` via `execFileSync` with `stdio: ['ignore','pipe','pipe']` ([`aider-adapter-audit.md:41-43`](../../docs/security/aider-adapter-audit.md)). No shell, stdin closed, no command injection surface.
- Env forwarding: `{ ...process.env }` spread plus explicit `PYTHONUTF8` and hardcoded `OLLAMA_API_BASE`. `PL_TRACE`, `PL_TRACE_DIR`, `PL_RUN_ID`, `PL_TRACE_STRICT` inherit through the spread ([`aider-adapter-audit.md:29,32`](../../docs/security/aider-adapter-audit.md)).
- Trace chain: `TracedPromptTurnRunner` wraps the raw aider runner when `PL_TRACE=1` is set. `stdinSha256 = sha256Hex(input.prompt)` fingerprints the exact prompt sent to aider; `stdoutSha256` reflects the 12,000-char truncated assistantText ([`aider-adapter-audit.md:31`](../../docs/security/aider-adapter-audit.md)).
- Known Severity-2 exposure: the prompt is placed on argv via `--message <prompt>`, making it visible to any local user via `ps -ef` or `/proc/<pid>/cmdline` ([`aider-adapter-audit.md:36`](../../docs/security/aider-adapter-audit.md), finding #8). If a reviewer runs aider on a shared host with untrusted local users, interpolated secrets in `${var}` values would leak. Follow-up fix is tracked under `prompt-xgav.11.1`.

### What an independent reviewer cannot currently do

- Reproduce H1-H10 outcomes (no fixture committed).
- Verify that the Phase 1 model SHA matches any published Qwen3 30B checkpoint (not recorded).
- Verify that the Phase 1 aider version matches any release (not recorded).
- Detect whether a Phase 1 result file was edited post-run (no attestation, no signed bundle).

These are the exact gaps Phase 2 is designed to close.

## Cross-references

- Scorecard: [`experiments/aider-vs-pl/SCORECARD.md`](SCORECARD.md)
- Per-hypothesis blurbs: [`experiments/aider-vs-pl/results/h1-retry.md`](results/h1-retry.md) through [`results/h10-ceiling.md`](results/h10-ceiling.md)
- Real PL flow proof: [`experiments/aider-vs-pl/results/real-pl-flow.md`](results/real-pl-flow.md)
- Phase 2 design: [`experiments/aider-vs-pl/phase2-design.md`](phase2-design.md)
- E-SMALL fixture: [`experiments/aider-vs-pl/e-small-fixtures/verify.js`](e-small-fixtures/verify.js)
- Phase 2 fixtures: [`experiments/aider-vs-pl/fixtures/h11-multi-file-refactor/`](fixtures/h11-multi-file-refactor/) through [`fixtures/h20-doc-generation/`](fixtures/h20-doc-generation/)
- Scrutiny audit: [`docs/security/aider-vs-pl-scrutiny.md`](../../docs/security/aider-vs-pl-scrutiny.md)
- Aider adapter audit: [`docs/security/aider-adapter-audit.md`](../../docs/security/aider-adapter-audit.md)
- Program status (downgraded claim rows 11, 23, 38): [`docs/strategy/program-status.md`](../../docs/strategy/program-status.md)
- §3a claim-eligibility rules: [`docs/strategy/program-status.md:53-74`](../../docs/strategy/program-status.md)
- Cross-family reviewer design: [`docs/strategy/cross-family-reviewer.md`](../../docs/strategy/cross-family-reviewer.md)
- Thesis: [`docs/strategy/thesis.md`](../../docs/strategy/thesis.md)
