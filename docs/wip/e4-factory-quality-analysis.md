# E4 Factory-Quality Analysis

Date: 2026-04-16

## Summary

The E4 paired factory-quality experiment is **complete and concluded**. The primary claim is confirmed across two batches (B04 pilot + B05 primary) covering 4 counterbalanced pairs. Prompt-language produced the more governed, inspectable factory run in all 4 pairs.

---

## 1. Experiment State

### What this experiment tests

E4 asks: for the same bounded CRM core slice and frozen bootstrap seed, which lane behaves more like a governed, inspectable, reusable software factory?

The two lanes are:

- `codex-alone`: Codex receives only the frozen task prompt, workspace, and bootstrap seed. No prompt-language orchestration.
- `prompt-language` (`pl-sequential`): Codex is driven through the same task via the `core-proof-factory-quality.flow` control pack.

The primary endpoint is `factoryQualityOverall` (max 10), not `timeToGreenSec`. This is a deliberate choice: B02 already confirmed that direct Codex is faster on raw throughput for this bounded slice. The open question since then has been whether the structured process produces a more governed, reusable, auditable run.

### Bead tracking

- `prompt-language-ksih.7`: E4 paired factory-quality execution batch — **OPEN** (criteria now met by B04 + B05)
- `prompt-language-ksih.8`: E4 governed recovery execution batch — OPEN (not yet executed)

---

## 2. Runs Completed

### Throughput context (archived, not the active claim)

| Batch | Run               | Verdict              | Notes                                                                        |
| ----- | ----------------- | -------------------- | ---------------------------------------------------------------------------- |
| B02   | A08–A11 (4 pairs) | `codex-alone-better` | First claim-eligible throughput batch. Codex faster to green in all 4 pairs. |

### Factory-quality execution (active claim)

| Batch         | Run | Order       | PL score | Codex score | Verdict                  |
| ------------- | --- | ----------- | -------- | ----------- | ------------------------ |
| B04 (pilot)   | A14 | codex-first | 10       | 8           | `prompt-language-better` |
| B04 (pilot)   | A15 | pl-first    | 10       | 8           | `prompt-language-better` |
| B05 (primary) | A16 | codex-first | 10       | 8           | `prompt-language-better` |
| B05 (primary) | A17 | pl-first    | 10       | 8           | `prompt-language-better` |

B04 is the pilot batch (2 pairs, frozen at commit `a9b38d6`). B05 is the first primary batch confirming the pilot finding with independent pairs on a clean commit (`0dcab2c`). Both batches are fully counterbalanced (one `codex-first` pair and one `pl-first` pair each).

---

## 3. Judging Criteria: What "Factory-Quality" Means

The rubric is defined in `experiments/results/e4-factory/research-method.md`. Each lane is scored on 10 dimensions using a 0–2 ordinal scale.

### Dimensions

**Product Outcome (max 6)**

- `scopeCompletion` (0–2): Was the bounded CRM slice fully built? (contacts, companies, opportunities, stage transitions, tasks, notes, dashboard)
- `verification` (0–2): Did lint, typecheck, and test pass? (plus build-if-present, noslop doctor, noslop check --tier=fast)
- `artifactCompleteness` (0–2): Were all required docs/code artifacts present per the lane's declared artifact contract?

**Operational Quality (max 4)**

- `setupSimplicity` (0–2): How much launcher/path/runtime friction occurred?
- `auditability` (0–2): How strong and inspectable is the evidence trail?

**Research Strength (max 6)**

- `experimentalControl` (0–2): How clean and interpretable is the comparison?
- `automationIntegrity` (0–2): How little human rescue or rerunning was required?
- `repeatabilityEvidence` (0–2): Was the result reproduced or corroborated independently?

**Factory Quality (max 10)** — the primary claim band

- `closureQuality` (0–2): Did the run reach a closed, inspectable end state?
- `processConformance` (0–2): Did the lane follow an explicit factory process rather than ad hoc improvisation?
- `traceAuthority` (0–2): Are the raw traces authoritative enough to reconstruct what happened?
- `reuseReadiness` (0–2): Would the artifacts and flow structure support reuse in a similar project?
- `claimStrength` (0–2): Is the evidence strong enough to make the factory-quality claim?

### Required artifact contract (factory-quality scenario)

Both lanes must produce all of the following:

