# Aider Runner — P1 Triage (2026-04-20)

Owner: quality review (maintainability-reviewer)
Scope: the two P1 defects captured live in `experiments/aider-vs-pl/rescue-viability/LIVE-NOTES.md` "Open bugs discovered this session", reproduced in R1 Run B against `ollama_chat/qwen3:8b` via `prompt-language ci --runner aider`.
Cross-references: [`LOCAL-MODEL-VIABILITY-FINDINGS.md`](LOCAL-MODEL-VIABILITY-FINDINGS.md) §2b, §5 (original pair: `prompt-qtn7`, `prompt-khm1`); [`EVIDENCE-CONSOLIDATION.md`](EVIDENCE-CONSOLIDATION.md) §3 (methodology scrutiny); [`SCORECARD.md`](SCORECARD.md) §§3-6 (narrative); [`GUIDE-AND-ROADMAP.md`](GUIDE-AND-ROADMAP.md) §4.1 (engineering debt).

Important terminology note: the two defects triaged here are a **newly observed pair** captured 2026-04-20 during R1 Run B (ollama TCP drop, parent-git-dir path resolution). They are **not** the originally filed pair (`prompt-qtn7` xterm-256color, `prompt-khm1` prompt-node dispatch-time completion). The pre-existing pair is already partially mitigated: `TERM=dumb` workaround for `prompt-qtn7` is now coded in `buildAiderEnv()` (`aider-prompt-turn-runner.ts:63-65`). See §6 below for how the two pairs interact.

---

## Defect A — Ollama TCP connection drop mid-inference, infinite litellm retry

Label: Layer 1 per LIVE-NOTES. Severity: P1 (blocks multi-turn flows on this host). Confidence: High (observed live, stack trace captured).

### Reproducer (captured today)

1. Keep an opencode session running against the same local Ollama endpoint (observed concurrency context on this PC).
2. `cd C:\Projects\prompt-language\experiments\aider-vs-pl\rescue-viability\runs\r1\qwen3-8b-pl-full-v3`
3. Run:
   ```bash
   PYTHONUTF8=1 OLLAMA_API_BASE=http://127.0.0.1:11434 \
     PROMPT_LANGUAGE_AIDER_TIMEOUT_MS=600000 \
     node C:/Projects/prompt-language/bin/cli.mjs ci --runner aider r1-pl-full.flow
   ```
4. Flow's second aider prompt node fires, aider issues chat completion to `ollama_chat/qwen3:8b`, mid-stream the TCP connection drops with `wsarecv: An existing connection was forcibly closed by the remote host`. litellm catches the `APIConnectionError` and enters its default tenacity retry loop. Aider neither aborts nor reports failure to PL; it waits until the 600 s PL timeout fires and gets killed (`exitCode: 124`, `madeProgress: false`).

Stack fragment (paraphrased from LIVE-NOTES §Open bugs bullet 3): `litellm.APIConnectionError: Ollama_chatException - ... ConnectionResetError ... wsarecv`.

### Where the defect originates in code

Not in PL's aider runner per se. Chain of custody:

- Ollama server (on this host) drops the HTTP/SSE stream mid-inference. Suspected triggers per LIVE-NOTES: concurrent opencode+aider requests, or model-swap thrash when Ollama unloads qwen3:8b to make room for another model.
- litellm (aider dependency) wraps the network failure in `APIConnectionError` and retries indefinitely by default rather than surfacing the error.
- aider does not expose a user-facing `--max-retries` or per-attempt timeout override and does not propagate the retry state to its stdout/stderr, so the retry storm is invisible to the caller.
- PL's `AiderPromptTurnRunner.run` (`src/infrastructure/adapters/aider-prompt-turn-runner.ts:127-182`) waits on `execFileSync` up to `PROMPT_LANGUAGE_AIDER_TIMEOUT_MS` (default 600 s). When the aider subprocess is finally SIGKILLed by `execFileSync`'s timeout path, the runner returns `exitCode: 124` with `madeProgress: false` (`:157-163`).

