# H11 Phase-5 Gate-Loop Follow-up

Runner: `aider`
Model: `ollama_chat/qwen3-opencode:30b`
Host: Windows with local Ollama

This phase tested whether a narrower H11 follow-up could finish the remaining
runtime repair after the phase-4 scoping fix.

## What changed in the flow

- Added `check-seed-contract.js` and a late seed-contract gate.
- Tightened the `src/app.js` integration repair prompt so it had to preserve
  the fixture's original CommonJS smoke-test shape instead of inventing an
  Express server.

## Rerun

- artisan-v5:
  [summary](artisan-v5/summary.json),
  [stderr](artisan-v5/pl.stderr.txt),
  [oracle](artisan-v5/verify.txt)

## Outcome

- Phase-4 runtime-scoped `artisan-v4`: `10/12 passed; 2 failed`
- Phase-5 `artisan-v5`: `8/11 passed; 3 failed`

The targeted seed gate did help narrow the shape of the error, but it did not
turn the arm into a winner:

- `src/seed.js` stayed clean and no longer failed on the earlier `Client is not defined`
  problem.
- The final oracle still failed.
- `README.md` regressed back to unresolved `Contact` mentions.
- `src/app.js` still drifted enough to fail at runtime with
  `ClientStore is not a constructor`.

## Main read

This is negative evidence against another round of content-only H11 flow tweaks.
The remaining failure mode is now the broad completion-gate repair loop itself.
Even after adding narrower mid-flow repairs, the generic `h11_oracle` retries
still had enough freedom to reintroduce unrelated regressions.
