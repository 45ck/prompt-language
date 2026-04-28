# 2026-04-28 Local Model Experiments

Host: Windows local Ollama
Primary model: `ollama_chat/qwen3-opencode-big:30b`

## Summary

The local-model results are mixed but useful:

- H15 produced a clean PL win: solo reached `6/10`; PL reached `10/10`.
- H11 shows high variance at the current task size. PL can repair to `11/11`, but first-turn timeout/no-capture failures still happen.
- H12/H14 ad hoc suite results are partially contaminated by launcher/cwd problems and should not be used as claim-grade comparisons.
- R9 qwen3:8b review grounding detects failures reliably, but repair remains unreliable; the earlier `11/11` R9-E run is best treated as an outlier.

## Results

| Experiment | Arm | Result | Runner | Notes |
| --- | --- | --- | --- | --- |
| H11 counterbalanced `20260428-081413` | solo rep1 | `2/11` | exit 0, `974s` | No useful edit application. |
| H11 counterbalanced `20260428-081413` | solo rep2 | `2/11` | exit 0, `421s` | No useful edit application. |
| H11 counterbalanced `20260428-081413` | solo rep3 | `9/11` | exit 0, `357s` | Real edits, failed runtime/import checks. |
| H11 PL `20260428-085319` | PL rep1 | `2/11` | exit 3, `900s` | Prompt turn failed before captured edits. |
| H11 PL `20260428-085319` | PL rep2 | `2/11` | exit 3, `900s` | Prompt turn failed before captured edits. |
| H11 PL `20260428-085319` | PL rep3 | `11/11` | exit 0, `437s` | PL repaired oracle failures to green. |
| R9 qwen3:8b repeats `20260428-094411` | review v4 x3 | `5/11`, `5/11`, `5/11` | exits 1/3/3 | Review catches the bug; 8B repair does not stabilize. |
| H12 `20260428-103200` | solo | `8/9` | exit 0, `89s` | Fails apostrophe-name search. |
| H12 rerun `20260428-104851` | PL | `8/9` | exit 0, `705s` | Same apostrophe-name failure; earlier PL run invalid. |
| H14 `20260428-110105` | solo | `7/8` | exit 0, `253s` | Missing test import. |
| H14 `20260428-110536` | PL | `6/8` | PL gate failure | Missing import plus incomplete merge behavior. |
| H15 `20260428-120933` | solo | `6/10` | exit 0, `417s` | Real edits, verifier failed. |
| H15 `20260428-120933` | PL | `10/10` | exit 0, `494s` | Real edits, verifier passed. |

## Harness Fix

Added `experiments/aider-vs-pl/scripts/run-fixture-pair.ps1` after H12/H14 and the first H15 launch exposed harness reliability issues.

The harness now:

- Runs each arm from a fresh copied fixture workspace.
- Records the exact child-process `cwd` in each manifest.
- Separates outer aider timeout, PL prompt-turn timeout, and verifier timeout.
- Captures stdout/stderr, manifests, scorecard JSON, and scorecard text.
- Records whether the workspace actually changed before verification.
- Always writes a manifest even when a runner errors or times out.

## Interpretation

Prompt Language helps most when the task benefits from staged control: implement, check, repair, and re-run the oracle. H15 is the clean example from today: the same local model failed as a solo one-shot but passed under PL control.

The main local-model limit is not just intelligence. It is also capture reliability and latency. H11 failures often happened before edits were captured, so they should be classified separately from genuine task-solution failures.

For smaller local models, R9 shows that verifier-grounded review can identify defects, but identifying the defect is not enough. The repair prompt must make the root cause and minimal diff unavoidable, or the 8B model repeats the same structural parsing bug.

## Next

1. Rerun H12/H14 only through `run-fixture-pair.ps1` or a derived harness with the same cwd/manifest guarantees.
2. Add an R9-F repair prompt that includes full verifier stdout, asks for a one-line root cause, then requests a minimal diff.
3. Split H11's first PL prompt into smaller file groups or raise the first-turn timeout, then rerun with the new no-edit classification.
4. Use bead `prompt-language-lghe` to design a senior-engineer criteria-ranking PL program and test it against plain persona prompting on non-coding decision scenarios.