So the **PL contribution to this defect is zero at the proximate cause level**. PL is the _victim_, not the _source_. However PL's handling has two maintainability/debt weaknesses:

1. The PL layer has no shorter inner per-turn timeout or healthcheck, so a stuck aider is invisible to the operator for up to 10 minutes.
2. On timeout, `madeProgress: false` + `exitCode: 124` is indistinguishable (at the flow level) from "aider ran, model emitted nothing" or "aider crashed" — the retry/gate-loop machinery cannot tell "transient network storm — try again immediately" from "model cannot do this task — stop retrying".

### Is this really a PL defect?

**No, not at root cause.** This is an ollama/litellm/aider stack issue. Primary fix belongs upstream:

- Ollama: the TCP reset is the trigger. Concurrent requests and/or model-swap thrash need mitigation (server-side keepalive, bounded concurrency).
- litellm: infinite retry on `APIConnectionError` is the amplifier. A bounded retry count with exponential backoff, or propagation of retry state to stdout, would make this visible.
- aider: no surface for caller-side retry caps.

**But PL can reduce the blast radius** without fixing root cause (see fix sketch below). "Live with root cause, harden the runner" is the right posture.

### Blast radius

- Every multi-turn flow against a local Ollama on this Windows host is exposed. R1 Run B reproduced it on the second aider invocation.
- Single-turn flows or flows using frontier models via Sonnet/OpenAI SDK are not exposed (different transport stack).
- Users hit by this: any operator running `ci --runner aider` against Ollama with a non-trivial flow. On this host, this is ~100% of small-model real-PL runs and ~estimated 30-50% of Qwen3 30B runs (inferred from LIVE-NOTES §2d "aider+litellm wedged on 600s HTTP timeouts for every model on step 1").
- Frequency of the H11 phase-2 rigor run hitting this was not zero (see `LOCAL-MODEL-VIABILITY-FINDINGS.md` §4, "aider reliability gate — separate investigation" recommendation).

### Proposed fix sketch (PL-side mitigations, non-destructive)

Outline (not full code):

1. Add env `PROMPT_LANGUAGE_AIDER_TURN_TIMEOUT_MS` (default 120 s) as an inner per-turn timeout distinct from the outer `PROMPT_LANGUAGE_AIDER_TIMEOUT_MS`. On expiry, classify the failure as `exitCode: 124` _with a new flag like `reason: 'inner_timeout'`_ so callers can retry without penalty.
2. Pass aider CLI knobs that cap litellm retries if upstream exposes them (`--retries` is available on some aider versions — gate on version detect). If not available, document the known-gap in the runner header comment.
3. On `exitCode: 124` + `madeProgress: false` + stdout/stderr matching transient-connection regex (`wsarecv|ECONNRESET|APIConnectionError|ReadTimeout`), return a distinguishable `PromptTurnResult` shape (e.g. add `transient: true`) that the flow-executor/retry node can use to avoid counting against the retry budget.
4. Longer-term: plumb a structured progress signal (stdout heartbeat parsing) so a stalled aider is detectable within seconds, not minutes.

Risk assessment:

- (1) Low. Additive env var. No test regressions expected. Needs unit test covering `undefined env -> outer timeout`, `set env -> inner timeout`, and reason classification.
- (2) Low-to-medium. Depends on aider version parity across dev hosts — runtime feature-detection is safer than hardcoding. Gate with capability probe or a try/fail-soft mode.
- (3) Medium. Changes the public `PromptTurnResult` shape (if `transient` is exposed). Must be optional and backwards-compatible.
- (4) Medium-high. Requires an IPC pattern change (currently `execFileSync` is blocking). Would need `spawn` + chunked-read + watchdog.

### Regression tests (must merge before fix)