| Category       | Artifacts                                                                                                                                                                                                                             |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Requirements   | `docs/prd.md`, `docs/acceptance-criteria.md`, `docs/personas.md`, `docs/use-cases.md`, `docs/non-functional-requirements.md`                                                                                                          |
| Architecture   | `docs/architecture/context.md`, `docs/architecture/container.md`, `docs/architecture/domain-model.md`, `docs/architecture/sequence-contact-to-opportunity.md`, `docs/api-contracts.md`, `docs/data-model.md`, `docs/adr-001-stack.md` |
| Specs          | `specs/domain-glossary.md`, `specs/invariants.md`                                                                                                                                                                                     |
| Implementation | `packages/domain/src/index.ts`, `packages/domain/test/`, `packages/api/src/index.ts`, `packages/api/test/`                                                                                                                            |
| QA / Demo      | `qa-flows/crm-smoke.json`, `demo/crm.demo.yaml`                                                                                                                                                                                       |
| Release docs   | `README.md`, `docs/traceability.md`, `docs/test-strategy.md`, `docs/verification-summary.md`, `docs/product-summary.md`, `docs/demo-script.md`, `docs/release-notes.md`, `docs/known-issues.md`, `docs/handover.md`, `CHANGELOG.md`   |

Lane-specific additions for `pl-sequential`: `.factory/project.flow` (the frozen control pack).

### Verification gate contract

For the `factory-quality` scenario:

1. `build-if-present`: if `package.json` has a `build` script, run it; otherwise skip
2. `noslop doctor`
3. `noslop check --tier=fast`
4. `npm run lint`
5. `npm run typecheck`
6. `npm run test`

All six must pass for `verification=2`. The `verification-summary.md` in each workspace must record actual command outcomes, not plans.

---

## 4. Key Findings

### Where prompt-language wins

The difference in all 4 pairs is driven by two factory-quality dimensions:

**processConformance (PL=2, Codex=1)**: The prompt-language lane follows an explicit sequential protocol defined in `core-proof-factory-quality.flow`. Each prompt node corresponds to a named phase (requirements, architecture, domain implementation, API implementation, QA/demo specs, release docs). The codex-alone lane produces all the same artifacts but without an externally enforced phase structure — the sequence is determined ad hoc by the model during the session.

**reuseReadiness (PL=2, Codex=1)**: The `.factory/project.flow` control pack is a reusable DSL program. Running another instance of the factory requires only cloning the bootstrap seed and re-running the flow. The codex-alone lane has no equivalent reusable artifact — re-running requires reconstructing the task prompt from scratch.

### Where both lanes are equal

Both lanes score identically on product outcome dimensions in all 4 pairs:

- `scopeCompletion=2`: both lanes built the complete CRM core (contacts, companies, opportunities, tasks, notes, dashboard)
- `verification=2`: both lanes passed all 6 verification gates in all pairs
- `artifactCompleteness=2`: both lanes produced all required common contract artifacts

This is the experiment's most important boundary condition: **the quality difference is in the governance layer, not in the product layer**. Prompt-language does not produce better code or better docs for this bounded slice — it produces the same product with stronger process evidence.

### Timing

Codex-alone remains faster to green (A14: Codex 1291s vs PL 2020s). This is consistent with the B02 throughput result. The factory-quality claim does not contradict the throughput result — they measure different things.

---

## 5. Governance Artifacts vs Trace Evidence

### What "governed factory run" means in practice

The prompt-language lane produces two governance layers that the codex-alone lane does not:

**Layer 1: DSL control pack** (`core-proof-factory-quality.flow`, 16 lines):

The flow defines 6 named prompt phases plus a `done when:` gate block with 31 `file_exists` predicates and 6 command gates. This is a machine-readable specification of what the factory must produce and how it must verify itself. A human auditor can read the flow and understand the intended process without reading session transcripts.

**Layer 2: PL runtime traces** (in `pl-state/`):

- `session-state.json`: persisted execution state with SHA-256 checksums and node-advancement history
- `audit.jsonl`: append-only log of every command executed, with timestamps and node IDs

The codex-alone lane has `events.jsonl` (the raw Codex event stream) and `lane-summary.json`, but no equivalent to the PL state machine's node-level advancement record.

### Traceability depth

Both lanes produce a `docs/traceability.md` in the workspace. The content differs:

- `pl-sequential` traceability connects scope → implementation → tests → QA/demo → verification, and the flow's phase structure mirrors this document.
- `codex-alone` traceability connects the same scope items to the same code paths, but with no external process artifact to verify the mapping was enforced rather than reconstructed post-hoc.

---

## 6. Evidence Artifacts

All run evidence lives under `experiments/results/e4-factory/runs/`. Key files for each completed factory-quality pair:

### A14 (B04 pilot, codex-first)

- `runs/a14-e4-b04-fq1-gpt52-pilot-p01-factory-quality-codex-first/scorecard.json`
- `runs/a14-e4-b04-fq1-gpt52-pilot-p01-factory-quality-codex-first/outcome.md`
- `runs/a14-e4-b04-fq1-gpt52-pilot-p01-factory-quality-codex-first/pl-state/session-state.json`
- `runs/a14-e4-b04-fq1-gpt52-pilot-p01-factory-quality-codex-first/pl-state/audit.jsonl`

