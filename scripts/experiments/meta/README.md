# Meta-Factory Experiment Harness

Single-entry runner for meta-factory flows.

## Usage

```
node scripts/experiments/meta/run-meta-experiment.mjs <flow-path> [--live]
```

- Default: **dry-run**. Parses the flow, resolves `import:` targets, checks that
  the plugin is installed, the agent shim is on disk, and that `claude` is on
  PATH. Exits `0` when all prerequisites are met.
- `--live`: actually invokes `claude -p --dangerously-skip-permissions` with the
  flow text as the prompt. Full provenance trace is captured under
  `experiments/meta-factory/results/<run-id>/`.

## npm scripts

- `npm run experiment:meta:dry -- <flow-path>` — dry-run
- `npm run experiment:meta:live -- <flow-path>` — live run

## What the live mode does

1. **Pre-flight**
   - `bin/cli.mjs install` if the plugin directory is missing.
   - `git stash push -u -m meta-<run-id>` to isolate unversioned changes.
   - Generates `PL_RUN_ID=meta-<timestamp>`.
   - Creates evidence bundle `experiments/meta-factory/results/<run-id>/`.
   - Records `manifest-pre.json` (SHA-256 of every file under `src/`, `scripts/`,
     plus protected top-level config files).
2. **Invocation**
   - Env: `PL_TRACE=1 PL_TRACE_STRICT=1 PL_RUN_ID=<id> PL_TRACE_DIR=<bundle>/.prompt-language`
   - PATH prefix: `scripts/eval/agent-shim/`
   - `PL_REAL_BIN_CLAUDE` set to resolved `claude` binary.
   - Wall-clock cap defaults to 25 minutes; override with `META_WALL_CLOCK_SEC`.
3. **Post-run**
   - Copies `provenance.jsonl` and `session-state.json` into the bundle.
   - Runs `scripts/eval/verify-trace.mjs` and writes `verify.json`.
   - Records `manifest-post.json` and `diff.json`.
   - Restores stash regardless of success.
4. **Success criteria**
   - `verify-trace.mjs` exits 0 **and** no protected config file appears in
     `diff.protectedChanged` (META-5 MR-2 rule-weakening guard).

## Evidence bundle

```
experiments/meta-factory/results/<run-id>/
  manifest-pre.json
  manifest-post.json
  diff.json
  provenance.jsonl
  session-state.json
  verify.json
  claude.stdout.log
  claude.stderr.log
  stash-pop.json
  report.json
```

`report.json` is the authoritative structured summary. The one-line JSON written
to stdout is an operator-facing digest.

## Tests

```
node --test scripts/experiments/meta/run-meta-experiment.test.mjs
```
