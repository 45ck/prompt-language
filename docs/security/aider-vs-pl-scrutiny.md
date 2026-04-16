# Aider-vs-PL 6/0/3 Methodology Scrutiny

Audit date: 2026-04-14
Auditor role: quality reviewer / methodology scrutiny
Scope: the claim "PL 6 wins, 0 losses, 3 ties" cited in
[`docs/strategy/program-status.md`](../strategy/program-status.md) rows 11, 23,
38.

## 1. The claim under audit

Program-status asserts three times that the aider-vs-PL phase-1 result is
"PL 6 wins, 0 losses, 3 ties" and lists it among "the strongest shipped
evidence today" alongside the witness-chain and the E7 CRM factory. Row 23
labels it **Complete** and the commit message for `94e1f72` says
"Final results from 10 controlled A/B experiments".

## 2. Evidence located

Only five classes of artifact exist for phase 1 (H1-H10):

| Artifact | Path | Form |
| --- | --- | --- |
| Top-level scorecard | `experiments/aider-vs-pl/SCORECARD.md` | 63-line narrative, one row per hypothesis |
| Per-hypothesis result | `experiments/aider-vs-pl/results/h{1..10}-*.md` | 4-20 line prose blurb |
| Single shared fixture | `experiments/aider-vs-pl/e-small-fixtures/{test-input.csv, verify.js}` | Landed in framework commit `3664ab0`; only serves a CSV-to-JSON task that is not any of H1-H10 |
| Result commits | `7127476`, `0aceba7`, `847fd8b`, `94e1f72` | Narrative-only diffs; no logs, transcripts, invocation commands, scorecards, or traces |
| Phase-2 design doc | `experiments/aider-vs-pl/phase2-design.md` | Proposes rigor (declared tasks, randomized order, blinded scoring) for H11-H20 that phase 1 did not have |

No fixture directories, `.flow` files, `TASK.md`, `verify.js`, `package.json`
scaffolds, aider transcripts, PL session-state bundles, or rubric scorecards
exist for H1-H10. The H11-H20 fixtures under
`experiments/aider-vs-pl/fixtures/` are an explicitly future batch that did
not run.

`prompt-xgav` is the existing trace-verification security-hardening epic;
slots .1-.9 are already occupied. This audit files under `.15` as requested.

## 3. Per-question verdict

| # | Question | Finding | Severity | Recommendation |
| --- | --- | --- | --- | --- |
| 1 | Tasks declared before running? | **No.** No `TASK.md`/fixture exists for H1-H10. The only declared contract is a one-line task name in the scorecard (e.g. "Retry recovery", "Gate enforcement TDD"). Phase-2 design introduces this discipline retroactively and concedes Phase 1 lacked it. | 4 / critical | Re-run against committed `TASK.md` + `verify.js` declared in a commit that precedes any run commit. |
| 2 | Scorer blinded? | **No.** Scorecard results are authored in the same commits as the narrative ("PL WINS (decisive)"). No evidence of workspace anonymisation, label stripping, or blinded review. Phase-2 design admits blinding must be added. | 4 / critical | Implement the blinded scoring script proposed in phase2-design §"Blinding" before counting any wins. |
| 3 | Reviewer independence? | **No.** The scorer is the same author/agent that designed the PL flows and ran both lanes. No cross-family reviewer. This is exactly the MR-4 failure mode called out in program-status §7. | 4 / critical | Require a cross-family reviewer (§3a rule 4) for each hypothesis verdict before it counts toward program-status claims. |
| 4 | Objective oracle? | **Partial at best.** H2, H5, H8 reference numeric pass counts ("10/10 tests", "3/3 tests", "4/4 spec-conformant") but the test scripts and raw outputs are not checked in. H3, H4, H6, H9, H10 use subjective grades ("3/5 quality", "4/5 quality", "Grade B"). No rubric is attached to the commits. | 3 / high | Replace grades with a test script (`verify.js`) exit code per hypothesis; commit the script before the run; attach raw stdout+stderr bundles. |
| 5 | Sample size / variance? | **N = 1 per hypothesis, per lane.** The scorecard shows single runs. H1 is dismissed as "too easy / deterministic", H6 as "seed data too weak", H7 as variance-dominated — exactly the cases where repetition was needed but not performed. No variance bounds, no CIs. | 4 / critical | Re-run each hypothesis k ≥ 3 times per lane, record seed/commit/model hash, report win rate with uncertainty. Phase-2 design correctly specifies k=3; phase 1 did not do this. |
| 6 | Counterbalance / order effects? | **Not addressed.** No evidence of randomised run order, warm/cold cache control, or conversation-reset discipline between lanes. Qwen3 MoE routing is non-deterministic; order effects are plausible. | 3 / high | Randomise solo-vs-PL order per hypothesis; document cache/context reset per run. |
| 7 | Reproducibility? | **Not reproducible.** No pinned model revision (just "Qwen3 30B Q4_K_M"), no aider version, no PL commit SHA in the result files, no command line for each run, no environment manifest, no seed. An independent operator cannot re-run. | 4 / critical | Attach a `run-manifest.json` per hypothesis: aider version, ollama model sha, PL commit, cwd hash, command line, wall-clock start, tokens-in/out. |
| 8 | What does "tie" mean? | **Ambiguous.** H1 tie = both passed trivially. H6 tie = both caught the obvious error, both missed the subtle one. H7 tie = PL 84 % slower, scored tie. Tie semantics differ per row. | 3 / high | Define tie formally ("equal on rubric to within epsilon") or drop the category and report raw pass-rate deltas. |
| 9 | Adjudication provenance? | **Absent.** No signed scorecard, no trace bundle, no invocation log. The entire record is a prose blurb in a git commit authored in the same breath as the run. | 4 / critical | Produce a scorecard JSON per run with hash; sign via the same attestation pathway being built for §3a rule 5. |
| 10 | Claim-eligible per §3a? | **No.** Zero of the five gates hold: (1) `PL_TRACE_STRICT` not set — the experiment does not invoke the PL trace chain; (2) preflight envelope not run; (3) `verify-trace` not invoked; (4) cross-family reviewer not used; (5) no signed attestation. Program-status §3a itself says "today zero runs satisfy all five". The aider-vs-PL runs are not an exception. | 4 / critical | Do not cite as thesis-eligible evidence. Re-label as informal dev-time comparison or re-run under §3a gates. |

