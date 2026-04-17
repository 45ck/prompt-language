# 2026-04-17 Local Qwen3 Opencode 30B Follow-up

Runner: `aider`
Model: `ollama_chat/qwen3-opencode:30b`
Host: Windows with local Ollama

## Harness note

The first in-repo reruns were confounded because the aider adapter did not pass `--no-git` for nested fixture workspaces, so aider could inherit the outer repo root. The adapter was fixed and the results below are from clean reruns in temp workspaces outside the repo.

## Clean reruns

- H11 baseline PL flow: [summary](h11-phase2-fixed/baseline/summary.json), [report](h11-phase2-fixed/baseline/pl.report.json), [oracle](h11-phase2-fixed/baseline/verify.txt)
- H11 artisan PL flow: [summary](h11-phase2-fixed/artisan/summary.json), [report](h11-phase2-fixed/artisan/pl.report.json), [oracle](h11-phase2-fixed/artisan/verify.txt)
- H11 artisan-v2 PL flow: [summary](h11-phase2-fixed/artisan-v2/summary.json), [report](h11-phase2-fixed/artisan-v2/pl.report.json), [oracle](h11-phase2-fixed/artisan-v2/verify.txt)
- H11 swarm PL flow: [summary](h11-phase2-fixed/swarm/summary.json), [report](h11-phase2-fixed/swarm/pl.report.json), [oracle](h11-phase2-fixed/swarm/verify.txt)
- H14 TDD PL flow: [summary](h14-tdd-fixed/pl/summary.json), [report](h14-tdd-fixed/pl/pl.report.json), [oracle](h14-tdd-fixed/pl/verify.txt)

## Phase-3 portable reruns

- Phase summary: [H11 portable README](h11-phase3-portable/README.md)
- H11 portable baseline: [summary](h11-phase3-portable/baseline/summary.json), [report](h11-phase3-portable/baseline/pl.report.json), [oracle](h11-phase3-portable/baseline/verify.txt)
- H11 portable artisan: [summary](h11-phase3-portable/artisan/summary.json), [report](h11-phase3-portable/artisan/pl.report.json), [oracle](h11-phase3-portable/artisan/verify.txt)
- H11 portable artisan-v2: [summary](h11-phase3-portable/artisan-v2/summary.json), [report](h11-phase3-portable/artisan-v2/pl.report.json), [oracle](h11-phase3-portable/artisan-v2/verify.txt)
- H11 portable swarm: [summary](h11-phase3-portable/swarm/summary.json), [report](h11-phase3-portable/swarm/pl.report.json), [oracle](h11-phase3-portable/swarm/verify.txt)
- H11 exploratory artisan-v3: [summary](h11-phase3-portable/artisan-v3/summary.json), [report](h11-phase3-portable/artisan-v3/pl.report.json), [oracle](h11-phase3-portable/artisan-v3/verify.txt)
- H11 exploratory artisan-v4: [summary](h11-phase3-portable/artisan-v4/summary.json), [stderr](h11-phase3-portable/artisan-v4/pl.stderr.txt), [oracle](h11-phase3-portable/artisan-v4/verify.txt)

## Outcomes

- H11 baseline still failed badly: `2/11 passed; 9 failed`.
- H11 artisan materially improved the result: `8/11 passed; 3 failed`.
- H11 artisan-v2 completed without the earlier aider deadlock, but the flow quality regressed badly: `2/11 passed; 9 failed`.
- H11 swarm did not help on this fixture: `2/11 passed; 9 failed`.
- H14 still failed under the stricter oracle, but the outcome improved materially: `7/8 passed; 1 failed`.
- H11 portable baseline stayed at `2/11 passed; 9 failed`.
- H11 portable artisan improved again to `10/11 passed; 1 failed`.
- H11 portable artisan-v2 recovered from the earlier broken loop but still landed at only `5/11 passed; 6 failed`.
- H11 portable swarm stayed at `2/11 passed; 9 failed`.
- The exploratory README-targeted follow-ups did not beat the winning artisan arm: `artisan-v3` fell to `3/11`, and `artisan-v4` reached `5/11`.

## Main read

- The runtime-side prompt lifecycle fix is landed and repo CI is green.
- The aider adapter now scopes nested non-git workspaces correctly with `--no-git`, forces fully non-interactive confirmations with `--yes-always`, and disables aider auto-lint to avoid hanging inside local eval runs.
- The strongest current signal is H11 portable artisan. Portable per-file gating plus repeated oracle pressure moved the local 30B model from a near-total miss to `10/11` on a realistic multi-file rename.
- In the earlier phase-2 clean reruns, the remaining H11 artisan failures were specific and concrete: README text was not renamed, and the JS rename left `Client` undefined in `contact-store.js`, which broke runtime/import verification.
- The portable fixture changes mattered. Replacing Unix-only shell commands with Node helper scripts and tightening the oracle scope removed avoidable Windows/runtime confounders from the H11 evaluation.
- H11 artisan-v2 was useful as a runtime check, not as a better flow. After removing the broken file-discovery path, it improved to `5/11`, but it still did not beat the original artisan pattern.
- Swarm did not beat baseline here. Role separation by itself was not enough to recover the task.
- The two README-targeted follow-ups (`artisan-v3`, `artisan-v4`) regressed. They do not replace the winning artisan flow and are better read as evidence of aider repair-turn scoping fragility than as a better orchestration pattern.
- H14 should not be judged by `file_exists` alone. After replacing the weak completion condition with `gate h14_oracle: node verify.js`, the model got most of the way there but still shipped failing tests.

## Practical next steps

- Treat H11 portable artisan as the best current evidence for the thesis: handcrafted gated orchestration can materially improve a local 30B model on a realistic multi-file refactor.
- Keep the original portable H11 artisan flow as the current best arm. The `artisan-v2`, `artisan-v3`, and `artisan-v4` variants are useful comparison points, but none is an improvement.
- If H11 gets another pass, prefer diagnosing aider repair-turn scoping or no-op detection rather than adding more prompt structure around README cleanup.
- Keep H14 on the oracle gate and tighten the red-green loop until the final failing test is fixed, rather than allowing any file-exists completion condition back in.
- Do not invest further in the current H11 swarm variant until it shows a measurable gain over baseline or artisan.
