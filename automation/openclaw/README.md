# OpenClaw Local Autodev

This folder runs a local OpenClaw worker for `prompt-language`.

Design:

- Windows hosts Ollama and the selected local model.
- Docker runs the coding agent, repo commands, experiments, and nested app
  containers.
- OpenClaw cron wakes a supervisor on a loop.
- Each cycle starts from a fresh clone of `origin/main`.
- The live checkout at `C:\Projects\prompt-language` is not committed by the
  automation.
- Commits push directly to `main` only after repo gates pass.

The runner is intentionally capable. It has network access, Git, Node, npm,
Python, OpenClaw, Docker CLI, Docker Compose, and the host Docker socket mounted
for app and experiment containers. Do not mount home directories, SSH keys, npm
tokens, cloud credentials, or browser profiles into the runner.

## Install

From PowerShell:

```powershell
.\automation\openclaw\install-local.ps1 -Mode live
```

Use `-Mode dry-run` to register the cron job without allowing commits or pushes.

## Status

```powershell
.\automation\openclaw\status.ps1
```

## One Cycle

```powershell
.\automation\openclaw\supervisor.ps1 -Mode dry-run
.\automation\openclaw\supervisor.ps1 -Mode live
```

Runtime state lives under `.tmp/openclaw-autodev/` and is ignored by Git.
