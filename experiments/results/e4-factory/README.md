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
- raw stdout or JSONL event logs
- stderr logs
- exit code files
- verification logs for lint, typecheck, and test
- `outcome.md`
- `postmortem.md`
- `interventions.md`
- a `manifest.json`

If a prompt-language lane exists, keep its persisted `pl-state/` artifacts.

## Closure Checklist

Before a run is considered closed:

- `manifest.json` exists and has a final `status` / `verdict`
- `outcome.md` exists
- `postmortem.md` exists
- `interventions.md` exists
- verification status for `lint`, `typecheck`, and `test` is recorded
- artifact completeness is recorded
- follow-up actions are recorded, or explicitly `none`
- [comparison.md](./comparison.md) is updated
- `npm run results:e4` passes

## Templates

Use the canonical templates when adding new run docs:

- [templates/outcome.template.md](./templates/outcome.template.md)
- [templates/postmortem.template.md](./templates/postmortem.template.md)

The canonical comparison summary lives at [comparison.md](./comparison.md).
