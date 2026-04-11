# Design: Codex External Child-Session Decision

## Status

Decision note for `prompt-language-72a5.5`.

Related beads:

- `prompt-language-72a5.6` for supported-host smoke and support-matrix evidence
- `prompt-language-72a5` for the broader Codex port epic

## Question

Now that prompt-language has a working headless Codex path for `spawn` / `await`, does the repo still need a second implementation slice for **true external child-session lifecycle via `codex exec`**, or is the existing headless path the sufficient Codex answer for the current product claim?

## Decision

**No additional `codex exec` child-session harness is currently needed for the repo's honest Codex support story.**

`prompt-language-72a5.5` is closure-ready as a decision item:

- the repo already has a working Codex-backed `spawn` / `await` path
- that path is the **accepted headless/supervised Codex story**
- the remaining open Codex gap is **supported-host smoke and support evidence**, not missing spawn semantics

If future work still wants true external child sessions, that should be opened as a **new, narrower bead** for host-lifecycle parity or operator hardening, not kept as the current "make spawn/await work under Codex" task.

## Current repo behavior

The current shipped Codex child-orchestration path is:

- `CodexPromptTurnRunner` runs turns through `codex exec`
- `runFlowHeadless()` owns the turn loop, completion timing, and max-turn budget
- `HeadlessProcessSpawner` runs spawned child flows **in-process** by calling `runFlowHeadless()` again with the same prompt-turn runner

That means the repo's current Codex answer is not "native Codex child sessions managed by the host." It is:

> prompt-language owns the child lifecycle itself and uses `codex exec` as the prompt-turn engine for both parent and child headless flows.

This matches the existing repo recommendation in [Report 08](../research/08-feature-completeness.md): treat the supervised/headless Codex runner as the initial honest Codex support story rather than pretending native host lifecycle parity already exists.

## What the current headless path already proves

## 1. Codex-backed `spawn` / `await` semantics exist in shipped code

The repo no longer has a design-only gap here.

Implementation evidence:

- `src/infrastructure/adapters/codex-prompt-turn-runner.ts`
- `src/application/run-flow-headless.ts`
- `src/infrastructure/adapters/headless-process-spawner.ts`

That code already proves:

- spawned child flows can be launched under the Codex runner path
- parent variables are injected into child flow text
- child completion is polled through the existing `ProcessSpawner` contract
- child variables are imported back into the parent after `await`

## 2. Repo-local test evidence is green

Fresh local validation in this workspace:

- `npm test -- headless-process-spawner codex-prompt-turn-runner run-flow-headless`
- result: `35` tests passed across the headless spawner, Codex prompt-turn runner, and headless flow loop

This is direct current evidence that the shipped path still works in the repo snapshot under test.

## 3. Quick-smoke evidence already covers the Codex spawn cases

The repo's checked-in evaluation docs already classify Codex `spawn` / `await` as covered:

- [Smoke Coverage Status](../evaluation/test-design-smoke-gaps.md) lists `spawn` / `await` as covered by `AM`, `AN`, headless spawner tests, and Codex quick smoke
- [Codex Parity Delta Analysis](../evaluation/codex-parity-delta-analysis.md) records the quick Codex subset as passing `27/27`
- `scripts/eval/results/history.jsonl` contains passing `AM` and `AN` quick-smoke entries on `2026-04-10`

This is enough to support a closure-quality decision about the bead's original purpose.

## 4. The repo already treats headless Codex as the honest baseline

[Report 08](../research/08-feature-completeness.md) and [Codex Parity Delta Analysis](../evaluation/codex-parity-delta-analysis.md) both point the same direction:

- native Codex hooks are still narrower than Claude's lifecycle
- the supervised/headless runner is the least misleading Codex support story
- remaining parity work is about supported-host validation, not hidden missing headless semantics

That matters because `72a5.5` was originally framed as "make `spawn` / `await` work under Codex." The repo already has that.

## What true external child sessions would add

An external child-session implementation would still add some things that the current headless spawner does not provide.

## 1. Real independent child CLI sessions

Today, headless children are in-process tasks inside the parent Node runtime. A true external-child path would create separately managed Codex CLI executions for child flows.

That would add:

- separate OS processes per child
- stronger crash isolation between parent and child execution
- a lifecycle model closer to the existing Claude external-child story

## 2. More faithful host-lifecycle evidence

A true external-child path would exercise:

- multi-session Codex CLI behavior directly
- child-session startup/exit behavior under real host conditions
- any host-specific auth, environment, and process-isolation quirks that the in-process spawner hides

That is useful for host-parity investigation, but it is **not required** to claim that prompt-language has working Codex headless spawn semantics.

## 3. Better operator-facing child lifecycle control

An external-child path could support future work around:

- stronger termination semantics
- richer per-child inspection and recovery
- child session ownership closer to the operator-shell lifecycle model

The current `HeadlessProcessSpawner` explicitly does not provide real external termination and returns `false` from `terminate()`.

That is a real limitation, but it is an **operator/lifecycle enhancement**, not a blocker on Codex `spawn` / `await` working at all.

## What true external child sessions do not currently add to the repo claim

They do **not** currently change the answer to these questions:

- Can prompt-language execute spawned child work under the Codex headless path? Yes.
- Can parent variables reach the child and return after `await`? Yes.
- Do repo-local tests cover that path? Yes.
- Does the checked-in quick-smoke evidence cover the Codex spawn cases? Yes.

So the external-child idea is no longer a missing prerequisite for the current Codex story. It is optional future hardening.

## Fresh blocker in this workspace

I attempted a fresh local live rerun of the Codex quick smoke target:

- `npm run eval:smoke:codex:quick`

Current result in this workspace:

- build succeeded
- live Codex quick smoke skipped because `codex` is not installed on this workstation (`[smoke-test] SKIP — Codex CLI not found.`)

This is a real local replication blocker, but it does **not** reopen `72a5.5`:

- the blocker is environment availability
- the repo already contains passing quick-smoke evidence for `AM` / `AN`
- the remaining bead for supported-host smoke is `prompt-language-72a5.6`

## Recommendation for bead status

`prompt-language-72a5.5` should be treated as **done in substance and closure-ready in wording**.

Suggested closure rationale:

> Codex-backed `spawn` / `await` now works through the shipped headless/supervised path (`CodexPromptTurnRunner` + `runFlowHeadless()` + `HeadlessProcessSpawner`). Repo-local tests pass and checked-in quick-smoke evidence already covers `AM` / `AN`. True external child-session lifecycle via separate `codex exec` children is no longer required for the current Codex support story; any future work there should be tracked separately as host-lifecycle or operator-hardening work.

## Backlog consequence

## Close or narrow `72a5.5`

The bead should not remain open as if Codex still lacks `spawn` / `await`.

Either:

- close it outright using the decision above

or, if the team wants a bookkeeping split:

- narrow it explicitly to "external child-session lifecycle parity / operator hardening"

The first option is cleaner because the original acceptance intent has already been met by a different but now-accepted implementation shape.

## Keep `72a5.6` open

The remaining honest Codex gap is still:

- supported-host smoke
- support-matrix evidence
- broader host validation beyond repo-local tests and checked-in quick-smoke history

That work is already tracked by `prompt-language-72a5.6`.

## Summary

The repo no longer needs `72a5.5` as a missing implementation task.

The current evidence says:

- **headless Codex spawn/await exists**
- **repo-local validation for that path is green**
- **checked-in quick-smoke evidence covers the spawn cases**
- **true external child sessions would be optional future hardening, not a current requirement**

That is enough evidence for a closure-quality decision note today.
