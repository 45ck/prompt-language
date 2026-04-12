# E4 Factory Results

This directory stores run evidence for the bounded CRM software-factory experiments.

Structure:

- `runtime-smoke/` for the narrow orchestration proof
- `core-proof/` for the early bounded-core dry run residue
- `runs/<run-id>/` for repeatable comparison runs

## Closure Policy

A run is not complete until its raw evidence is stored, `manifest.json` has final closure fields,
`outcome.md` and `postmortem.md` are present, and the canonical E4 comparison document has been
updated.

Postmortem is required for both success and failure. A successful run still needs a postmortem so
the repo records what almost failed, what guardrail was added, and what remains risky.

For current repeatable runs under `runs/<run-id>/`, the run folder is the source of truth. Legacy
attempt folders outside `runs/` must still be backfilled with at least `outcome.md`,
`postmortem.md`, and a comparison entry.

## Required Run Folder Shape

Each repeatable run must keep:

- per-lane prompts or flow control references
- raw lane traces
  Codex-alone lanes: `events.jsonl`, `stderr.log`, `last-message.txt`, `lint.log`,
  `typecheck.log`, `test.log`
  Prompt-language lanes: `session-state.json`, `audit.jsonl`, plus verification logs when they are
  authoritative
- `outcome.md`
- `postmortem.md`
- `interventions.md`
- `scorecard.json`
- `trace-summary.md`
- a `manifest.json`

If a prompt-language lane exists, keep its persisted `pl-state/` artifacts.

## Closure Checklist

Before a run is considered closed:

- `manifest.json` exists and has a final `status` / `verdict`
- `outcome.md` exists
- `postmortem.md` exists
- `interventions.md` exists
- `scorecard.json` exists
- `trace-summary.md` exists
- verification status for `lint`, `typecheck`, and `test` is recorded
- artifact completeness is recorded against the lane's declared artifact contract
- paired A/B comparisons use the same common product contract for both lanes, with lane-specific
  control artifacts tracked separately
- follow-up actions are recorded, or explicitly `none`
- [comparison.md](./comparison.md) is updated
- `npm run results:e4` passes

## Templates

Use the canonical templates when adding new run docs:

- [templates/outcome.template.md](./templates/outcome.template.md)
- [templates/postmortem.template.md](./templates/postmortem.template.md)
- [templates/scorecard.template.json](./templates/scorecard.template.json)
- [templates/trace-summary.template.md](./templates/trace-summary.template.md)

The canonical comparison summary lives at [comparison.md](./comparison.md).
The scoring rubric and validity rules live at [research-method.md](./research-method.md).
