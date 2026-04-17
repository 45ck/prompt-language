# 2026-04-17 Local Qwen3 Opencode 30B Follow-up

Runner: `aider`
Model: `ollama_chat/qwen3-opencode:30b`
Host: Windows with local Ollama

## Harness note

The first in-repo reruns were confounded because the aider adapter did not pass `--no-git` for nested fixture workspaces, so aider could inherit the outer repo root. The adapter was fixed and the results below are from clean reruns in temp workspaces outside the repo.

## Clean reruns

- H11 baseline PL flow: [summary](h11-phase2-fixed/baseline/summary.json), [report](h11-phase2-fixed/baseline/pl.report.json), [oracle](h11-phase2-fixed/baseline/verify.txt)
- H11 artisan PL flow: [summary](h11-phase2-fixed/artisan/summary.json), [report](h11-phase2-fixed/artisan/pl.report.json), [oracle](h11-phase2-fixed/artisan/verify.txt)
- H11 swarm PL flow: [summary](h11-phase2-fixed/swarm/summary.json), [report](h11-phase2-fixed/swarm/pl.report.json), [oracle](h11-phase2-fixed/swarm/verify.txt)
- H14 TDD PL flow: [summary](h14-tdd-fixed/pl/summary.json), [report](h14-tdd-fixed/pl/pl.report.json), [oracle](h14-tdd-fixed/pl/verify.txt)

## Outcomes

- H11 baseline still failed badly: `2/11 passed; 9 failed`.
- H11 artisan materially improved the result: `8/11 passed; 3 failed`.
- H11 swarm did not help on this fixture: `2/11 passed; 9 failed`.
- H14 still failed under the stricter oracle, but the outcome improved materially: `7/8 passed; 1 failed`.

## Main read

- The runtime-side prompt lifecycle fix is landed and repo CI is green.
- The aider adapter now scopes nested non-git workspaces correctly with `--no-git`.
- The strongest new signal is H11 artisan. Per-file gating plus repeated oracle pressure moved the local 30B model from a near-total miss to a mostly-correct rename.
- The remaining H11 artisan failures were specific and concrete: README text was not renamed, and the JS rename left `Client` undefined in `contact-store.js`, which broke runtime/import verification.
- Swarm did not beat baseline here. Role separation by itself was not enough to recover the task.
- H14 should not be judged by `file_exists` alone. After replacing the weak completion condition with `gate h14_oracle: node verify.js`, the model got most of the way there but still shipped failing tests.

## Practical next steps

- Treat H11 artisan as the best current evidence for the thesis: handcrafted gated orchestration can materially improve a local 30B model on a realistic multi-file refactor.
- Add a README-specific repair step and a stricter post-rename integration repair loop to the artisan flow, then rerun H11.
- Keep H14 on the oracle gate and tighten the red-green loop until the final failing test is fixed, rather than allowing any file-exists completion condition back in.
- Do not invest further in the current H11 swarm variant until it shows a measurable gain over baseline or artisan.
