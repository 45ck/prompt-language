# E6 live smoke -- PARTIAL

Outcome: PARTIAL. The flow parsed, imports resolved from repo root, the first six nodes (remember x5, intro prompt x1) executed, but the agent refused to advance past n7. It correctly detected that the memory: prefetch hydrates variables BEFORE the remember nodes write them, so on a cold-start session every ${crm_workspace}, ${crm_entities}, etc. resolves to empty string for the entire run. The agent explicitly declined to auto-advance rather than contaminate the plugin repo root with scaffold directories.

## Run metadata

- Run id: e6-live-1776375508
- Wall-clock: 357 s
- Claude version: 2.1.112
- Invocation: timeout 1200s claude -p --dangerously-skip-permissions "$(cat experiments/full-saas-factory/e6-pl-crm-factory/project.flow)"
- cwd: C:\Projects\prompt-language (repo root -- see Invocation note below)
- Env: PL_TRACE=1, PL_TRACE_STRICT=1, PL_RUN_ID=e6-live-1776375508, PL_TRACE_DIR=<bundle>/.prompt-language, shim dir prepended to PATH, PL_REAL_BIN_CLAUDE set. On this Windows host the shim did not emit shim_invocation_* records into the provenance -- only the runtime side is represented.
- Exit code: 0

## Invocation note (falsifier finding 1 -- docs/flow mismatch)

The E6 README says cd experiments/full-saas-factory/e6-pl-crm-factory then claude -p ... "$(cat project.flow)". But project.flow imports use paths like experiments/full-saas-factory/e6-pl-crm-factory/phases/discovery.flow, resolved relative to basePath = process.cwd() (parse-flow.ts line 2428). Invoked from the pack directory, every import fails with Could not read import file "...", and every use scaffold.* or use discovery.* becomes an Unknown namespace warning. Confirmed by direct parseFlow() from both cwds:

- cwd=<pack>/: 8 import failures, 11 Unknown namespace warnings, no libraries resolved.
- cwd=<repo root>: 0 warnings, 8 imports resolved, 38 flow nodes.

The task spec /tmp/e6-live-$ts pattern has the same failure mode. I ran from the repo root so imports would actually resolve and give the flow a fair shot. This is not a modification of src/ or the flow pack -- just a cwd choice.

## Answers to the mandatory questions

1. Did the flow parse AND start executing? Yes. 38 nodes, 0 warnings, 8 libraries. Runtime advanced n1..n6. Stopped at n7.

2. Did it reach the end of project.flow or get stuck mid-phase? Stuck very early. currentNodePath=[6], n7 not_started. 6 of 38 nodes advanced (15.8%). No phase entered.

3. What files exist in the workspace? Is there a package.json with sensible deps? Only the seed README.md (see workspace-tree.txt). No package.json, no apps/web, no packages/api, no docs.

4. Does npm install --dry-run against the emerged package.json resolve cleanly? Not applicable -- no package.json.

5. Can you npm run build (or equivalent) without hand-editing? Not applicable -- no build target.

6. Phase gate hits? audit.jsonl recorded 6 node_advance events (remember x5 then prompt x1). No run_command, no gate_*, no capture_*. Zero phase gates hit.

7. Verify-trace result: FAILED. Verifier rejects entry 0 with chain: entry 0: prevEventHash must be string or null. The runtime omits the field entirely instead of emitting null. Every runtime-only trace will fail under the current validator. A secondary state-hash mismatch also appeared because the session-state file was re-serialized by stop-hook bypass attempts after the run. Command: node scripts/eval/verify-trace.mjs --trace <bundle>/.prompt-language/provenance.jsonl --allow-missing-state -> exit 1.

8. Honest outcome: PARTIAL. Runtime control-flow machinery works (nodes advance, audit writes, memory.json writes, session-state.json persists). But the flow pack is semantically broken on cold start, the agent refused to proceed, and the packs own README invocation does not work. No runnable artifact shipped.

## Falsifier findings

1. E6 README invocation instructions broken. cd <pack> then claude -p "$(cat project.flow)" makes imports resolve against the pack dir where they do not exist. Must be run from the repo root.

2. memory: prefetch races remember writes on cold start. memory.json is empty when memory: hydration runs, so variables.crm_workspace starts as "". The subsequent remember key="crm_workspace" value="..." nodes write to memory.json on disk but do not update state.variables. The whole session then interpolates empty strings. Confirmed in session-state.json: variables has every crm_* key as "" while memory.json holds correct values. Workaround suggested by the agent: use let x = "..." at the top of the flow instead.

3. Provenance entry 0 missing prevEventHash. verify-trace.mjs rejects the first runtime event because prevEventHash is absent. Schema requires null. Fails every run trace.

4. Gates resolve paths against process.cwd(), not ${crm_workspace}. Agent noted evaluate-completion.ts line 80 uses existsSync('docs/prd.md') against process cwd. With the agent launched at the repo root (required for imports), gates check the repo not the workspace. No in-session primitive can change process cwd. Not observed live (execution never reached a gate).

5. Shim records not emitted on Windows. Despite PATH=<shim>:$PATH and PL_REAL_BIN_CLAUDE set, provenance.jsonl contains only source:"runtime" entries. No shim_invocation_begin/end. Windows PATH resolution preferred claude.exe over the pl-claude.cmd stub; shim bypassed. Witness chain single-sided.

## Maintainability notes

- Bootstrap ordering bug is the highest-leverage fix: either hydrate memory: after remember executes, or resolve ${var} live against memory.json on interpolation, or warn when both memory: and early remember are present.
- Comments (# lines) should be a lexer primitive, not swallowed as prompts. E7 produced 57 warnings on this alone.
- verify-trace should accept missing prevEventHash on seq=0, or the runtime should emit "prevEventHash": null. Either fixes it; the current state breaks every trace.
- Pack README should say run from repo root (or the import resolver should accept paths relative to the flow file's own directory).

## Evidence bundle

- report.md -- this file
- run.log -- invocation metadata + exit code + wall-clock
- claude.stdout.log -- 18 lines, the agents explicit refusal (valuable -- diagnoses the bug in prose)
- claude.stderr.log -- empty
- audit.jsonl -- 6 node_advance entries from this run at 2026-04-16T21:41:06.* plus 10 historical entries retained from the shared state dir
- memory.json -- 5 keys correctly persisted by remember, proving the memory write path works
- session-state.json -- currentNodePath:[6], status:"active", variables all empty strings -- the bug fingerprint
- .prompt-language/provenance.jsonl -- 6 runtime entries, no shim entries
- verify-trace.json -- FAIL output
- workspace-tree.txt -- single-line workspace listing
- emerged-artifacts/ -- full copy (trivial; only README.md)
