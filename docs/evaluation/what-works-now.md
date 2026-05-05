# What Works Now

This page is the short, honest answer to "what is prompt-language actually good at today?"

## Strongest proven mechanism

The strongest proven mechanism is still **deterministic completion gates around an agent loop**.

That is the clearest place where prompt-language adds value over plain prompting:

- it keeps the task alive until explicit checks pass or a bounded failure state is reached
- it turns recurring checks into reusable flow structure instead of prompt prose
- it makes pass/fail evidence inspectable through flows, reports, and saved artifacts

After the FSCRUD R30-R45 local-model sequence, the strongest local-model pattern is
also clearer: local models are useful as bounded semantic selectors/rankers inside a
deterministic PL envelope. The evidence does not yet support autonomous local
full-stack implementation. See
[Evidence Snapshot: 2026-05-06](2026-05-06-evidence-snapshot.md).

## Proven in this repo

- Last recorded verification on 2026-05-06: `npm run test` and `npm run ci`
  passed before commit `f4717fa`. Rerun those gates after new local edits before
  treating the worktree as green.
- checked-in evaluation evidence includes a `27/27` `npm run eval:smoke:codex:quick` pass through the Codex headless path
- the v1 eval runner is real: checked-in JSONL datasets, repeat counts, machine-readable reports, and baseline comparison all ship through `prompt-language eval`
- review and judge plumbing is now part of the runtime surface rather than dead design text: named judges, typed review verdict capture, and strict fail-closed review behavior are implemented and tested

## What is useful right now

- supervising bounded coding tasks with explicit gates
- encoding repeatable recovery and review structure
- running seed eval suites against checked-in datasets
- using headless Codex or OpenCode runner paths for cheaper repo-local experimentation
- using local Ollama models for bounded option selection, ranking, short rationale,
  and risk-response choice when deterministic validation owns shape and rendering

The current repo also has bounded **runtime-backed factory evidence** for both
Codex and Claude on the same discovery-only CRM slice. The latest checked-in
series under [`experiments/results/factory-runtime-proof/`](../../experiments/results/factory-runtime-proof/)
shows real PL runtime execution on both hosts, with asymmetric committed
results: `20260418-083500/codex-medium` is the clean bounded proof, with parent
completion, both spawned discovery children completed, and review passed. The
latest committed Claude terminal bundle is `20260418-074500/claude-medium`, but
that run completes with both spawned children marked failed; it proves the PL
runner path is real on Claude and also documents the old await-integrity gap
that has now been fixed in the current tree. That is useful bounded proof, but
it is still not verifier-closed or attested. See
[2026-04-18 Runtime Factory Proof: Codex + Claude, Medium Effort](2026-04-18-runtime-factory-proof-codex-claude-medium-evidence.md).

## What is not fully proven yet

- supported-host live smoke with Claude access in a supported host environment: `npm run eval:smoke` is still not closed out by native-Windows evidence alone
- full Codex parity on a supported Linux/macOS/WSL host with live smoke plus compare and verify reruns
- broad thesis claims beyond the seeded E1 dataset bank and the historical comparative eval set
- larger orchestration-shell positioning beyond the current supervision-runtime boundary
- clean end-to-end factory completion claims for the bounded Codex/Claude discovery probe on both hosts: Codex has one clean committed bounded proof, while the latest committed Claude terminal bundle still closes over failed children
- local-only full-stack product implementation: FSCRUD diagnostics show useful
  selector/ranker behavior, but product behavior was supplied deterministically in
  the passing R40-R45 treatment arms

That means the full-run parity bead is still open on evidence capture, not on a
known Codex-specific runtime break.

## Caveats

- prompt-language adds overhead; the gate and review structure only pays off when the task is failure-prone enough to justify supervision
- quick smoke is a strong regression signal, but it does not replace supported-host live smoke
- the current product direction is still "verification-first supervision runtime", not "general orchestration shell"

## Where to go next

- [Eval Analysis](eval-analysis.md) for the longer comparative history
- [Evidence Snapshot: 2026-05-06](2026-05-06-evidence-snapshot.md) for the current
  post-FSCRUD claim boundary
- [Dataset Bank](dataset-bank.md) for the seeded runner surface
- [Codex Parity Matrix](eval-parity-matrix.md) for the current validation bar
- [Thesis Research Roadmap](../strategy/thesis-roadmap.md) for the next experiment layers
