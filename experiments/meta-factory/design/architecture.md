# META-1: Meta-Factory Architecture Decisions

This document renders the five architectural decisions that frame the
self-hosting program. Each decision captures context, drivers, the chosen
path, and consequences.

## MD-1: Meta-flows run against a frozen runtime; edits land only in `src/`

**Context.** A meta-flow edits the same project whose DSL it uses to
orchestrate itself. Without isolation, a broken edit in `src/` would
immediately poison the very interpreter that executes the flow, producing
a cascade where diagnosis is impossible.

**Drivers.**
- Reproducibility: a run must be replayable from a fixed runtime image.
- Debuggability: a failing run must not implicate the runtime it used.
- Separation of subject and tool.

**Decision.** Every meta-run executes against a pinned snapshot of
`dist/` and a pinned `bin/cli.mjs`, copied into `experiments/meta-factory/snapshots/<run-id>/`.
The flow may only write to `src/`, `scripts/eval/smoke-test.mjs`,
`docs/`, and `CLAUDE.md`. `dist/`, `bin/`, `node_modules/`, `package.json`,
and `package-lock.json` are read-only for the duration of the run.

**Consequences.**
- A post-run `npm run build` refreshes `dist/` only after the run is
  accepted.
- Runtime bugs cannot be fixed mid-run; they require a separate
  snapshot-refresh task.
- The snapshot directory is gitignored but its manifest (hash + version)
  is captured in the evidence bundle.

## MD-2: Per-run git worktree under `experiments/meta-factory/workspaces/<run-id>/`

**Context.** Multiple meta-runs may execute concurrently or in rapid
succession. Running them directly against the main checkout risks
interleaved edits, accidental commits, and contamination of the host
working tree.

**Drivers.**
- Isolation between concurrent runs.
- Clean rollback on failure.
- Ability to diff a single run's output without noise from others.

**Decision.** Each run creates a git worktree at
`experiments/meta-factory/workspaces/<run-id>/` branched from the current
HEAD. All flow edits land inside that worktree. Successful runs produce
a patch that is reviewed and cherry-picked; failed runs are deleted whole.

**Consequences.**
- `workspaces/` is gitignored (except `.gitkeep`).
- `run.sh` is responsible for worktree lifecycle.
- Disk usage grows linearly with run count; a cleanup policy is needed.

## MD-3: Only `npm run ci` + `npm run eval:smoke` are authoritative gates

**Context.** The temptation to let the model self-assess ("I believe the
test is correct") is strong but produces silent false positives. Every
acceptance decision must be external to the agent.

**Drivers.**
- Ground truth must come from deterministic, reproducible tooling.
- Model self-assessment is an unreliable oracle for its own output.

**Decision.** A meta-run is accepted only if **both** `npm run ci` and
`npm run eval:smoke` (scoped to the new test id) pass on the worktree.
Any acceptance language from the model itself is advisory only; `run.sh`
ignores it.

**Consequences.**
- Meta-runs are slower (each full gate is ~10 minutes).
- The acceptance oracle is small, auditable, and shared with the manual
  development loop.
- Failures produce the same diagnostics a human developer would see.

## MD-4: Trace-first execution (`PL_TRACE=1 PL_TRACE_STRICT=1`)

**Context.** Meta-flows are long-lived, branchy, and frequently contain
loops and retries. Without a trace, post-mortem diagnosis is infeasible.

**Drivers.**
- Every meta-run must produce a machine-readable execution trace.
- Strict mode catches emission regressions early.
- Trace contract is already defined in `docs/tracing-and-provenance.md`.

**Decision.** `run.sh` sets `PL_TRACE=1` and `PL_TRACE_STRICT=1` before
invoking `claude -p`. Post-run, it invokes `verify-trace` against the
emitted trace. A run cannot be accepted unless `verify-trace` exits 0.

**Consequences.**
- Every run produces a trace archived in the evidence bundle.
- Trace schema drift breaks meta-runs loudly; this is desirable.
- Overhead of tracing is acceptable given run cadence.

## MD-5: One concrete target per run

**Context.** A meta-flow that tries to add a test, document it, and
refactor a helper in a single run has three failure modes, three
rollback surfaces, and zero clean acceptance criteria.

**Drivers.**
- Single acceptance criterion per run is simpler to verify.
- Failures are easier to localise.
- Parallel runs can cover different targets without conflict.

**Decision.** Every meta-flow targets exactly one concrete addition.
M1 adds one smoke test. MF-2 adds one docstring block. MF-3 adds one
parser rule. No combined targets.

**Consequences.**
- More runs are needed to cover the corpus.
- Each run's acceptance oracle is small and unambiguous.
- Cross-target coordination is a human responsibility, not a flow's.

## Rationale summary

The five decisions together enforce a single invariant: **a meta-run is
a well-isolated, externally-verified, single-purpose edit whose failure
cannot damage the runtime that ran it**. Every other design choice in
this program follows from that invariant.