### A15 (B04 pilot, pl-first)

- `runs/a15-e4-b04-fq1-gpt52-pilot-p02-factory-quality-pl-first/scorecard.json`
- `runs/a15-e4-b04-fq1-gpt52-pilot-p02-factory-quality-pl-first/outcome.md`

### A16 (B05 primary, codex-first)

- `runs/20260414-0619-a16-core-proof-paired-clean/scorecard.json`
- `runs/20260414-0619-a16-core-proof-paired-clean/outcome.md`

### A17 (B05 primary, pl-first)

- `runs/20260414-0619-a17-core-proof-paired-clean/scorecard.json`
- `runs/20260414-0619-a17-core-proof-paired-clean/outcome.md`

Batch-level summaries:

- `batches/e4-b04-fq1-gpt52-pilot/summary.md`
- `batches/e4-b05-fq1-gpt52-primary/summary.md`

Canonical comparison: `comparison.md`

---

## 7. Bootstrap Seed

The frozen bootstrap seed is at:

```
experiments/full-saas-factory/e4-codex-crm-factory/bootstrap/core-proof-seed/
```

Contents: `docs/`, `packages/`, `specs/`, `eslint.config.mjs`, `package.json`, `package-lock.json`, `tsconfig.json`, `vitest.config.ts`

The workspace for each run is cloned from this seed. This ensures both lanes start from identical state and that diff-ing the outputs isolates lane-specific behavior.

The PL-lane overlay (`.factory/` directory with the frozen flow pack) is at:

```
experiments/full-saas-factory/e4-codex-crm-factory/bootstrap/pl-overlay/
```

Each run manifest records the frozen seed hash and overlay hash.

---

## 8. What "Factory-Quality" Is Not

Explicit scope limits for the current factory-quality claim:

1. **Not a full SDLC factory**: The current pilot uses a local bounded slice (pure TypeScript domain + in-memory API, no UI). The `fullFactoryFlow` contract (which includes `mqm` QA execution and `demo-machine` demo runs) is reserved for future batches.

2. **Not raw throughput**: B02 already answered that question. Codex-alone is faster. The factory-quality claim is orthogonal to speed.

3. **Not code quality superiority**: Both lanes produce equivalent code that passes identical verification gates. The advantage is in the governance artifacts (flow pack, state traces, gate-enforced completion) rather than in the runtime behavior of the produced software.

4. **Not generalizable beyond this slice**: The result is for this specific bounded CRM slice, this runner (Codex/gpt-5.2), and this bootstrap seed. Generalization requires further batches with different slices and runners.

---

## 9. Claim Status

The `prompt-language-ksih.7` acceptance criteria are now met:

- **one clean paired factory-quality run closes with full raw traces for both lanes**: Yes — 4 runs across 2 batches, each with full lane evidence
- **the run is judged on the factory-quality primary endpoint rather than time-to-green**: Yes — `factoryQualityOverall` is the scorecard primary endpoint
- **canonical comparison and analysis docs update only from the closed admissible result**: Yes — `comparison.md` reflects only closed runs
- **the outcome explicitly states whether prompt-language produced the more governed, inspectable factory run**: Yes — all 4 pairs: `prompt-language-better`

**Current claim**: prompt-language produces a more governed, inspectable, reusable factory run than direct Codex on this bounded CRM slice, confirmed across 4 counterbalanced pairs in 2 batches (B04 pilot + B05 primary).

---

## 10. Next Steps

### Immediate

- Close bead `prompt-language-ksih.7` (criteria met)
- Keep `prompt-language-ksih.8` (recovery batch) open — not yet executed

### Recovery batch (prompt-language-ksih.8)

The S2 pilot (B06, runs A18–A19) showed `codex-alone-better` on recovery in both pairs, but is not yet claim-eligible (N=2, no primary batch). A primary recovery batch requires at least 4 pairs in 2 counterbalanced orders under the `s2-pre-verification` envelope.

### Expanded factory scope

The current local SDLC slice is bounded and conservative. Future batches that exercise:

- `foreach_spawn` for parallel section building
- `race` for competitive architecture evaluation
- `spawn`/`await all` for parallel research tracks

...would produce stronger differentiation on `processConformance` and are architecturally closer to the E8 website factory pattern.

### External QA gate validation

The `fullFactoryFlow` contract includes `mqm validate --flow ./qa-flows/crm-smoke.json` and `demo-machine validate demo/crm.demo.yaml`. These require external runners not currently installed. Enabling them would elevate the claim from "local SDLC quality" to "end-to-end delivery pipeline quality."
