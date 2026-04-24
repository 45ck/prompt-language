# H11 Phase-6 Context-Controlled Pilots

Runner: `aider`
Host: Windows with local Ollama
Date: 2026-04-24

This phase tested whether H11 is ready for a corrected `k>=3` rerun after the
R3 synthesis. It is not a claim-grade bundle. It is a harness/oracle pilot that
decides whether the expensive repeated series should start.

## What Changed

- Added a reusable PowerShell harness:
  `experiments/aider-vs-pl/scripts/run-h11-context-controlled.ps1`.
- Changed the H11 oracle denominator to a fixed `11` checks by scoring only the
  declared source surface:
  `src/app.js`, `src/contact-store.js`, `src/contact.js`, `src/routes.js`,
  `src/seed.js`, `src/test.js`, and `README.md`.
- Added an unexpected-JS-file check under the existing import-resolution
  assertion so nested files such as `src/src/seed.js` fail without changing the
  denominator.
- Captured per-cell manifests, runner stdout/stderr, verifier stdout/stderr,
  fixture hashes, and `ollama ps` samples.

Workspaces are intentionally ignored by this result directory's `.gitignore` to
avoid committing nested git repositories. The committed evidence is the
manifest/log/oracle layer.

## Pilots

| Run | Arm | Model | Flow / prompt | Timeout | Result | Interpretation |
| --- | --- | --- | --- | --- | --- | --- |
| `20260424-152706` | solo | `ollama_chat/qwen3-opencode:30b` | `TASK.md`, explicit file args | 1200s | 2/11, no timeout | Context alone did not rescue solo. |
| `20260424-152706` | PL | `ollama_chat/qwen3-opencode:30b` | `task-artisan.flow` | 1200s | 7/11, timeout | PL improves pass count but does not complete inside the bound. |
| `20260424-155554` | PL | `ollama_chat/qwen3-opencode-big:30b` | `task-artisan-v5.flow` | 1800s | 6/11, timeout | Bigger context plus tighter v5 flow did not stabilize completion. |

## Decision

Do not start a `k>=3` H11 series yet.

The corrected precondition is: one PL pilot must complete within the declared
timeout and produce a comparable fixed-denominator score. Both phase-6 PL pilots
timed out. Launching repeated arms now would mostly measure timeout behavior and
flow drift, not model-vs-orchestration reliability.

## Next Technical Step

Fix the H11 flow termination shape before more compute:

- Prefer a shorter `task-artisan`-style flow over broad late repair loops.
- Keep the fixed-denominator oracle.
- Add a targeted termination gate that runs `node verify.js` earlier and exits
  decisively instead of continuing broad repair after partial success.
- Once a PL pilot completes inside timeout, run a counterbalanced repeated
  series with fresh fixture copies for every cell.
