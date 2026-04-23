# R7 — foreach-spawn fan-out vs sequential prompt scaffolding

Design only. No runs attached. See `flows/r7-foreach-spawn.flow` for the
new arm; the sequential baseline already shipped as
`C:/Projects/oc-nextjs-v2/build.flow` (v2) on 2026-04-20.

## Hypothesis

H1 (primary): replacing six sequential `prompt:` nodes with one
`foreach-spawn file in ${files} max N` fan-out does NOT improve
wall-clock time on a single-GPU ollama box, because one Ollama model
slot serialises generation regardless of how many `opencode` child
processes are alive. Spawn-side parallelism is bounded by model-side
sequentiality.

H2 (secondary, the interesting one): fan-out DOES improve **failure
isolation** — a scaffolding failure for one file (bad write, tool
refusal, timeout, malformed response) does not poison the context of
sibling files, because each child has its own opencode session.

H3 (secondary): fan-out produces a **measurably different error
profile** — the dominant failure mode shifts from "later prompt sees
earlier half-written file and compounds the mistake" to "one child
fails cleanly, other five succeed, npm install / next build surfaces
the missing file as an isolated error."

### Null hypotheses

- H0a (vs H1): wall-clock of foreach-spawn N=3 and N=6 are both within
  ±10% of the sequential baseline's 40-minute scaffold+install+build.
- H0b (vs H2): failure rate per file is not significantly different
  between arms (one-sided Fisher exact across runs, alpha=0.1).
- H0c (vs H3): the frequency of the "cross-file contamination" error
  class is zero in both arms, so there is nothing to separate. (If we
  never see it in baseline, H3 is unfalsifiable from this experiment.)

## Arms

| Arm         | Flow                                 | Parallel budget | Expected serialisation point       |
| ----------- | ------------------------------------ | --------------- | ---------------------------------- |
| A0 baseline | `oc-nextjs-v2/build.flow`            | 1 (sequential)  | by construction                    |
| A1 N=3      | `r7-foreach-spawn.flow` with `max 3` | 3 children      | ollama model slot                  |
| A2 N=6      | copy of r7 with `max 6`              | 6 children      | ollama model slot + spawn overhead |

All arms: same model (`qwen3-opencode-big:30b`), same runner
(opencode), same prompts for the per-file body, same install+retry
tail, same host.

## Metrics

Primary:

- `wall_time_total` — seconds from flow start to `done when` resolution.
- `wall_time_scaffold` — seconds from start to `await all` resolution
  (baseline: last of the six sequential prompts).
- `build_success` — boolean, `.next/BUILD_ID` exists.

Secondary:

- `tokens_in`, `tokens_out` summed across all children and the parent.
- `retry_count` — times the `retry max 3 { next build }` loop fires.
- `scaffold_failure_count` — number of `prompt:` scaffolding steps (or
  child exits) reporting non-ok.
- `scaffold_failure_isolation_index` = (failed children) / (files not
  written). 1.0 means perfect isolation (every unwritten file maps to
  exactly one failed child); <1.0 means one failure caused ≥2 missing
  files (contamination).
- `error_attribution_clarity` — manual 3-level grade {clear, partial,
  opaque} of whether logs let you identify which file caused a failure
  without re-running.

Observational:

- peak RSS of ollama and of the parent node process.
- child startup overhead (first child spawn to first prompt token).

Sample size: 5 runs per arm to get a crude spread; not powered for
significance, only for direction.

## Predicted outcomes (specific)

| Metric                           | A0 sequential                               | A1 N=3                                                      | A2 N=6                                                         |
| -------------------------------- | ------------------------------------------- | ----------------------------------------------------------- | -------------------------------------------------------------- |
| wall_time_scaffold               | ~40% of total (~16 min)                     | same or slightly worse (+5–15% due to spawn+queue overhead) | same ± spawn overhead, possibly worse on context-switch thrash |
| wall_time_total                  | ~40 min (observed)                          | 38–46 min                                                   | 38–48 min                                                      |
| build_success                    | ~1.0 (observed 1/1)                         | ~0.8–1.0                                                    | ~0.6–0.9 (more variance from spawn collisions)                 |
| retry_count                      | 0–1                                         | 0–1                                                         | 0–2                                                            |
| scaffold_failure_isolation_index | N/A (no fan-out)                            | ~1.0 if isolation holds                                     | ~1.0 if isolation holds                                        |
| error_attribution_clarity        | partial (linear log, but interleaved fixes) | clear (per-child logs)                                      | clear but noisier                                              |

