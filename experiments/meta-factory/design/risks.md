# META-5: Risks, Bootstrap Envelope, Sign-offs

This document enumerates the 20 risks identified for the meta-factory
program, the 8-item bootstrap envelope that must be green before any
live meta-run, and the 3 operator sign-offs required for production use.

## Risk register (20)

Severity legend: C (critical), H (high), M (medium), L (low).

| #   | Sev | Risk                                                      | Primary mitigation                                              |
| --- | --- | --------------------------------------------------------- | --------------------------------------------------------------- |
| 1   | C   | Meta-run corrupts the runtime it uses                     | MD-1 frozen snapshot; `dist/` and `bin/` read-only              |
| 2   | C   | Meta-run overwrites unrelated files in working tree       | MD-2 per-run worktree; `run.sh` stash rollback                  |
| 3   | C   | False-positive acceptance via model self-report           | MD-3 external gate; model text is advisory                      |
| 4   | H   | Trace gaps prevent post-mortem                            | MD-4 trace-first + `verify-trace` as O4                         |
| 5   | H   | Multi-target run produces ambiguous acceptance            | MD-5 single target per run                                      |
| 6   | H   | Smoke test flake masks a real failure                     | Require two consecutive green runs during bootstrap             |
| 7   | H   | Parser warning is treated as success                      | O1 requires warning-free parse                                  |
| 8   | H   | Keyword collision bypasses novelty check                  | `synonyms.json` scopes grep; expand on discovery                |
| 9   | H   | Concurrent runs corrupt shared state                      | Per-run worktree + per-run state dir                            |
| 10  | M   | Meta-run authors a test that passes for wrong reason      | Review checkpoint before cherry-pick                            |
| 11  | M   | Meta-run weakens an existing oracle while "fixing" a test | `run.sh` diffs smoke-test.mjs; reject oracle-weakening diffs    |
| 12  | M   | Disk pressure from accumulated worktrees                  | Cleanup policy in phase-4-ship                                  |
| 13  | M   | Long-running flow exceeds agent context                   | Split into phases; use spawn/await for heavy subtasks           |
| 14  | M   | Trace schema drift breaks `verify-trace`                  | Pin trace schema with snapshot; version in manifest             |
| 15  | M   | Agent authentication failure aborts run mid-way           | Bootstrap envelope verifies auth; stash rollback                |
| 16  | M   | CLAUDE.md diverges from code                              | O5 catalog check + post-merge link check                        |
| 17  | L   | Cross-platform path bugs (Windows vs POSIX)               | `run.sh` uses forward slashes; CI covers both                   |
| 18  | L   | Agent edits the meta-flow itself mid-run                  | `m1.flow` is read-only for the run; flow is inlined by `run.sh` |
| 19  | L   | Snapshot drift between documented and actual behaviour    | Snapshot manifest includes git SHA                              |
| 20  | L   | Human reviewer rubber-stamps accepted runs                | Require cherry-pick diff review + explicit ACK                  |

## Bootstrap envelope (8 items)

No live meta-run may be executed until **all** 8 bootstrap items are
green. These are verified by `run.sh --dry-run` and logged in the
evidence bundle.

1. **Frozen snapshot present.** `experiments/meta-factory/snapshots/<run-id>/dist/` and `bin/cli.mjs` exist and hashes are recorded in `manifest.json`.
2. **Worktree clean.** `git worktree add` succeeds; target workspace directory is empty.
3. **Environment vars set.** `PL_TRACE=1`, `PL_TRACE_STRICT=1`, `PL_RUN_ID=<run-id>` exported.
4. **Smoke harness self-test.** `SMOKE_ONLY=A node scripts/eval/smoke-test.mjs` passes on the snapshot (proves the harness works before the meta-flow runs).
5. **Agent auth verified.** `claude -p "echo ready"` returns within 30s.
6. **Disk budget.** At least 2 GB free under `workspaces/`.
7. **Stash safety.** `git stash list` baseline captured so the post-run stash can be matched unambiguously.
8. **Verify-trace available.** `node scripts/trace/verify-trace.mjs --version` (or equivalent) returns 0.

## Operator sign-offs (3)

Before a meta-run is considered production-grade, three human sign-offs
are required and recorded in the evidence bundle:

1. **Design sign-off.** A maintainer has reviewed the corpus entry's
   target and confirmed it is non-trivial, useful, and within scope.
2. **Gate sign-off.** A maintainer has reviewed the oracle configuration
   (keyword, smoke id, catalog line) and confirmed the oracles will
   fail loudly on a regression.
3. **Merge sign-off.** After a green run, a maintainer has reviewed the
   cherry-pick diff and confirmed it is safe to land on the main branch.

## Residual risks accepted

The following risks are explicitly accepted as residual and tracked in
the risk register:

- **R6** (smoke flake) is mitigated, not eliminated. A flaky new test
  will require human diagnosis.
- **R10** (right-answer-wrong-reason) depends on human review; no oracle
  catches this.
- **R13** (context overflow) is possible on complex meta-flows; the
  recovery path is to split the flow across phases.

## Change-control

Any change to the five MD decisions, the corpus ordering, or the oracle
set requires a new ADR under `docs/adr/` and a bump to this document's
version marker.

Current version: `META-5.0.0` (scaffold commit).