- Unit: `aider-prompt-turn-runner.test.ts` — feed a mocked `execFileSync` that throws with `killed: true` and stderr containing `wsarecv`; assert returned result is `exitCode: 124` and (if option 3 adopted) `transient: true`.
- Unit: inner-timeout env parsing (positive int, invalid string, missing → falls back to outer).
- Unit: when both timeouts are set, inner fires first and is reported with the correct reason tag.
- Integration: a dry-run harness test that asserts a `transient` classification is preserved through `TracedPromptTurnRunner` and through retry-loop counting in the flow executor (to guarantee root-cause invariant: transient failures don't burn retry budget).

---

## Defect B — Aider resolves file edits against the parent git working dir even when invoked with `--no-git` inside a PL checkout subtree

Label: Layer 2 per LIVE-NOTES. Severity: P1 (silently corrupts output location). Confidence: High (observed live, aider banner printed path).

### Reproducer (captured today)

1. `cd C:\Projects\prompt-language\experiments\aider-vs-pl\rescue-viability\runs\r1\qwen3-8b-pl-full-v3` (a **subdirectory inside** the PL git repo, without its own `.git`).
2. Invoke the PL aider runner via `ci --runner aider` on a `.flow` file whose prompts tell aider to "write csv2json.js in the current working directory".
3. Observe aider's startup banner (stdout): `Git working dir: C:\Projects\prompt-language` even though `--no-git` was passed in argv (see `aider-prompt-turn-runner.ts:31-37` — `--no-git` is conditionally added when `cwd` lacks a `.git` directory).
4. Result: file-edit tool calls resolve relative to the **parent** PL repo, not the R1 Run B cwd. The workspace under `runs/r1/qwen3-8b-pl-full-v3/` shows the run.log but `csv2json.js` never lands there (or lands corrupted at the parent-repo root if aider decides to write there).

Note: in the audit.jsonl captured (`runs/r1/qwen3-8b-pl-full-v3/.prompt-language/audit.jsonl:4`), stderr shows `file:///C:/Projects/prompt-language/experiments/aider-vs-pl/rescue-viability/runs/r1/qwen3-8b-pl-full-v3/csv2json.js` — i.e. the file _was_ eventually created in the right place on this particular run, but the LIVE-NOTES capture flags the behavior as inconsistent and deterministic enough to be a P1. Reproducibility requires a separate direct probe of aider in `--no-git` mode inside a nested git subtree; prior evidence in LIVE-NOTES is sufficient to raise the bug and scope the fix.

### Where the defect originates in code

Primary location: aider itself (upstream). Aider's repo-discovery walks _up_ from `cwd` to find `.git` and uses the first hit as its working tree, irrespective of `--no-git` for some code paths. `--no-git` disables commits and repo-map-via-git but does not consistently override repo-root discovery for subtree path resolution. This is an aider-side behavior.

Secondary location in PL: `src/infrastructure/adapters/aider-prompt-turn-runner.ts:74-76`

```ts
function hasGitRepo(cwd: string): boolean {
  return existsSync(join(cwd, '.git'));
}
```

This check is **shallow** — it only looks at `cwd`, not at any ancestor. Consequently the PL runner silently assumes "no .git at cwd → pass --no-git and everything is fine". In reality, when `cwd` is _under_ another git repo, aider ignores `--no-git` for path-root purposes and resolves against the parent.

### Is this really a PL defect or caller discipline?

Both — but the PL runner is the right place to defend against it:

- aider's behavior is upstream and unlikely to change soon. Filing an issue is good hygiene but not a fix path on PL's timeline.
- Caller discipline ("always `git init` the run dir") is a weak mitigation. Operators forget. Automation forgets. Evidence: this very session forgot — see LIVE-NOTES §Workarounds: "For aider path resolution: git init the run dir before invoking PL. **Not yet applied.**"
- The PL runner **can** fix this defensively:
  - Option A (recommended): `hasGitRepo(cwd)` walks ancestors; if a parent `.git` exists but `cwd` is not itself the repo root, pass `--subtree-only` in addition to the existing flags. (aider supports `--subtree-only` to constrain repo operations to a subdirectory.)
  - Option B: automatically `git init` an ephemeral repo at `cwd` before invoking aider and `.gitignore` everything (or use `GIT_DIR=<tmp>` / `GIT_WORK_TREE=cwd`). Higher blast radius; it pollutes the cwd with a `.git` directory.
  - Option C: reject the run with a preflight error when `cwd` is inside an ancestor git repo and not itself the root. Fail loud. Forces caller discipline.

### Blast radius

- Any invocation of `ci --runner aider` with a cwd **inside** another git repo, when that cwd is itself not a git repo.
- This is the default layout for the experiments directory (`C:\Projects\prompt-language\experiments\...\runs\...`). Every rescue-viability run, every E-SMALL real-PL cell on this host, every phase-2 rigor cell that lives under the PL repo tree is exposed unless the caller manually `git init`s the run dir.
- Every downstream aider-produced file is at risk of silently landing in the wrong location (or aider re-reading stale files from the parent repo as "chat context").
- Secondary effect: the verify.js oracle then runs in the "correct" cwd and sees no file → `VERDICT: FAIL` with a misleading cause signature ("model didn't produce code" when in reality "file landed elsewhere"). This muddies measurement materially — suspected contributor to some Phase-1/E-SMALL "model emitted nothing" classifications.

### Proposed fix sketch

Option A (recommended):

1. Replace `hasGitRepo(cwd)` with `findGitRoot(cwd): string | undefined` that walks from `cwd` upward until it finds `.git` or reaches a filesystem root.
2. In `buildAiderArgs`, use three-state logic:
   - cwd is repo root → no `--no-git`, no `--subtree-only`.
   - cwd is inside a parent repo but not root → pass `--no-git` **and** `--subtree-only` (or equivalently set `--no-git` and also set env `GIT_CEILING_DIRECTORIES=<cwd>` to prevent aider's git discovery from climbing).
   - cwd has no git ancestor → current behavior (`--no-git` alone).
3. Consider setting `GIT_CEILING_DIRECTORIES=<parentOf(cwd)>` in `buildAiderEnv` as a belt-and-braces measure independent of the argv flag. This is a clean, aider-version-agnostic way to stop git-root discovery from escaping the run directory.

Risk assessment:

- Option A (2) correctness risk: `--subtree-only` semantics may not perfectly isolate path resolution in all aider versions. Feature-detect or fall back on A(3).
- Option A (3) env-based fix: low risk, documented git behavior, independent of aider version. **Preferred**. Minimal diff: one line added to `buildAiderEnv`. Does not affect existing tests beyond the env assertion.
- Option B (auto git init): medium-high risk. Pollutes cwd. Rejected.
- Option C (fail-fast preflight): low risk but bad UX for the common case (experiments/\*\* is always inside the PL repo). Use as a belt over the braces: warn-only mode, not fail-fast.

### Regression tests (must merge before fix)

- Unit: `findGitRoot` walks ancestors, returns parent `.git` path when present, returns undefined at filesystem root.
- Unit: `buildAiderArgs` → when `cwd` is a nested subdir of an ancestor with `.git`, argv includes both `--no-git` and `--subtree-only` (or the chosen equivalent).
- Unit: `buildAiderEnv` → when run in nested-subdir mode, `GIT_CEILING_DIRECTORIES` is set to the parent of `cwd` (platform-correct path separator).
- Unit: existing "omits --no-git when cwd is a git workspace" test (`aider-prompt-turn-runner.test.ts:61-72`) must continue to pass.
- Integration: spawn aider against a temp cwd nested inside a parent `.git`; assert aider's stdout banner reports `Git working dir: none` or the run cwd, not the parent. Gate on `AIDER_E2E=1` env so CI without aider installed can skip.

---

## Priority ordering

1. **Defect B first.** It is cheaper, more local, strictly in PL's remit, and its _silent_ corruption of output location is worse for experimental integrity than Defect A's _loud_ timeout. Defect B silently moves the failure signal; Defect A at least eventually fires a timeout. The `GIT_CEILING_DIRECTORIES` env fix is a ~5-line diff with minimal risk and directly protects every experiment under `experiments/**`. Attack this one today.
2. **Defect A second** and only in the PL-mitigation sense: add the inner turn timeout + transient classification. Do not attempt to fix root cause upstream from inside PL. File an aider/litellm issue separately for the retry-storm behavior. Accept that on this host, Ollama-side instability and litellm's infinite retry are a systemic cost you cannot eliminate from the runner.

Rationale: B is a measurement-integrity defect (we cannot trust experimental results until it is fixed); A is a measurement-cost defect (runs take longer and fail noisily, but fail recognizably). In the order "trust first, cost second", B wins.

## Cross-reference notes

- **Relation to the originally-filed P1 pair (`prompt-qtn7`, `prompt-khm1`)**:
  - `prompt-qtn7` (xterm-256color crash on 2nd aider invocation) is partially mitigated by `TERM=dumb` in `buildAiderEnv` (`aider-prompt-turn-runner.ts:63-65`). Needs a follow-up verification that the mitigation holds under the new multi-turn flows and its regression test is pinned (`aider-prompt-turn-runner.test.ts:94-104` exercises the env var only, not end-to-end second-invocation behavior). Still live in `LOCAL-MODEL-VIABILITY-FINDINGS.md` §5.
  - `prompt-khm1` (prompt nodes marked `completed` at dispatch) is _not_ addressed by the aider runner — it lives in the flow executor / session-state layer and is out of scope for this triage. If it is still unfixed, it compounds Defect B: even if files land in the wrong dir, prompt nodes still mark complete and the gate-loop cannot tell.

- **LIVE-NOTES §Open bugs also names a gate-evaluator defect** ("`file_exists '.next/BUILD_ID'` is false 50 times in a row while the file exists on disk"). Likely the _same class_ of cwd/path-resolution issue as Defect B, but in the gate evaluator rather than the runner. Fixing Defect B in the runner does not automatically fix it in the gate evaluator — they must be attacked together if the user-visible symptom ("gates don't see files that exist") is to go away.

- **SCORECARD.md** narrative scoring (PL 6-Solo 0-Tie 3) predates the live repro and is already downgraded to informal evidence by the methodology scrutiny in EVIDENCE-CONSOLIDATION §3. Defect B retroactively threatens the validity of any Phase-1 cell whose workspace lived inside the PL repo (most of them); it does not flip scores but lowers confidence further.

## Quality score rationale

- Correctness risk (runner): Medium-high — Defect B silently corrupts output location, Defect A silently consumes wall-clock budget. Both reduce trust in experimental results more than in shipped production quality.
- Maintainability: runner is small (209 lines) and well-tested for happy paths. Gaps: no test covers nested-git-subtree cwd; no test covers transient-network-error classification; timeout path collapses too many failure modes.
- Debt posture: fix Defect B now (cheap, high-value). Live with Defect A's root cause; mitigate in PL only (inner timeout + transient classification). Escalate aider/litellm upstream asynchronously.

## Minimum output skeleton artifacts

- Findings: §A, §B, priority ordering.
- Structured outputs: reproducer commands, code locations, blast radius, fix options with risk, regression tests.
- Evidence / confidence: High for both defects (live repro, banner + audit.jsonl captures). B's silent-path behavior needs one confirmatory probe to nail exact semantics before fix.
- Assumptions: aider 0.86.2 upstream behavior on `--no-git` + nested git subtree is as described in LIVE-NOTES. Needs a 5-min direct probe before patching to confirm which of `--subtree-only`, `GIT_CEILING_DIRECTORIES`, or both is the right lever.
- Open questions: (a) is the opencode+aider concurrency on Ollama the definitive trigger for Defect A, or is model-swap thrash alone sufficient? (b) does Defect B also occur when `cwd` _is_ a git repo but differs from the aider-assumed repo-root? (c) is `prompt-khm1` still live?
- Recommended next skill: `rework-plan-writer` to convert this triage into an owner/sequence/closure-criteria plan, and `test-oracle-writer` for the regression tests before any code change lands.
