# E1 Repeated Failure Results

Lock vanilla baselines and gated comparison reports for the `E1` seed suite here.

Suggested filenames:

- `vanilla.<harness>.<model>.json`
- `gated.<harness>.<model>.json`

The currently checked-in seed keeps shorter canonical names:

- `codex-vanilla.json`
- `codex-gated.json`

Current locked pair on April 10, 2026:

- `codex-vanilla.json`: `0/3`
- `codex-gated.json`: `1/3`
- comparison winner: gated (`+33.3` points, one case win)

Do not treat transient `scripts/eval/results/` output as the canonical thesis baseline bank. Locked comparison artifacts for this suite belong in this directory.
