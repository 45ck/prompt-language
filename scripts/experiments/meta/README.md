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
   - Runs the bootstrap envelope and writes `bootstrap-preflight.json`.
   - `blocked` preflight refuses launch; `degraded` may run but is recorded-only and not claim-eligible.
   - `git stash push -u -m meta-<run-id>` to isolate unversioned changes.
   - Generates a fresh nonce-backed `PL_RUN_ID` from the private per-user nonce store.
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
   - Runs `scripts/eval/verify-trace.mjs` with the harness hardening flags:
     `--expected-run-id`, `--freshness-window-ms`, `--min-entries 1`,
     `--expected-pair-count <N>` when the flow implies at least one prompt/run pair,
     and `--expected-binary-hashes` when the local allow-list file exists.
   - When attestation is configured, the same verifier pass also receives
     `--attestation`, `--trusted-signers`, `--revoked-signers`, and, in
     required mode, `--require-attestation --require-role <role>`.
   - Writes the verifier output to `verify.json`.
   - Records `manifest-post.json` and `diff.json`.
   - Restores stash regardless of success.
4. **Optional / required attestation**
   - If `PL_ATTEST_SIGNER` and `PL_ATTEST_KEY_PATH` are set, the harness signs
     the frozen bundle and writes `attestation.json` before running the verifier.
   - `PL_TRUSTED_SIGNERS_PATH` and `PL_REVOKED_SIGNERS_PATH` override the signer
     registries for that run.
   - `PL_REQUIRE_ATTESTATION=1` upgrades the verifier pass to a hard
     attestation gate; `PL_REQUIRE_ROLE` defaults to `operator` when attestation
     is configured and may be set to `ci` for non-claim workflows.
   - Without signer config, the run may still succeed as recorded evidence, but
     `report.json.claimEligibility` stays ineligible with `attestation-missing`.
   - `scripts/experiments/meta/attest.mjs` remains the manual fallback when the
     operator wants to promote a frozen bundle after the initial harness run.
5. **Recorded success criteria**
   - The first-pass `verify-trace.mjs` invocation exits 0 **and** no protected
     config file appears in `diff.protectedChanged` (META-5 MR-2 rule-weakening guard).
6. **Claim-eligible success criteria**
   - Preflight was `ready`.
   - Cross-family reviewer evidence remains acceptable.
   - The verifier pass completed with a valid operator attestation under
     `--require-attestation --require-role operator`.
   - `docs/security/trusted-signers.json` contains a real non-placeholder operator signer.

## Evidence bundle

```
experiments/meta-factory/results/<run-id>/
  bootstrap-preflight.json
  manifest-pre.json
  manifest-post.json
  diff.json
  provenance.jsonl
  session-state.json
  verify.json
  attestation.json        # optional; written when signer config is present
  claude.stdout.log
  claude.stderr.log
  stash-pop.json
  report.json
```

`report.json` is the authoritative structured summary. The one-line JSON written
to stdout is an operator-facing digest. `verify.json` is the harness verifier
pass; it may be unattested, attestation-aware, or attestation-required depending
on the run configuration.

## Tests

```
node --test scripts/experiments/meta/run-meta-experiment.test.mjs
```
