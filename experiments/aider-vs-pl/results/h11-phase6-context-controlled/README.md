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
- Added `task-artisan-v6.flow`, a compact oracle-first PL flow.
- Split the whole-cell timeout from the per-aider-turn timeout in the H11
  harness and enabled `PROMPT_LANGUAGE_AIDER_SCOPED_MESSAGE=1` for this
  controlled H11 arm so aider receives the active task prompt rather than the
  full rendered PL envelope.

Workspaces are intentionally ignored by this result directory's `.gitignore` to
avoid committing nested git repositories. The committed evidence is the
manifest/log/oracle layer.

## Pilots

| Run | Arm | Model | Flow / prompt | Timeout | Result | Interpretation |
| --- | --- | --- | --- | --- | --- | --- |
| `20260424-152706` | solo | `ollama_chat/qwen3-opencode:30b` | `TASK.md`, explicit file args | 1200s | 2/11, no timeout | Context alone did not rescue solo. |
| `20260424-152706` | PL | `ollama_chat/qwen3-opencode:30b` | `task-artisan.flow` | 1200s | 7/11, timeout | PL improves pass count but does not complete inside the bound. |
| `20260424-155554` | PL | `ollama_chat/qwen3-opencode-big:30b` | `task-artisan-v5.flow` | 1800s | 6/11, timeout | Bigger context plus tighter v5 flow did not stabilize completion. |
| `20260424-164655` | PL | `ollama_chat/qwen3-opencode-big:30b` | `task-artisan-v6.flow` | 1800s outer / 420s turn | 2/11, no timeout | Compact flow terminated decisively, but the full PL envelope polluted aider file prompting and no authored files changed. |
| `20260424-171124` | PL | `ollama_chat/qwen3-opencode-big:30b` | `task-artisan-v6.flow` with scoped-message opt-in | 1800s outer / 420s turn | 11/11, no timeout | First green H11 PL pilot under the fixed denominator. |

## Decision

The H11-specific precondition for a repeated PL series is now met by
`20260424-171124`: one corrected PL pilot completed within the declared timeout
and passed the fixed-denominator oracle.

Do not promote this to a broad runner-quality claim. The generic
`npm run eval:smoke:aider` check still failed on local-model capture/context
cases in this environment, so the scoped-message behavior remains an explicit
H11 harness opt-in rather than the default aider runner mode.

## Next Technical Step

Run the counterbalanced H11 `k>=3` series only with the corrected controls:

- Use `task-artisan-v6.flow`.
- Keep the fixed-denominator oracle.
- Keep separate outer and per-turn timeouts.
- Keep `PROMPT_LANGUAGE_AIDER_SCOPED_MESSAGE=1` isolated to this H11 harness.
- Preserve fresh fixture copies for every cell.
