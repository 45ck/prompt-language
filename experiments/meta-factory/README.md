# Meta-Factory: Self-Hosting Program

## Thesis

Can prompt-language develop prompt-language? This program tests whether a
meta-flow, running on a frozen snapshot of the DSL, can author genuine,
novel, runnable improvements to the DSL's own test corpus and source tree.

See [../../docs/strategy/thesis.md](../../docs/strategy/thesis.md) for the
top-level thesis and [../full-saas-factory/e4-codex-crm-factory/](../full-saas-factory/e4-codex-crm-factory/)
for the layout this experiment mirrors.

## Structure

```
experiments/meta-factory/
  README.md                          ← this file
  design/
    architecture.md                  ← META-1: MD-1..MD-5 decisions
    corpus.md                        ← META-2: MF-1..MF-9 meta-flow corpus
    verification.md                  ← META-3: summary verification rule
    risks.md                         ← META-5: risks + bootstrap envelope
  project.flow                       ← top-level orchestration (mirrors E4)
  phases/
    phase-1-scope.flow               ← scoping (stub)
    phase-2-author.flow              ← authoring (stub)
    phase-3-verify.flow              ← verification (stub)
    phase-4-ship.flow                ← shipping (stub)
  m1-pl-writes-smoke-test/
    protocol.md                      ← META-4: M1 acceptance protocol
    m1.flow                          ← the runnable meta-flow
    run.sh                           ← orchestrator with stash rollback
    synonyms.json                    ← initial novelty-grep aliases
  workspaces/                        ← per-run git worktrees (gitignored)
  snapshots/                         ← frozen dist/ snapshots (gitignored)
```

## Design pillars (META-1)

1. **MD-1 frozen runtime**: meta-flows execute against a frozen `dist/` +
   pinned `bin/cli.mjs`; edits land only in `src/`.
2. **MD-2 isolated worktree**: every run gets its own git worktree under
   `workspaces/<run-id>/` so edits cannot corrupt the host checkout.
3. **MD-3 authoritative gate**: only `npm run ci` and `npm run eval:smoke`
   decide success; model self-assessment never ratifies acceptance.
4. **MD-4 trace-first**: every meta-run is executed under `PL_TRACE=1
PL_TRACE_STRICT=1` and validated with `verify-trace`.
5. **MD-5 one-target-per-run**: each meta-flow targets exactly one
   concrete addition (e.g. one smoke test, one docstring block, one
   parser rule); no multi-goal runs.

See [design/architecture.md](design/architecture.md) for detailed rationale.

## Acceptance (META-3)

A meta-run is accepted only when **all** of the following hold:

- O1 PARSE: the generated `.flow` parses cleanly via `parseFlow`.
- O2 NOVELTY: a grep-safe keyword is absent before the run and present after.
- O3 RUNNABLE: targeted `SMOKE_ONLY=<id>` run passes.
- O4 TRACED: `verify-trace` exits 0 under `PL_TRACE_STRICT=1`.
- O5 CATALOG: `CLAUDE.md` smoke catalog is updated with the new entry.

## Bootstrap envelope (META-5)

Live meta-runs require the 8-item bootstrap envelope and 3 operator
sign-offs listed in [design/risks.md](design/risks.md). Do not invoke
`run.sh` without `--dry-run` until that checklist is green.

### Bootstrap envelope preflight

Before any live meta-run, run:

```sh
npm run meta:preflight
```

Interpret the result as follows:

- `blocked`: do not launch the live run. The harness must refuse execution until
  the blocked items are fixed.
- `degraded`: the run may proceed, but it is recorded evidence only and is not
  claim-eligible.
- `ready`: the bootstrap envelope is satisfied. The run can still fail later,
  but preflight no longer disqualifies it.

## Status

- [x] Program scaffolded
- [x] M1 (PL-writes-smoke-test) authored as runnable DSL
- [ ] M1 executed live and accepted
- [ ] MF-2..MF-9 authored
- [ ] Phases 1–4 fleshed out
