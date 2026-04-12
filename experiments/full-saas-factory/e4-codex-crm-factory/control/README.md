# Control Packs

This directory is the immutable control surface for repeatable E4 runs.

- Keep prompts and `.flow` files here.
- Clone starter workspaces elsewhere before running.
- Store run evidence under `experiments/results/e4-factory/runs/<run-id>/`.
- Do not let model runs operate directly in this directory.
- Do not mark a run complete until its results folder has `manifest.json`, `outcome.md`,
  `postmortem.md`, `interventions.md`, `scorecard.json`, `trace-summary.md`, and an updated entry in
  `experiments/results/e4-factory/comparison.md`.
- Use the same common product artifact contract for both lanes in A/B comparisons; lane-specific
  control artifacts belong in manifest metadata and trace evidence, not as hidden downgrade rules
  for the other lane.
- Keep the lane's raw traces:
  `codex-alone` requires `events.jsonl`, `stderr.log`, `last-message.txt`, and verification logs.
  `prompt-language` requires `session-state.json`, `audit.jsonl`, and authoritative verification
  evidence.
- Closure is enforced by `npm run results:e4`; if that script fails, the run is not closed.

Current bounded-core control packs:

- `core-proof-multi-agent.flow`
- `core-proof-sequential.flow`
- `core-proof-throughput.flow`
- `codex-alone-core-proof.prompt.md`
