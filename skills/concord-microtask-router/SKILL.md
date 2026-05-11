---
name: concord-microtask-router
description: Route clearly-specified single-function implementation tasks to a local Ollama model (qwen3-coder:30b or equivalent) to save frontier API output tokens. Falls back to frontier on oracle fail. Use ONLY for single-function tasks with a deterministic test; do NOT use for multi-file refactors, debugging existing code, or app-build orchestration.
status: experimental — based on 2026-05-11 micro-task pilot; not yet validated at scale
---

# Concord Microtask Router

Route narrow code-generation tasks to a local model when both apply:

1. The ask fits in **≤100 tokens of prompt** (function signature +
   short English description)
2. A **deterministic oracle** exists or can be cheaply written (test
   cases or property check)

Outside that scope this skill does NOT save tokens — see
[Boundaries](#boundaries) below.

## When to invoke

User asks for a single small implementation that meets all of:

- One function (one file, one export)
- Pure-ish (no shared mutable state with other code)
- Specifiable in a few sentences (no implicit project context, no
  caller-specific identifiers from across the repo)
- Testable with a small number of input/output pairs

Examples that fit:
- "Write a `function chunk(arr, size)` that splits arr into
  consecutive groups of size."
- "Implement `function applyDiscountTier(cartTotal, tiers)` where
  tiers is `[[minTotal, percentOff], ...]` sorted ascending."
- "Write `function parseQuery(qs)` that parses a URL query string."

Examples that do NOT fit:
- "Refactor the auth middleware in src/auth/ to use JWTs."
- "Find why this test is failing and fix it."
- "Add a new feature to the dashboard."
- "Build a small CRUD app." (use frontier-only — see prior TODO CLI
  pilot finding)

## How it works

Routing is local-first with a single fallback to frontier on oracle
failure:

1. Read the task spec (signature + 1-3 line description).
2. Send it to local Ollama via `POST /api/generate` with a strict
   prompt template (no commentary, no fences, just the function
   declaration).
3. Extract the function code, write to a temp file.
4. Run the oracle (the user-provided test or property check).
5. If oracle passes → return the local code as the answer. **No
   frontier output tokens spent.**
6. If oracle fails → fall back to frontier (Claude/GPT) for the
   implementation. Local tokens are wasted GPU time only.

Reference implementation: see the runner pattern in
`experiments/concord-vho-microtask-cost/2026-05-11/runner.mjs`.

## Boundaries (do NOT use outside these)

- **Not for multi-file changes.** Local model has no project
  context.
- **Not for debugging.** Local can't read existing code well enough
  to localise bugs.
- **Not for app-build orchestration.** The 2026-05-11 TODO CLI
  pilot showed scaffolding cost makes hybrid 2-3× *more* expensive
  than frontier-only at app-build scope. Frontier-write the whole
  app.
- **Not for security-sensitive code.** Local model has weaker
  knowledge of latest CVEs and language gotchas; have frontier
  review or write directly.
- **Not for tasks where a wrong answer is silently accepted.** The
  oracle is load-bearing — if you can't test it cheaply, don't
  route.

## Evidence base

- Pilot v2 (2026-05-11):
  `experiments/concord-vho-microtask-cost/2026-05-11/`
  - 10/10 tasks first-attempt local pass at k=3 (30/30 individual
    oracle passes)
  - 4 novel-spec + 6 utility tasks
  - 100% of frontier baseline tokens saved when local succeeds
  - **Caveat**: at single-pilot scope with fresh infrastructure,
    hybrid is still ~5× more expensive than frontier-only because
    of router/oracle scaffolding cost (~3500 tokens). Break-even
    at ~5 pilots reusing the same infrastructure. Past that,
    linear payoff.

- Counter-evidence — when NOT to use:
  `experiments/concord-vho-pilot-todo-cli/2026-05-11/` shows
  hybrid is 2-3× *more* expensive than frontier-only at app-build
  scope due to scaffolding-cost dominance. Both reviews are in
  that pilot's `results/`.

## Real value beyond cost

The dollar savings are modest (~$0.0001-0.0006 per task at Sonnet
output rates, ~$0.0006-0.002 per task at Opus rates). The skill is
worth invoking primarily for:

- **Privacy** — code never leaves the rig
- **Latency** — 1-3s local vs 2-10s API
- **Quota independence** — no Anthropic/OpenAI rate limits
- **Reliability** — no API outages

## Pre-requisites

- Ollama running locally (or reachable via `OLLAMA_ENDPOINT`)
- `qwen3-coder:30b` pulled (`ollama pull qwen3-coder:30b`); or
  `devstral-small-2:24b` as fallback (slower, slightly weaker)
- Node ≥18 for the runner pattern
- `tiktoken` (Python pip) for token accounting if you want the
  cost-economy report

## Open questions (next experiments)

1. **Spec-density ablation** — how thin can the prompt be before
   local fails? Not yet measured.
2. **Generalisation** — does the 100% pass rate hold on 50 random
   functions from a real codebase? Not yet measured.
3. **k=10** — current k=3 is enough to refute single-shot variance
   but not enough to publish a stable pass-rate.

Until these are answered, treat this skill as **experimental** —
useful proof-of-life, not a production routing pattern.
