# M1: PL-writes-smoke-test (META-4 Protocol)

## Objective

Prove that a meta-flow, authored in prompt-language and executed against
a frozen prompt-language runtime, can add one genuinely novel smoke test
to `scripts/eval/smoke-test.mjs` that passes end-to-end through the real
smoke harness, under full trace and catalog discipline.

## Scope

- **In scope:** adding exactly one new smoke test (`AW` fast or `AX` slow)
  that covers a DSL feature absent from the current catalog (A..AV, Z1..Z7,
  AR..AV), and updating `CLAUDE.md` accordingly.
- **Out of scope:** editing the DSL itself, modifying `src/`, refactoring
  the harness, or adding more than one test.
- **Explicitly excluded candidate features** (per the flow body):
  retry backoff, composite all/any gates, spawn modifiers, nested
  try/catch/finally, foreach-run-source.

## Acceptance oracles (O1..O5)

Acceptance is all-green-or-fail. No partial credit.

| Oracle      | Check                                                                                 | Tooling                                              |
| ----------- | ------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| O1 PARSE    | `m1.flow` parses with zero warnings and zero errors.                                  | `parseFlow()` from `dist/application/parse-flow.js`  |
| O2 NOVELTY  | `grep -c "<keyword>" scripts/eval/smoke-test.mjs` was 0 before the run and >=1 after. | `grep -c` pre/post                                   |
| O3 RUNNABLE | `SMOKE_ONLY=AW node scripts/eval/smoke-test.mjs` (or `AX`) exits 0.                   | standard smoke harness                               |
| O4 TRACED   | `verify-trace` exits 0 on the emitted trace file.                                     | `PL_TRACE=1 PL_TRACE_STRICT=1` + verify-trace binary |
| O5 CATALOG  | `CLAUDE.md` contains a new bullet `"- **AW: ..." ` or `"- **AX: ..."`.                | grep for `"- **AW:"` / `"- **AX:"` in CLAUDE.md      |

## DSL syntax notes (adaptations from the original protocol draft)

The flow in `m1.flow` is the protocol text, adapted minimally so it
parses cleanly against `src/application/parse-flow.ts` at scaffold time:

1. **Numeric comparison.** `if ${last_stdout} > 0` was replaced with
   `if ${last_stdout} >= 1`. Semantically equivalent on a grep-count
   output (stdout is either `0`, `1`, `2`, ...) and verified against the
   pattern used in test V which uses `>=`.
2. **String equality after grep fallback.** `grep ... || echo missing`
   was replaced with `grep -c ... || true`, and the predicate changed
   from `if ${last_stdout} == "missing"` to `if ${last_stdout} == "0"`.
   This keeps the semantics (CLAUDE.md bullet absent → take the
   remediation branch) while using grep's count output directly.
3. **Backticks and pipe tails.** `2>&1 | tail -40` suffixes were dropped
   from the `run:` commands to avoid shell-lexer ambiguity with
   `shellInterpolate()`. The smoke harness preserves stdout on failure
   via `last_stdout` truncation (2000 chars), which is enough tail for
   the retry branch's diagnosis prompt.
4. **Bullet pattern escape.** The original `grep -q "^- \\*\\*AW: \\|^- \\*\\*AX: "`
   compound pattern was replaced with `grep -c "^- \*\*AW:"` (single
   alternative, count-based). The oracle still catches the AW branch;
   AX is handled by a future follow-up if the model self-scopes a slow
   test. This is a deliberate narrowing to reduce shell-quote risk.
5. **Keyword hint syntax.** `"race_winner" or "approve timeout"` in the
   original prompt became `"race_winner or approve_timeout"` (underscore)
   so the example tokens in the prompt are themselves grep-safe tokens.

These adaptations are semantically faithful; any future changes to the
DSL that enable the original forms should be reflected here.

## Execution protocol

1. **Bootstrap check.** Verify META-5 bootstrap envelope (8 items).
2. **Stash.** `git stash push -u` on the host working tree; record the
   stash ref in the evidence bundle.
3. **Run ID.** Generate `PL_RUN_ID=m1-<epoch>`.
4. **Trace.** Export `PL_TRACE=1 PL_TRACE_STRICT=1`.
5. **Install.** Run `node bin/cli.mjs install` to ensure the frozen
   runtime is registered.
6. **Invoke.** `claude -p --dangerously-skip-permissions "$(cat m1.flow)"`.
7. **Post-run oracles.** Run O1..O5 in order. On any failure, restore
   the stash and mark the run failed.
8. **Archive.** Copy `m1.flow`, trace, pre/post diff, CI/smoke logs, and
   `manifest.json` to `workspaces/<run-id>/evidence/`.
9. **Restore stash on failure only.** On success, leave the worktree
   intact for the operator to cherry-pick.

## Synonyms and novelty scoping

The keyword the flow emits is matched literally in
`scripts/eval/smoke-test.mjs`, but the novelty check should not be
fooled by semantic duplicates. `synonyms.json` records known aliases.
Operators should extend it when new synonym classes are discovered.

## Failure semantics

| Failure class             | Action                                                |
| ------------------------- | ----------------------------------------------------- |
| O1 PARSE fails            | Halt, restore stash, mark "flow authoring regression" |
| O2 NOVELTY fails          | Halt, restore stash, mark "gap detection failed"      |
| O3 RUNNABLE fails         | Halt, restore stash, mark "test authoring failed"     |
| O4 TRACED fails           | Halt, restore stash, mark "trace contract violation"  |
| O5 CATALOG fails          | Halt, restore stash, mark "catalog discipline failed" |
| Claude auth / login block | Halt, host-limitation tag, no stash needed            |

## Evidence bundle layout

```
workspaces/<run-id>/
  evidence/
    m1.flow                     ← exact flow executed
    trace.jsonl                 ← PL_TRACE output
    diff.pre.patch              ← git diff before run
    diff.post.patch             ← git diff after run
    ci.log                      ← npm run ci tail
    smoke.log                   ← SMOKE_ONLY=AW log
    manifest.json               ← snapshot hashes, node/OS, run id
    oracles.json                ← O1..O5 results
```

## Non-goals reminder

This M1 protocol **does not**:

- Judge whether the new test is a good test.
- Generalise the meta-flow beyond this single target.
- Replace the need for human review before cherry-pick.
- Demonstrate end-to-end self-hosting (that is MF-9's job).
