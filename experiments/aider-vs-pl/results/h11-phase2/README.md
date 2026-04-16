# H11 Phase-2 Result (Contact to Client rename, k=1)

This directory holds the first phase-2 rigor-artifact run of hypothesis H11
(multi-file refactor: rename `Contact` to `Client` across a small CommonJS
codebase). It is explicitly a **k=1** run, produced to exercise the manifest
and scorecard scaffolding described in `experiments/aider-vs-pl/phase2-design.md`
and to create reproducible artifacts that were missing from phase-1 per
`docs/security/aider-vs-pl-scrutiny.md`.

## What was run

- **Fixture**: `experiments/aider-vs-pl/fixtures/h11-multi-file-refactor/`
  - Pre-declared (committed before this run). sha256 of tarred fixture:
    `37a6b0bff7a1ee7d7a15f22f7b6eaca5c410377d38c81c7bac86624f44492503`.
- **Model**: `ollama_chat/qwen3-opencode:30b`
  - ollama blob sha256: `58574f2e94b99fb9e4391408b57e5aeaaaec10f6384e9a699fc2cb43a5c8eabf`
- **Aider**: 0.86.2
- **PL commit**: `9882c56d62e18b505382a4c5b84a81e9c14795da`
- **Host**: Windows 11, Python 3.12, Node 25.x, Git-bash
- **Oracle**: `verify.js` (12 assertions). Exit 0 = all pass.

### Solo cell (`./solo/`)

Command:

```
python -m aider \
  --model ollama_chat/qwen3-opencode:30b \
  --no-auto-commits --no-stream --yes --no-show-model-warnings \
  --no-git --no-check-update \
  --map-tokens 0 --edit-format whole \
  --message "$(cat TASK.md)"
```

No files were added to the aider chat. Aider responded asking for files and
produced no edits.

### PL cell (`./pl/`)

Command:

```
TERM=dumb PYTHONUTF8=1 OLLAMA_API_BASE=http://127.0.0.1:11434 \
  prompt-language ci --runner aider --file task.flow
```

The native PL runner (`ci --runner aider`) was used. **No fallback was
needed.** The runner parsed `task.flow`, resolved `let files = run ...`,
entered the `foreach` block, and drove aider per node. Full aider transcript
is at `./pl/aider-chat-history.md`; the PL CLI envelope is at
`./pl/transcript.log` (only two lines, since the runner emits a terse status
summary).

## Results

| Cell | verify_pass | verify_fail | wall_ms | notes |
| --- | --- | --- | --- | --- |
| solo | 2 | 10 | 393,723 | aider asked for files; no edits made |
| pl   | 3 | 9  | 584,355 | aider edited `src/app.js` (broke import syntax); other files untouched |

Delta: **pl - solo = +1 test passing**. wall_ratio = pl/solo = 1.484 (PL is
~48 % slower in wall clock).

**Winner**: `pl` by a 1-test margin on the declared oracle.

The combined scorecard is at `./scorecard.json`.

## Artifact layout

```
results/h11-phase2/
  README.md                  this file
  scorecard.json             combined cross-cell summary
  solo/
    run-manifest.json        versions, hashes, command line, timings
    verify-output.json       verify.js passed/failed/exit/stdout/stderr
    transcript.log           raw aider stdout+stderr
    verify-stdout.txt        raw verify.js stdout
    verify-stderr.txt        raw verify.js stderr
    workspace/               full working copy after the run
  pl/
    run-manifest.json
    verify-output.json
    transcript.log           PL ci envelope
    aider-chat-history.md    full aider chat history across all flow nodes
    verify-stdout.txt
    verify-stderr.txt
    workspace/
```

## Does this satisfy the §3a rules listed in `docs/security/aider-vs-pl-scrutiny.md`?

**No, not all of them.** This run is an honest k=1 scaffolding pass, not a
claim-eligible verdict. Status per the 10-question rubric in the scrutiny doc:

