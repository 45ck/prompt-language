# META-3: Verification Rule

## Summary rule

> A meta-run is **accepted** if and only if, on the isolated worktree,
> all five acceptance oracles (O1 PARSE, O2 NOVELTY, O3 RUNNABLE,
> O4 TRACED, O5 CATALOG) evaluate to green, and the overall evidence
> bundle is archived. No single oracle is sufficient; no alternate
> path exists; model self-assessment is advisory only.

## Oracle definitions

| Oracle      | Check                                                              | Tooling                                             |
| ----------- | ------------------------------------------------------------------ | --------------------------------------------------- |
| O1 PARSE    | The generated `.flow` parses without errors.                       | `parseFlow()` from `dist/application/parse-flow.js` |
| O2 NOVELTY  | The keyword was absent before the run, present after.              | `grep -c` on the pre- and post-run tree             |
| O3 RUNNABLE | `SMOKE_ONLY=<id> node scripts/eval/smoke-test.mjs` exits 0.        | standard smoke harness                              |
| O4 TRACED   | `verify-trace` exits 0 on the run's trace file.                    | `scripts/trace/verify-trace.*` (existing)           |
| O5 CATALOG  | The CLAUDE.md smoke catalog contains a bullet for the new test id. | `grep` for `"- **AW:"` or `"- **AX:"` in CLAUDE.md  |

## Threats to validity

These are failure modes that each oracle was designed to catch, plus
known-but-accepted residual risks.

1. **Parser tolerance.** The soft parser emits warnings instead of
   errors for recoverable issues. O1 treats a warning-free parse as
   green, but does not catch semantically-meaningless-but-syntactically-legal
   flows. Mitigated by O3 (runtime execution).
2. **Keyword homonyms.** A keyword like `race` may appear in comments
   or unrelated tests. Mitigated by `synonyms.json` (see
   `m1-pl-writes-smoke-test/synonyms.json`) which scopes the grep.
3. **Smoke flake.** A test may pass spuriously on first run and fail
   on replay. Mitigated by requiring clean passes on two consecutive
   runs during the bootstrap phase (META-5 residual risk).
4. **Trace drift.** Strict trace mode catches missing emissions but
   not incorrect-but-well-formed ones. Mitigated by spot checks during
   the bootstrap phase.
5. **Catalog bullet accuracy.** O5 only checks presence, not accuracy
   of description. Mitigated by a human review checkpoint before merge.

## Bounded-success criteria

A meta-run producing green oracles is **bounded-successful**, meaning:

- The specific target was added and verified.
- The run's trace is reproducible.
- The evidence bundle archives the full provenance.

Bounded success is **not** a claim that:

- The added artifact is a good addition (human taste still required).
- The meta-flow generalises (corpus-wide evidence required).
- The DSL is self-hosting in a complete sense (only MF-9 would demonstrate this).

## Reproducibility requirement

A meta-run's evidence bundle must be sufficient, together with the
frozen snapshot, to reproduce the run. The bundle contains:

- The `.flow` file executed.
- The trace (JSONL) from the run.
- Pre- and post-run `git diff` on the worktree.
- Exit codes and tail output from CI and smoke.
- A `manifest.json` pinning dist hash, bin hash, node version, OS,
  and run id.

## Explicit non-criteria

The following are **not** oracles and must not be treated as such:

- Agent self-report ("I verified the test works").
- Step count or token count of the run.
- Absence of retries during the run.
- Aesthetic judgments about the generated code.
