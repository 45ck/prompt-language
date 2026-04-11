# Cross-Platform Smoke Verification

Date: `2026-04-12`  
Workspace host: native Windows (`PowerShell`)  
Repo path: `D:\Visual Studio Projects\prompt-language`

This note records what was directly verified for cross-platform smoke posture from this workspace and what remains blocked.

## Summary

- Windows native can run the repo's CI-safe smoke suite and it passed.
- Linux-native CI-safe smoke is runnable through the installed WSL2 Ubuntu environment and it passed.
- Windows native live smoke is blocked by Claude CLI authorization in this host.
- Linux-native live smoke is blocked earlier by the WSL runtime using Node `v18.19.1`, while this repo requires Node `>=22.0.0`.
- Native macOS smoke cannot be executed from this Windows host. macOS evidence must come from a real macOS machine or GitHub Actions.
- No workflow change was needed because `.github/workflows/ci-matrix.yml` already runs `npm run eval:smoke:ci` on `ubuntu-latest`, `macos-latest`, and `windows-latest`.

## Command Matrix

| Environment    | Command                                                                                                                                        | Result                                                                 | Classification           | Notes                                                                                                               |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------- | -------------- | --------------------------------------- |
| Windows native | `node -v`                                                                                                                                      | `v22.22.0`                                                             | `PASS`                   | Meets `package.json` engine floor `>=22.0.0`.                                                                       |
| Windows native | `npm run eval:smoke:ci`                                                                                                                        | `73 passed, 0 failed`                                                  | `PASS`                   | CI-safe smoke path verified locally.                                                                                |
| Windows native | `node scripts/eval/smoke-test.mjs --quick --only A`                                                                                            | exited `1`                                                             | `BLOCKED_AUTH`           | Harness started, `claude -p` failed authorization before scenarios ran.                                             |
| Windows native | `where.exe claude codex gemini opencode ollama`                                                                                                | `claude`, `codex`, `gemini`, `opencode` found; `ollama` missing        | `PARTIAL_TOOLING`        | Tool presence alone does not prove live smoke readiness.                                                            |
| WSL Ubuntu     | `wsl --status`                                                                                                                                 | default distro `Ubuntu`, WSL version `2`                               | `PASS`                   | Linux execution path exists on this machine.                                                                        |
| WSL Ubuntu     | `wsl -l -v`                                                                                                                                    | `Ubuntu` present, state `Stopped`, version `2`                         | `PASS`                   | Local Linux runner is installed but was not already warm.                                                           |
| WSL Ubuntu     | `wsl bash -lc "cd '/mnt/d/Visual Studio Projects/prompt-language' && npm run eval:smoke:ci"`                                                   | `73 passed, 0 failed`                                                  | `PASS`                   | Linux-native CI-safe smoke path verified through WSL.                                                               |
| WSL Ubuntu     | `wsl bash -lc "cd '/mnt/d/Visual Studio Projects/prompt-language' && node -v"`                                                                 | `v18.19.1`                                                             | `BLOCKED_RUNTIME`        | Below repo engine requirement.                                                                                      |
| WSL Ubuntu     | `wsl bash -lc "cd '/mnt/d/Visual Studio Projects/prompt-language' && EVAL_TIMEOUT_MS=60000 node scripts/eval/smoke-test.mjs --quick --only A"` | exited `1` with `ERR_INVALID_ARG_TYPE` from `scripts/eval/harness.mjs` | `BLOCKED_RUNTIME`        | Live smoke could not start because the WSL Node runtime is too old for the script path assumptions in current code. |
| WSL Ubuntu     | `wsl bash -lc "command -v claude"`                                                                                                             | `/mnt/d/Programs/npm-global/claude`                                    | `PASS`                   | Claude CLI is visible from WSL.                                                                                     |
| WSL Ubuntu     | `wsl bash -lc "command -v codex"`                                                                                                              | `/mnt/d/Programs/npm-global/codex`                                     | `PASS`                   | Codex CLI is visible from WSL.                                                                                      |
| WSL Ubuntu     | `wsl bash -lc "command -v gemini"`                                                                                                             | `/mnt/d/Programs/npm-global/gemini`                                    | `PASS`                   | Gemini CLI is visible from WSL.                                                                                     |
| WSL Ubuntu     | `wsl bash -lc "command -v opencode"`                                                                                                           | `/mnt/d/Programs/npm-global/opencode`                                  | `PASS`                   | OpenCode CLI is visible from WSL.                                                                                   |
| WSL Ubuntu     | `wsl bash -lc "command -v ollama                                                                                                               |                                                                        | echo ollama-missing"`    | `ollama-missing`                                                                                                    | `MISSING_TOOL` | Ollama harness is not available in WSL. |
| macOS native   | any local smoke command from this host                                                                                                         | not attempted                                                          | `NOT_EXECUTABLE_ON_HOST` | This machine cannot directly execute native macOS binaries or a macOS runner.                                       |

