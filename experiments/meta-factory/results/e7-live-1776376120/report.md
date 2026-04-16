# E7 live smoke -- FAIL

Outcome: FAIL. The flow parsed (190 nodes, 57 warnings, 15 imports) but only the first node was advanced, Claude returned empty stdout, and no session-state.json was written. The first node is a comment line (# Bootstrap: set configuration variables) that the parser silently re-classified as a prompt because # is not a DSL comment primitive. Claude was sent a prompt whose entire content is a decorative header and apparently responded with nothing. The workspace is untouched.

## Run metadata

- Run id: e7-live-1776376120
- Wall-clock: 82 s
- Claude version: 2.1.112
- Invocation: timeout 1800s claude -p --dangerously-skip-permissions "$(cat experiments/full-saas-factory/e7-enterprise-crm-factory/project.flow)"
- cwd: C:\Projects\prompt-language (repo root, same rationale as E6)
- Env: PL_TRACE=1, PL_TRACE_STRICT=1, PL_RUN_ID=e7-live-1776376120, PL_TRACE_DIR=<bundle>/.prompt-language, shim dir prepended to PATH, PL_REAL_BIN_CLAUDE set.
- Exit code: 0
- stdout: 0 bytes. stderr: 0 bytes.

## Answers to the mandatory questions

1. Did the flow parse AND start executing? Parsed with 190 nodes and 57 warnings (all of shape Unknown keyword "# ..." -- treating as prompt). 15 imports resolved from repo root. Runtime advanced n1 only.

2. Did it reach the end of project.flow or get stuck mid-phase? Stuck at n1. Cannot confirm where it stopped after that because no session-state.json was persisted in the state dir (only audit.jsonl and provenance.jsonl, each with a single entry).

3. What files exist in the workspace? Is there a package.json with sensible deps? Only the seed README.md. No package.json, no app code, no docs.

4. Does npm install --dry-run against the emerged package.json resolve cleanly? Not applicable -- no package.json.

5. Can you npm run build without hand-editing? Not applicable.

6. Phase gate hits? audit.jsonl has 1 node_advance event for n1 kind=prompt (text: # Bootstrap: set configuration variables). Zero gates.

7. Verify-trace result: FAILED with the same chain: entry 0: prevEventHash must be string or null defect as E6. Provenance has exactly 1 entry so only the header-validation issue shows. Command: node scripts/eval/verify-trace.mjs --trace <bundle>/.prompt-language/provenance.jsonl --allow-missing-state -> exit 1.

8. Honest outcome: FAIL. The flow advanced exactly one node, produced no observable output, and persisted no durable state. The combination of parser permissiveness (comments accepted as prompts) and a single empty-content first node made it look like execution happened while nothing useful did.

## Falsifier findings specific to E7 (additive to E6's)

6. Comments silently converted to prompts. The E7 project.flow uses # ... decorations between phases. parseFlow emits warnings (Unknown keyword "# ..." -- treating as prompt) but still builds prompt nodes from them. Effect: n1 is a decorative header sent verbatim to Claude. Fix: make # a lexer-level comment and ignore it.

7. Empty session-state after a run is a silent failure mode. E7 left audit.jsonl and provenance.jsonl in the state dir but no session-state.json. On Windows the file may have been transiently created and deleted by a hook, or never fully written. Either way, an orchestrator that reads session-state.json to resume cannot tell the run happened at all -- it looks like a no-op. There is no terminal event in the trace marking completion or abort.

8. E7 inherits every bug E6 exposed (memory bootstrap race, gates vs process.cwd, trace entry-0 format, shim not firing on Windows). None of these were exercised because execution stopped at n1, but all apply.

## Why the silent exit is plausible

Claude was asked to process a prompt whose entire content was # Bootstrap: set configuration variables. With --dangerously-skip-permissions in -p mode, a model may reasonably return an empty turn (the request is not a request). The runtime then advanced past n1 because prompt auto-advances after the agent reply. A plausible follow-up is that the runtime tried to continue to n2 (remember crm_target_market) but the session was already torn down -- session-state.json never reached a steady state and the stop hook pruned it. I did not re-run to confirm this hypothesis because it would not change the outcome class.

## Evidence bundle

- report.md -- this file
- run.log -- invocation metadata + exit code + wall-clock
- claude.stdout.log -- 0 bytes
- claude.stderr.log -- 0 bytes
- audit.jsonl -- 1 node_advance entry for n1 (2026-04-16T21:49:05.557Z), plus historical entries retained from the shared state dir
- memory.json -- unchanged from E6 run (not re-written; remember nodes were never reached)
- (no session-state.json) -- notable absence
- .prompt-language/provenance.jsonl -- 1 runtime entry, no shim entries
- verify-trace.json -- FAIL output (--allow-missing-state used because state file was never produced)
- workspace-tree.txt -- single-line workspace listing
- emerged-artifacts/ -- full copy (trivial; only README.md)
