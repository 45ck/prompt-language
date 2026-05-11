---
title: PL flow-runtime hang diagnosis — root cause + smallest fix
status: research note + proposed code change (not applied)
operator: 45ck
date: 2026-05-11
related-bead: prompt-language-5io5
---

# PL flow-runtime hang diagnosis

Investigation by parallel research agent into why
`prompt-language ci --runner ollama` AND `--runner aider` both
hang on simple flows after printing "Running flow via
ollama|aider..." with no further visible output.

## Headline

**The "hang" is silence-by-design, not a bug.** The process is
running. Per-round telemetry goes to a file
(`appendProviderTelemetry` at `ollama-prompt-turn-runner.ts:972`),
never stdout. The runtime has zero progress emissions during the
run loop — confirmed by greps for `console.|stdout.write|process.stdout`
across `src/application/run-flow-headless.ts` and
`src/infrastructure/adapters/ollama-prompt-turn-runner.ts`.

## Ollama runner: strict JSON action protocol

The runner expects strict JSON (no markdown fences) parsed by
**`parseActionEnvelope`** at `ollama-prompt-turn-runner.ts:363`.
Validated by `isRunnerAction` at line 339. Expected shape (lines
207-208):

```json
{
  "actions": [
    {"type": "list_files", "path": "."},
    {"type": "read_file", "path": "..."},
    {"type": "write_file", "path": "...", "content": "..."},
    {"type": "run_command", "command": "..."},
    {"type": "done", "message": "..."}
  ]
}
```

System prompt enforcing this is built by `createSystemPrompt()`
(line 203). Loop only exits on `reachedDone && !actionFailed` at
line 1071. If the model emits prose, JSON-with-fences (regex at
line 325 handles fences), or a different schema, `parseActionEnvelope`
returns undefined and the loop pushes the corrective user message
at line 990 and continues until `DEFAULT_ACTION_ROUNDS = 8` (line 30)
is hit, raising PLR-007.

## Aider runner: captured-pipes block

`AiderPromptTurnRunner.run` (`aider-prompt-turn-runner.ts:162`)
calls `execFileSync('python', args, { stdio: ['ignore','pipe','pipe'] })`
at line 169. **Pipes are captured, not inherited** — aider's
per-turn output never reaches the parent's stdout. Parent blocks
synchronously inside `execFileSync` until aider exits. Default
`DEFAULT_TIMEOUT_MS = 600_000` (line 13) = 10-minute wall. With
`--model ollama/qwen3-coder:30b`, a single turn easily takes
90-300s.

The shared blocker is **not** in the flow-runtime layer above the
adapters — `runFlowHeadless` (`src/application/run-flow-headless.ts:535`)
just `await`s `promptTurnRunner.run(...)`. The shared property is
"no progress events leak out of either adapter while the model
spins for 1-5 minutes per turn." Different causes, same symptom.

## Has anyone successfully run `--runner ollama` end-to-end?

**Only one commit claims it: `32f4d20`** (Apr 11 2026, by 45ck) —
"fix(ollama): pass full local smoke on **gemma4**". It modifies
`bin/cli.mjs`, `run-flow-headless.ts`, `parse-flow.ts`, etc.
That's a fix that *enabled* the smoke pass, not evidence of
stable use. **No other commit** mentions an end-to-end success
with qwen, llama, or any other model. The 35 other ollama-tagged
commits are diagnoses, feature additions, retry hardening, and
PowerShell bridging — all consistent with a runner that has only
worked once on one model.

**Conclusion**: the ollama runner has effectively never been used
end-to-end at qwen3-coder:30b scale. The JSON-tool-use protocol
is hostile to most local models that aren't fine-tuned for strict
JSON action schemas.

## Smallest concrete code change (~8 LOC, NOT YET APPLIED)

Two surgical edits would unblock single-prompt flows:

### Edit 1: `src/infrastructure/adapters/ollama-prompt-turn-runner.ts:30`

```diff
-const DEFAULT_ACTION_ROUNDS = 8;
+const DEFAULT_ACTION_ROUNDS = 1;
```

One LOC. With rounds=1 and a non-action prompt, the loop returns
PLR-007 in one model call (~10-20s) instead of 8. **Doesn't fix
the architecture** but reduces the worst-case hang duration by 8×.

### Edit 2: `src/infrastructure/adapters/ollama-prompt-turn-runner.ts:987-995`

The real fix. When `parseActionEnvelope` returns undefined on
round 1 AND the prompt contains no workspace verbs (the
`promptRequiresWorkspaceAction(prompt)` predicate already exists
at line 381), short-circuit:

```diff
+      if (round === 1 && !json && !promptRequiresWorkspaceAction(prompt)) {
+        return {
+          exitCode: 0,
+          assistantText: raw,
+          madeProgress: false,
+        };
+      }
```

~6 LOC. This is the "ollama-text mode" path #1 listed in the
findings doc at
`experiments/concord-vho-realsoftware-rpncalc/2026-05-11/arm-a-hybrid-pl-flow/findings.md`.

### Edit 3: visibility (orthogonal, kills "hang" perception)

At `ollama-prompt-turn-runner.ts:985`:

```diff
+      console.log(`[ollama] round ${round}/${maxActionRounds}`);
```

~3 LOC.

### Edit 4: aider stdio inheritance

`src/infrastructure/adapters/aider-prompt-turn-runner.ts:175`:

```diff
-      stdio: ['ignore', 'pipe', 'pipe'],
+      stdio: 'inherit',
```

1 LOC. Aider's progress output reaches the parent's stdout in
real time.

**Total: ~11 LOC across 2 files.** All changes reversible via
git revert.

## Why this isn't applied

The user has not explicitly authorized changes to the runtime
code. These edits change behavior of the published npm package
(`@45ck/prompt-language`) and could affect existing users. They
are documented here as a proposal; apply via separate commit
after explicit approval.

## What the fix does NOT address

- The fundamental architecture mismatch (PL ollama runner is
  agentic tool-use, not single-turn generation). The 6-LOC
  short-circuit handles the single-turn case but doesn't make
  qwen-class models speak the JSON action protocol for true
  agentic use.
- The aider stdio fix surfaces output but doesn't speed up aider
  itself.
- For real claim-eligible runs, the operator-signer playbook
  (`docs/security/operator-signer-provisioning-playbook.md`) is
  separately required.

## Cross-references

- Bead: `prompt-language-5io5` (P1)
- Findings from the morning's pilot:
  [`experiments/concord-vho-realsoftware-rpncalc/2026-05-11/arm-a-hybrid-pl-flow/findings.md`](../../experiments/concord-vho-realsoftware-rpncalc/2026-05-11/arm-a-hybrid-pl-flow/findings.md)
- Source: `src/infrastructure/adapters/ollama-prompt-turn-runner.ts`
- Source: `src/infrastructure/adapters/aider-prompt-turn-runner.ts`
- Run-flow-headless: `src/application/run-flow-headless.ts:535,611`
- CLI dispatcher: `bin/cli.mjs:1948-2030`
- Only successful end-to-end commit: `32f4d20` (gemma4-only)