## Exact Blockers

### 1. Windows native live smoke

Classification: `BLOCKED_AUTH`

Observed failure:

```text
[smoke-test] BLOCKED — Claude CLI login/access is unavailable in this environment.
[smoke-test] `claude -p` returned an authorization error; smoke scenarios were not run.
```

Meaning:

- The live smoke harness path is installed.
- The blocker is not missing CLI tooling.
- The blocker is host authorization/access for the selected harness.

### 2. WSL Ubuntu live smoke

Classification: `BLOCKED_RUNTIME`

Observed failure:

```text
TypeError [ERR_INVALID_ARG_TYPE]: The "paths[0]" argument must be of type string. Received undefined
    at .../scripts/eval/harness.mjs:18:14
Node.js v18.19.0
```

Meaning:

- Linux execution exists and repo-safe smoke works in WSL.
- Live smoke is blocked before harness auth is even tested because WSL is on Node `v18.19.1`.
- The repo declares `node >=22.0.0`, so this is an environment mismatch, not product evidence.

### 3. macOS smoke from this workspace

Classification: `NOT_EXECUTABLE_ON_HOST`

Meaning:

- There is no honest way to claim native macOS smoke evidence from a Windows workstation.
- macOS evidence must come from:
  - a real macOS host, or
  - GitHub Actions jobs that run on `macos-latest`.

## CI Matrix Posture

Current file: [ci-matrix.yml](/abs/path/D:/Visual%20Studio%20Projects/prompt-language/.github/workflows/ci-matrix.yml:1)

Current posture is already additive and cross-platform:

- matrix OS set: `ubuntu-latest`, `macos-latest`, `windows-latest`
- matrix Node set: `22`, `24`
- smoke command already included: `npm run eval:smoke:ci`

This means the repository already has a safe GitHub-hosted cross-platform smoke signal for:

- parse/state/render/plugin-artifact integrity
- Node and OS matrix posture
- non-authenticated smoke coverage on Ubuntu and macOS

No workflow edit was made because:

- the requested Ubuntu/macOS smoke matrix posture already exists
- adding live smoke to hosted CI would not be clearly safe without a supported authenticated harness strategy
- forcing a live harness into CI would risk flaky or permanently blocked jobs rather than adding trustworthy evidence

## Evidence Boundary

What this note proves:

- Windows native repo-safe smoke: verified
- Linux-native repo-safe smoke via WSL2: verified
- current local blockers for live smoke: verified and classified
- GitHub Actions already has a cross-platform CI-safe smoke matrix: verified from workflow inspection

What this note does not prove:

- fresh successful live smoke on Linux
- fresh successful live smoke on macOS
- hosted CI live smoke through Claude, Codex, Gemini, or OpenCode auth

## Next Actions

1. Upgrade WSL Ubuntu to Node `22` or newer, then rerun limited live smoke in WSL.
2. Run a real macOS `npm run eval:smoke:ci` or `npm run eval:smoke` job and archive the result separately.
3. If hosted live smoke is ever desired, design an explicit non-interactive harness auth strategy first rather than expanding the current CI matrix blindly.