## 4. Overall verdict

**Narrative evidence, not claim-eligible.**

The phase-1 aider-vs-PL batch is informal development-time comparison.
It is legitimately useful for picking features to prioritise (gate loops,
file scoping, decomposition) but it is **not** thesis-eligible under the
repo's own §3a rule: no pre-declared task fixtures, no blinded scoring, no
cross-family reviewer, no reproducible manifest, no signed bundle, N=1 per
cell. Program-status citing it alongside the witness-chain and E7 as "the
strongest shipped evidence today" overstates what exists. The phase-2
design doc (`phase2-design.md`) correctly lists all of the disciplines
that phase 1 skipped; adopting those disciplines is the fix, not
polishing the existing scorecard.

The outcome (PL winning) is not in dispute here — it may well be true
that PL orchestration beats solo aider with a 30B local model. The audit
says only that **no shipped artifact in this repo proves it at thesis
level**.

## 5. Recommended corrections to program-status.md

Three concrete edits (applied in the same patch as this file):

**Edit 1 (§1 Thesis status, row 11):** replace
> ..., and the aider-vs-PL experiment (PL 6 wins, 0 losses, 3 ties).

with
> ..., and the aider-vs-PL phase-1 informal comparison (10 hypotheses, N=1 per lane, not claim-eligible per §3a; see `docs/security/aider-vs-pl-scrutiny.md`).

**Edit 2 (§2 Programs, row 23):** replace
> Complete. PL 6, Solo 0, Tie 3.

with
> Phase 1 informal dev-time comparison complete (10 hypotheses, N=1 per lane, narrative scoring, not §3a-eligible). Phase 2 design shipped; not yet run. See `docs/security/aider-vs-pl-scrutiny.md`.

**Edit 3 (§3 What has shipped, row 38):** replace
> Aider-vs-PL experiment — 10 hypotheses, PL 6 wins / 0 losses / 3 ties against solo aider with Qwen3 30B local model. ...

with
> Aider-vs-PL phase-1 informal comparison — 10 hypotheses, single run per lane, narrative scoring; not claim-eligible per §3a (see `docs/security/aider-vs-pl-scrutiny.md`). `prompt-language ci --runner aider` verified end-to-end. Phase-2 design with pre-declared tasks, blinding, and k=3 repetition shipped at `experiments/aider-vs-pl/phase2-design.md`; not yet run.

## 6. Follow-up beads

Filed under the `prompt-xgav` security epic (IDs assigned by the tracker):

- `prompt-xgav.10` - aider-vs-PL scrutiny audit (this document). Status: open.
- `prompt-xgav.10.1` - pre-declare H1-H10 fixtures + verify scripts (severity 4).
- `prompt-xgav.10.2` - implement blinded scoring pathway (severity 4).
- `prompt-xgav.10.3` - run cross-family reviewer on each hypothesis verdict (severity 4).
- `prompt-xgav.10.4` - objective test-exit-code oracle per hypothesis (severity 3).
- `prompt-xgav.10.5` - run each hypothesis k >= 3 and report variance (severity 4).
- `prompt-xgav.10.6` - sign scorecard JSON per run using the trusted-signers path (severity 4).
- `prompt-xgav.10.7` - attach run-manifest.json with model/aider/PL versions (severity 4).

Severity 3+ items become Phase-2 entry criteria; Phase 2 must not run until
they are in place.