| # | Rubric item | This run |
| --- | --- | --- |
| 1 | Tasks declared before running | **YES**. `TASK.md`, `task.flow`, and `verify.js` are pre-committed at a SHA earlier than this run's commit. Fixture tarball sha256 is recorded in the manifest. |
| 2 | Scorer blinded | **NO**. The scorer (this agent) ran both cells and authored the scorecard in the same session. No workspace anonymisation, no label stripping. |
| 3 | Reviewer independence (cross-family reviewer) | **NO**. No cross-family reviewer was invoked. |
| 4 | Objective oracle | **YES (partial)**. `verify.js` exit code and a 12-assertion breakdown are captured verbatim in `verify-output.json`. Raw stdout/stderr are committed. |
| 5 | Sample size / variance | **NO**. `runs_per_cell: 1`. The 1-test margin is inside the plausible variance of a 30B local model under Qwen3 MoE routing. A k>=3 rerun could plausibly invert the winner. |
| 6 | Counterbalance / order effects | **NO**. Solo ran first, PL second. No randomised order, no cache/context reset beyond a fresh temp work dir. |
| 7 | Reproducibility | **YES (partial)**. aider version, ollama model blob sha, PL commit, fixture tarball sha, command line, wall-clock ms, and env vars are all recorded in the per-cell manifest. Missing: signed attestation. |
| 8 | Tie semantics | **YES**. `scorecard.json` declares `tie_semantics` explicitly (`verify_pass equal within 0 tests`). Not applicable here since pl > solo by 1. |
| 9 | Adjudication provenance (signed bundle) | **NO**. Scorecard JSON is committed but not signed via the trusted-signers path. |
| 10 | §3a claim-eligible | **NO**. Rules 1 (trace chain), 2 (preflight envelope), 3 (verify-trace), 4 (cross-family reviewer), 5 (signed attestation) - none of the five §3a gates are invoked. |

So: **rules 1, 4, 7, 8 are satisfied; rules 2, 3, 5, 6, 9, 10 are not**. This
run is a rigor-scaffolding pass, not a claim. It should be cited as "phase-2
pilot, k=1, not §3a-eligible" in any program-status update.

## Known result contamination (worth fixing for k>=3 reruns)

- `verify.js` scans all `.js` and non-`TASK.md` `.md` files in the workspace,
  including aider's side-effect files (`.aider.chat.history.md`). Solo's
  transcript happens to avoid the pattern `\bContact\b` because aider never
  echoed code; PL's `.aider.chat.history.md` contains 14 "Contact" matches
  from the rendered flow context aider was shown. This is a **scoring
  contamination** in both cells but especially for PL: the flow text itself
  mentions "Contact" and ends up in aider's transcript file, which `verify.js`
  then flags as a failure. Recommended fix for the fixture before k>=3: add
  `.aider*` to the ignore list inside `verify.js` or exclude hidden files.
- PL's edit to `src/app.js` introduced ES-module `import` syntax in a
  CommonJS project (`package.json` has `"type": "commonjs"`). This broke the
  "Application runs" and "All imports resolve" oracles even though the
  Contact-absence oracle passed for that file. A stronger phase-2 design
  would include a pre-run `run: node src/app.js` snapshot so we can
  attribute regressions correctly.

## Reproducing

```
git -C C:/Projects/prompt-language checkout 9882c56d62e18b505382a4c5b84a81e9c14795da
cd /tmp && rm -rf h11-solo h11-pl
cp -r C:/Projects/prompt-language/experiments/aider-vs-pl/fixtures/h11-multi-file-refactor h11-solo
cp -r C:/Projects/prompt-language/experiments/aider-vs-pl/fixtures/h11-multi-file-refactor h11-pl

# Solo
cd /tmp/h11-solo
PYTHONUTF8=1 OLLAMA_API_BASE=http://127.0.0.1:11434 python -m aider \
  --model ollama_chat/qwen3-opencode:30b \
  --no-auto-commits --no-stream --yes --no-show-model-warnings \
  --no-git --no-check-update --map-tokens 0 --edit-format whole \
  --message "$(cat TASK.md)"
node verify.js

# PL
cd /tmp/h11-pl
TERM=dumb PYTHONUTF8=1 OLLAMA_API_BASE=http://127.0.0.1:11434 \
  C:/Projects/prompt-language/bin/cli.mjs ci --runner aider --file task.flow
node verify.js
```
