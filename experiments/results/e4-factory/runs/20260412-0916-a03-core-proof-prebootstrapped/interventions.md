# Interventions

## Prompt-Language Lane

1. The first `Start-Process` launcher attempt was invalid on Windows because the `cli.mjs` path under `D:\Visual Studio Projects\...` was flattened incorrectly, so Node tried to execute `D:\Visual` as the script path.
2. Passing an absolute `--state-dir` path also failed on Windows because the runtime treated it as relative to `cwd` and tried to create `workspace\\D:\\...\\pl-state`.
3. The successful rerun used a relative `--state-dir` from the workspace root:
   `..\\..\\..\\..\\..\\..\\results\\e4-factory\\runs\\20260412-0916-a03-core-proof-prebootstrapped\\pl-state`
4. The run completed, but `run` nodes for `npm run lint` and `npm run test` still hit the built-in 30-second timeout. The post-run gate evaluations later passed for `lint`, `typecheck`, and `test`, so the timeouts were false negatives at the node level, not proof of a broken workspace.
5. `ci-report.json` and `ci-stderr.log` stayed empty in this run. The authoritative evidence for prompt-language completion is `pl-state/session-state.json` and `pl-state/audit.jsonl`.

## Codex-Alone Lane

1. The direct Codex baseline ran cleanly with `codex exec --json`.
2. The raw `events.jsonl` shows an intermediate typecheck failure in `packages/api/src/index.ts`, followed by an in-run fix and a successful final verification pass.
