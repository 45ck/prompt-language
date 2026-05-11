---
title: Concord/VHO pilot — TODO CLI build via hybrid local/frontier routing
status: ad-hoc evidence — non-claim-eligible per program-status §3a
operator: 45ck (frontier role: Claude Opus 4.7, this Claude Code session)
host: i7-14700K / RX 7600 XT 16GB / 64GB RAM
date: 2026-05-11
---

# Pilot: TODO CLI build via hybrid local/frontier routing

## Hypothesis under test

A bounded software task can be built by routing well-scoped subtasks
to a local model under PL-style supervision, escalating to frontier
**only** when the local attempt fails a deterministic oracle. The
program is useful if local successfully owns a meaningful share of
implementation work and the frontier escalations are concentrated on
the genuinely-hard subtasks.

This is the smallest credible test of the §2a hybrid-efficiency
tracker idea on real-but-bounded software, on this rig.

## App

A single-file Node TODO CLI (`todo.mjs`) with persistent JSON storage
and a small test suite (`todo.test.mjs`). Real enough to require
correctness on edge cases; small enough to finish in one session.

### Functional surface

```
node todo.mjs add "buy milk"
node todo.mjs list
node todo.mjs complete <id>
node todo.mjs remove <id>
node todo.mjs --json     # JSON output instead of human format
```

State persists to `./.todo.json` (overridable via `TODO_FILE` env).

## Routing roles

| Role                | Who                         | When invoked                                   |
| ------------------- | --------------------------- | ---------------------------------------------- |
| Architect / planner | Frontier (Claude, this session) | Once: writes spec, decomposes into bounded tasks, writes tests |
| Local-fast worker   | `qwen3-coder:30b` via Ollama | Per task: implements the stubbed function     |
| Local-second-opinion| `devstral-small-2:24b` via Ollama | Per task: invoked only if qwen3-coder's first attempt fails oracle |
| Frontier repair     | Claude (this session)       | Per task: invoked only if both locals fail oracle after one retry each |
| Reviewer            | Frontier (Claude)           | Once at end: smoke-runs the assembled CLI      |

## Tasks (decomposition)

Each task = implement one function in `todo.mjs` to pass a specific
slice of `todo.test.mjs`. Stubs and test framework exist before any
local call; local model only fills in the function body.

| ID | Function          | Description                                                       | Test slice         |
| -- | ----------------- | ----------------------------------------------------------------- | ------------------ |
| T1 | `add`             | `add(state, text) -> newState` — append item with auto-incrementing id | `T1_*` tests       |
| T2 | `list`            | `list(state) -> string` — human-readable lines                    | `T2_*` tests       |
| T3 | `complete`        | `complete(state, id) -> newState` — set done=true; throw on missing id | `T3_*` tests       |
| T4 | `remove`          | `remove(state, id) -> newState` — drop item; throw on missing id  | `T4_*` tests       |
| T5 | `save` / `load`   | `save(state, path)` writes JSON; `load(path) -> state` reads or returns empty | `T5_*` tests       |
| T6 | `formatJson`      | `formatJson(state) -> string` — JSON output mode                  | `T6_*` tests       |
| T7 | CLI dispatcher    | `runCli(argv) -> {exitCode, stdout, stderr}` — wire commands      | `T7_*` tests       |

7 bounded subtasks. Each test slice is a separate test group with
adversarial cases (empty state, duplicate text, nonexistent ids,
large id numbers, concurrent saves to same path).

## Oracle

`todo.test.mjs` is written by the frontier (me) before any local call.
Tests are run via Node's built-in `node:test` runner — no external
dependencies. Each test has a clear `it()` description tagged with the
task ID. The oracle for a task = its test slice exits 0 with all
assertions passing.

## Promotion / escalation policy

- Local attempt 1 (qwen3-coder:30b): bounded prompt, single response, oracle.
  - Pass → task closed, recorded as `local-only-attempt-1`.
  - Fail → escalation 1.
- Escalation 1 (devstral-small-2:24b): same prompt, second-opinion attempt.
  - Pass → task closed, recorded as `local-second-opinion`.
  - Fail → escalation 2.
- Escalation 2 (frontier, me): I read the failing tests + local outputs and write the implementation.
  - Always passes (control case). Recorded as `frontier-repair`.

## Metrics captured per task

- `route_terminal`: which role finally closed the task
- `local_attempt_1_pass`: bool
- `local_attempt_2_pass`: bool (null if attempt 1 passed)
- `frontier_invoked`: bool
- `local_tokens_total`: sum of eval_count across local calls
- `local_wall_ms_total`: sum of wall ms across local calls
- `frontier_required_for_completion`: bool

## Portfolio metrics

- Tasks closed by local-only (any local attempt): N / 7
- Tasks requiring frontier repair: N / 7
- **Hypothesis support condition:** ≥ 5 / 7 closed by local-only AND
  the 2 hardest tasks (subjectively: T7 CLI dispatcher, T5 save/load —
  involve fs/argv parsing) are the ones requiring frontier
- **Hypothesis falsified condition:** < 4 / 7 closed by local-only OR
  frontier escalations are concentrated on the easy tasks
  (T1 / T2 / T6)

## What this is NOT

- Not k≥3 — single attempt per task per role; failure modes here may
  be fragile, especially given the 2026-05-11 strict-format-fit smoke
  found qwen3-coder is non-deterministic at temperature 0.
- Not claim-eligible per §3a (no signed trace, no cross-family review).
- Not a controlled trial (no frontier-only baseline arm — just testing
  whether the hybrid path completes the app).
- Not a generalisation — one task class, one app, one rig. Useful as
  proof-of-life for the routing pattern, not as evidence the pattern
  scales.

## Deliverables

- `spec.md` (this file)
- `oracle/todo.test.mjs` — test suite, written before any local call
- `worker.mjs` — Ollama client wrapper with token/timing capture
- `router.mjs` — orchestration: per-task routing, escalation, oracle
- `run.mjs` — driver, reads tasks, runs router for each, writes manifest
- `tasks.json` — task definitions (function names, prompts, test patterns)
- `workspace/todo.mjs` — final assembled CLI
- `results/manifest.json` — per-task route + metrics
- `results/report.md` — human summary + verdict
