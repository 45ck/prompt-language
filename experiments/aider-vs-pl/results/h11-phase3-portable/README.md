# H11 Phase-3 Portable Reruns

Runner: `aider`
Model: `ollama_chat/qwen3-opencode:30b`
Host: Windows with local Ollama

This directory holds the portable reruns for H11 after replacing Unix-only
shell commands in the fixture with Node-based helpers and tightening the oracle
scope so helper scripts and tool transcripts do not contaminate the score.

## Fixture changes behind this phase

- Replaced `grep`/`find` usage in the H11 flows with `node list-contact-targets.js`,
  `node count-contact.js`, and `node find-contact-stragglers.js`.
- Changed straggler checks to branch on command exit codes instead of comparing
  multiline stdout.
- Scoped `verify.js` to `src/**/*.js` plus `README.md` so local helper scripts
  do not inflate the result.

## Main portable reruns

- baseline: [summary](baseline/summary.json), [report](baseline/pl.report.json), [oracle](baseline/verify.txt) -> `2/11 passed`
- artisan: [summary](artisan/summary.json), [report](artisan/pl.report.json), [oracle](artisan/verify.txt) -> `10/11 passed`
- artisan-v2: [summary](artisan-v2/summary.json), [report](artisan-v2/pl.report.json), [oracle](artisan-v2/verify.txt) -> `5/11 passed`
- swarm: [summary](swarm/summary.json), [report](swarm/pl.report.json), [oracle](swarm/verify.txt) -> `2/11 passed`

## Exploratory follow-ups

- artisan-v3: [summary](artisan-v3/summary.json), [report](artisan-v3/pl.report.json), [oracle](artisan-v3/verify.txt) -> `3/11 passed`
- artisan-v4: [summary](artisan-v4/summary.json), [stderr](artisan-v4/pl.stderr.txt), [oracle](artisan-v4/verify.txt) -> `5/11 passed`

These two follow-up arms were not improvements. Both were attempts to push the
winning artisan pattern over the last README-only failure. Both regressed, and
neither should replace the original portable artisan arm as the current best
result.

## Main read

- The portable fixture changes were worth it. They removed shell portability and
  oracle-hygiene confounders from the H11 flow runs.
- The strongest current H11 result is still the original artisan arm at `10/11`.
  The only remaining oracle failure in that run is `README.md`.
- `artisan-v2` improved over the earlier broken `2/11` result but still
  underperformed the original artisan arm.
- `swarm` remained at baseline quality on this fixture.
- The README-targeted follow-ups (`artisan-v3`, `artisan-v4`) regressed. The
  likely issue is repair-turn scoping fragility in aider after the code path has
  already drifted, not a new winning flow pattern.

## Practical conclusion

For H11, the evidence now supports a narrow claim: portable per-file gating plus
integration/oracle pressure materially improves the 30B local model, but the
winning pattern is still the original artisan flow, not the later README-repair
variants.
