# H11 Phase-4 Runtime-Scoped Rerun

Runner: `aider`
Model: `ollama_chat/qwen3-opencode:30b`
Host: Windows with local Ollama

This directory holds the first H11 rerun after the runtime changed aider file
selection to use the active captured prompt (`scopePrompt`) instead of the full
rendered flow envelope.

## What changed in the runtime

- `run-flow-headless` now passes the active prompt turn separately as
  `scopePrompt`.
- `AiderPromptTurnRunner` now uses that scoped instruction for file selection
  while still sending the full envelope to the model.
- Prompt-derived file refs are normalized and constrained to stay inside the
  workspace before they are added to aider chat context.

## Rerun

- artisan-v4 after runtime scoping:
  [summary](artisan-v4/summary.json),
  [stderr](artisan-v4/pl.stderr.txt),
  [oracle](artisan-v4/verify.txt)

## Outcome

- Phase-3 portable `artisan-v4`: `5/11 passed; 6 failed`
- Phase-4 runtime-scoped `artisan-v4`: `10/12 passed; 2 failed`

This is not directly apples-to-apples with the earlier `11`-assertion count,
because the model created an extra nested file `src/src/seed.js`, and the
oracle now checks that file too. Even with that caveat, the shape of the result
changed materially:

- `README.md` now passes.
- The broad late-turn regression across `src/app.js`, `src/routes.js`, and
  `src/test.js` is gone.
- The remaining failures are now runtime/import failures caused by
  `Client is not defined` in `src/seed.js`.

## Main read

The runtime scoping fix validated the H11 hypothesis. The late README-only
repair no longer dragged unrelated source files back into the aider file set
and no longer caused the broad code regression seen in the earlier `artisan-v4`
run. The remaining miss is now a narrower semantic repair problem, not the
previous repair-turn scoping failure.
