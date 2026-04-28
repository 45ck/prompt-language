# 2026-04-28 Local Model Experiments

Host: Windows local Ollama
Primary model: `ollama_chat/qwen3-opencode-big:30b`

## Summary

The local-model results are mixed but useful:

- H15 produced a clean PL win: solo reached `6/10`; PL reached `10/10`.
- H11 shows high variance at the current task size. PL can repair to `11/11`, but first-turn timeout/no-capture failures still happen.
- H12/H14 ad hoc suite results were partially contaminated by launcher/cwd problems. Clean harnessed reruns show H12 tied at `8/9`, while H14 favored solo.
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
| H12 clean rerun `20260428-131425` | solo | `8/9` | exit 0, `111s` | Real edit; same apostrophe-name failure. |
| H12 clean rerun `20260428-131425` | PL | `8/9` | exit 0, `811s` | Real edit; same failure at much higher cost. |
| H14 clean rerun `20260428-133224` | solo | `8/8` | exit 0, `241s` | Clean solo pass. |
| H14 clean rerun `20260428-133224` | PL | `6/8` | exit 1, `1282s` | TDD flow failed to converge. |

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

The clean H12/H14 reruns are the counterweight. H12 tied while PL was much slower, and H14 favored solo. This means the work is not just "wrap everything in PL"; the flow has to fit the task. Over-staging can make local models slower and less reliable.

H14's failure mode was specific enough to act on: the PL-written tests called `mergeDuplicates` without importing it, and the implementation removed duplicate emails without merging fields. The H14 flow has been revised to require the import, assert field-merge semantics, and run an oracle-fed repair loop before the final gate.

The first revised H14 rerun (`20260428-142641`) improved the PL arm from `6/8` to `7/8`, but did not pass. It fixed the missing import and incomplete field merge; the remaining failure came from interpreting "newer" via `createdAt` rather than later input order. The fixture now states that later input records define priority, and a clean rerun is still pending.

The main local-model limit is not just intelligence. It is also capture reliability and latency. H11 failures often happened before edits were captured, so they should be classified separately from genuine task-solution failures.

For smaller local models, R9 shows that verifier-grounded review can identify defects, but identifying the defect is not enough. The repair prompt must make the root cause and minimal diff unavoidable, or the 8B model repeats the same structural parsing bug.

## Next

1. Rerun H14 after the input-order priority clarification and compare against the clean solo baseline.
2. Add an R9-F repair prompt that includes full verifier stdout, asks for a one-line root cause, then requests a minimal diff.
3. Split H11's first PL prompt into smaller file groups or raise the first-turn timeout, then rerun with the new no-edit classification.
4. Use bead `prompt-language-lghe` to design a senior-engineer criteria-ranking PL program and test it against plain persona prompting on non-coding decision scenarios.