In plain English: I expect A1 and A2 to be a **wash on time** and a
**meaningful win on debuggability** when something breaks. I don't
expect either fan-out arm to beat baseline on success rate; it may
lose slightly because more moving parts.

## What would falsify H2 (failure isolation)?

Any ONE of these in A1 or A2:

1. A single failing child correlates with ≥2 missing files across runs
   (`isolation_index < 1.0` repeatedly). Means children are leaking
   state somewhere we didn't expect.
2. Scaffold failure rate in fan-out arms > sequential. Means the
   parallelism itself causes new failures faster than it isolates old
   ones.
3. Attribution-clarity grade ends up "opaque" as often in fan-out as
   in sequential. Means the logging does not actually help.
4. A child's failure is observed to mutate sibling outputs (e.g., bad
   package.json from child 1 appears in child 2's context). Would
   require explicit cross-contamination evidence in child transcripts.

## What would falsify H1 (no wall-clock win)?

A1 `wall_time_scaffold` < 0.7 × A0 `wall_time_scaffold` consistently.
That would imply either (a) ollama is actually serving concurrent
requests on this box, or (b) the sequential prompts were paying huge
per-prompt overhead unrelated to generation (session warmup, tool
negotiation) that fan-out amortises. Either is worth knowing.

## Caveats

### Concurrent opencode spawns and `.prompt-language/opencode-home/`

Open concern. `spawn.md` says "The child gets its own state directory"
but is silent on whether the `opencode-home` cache (used by the
opencode runner for auth, MCP, session caches) is per-spawn or shared.
If shared, concurrent children may collide on:

- session sqlite locks
- tool-registry writes
- log files written to the same path
- any auth token refresh

How to detect without executing:

- grep the runner source for `opencode-home` resolution logic and
  confirm whether it is keyed on child id / PID / random suffix.
- check `docs/reference/spawn.md` and the runner module for a
  documented isolation claim, not just an inference.
- if it's shared, a dry-run with `N=6` and `strace`/procmon on the
  opencode-home directory would show write contention.

How to detect during execution (for the eventual run, out of scope
here): tail `.prompt-language/opencode-home/**/*.log`, look for
sqlite `SQLITE_BUSY` or `EBUSY`/`EPERM` on concurrent writes, and
correlate with child failure timestamps.

Mitigation if shared: set a unique `OPENCODE_HOME` per child via the
`env:` block plus `${child_index}` — but note `foreach-spawn` does
not expose a child-index variable in the current DSL; the loop
variable is the list item (`${file}`), not an index. Workaround would
be to derive a hash of `${file}` into a sub-directory name.

### Env vars required

- `PL_SPAWN_RUNNER=opencode` — set in the flow's `env:` block so
  spawn children launch opencode rather than claude. Already present
  in `r7-foreach-spawn.flow`.
- `PROMPT_LANGUAGE_OPENCODE_TIMEOUT_MS` — must be set high enough that
  a large-model scaffold prompt under queue pressure does not kill
  the child before ollama delivers its first token. The qwen3 30b
  baseline ran ~40 min total; conservative per-child ceiling of
  600000 ms (10 min) per scaffold prompt is plausible, but verify
  against the baseline's longest observed prompt before the run.
  Set it in the parent shell's env before `prompt-language run`,
  not in the flow (the env block only injects into commands).

### Other caveats

- `max 3` is a parallelism cap, not a concurrency guarantee. On a
  single GPU it is effectively a queue depth hint. Wall-clock will be
  dominated by the slowest generation path, not the cap.
- The baseline's 1/1 success is n=1. Don't over-interpret the
  delta on any single run.
- The retry-and-heal tail is identical in all arms, so it is not the
  thing under test; keep it to hold the system honest end-to-end.
- File-level writes to the same working directory across children
  should not collide (distinct paths), but if the model hallucinates
  and writes `package.json` from two children, last-writer-wins will
  bite silently. Consider a `done when` predicate comparing content
  hash to expected, if later arms extend this.

## Handoff

Next skill: `nfr-evidence-matrix-builder` to make the wall-time,
success-rate, and isolation-index thresholds explicit with evidence
sources, once someone agrees the hypothesis set is what we want to
test. Then `qa-automation-engineer` to actually execute the three
arms under a fixed sample plan.
