# Program Status

Living status doc for the prompt-language thesis. Single page an operator reads to know where the thesis stands and what is next. Facts only; anything not directly observable in the repo is flagged "not measured".

Last synced: 2026-04-14 against `main` @ `60c5c40`.

## 1. Thesis status

Thesis (short form): prompt-language becomes the higher-order engineering medium engineers edit first, with code as a downstream artifact the agents produce and maintain. Full statement: [`docs/strategy/thesis.md`](thesis.md).

Current verdict: **inconclusive**. Design, scaffolding, and first end-to-end meta-factory invocation all exist. The only live meta-run produced no claim-eligible trace bundle (verify-trace did not run; trace dir was not produced by the child). The E5 maintenance-viability program is scaffolded and runnable in synthetic mode but has not yet produced a counter-balanced, blinded pair. The strongest shipped evidence today is the verifiable trace chain itself plus the pure-PL CRM factory (E6), not a thesis-supporting outcome.

## 2. Programs

| Program | Goal | Status | Evidence | Next actionable step |
| --- | --- | --- | --- | --- |
| E4 factory-quality | Does PL lane score higher on factory-quality rubric? | Closed. Verdict: PL 10 vs codex 8 on rubric, but E5 treats this as circular (rubric rewards PL's own structure). | `experiments/results/e4-*` batches B01–B06 (commits `9472404`, `0dcab2c`, `9300cc1`, `42c0f78`). | N/A — archived; findings feed E5 protocol. |
| E5 maintenance-viability | Does a second blind lane maintain PL output better than codex output? | Pilot scaffolded. Runner live, synthetic-mode only (no real pair run). | Program: `experiments/results/e5-maintenance/program.md`; scorecard template, 7 CRM journeys, 5 change requests, pair runner, blinding verifier under `scripts/experiments/e5/` (commit `4e61066`). | Run B01 pair P01 live once a supported-host Claude/codex auth is available; capture scorecard. |
| E6 pure-PL CRM factory | Prove a CRM factory can be driven entirely by `claude -p project.flow`. | Shipped; invokable. | `experiments/full-saas-factory/` + commit `02efd45`. No downstream maintenance metric has been taken. | Feed its output into E5 B01 as one of the factory-lane sources. |
| Meta-factory | Can PL develop PL? | M1 scaffolded + ran live once. Claude authored a smoke test; trace-gate failed because `PL_TRACE_DIR` was not populated (no `provenance.jsonl` emitted by the child). | `experiments/meta-factory/results/meta-1776129598770-407100/report.json` — `success: false, reason: verify-trace-failed, verify.reason: no-provenance`. Scaffold at commits `08c0c08`, `b567405`, `0cccfbd`. | Re-run MF-1 after propagating `PL_TRACE_DIR` / shim PATH into the child process; capture a claim-eligible bundle (O1–O5 in `experiments/meta-factory/design/verification.md`). |
| Trace verification + witness chain | Tamper-resistant trace for meta-runs. | Dual-recorder Merkle chain shipped; verifier runs; 6 Severity ≥ 3 attack paths documented; AP-6 patched. | `39a7c75` runtime chain, `80b9ae1` witness shim + verifier + Z-series + strict mode, `0271483` tamper-drill integration test, `60c5c40` canonical-JSON dedup (AP-6). Attack report: `docs/security/witness-chain-attacks.md`. | Close AP-5 (external nonce anchor) next — named the capstone in the attack report; AP-1/2/3/8 follow per the ranked-patch table. |

## 3. What has shipped (Q2 2026)

Every item below is a commit on `main`.

- Runtime trace chain — `TraceLogger` port, state-hash chain, `FileTraceLogger`, `TracedPromptTurnRunner` — commit `39a7c75`.
- Witness shim + trace verifier with strict mode, self-test, Z1–Z7 differential smoke tests (only-PL-runtime-passes oracle), and AR–AV coverage-gap cases — commit `80b9ae1`. Z-series and AR–AV are visible in `scripts/eval/smoke-test.mjs`.
- 10-case tamper-drill integration test for the verifier — commit `0271483`.
- AP-6 canonical-JSON duplication eliminated (verifier consumes compiled canonicalization) — commit `60c5c40`.
- Pure-PL CRM factory (E6) — commit `02efd45`.
- Meta-factory scaffold, M1 `PL-writes-smoke-test` flow, acceptance protocol, and synonyms — commit `08c0c08`. Design pack (`architecture.md`, `corpus.md`, `verification.md`, `risks.md`) landed in the same commit; DSL-primitives design handshake (snapshot/rollback/diff-review/self-trace-replay) followed in `0cccfbd`.
- Meta-experiment harness with git-stash pre-flight, manifest pre/post diffing, protected-config rule-weakening guard, wall-clock cap, and stash restoration — commit `b567405` (`scripts/experiments/meta/run-meta-experiment.mjs`).
- E5 maintenance-viability program scaffold — program doc, scorecard template, 7 journeys, 5 change requests, pair runner, journey suite, blinding verifier — commit `4e61066`.
- Aider harness adapter for local-model agentic coding — commits `91c64ae` (feat) and `bcb33d7` (`RunnerName` + `RUNNER_BINARIES` fix).
- Coverage lift: global statements coverage raised to 90% + CLI drift fix — commit `1a53d7b`.
- Tracing + thesis-verification operator docs — commit `5425ab5` (`docs/tracing-and-provenance.md`, `docs/thesis-verification.md`).
- Smoke catalog expansion — `scripts/eval/smoke-test.mjs` currently carries 48 distinct scenario IDs (A–Z, AA–AW, Z1–Z7; some IDs reused in the live-only sections). CLAUDE.md's public catalog lists 32 core + AA–AF, and Z1–Z7, AR–AV are present in the harness. Exact public list in `CLAUDE.md` has not been updated to reflect every new AR–AW/Z entry.

Not measured / not claimed: cost, latency, or pass-rate deltas for any thesis hypothesis (H1–H6). No E5 pair has produced a `maintenanceViabilityIndex` number.

## 3a. Claim-eligibility rule

A run is **claim-eligible** iff ALL of the following hold. Today **zero
runs satisfy all five**:

1. `PL_TRACE=1 PL_TRACE_STRICT=1` was set for the run (strict tracing)
2. Preflight envelope returned `overall: ready` (not `degraded`/`blocked`/`forced`)
3. `verify-trace` exited 0 with `--require-attestation --require-role operator`
4. Cross-family reviewer lane ran AND did not veto (factoryFamily ≠ reviewerFamily)
5. Bundle includes `attestation.json` signed by an operator key in `docs/security/trusted-signers.json`

Any other run is **recorded** (evidence archived, trace verified at whatever
level was possible) but **not counted toward thesis verdicts**.

| Item | Shipped? | Blocker |
| --- | --- | --- |
| Strict mode (1) | yes (commit ec086e8) | operator must set the env var |
| Preflight (2) | script shipped (I2); mandatory-gate K2b pending | K2b quota-blocked |
| Attestation flags (3) | designed (I3); not implemented | K1 quota-blocked |
| Cross-family reviewer (4) | design-only (I1); no enforcement | Implementation pending |
| Trusted-signers registry (5) | does not exist | K1 ships this |

## 3b. Verification state of closed beads

Beads are closed when a commit lands. That does not always mean the
outcome was verified by running the experiment. Honest audit:

| Bead | Closed on | Verification state |
| --- | --- | --- |
| prompt-lenh (coverage → 90) | `1a53d7b` | **Verified**: coverage test ran post-commit; 90.00% |
| prompt-y0hv (tamper-drill nightly) | `0271483` | **Committed but not run**: 10 unit cases pass locally; nightly job has never fired (workflow pending first schedule trigger) |
| prompt-lm0o.4 (MF-1 original live run) | `b567405` | **Run but not claim-eligible**: bundle's own `report.json` says `success: false, reason: verify-trace-failed`. Code Claude authored was reverted per harness rules. |
| prompt-lm0o.1 (meta-factory scaffold) | `08c0c08` | **Verified**: parse-tested, dry-run works, 0 warnings |
| prompt-lm0o.3 (DSL primitives PR1) | `c28d3c4` | **Verified**: 2745 unit tests pass including 23 new snapshot/rollback cases; no live smoke-tested |
| prompt-axt5.4 (shared blinding regex) | open | Not started |
| prompt-xgav.1 (F4 security review) | closed (doc-only) | **Verified**: doc shipped, no code change claimed |
| prompt-xgav.2 through .8 (G1/G2/G3 hardening) | closed | **Verified**: T1–T18 + fuzz + shim integration tests pass; no live-run pressure |

## 4. In flight (as of this doc)

"In flight" = an agent or workstream has open work, not that a human is literally watching a terminal. The specific workstream labels the operator referenced (F2, G1, G2, G3, H1, H3 and bead IDs `prompt-axt5`, `prompt-lm0o`) are not grep-findable in `.beads/issues.jsonl` in that form — the beads tracker uses `prompt-language-<slug>` IDs. The concrete in-flight items I can verify from the tracker and the ranked-patch table:

- Verifier hardening track: AP-5 external-nonce trust anchor (capstone), AP-1/2 mandatory `--state` default, AP-3 shim-binary allow-list, AP-8 `--expected-pair-count`. Ranked in `docs/security/witness-chain-attacks.md` §"Ranked patches". AP-6 already shipped in `60c5c40`.
- Related security beads open in `.beads/issues.jsonl`: `prompt-language-oei8` ("Capture nonce 32-bit insufficient for anti-spoofing"), `prompt-language-36ot` (Fagan inspection audit of 43f3227..70873bc).
- MF-1 re-run workstream: reproduce the live meta-run with `PL_TRACE_DIR` correctly propagated to the child `claude -p` process so `provenance.jsonl` is emitted and `verify-trace` can gate. Blocker is mechanical, not architectural.
- E5 B01 P01 live-pair execution: orchestrator is live (`scripts/experiments/e5/run-pair.mjs`); journey suite currently returns `pending-manual-review` for HTTP journeys until `app-boot` + `documented-endpoint-probe` are plugged in per that README's §"Known limitations (v1)".
- Generic runner abstraction: `prompt-language-9uqe.4` — in_progress. Headless prompt-turn seam is shipped (OpenCode, codex, aider); spawned-session runner abstraction remains.
- Codex parity matrix closure: `prompt-language-72a5.6` — open; blocked on supported-host smoke evidence.

## 5. Known unknowns / blockers (by urgency)

1. **Live-agent auth on a supported host.** The only blocker between the current scaffolds and a first claim-eligible E5 pair or MF-1 re-run. Native Windows `claude -p` currently exits with an org/access error for the smoke harness (bead `prompt-language-040u`).
2. **MF-1 trace-dir propagation.** Without it, every meta-run will hit the same `verify-trace no-provenance` exit path visible in `results/meta-1776129598770-407100/report.json`.
3. **Snapshot/rollback PR1.** The DSL-primitives handshake (`0cccfbd`) designed snapshot/rollback/diff-review/self-trace-replay but has not landed the runtime primitives. Without them, MF-N experiments cannot operate on frozen workspace snapshots.
4. **Verifier hardening AP-1/2/3/5/8.** Until AP-5 lands an external nonce anchor, `verify-trace OK` is achievable offline by an attacker with workspace write — the precise trust-zone the meta-flow occupies.
5. **Cross-family reviewer lane (META-5 operator sign-off #3).** The bootstrap envelope in `experiments/meta-factory/design/risks.md` requires this before live MF-2..MF-9 runs. Not started.

## 6. Operator checklist (next 5 concrete actions)

1. Re-run MF-1 live with the trace-dir fix.
   ```
   npm run experiment:meta:live -- experiments/meta-factory/m1-pl-writes-smoke-test/m1.flow
   ```
   Expect a populated `provenance.jsonl` and `verify.json` in the new bundle under `experiments/meta-factory/results/<run-id>/`.

2. Execute the E5 B01 P01 pair end-to-end (dry-run first).
   ```
   node scripts/experiments/e5/run-pair.mjs experiments/results/e5-maintenance/batches/e5-b01-mv-gpt52-pilot/pairs/p01-codex-first.json --dry-run
   node scripts/experiments/e5/run-pair.mjs experiments/results/e5-maintenance/batches/e5-b01-mv-gpt52-pilot/pairs/p01-codex-first.json --run-id e5-b01-p01-live
   ```

3. Land the AP-5 external-nonce anchor in `scripts/eval/verify-trace.mjs` per `docs/security/witness-chain-attacks.md` Rank 1.
   ```
   node scripts/eval/verify-trace.mjs --help   # confirm new --expected-run-id / --freshness-window-ms flags after the change
   npm run ci && npm run eval:smoke
   ```

4. Run the tamper-drill regression before/after the AP-5 change.
   ```
   node --test scripts/eval/verify-trace.tamper.test.mjs
   ```

5. Verify the runtime quality gate on a clean tree.
   ```
   npm run ci
   npm run eval:smoke
   ```

## 7. Failure modes to watch (from META-5 risk register)

- **MR-3 runtime regression.** Meta-runs and the rest of the test plane share the same `dist/`. A bad meta-change can silently regress smoke/CI. Defence: frozen `dist/` + worktree isolation (MD-1, MD-2). Still a risk whenever we modify CI-authoritative scripts during a meta-run.
- **MR-2 rule weakening.** A meta-run could edit CI thresholds, coverage floors, or verifier strictness to make its own output pass. Defence: `diff.protectedChanged` guard in `scripts/experiments/meta/run-meta-experiment.mjs`; `protectedChanged: []` must stay empty on every bundle.
- **MR-4 self-confirming bias.** PL grading PL, or the same judge model lane reviewing its own output, inflates thesis-supporting signal. E5 addresses this structurally (blinded second lane + change-request suite declared before factory runs); the risk returns the moment anyone short-circuits the blinding step.

---

Sources consulted when writing this doc: `git log --oneline -30`, `docs/strategy/thesis.md`, `experiments/results/e5-maintenance/program.md`, `experiments/meta-factory/README.md`, `experiments/meta-factory/design/*.md`, `experiments/meta-factory/results/meta-1776129598770-407100/report.json`, `docs/security/witness-chain-attacks.md`, `scripts/experiments/e5/README.md`, `scripts/experiments/meta/README.md`, `scripts/eval/smoke-test.mjs`, `.beads/issues.jsonl`.
