# E4 Factory Results

This directory stores run evidence for the bounded CRM software-factory experiments.

Structure:

- `runtime-smoke/` for the narrow orchestration proof
- `core-proof/` for the early bounded-core dry run residue
- `runs/<run-id>/` for repeatable comparison runs

Each repeatable run should keep:

- per-lane prompts or flow control references
- raw stdout or JSONL event logs
- stderr logs
- exit code files
- verification logs for lint, typecheck, and test
- a short `outcome.md`
- a `manifest.json`
