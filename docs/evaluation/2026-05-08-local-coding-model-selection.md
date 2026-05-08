<!-- cspell:ignore Aider GDDR GLM Kimi MiniMax Qwen qwen OpenCode Ollama Radeon ROCm SGLang subrole subroles SWE rebench vLLM Vulkan -->

# Local Coding Model Selection

Date: 2026-05-08

## Decision

Proceed with a local coding-model benchmark track, but do not rerun H14 as one
large bet. The next useful track is a promotion ladder:

1. prove the host can run a candidate model through Prompt Language and Ollama;
2. test H14-derived subroles with public gates;
3. run full H14 only for models that pass the subroles;
4. test hybrid routing only after local evidence suggests the model can contribute
   useful work before escalation.

This keeps the previous `qwen3:8b` H14 result as a useful negative baseline, not a
project failure.

## Current Evidence Boundary

The H14 evidence supports a narrow conclusion:

- local `qwen3:8b` failed H14 local-only;
- frontier-only Codex passed H14 once;
- advisor-only and static hybrid did not rescue local `qwen3:8b`;
- failure-aware hybrid eventually passed, but the passing run was frontier-repair
  dominated after a local Ollama runtime failure.

It does not support a broad claim that local models cannot code, or that hybrid
routing cannot reduce cost. It only says that `qwen3:8b` should not own H14-style
TDD implementation under the measured policy.

## Host Reality

The measured workstation is a plausible local-model test host, but not an 80B+
local agent host:

- WSL memory: about 31 GiB.
- CPU: Intel i7-14700K, 28 logical CPUs.
- Windows GPU: AMD Radeon RX 7600 XT.
- AMD lists the RX 7600 XT with 16 GB GDDR6.
- Ollama documentation lists RX 7600 XT under AMD ROCm support on Windows and
  documents Vulkan as an additional experimental path.
- WSL itself did not expose `/dev/dri`, `/dev/kfd`, or a useful GPU path during
  agent preflight, so claim runs should use Windows-hosted Ollama exposed to WSL
  through an explicit endpoint.

The important operational rule: record `ollama ps` before and during runs. A
17-19 GB model may fit on disk and RAM while still falling back to CPU or split
CPU/GPU once context and KV cache are included.

## Model Shortlist

| Priority | Model                                           | Local status                | Why                                                                                                                  |
| -------- | ----------------------------------------------- | --------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| 1        | `qwen3-coder:30b`                               | Best first new local target | Official Ollama package; 30B-class MoE with about 3.3B active parameters; code and agent focused.                    |
| 2        | `qwen3-opencode:30b` / `qwen3-opencode-big:30b` | Already installed           | Current local 30B coding-control family. Useful before adding more weights.                                          |
| 3        | `qwen3:30b`                                     | Already installed           | General Qwen 30B control to test whether code specialization matters.                                                |
| 4        | `gemma4-opencode:31b` / Vulkan variant          | Already installed, risky    | Good secondary challenger, but 31B Q4 plus context is heavy for a 16 GB GPU.                                         |
| 5        | GLM-4.7-Flash                                   | Promising follow-up         | 30B-class open-weight model with strong coding claims; add only after Ollama availability and host fit are verified. |

Do not start local testing with `qwen3-coder-next`. The current Ollama package is
around 52 GB for the 80B-A3B model. It is interesting as cloud/open-weight server
evidence, but not as a first local-only candidate for this host.

Treat MiniMax-M2.5, Kimi-K2.5, DeepSeek-V3.2, GLM-5.1, and Qwen3-Coder-Next as
cloud or larger-server comparison arms. They may be relevant to the broader
open-weight strategy, but they are not workstation-local evidence on this box.

## Benchmark Ladder

Use H14-derived subroles before full H14:

| Stage | Fixture                   | Purpose                  | Promotion signal                                                                           |
| ----- | ------------------------- | ------------------------ | ------------------------------------------------------------------------------------------ |
| 0     | Ollama smoke              | Endpoint/model readiness | Model responds through Prompt Language with recorded endpoint and `ollama ps`.             |
| 1     | tests-only                | Test authoring           | Adds meaningful merge/duplicate tests without oracle leakage.                              |
| 2     | implementation-from-tests | Core implementation      | Passes public tests and hidden behavior while preserving exports.                          |
| 3     | public repair             | Gate-guided repair       | Fixes a named public failure in one repair loop.                                           |
| 4     | API preservation          | Compatibility            | Keeps `createContact`, `findByEmail`, `addContact`, and `removeContact` signatures intact. |
| 5     | full H14                  | End-to-end TDD task      | Passes private oracle without frontier input.                                              |

Promote a local model to full H14 only if it passes implementation and API
preservation subroles at least 2/3 with no oracle leaks or schema-invalid
manifests.

Claim local H14 capability only if full H14 local-only passes 3/3 with no frontier
input.

Claim hybrid value only if hybrid passes at least 2/3, uses fewer frontier calls
than frontier-only, and has lower estimated frontier spend than frontier-only.

## Routing Policy

Default local ownership is appropriate for:

- file inventory and summaries;
- boilerplate from settled examples;
- docs from a decided design;
- narrow public-gate repair;
- formatting, lint, spelling, import cleanup;
- artifact packaging and manifest drafting.

Default frontier ownership is appropriate for:

- H14-like TDD ownership until a stronger local model proves otherwise;
- ambiguous architecture;
- security, auth, permissions, data loss, migrations, and persistence;
- public API preservation plans;
- final review of high-risk diffs;
- repair after the first substantive local failure.

Use early cutoff for local lanes:

- no meaningful diff after one attempt;
- one hard timeout;
- same public gate fails twice;
- export or API surface changes incompatibly;
- edits outside the assigned workspace;
- repair does not target the named failing assertion;
- progress requires hidden oracle detail.

For `qwen3:8b`, use stricter cutoffs: one implementation attempt, one narrow
verifier-named repair at most, and immediate frontier escalation for H14-like API
or merge-behavior failures.

## Safety Requirements

Live model batches must be treated as contained experiments:

- run in fresh fixture workspaces, never the repo root;
- keep private oracles outside model-visible files;
- pass only public gate output into local repair loops;
- record command templates, endpoint, model identity, cwd, timeouts, exit codes,
  wall time, and route triggers;
- serialize local Ollama runs until host capacity is measured;
- use command allowlists per fixture;
- deny package installs, background servers, network clients, git mutation, and
  destructive cleanup unless a fixture explicitly requires them;
- treat oracle leakage, provider substitution, out-of-workspace writes, unclean
  timeouts, stray processes, or schema-invalid manifests as harness or policy
  failures, not model failures.

## Immediate Run Order

1. Pull or verify `qwen3-coder:30b`.
2. Start Windows Ollama on a WSL-reachable endpoint and record `/api/version`,
   `/api/tags`, and `/api/ps`.
3. Run a bounded Prompt Language smoke for:
   - `qwen3-coder:30b`;
   - `qwen3-opencode:30b`;
   - `qwen3:30b`;
   - one `gemma4-opencode` variant.
4. Record residency and wall time from `ollama ps`.
5. Only then run H14 subroles. Do not spend a full H14 run on a model that cannot
   pass the readiness smoke and subrole screen.

## Live Readiness Results

Initial execution used Windows-hosted Ollama `0.20.5` exposed to WSL at
`http://172.17.32.1:11435`. The previous `10.255.255.254` endpoint from earlier
readiness notes was stale for this WSL session. The Windows server listened on
`0.0.0.0:11435`; WSL `127.0.0.1:11434` was not reachable.

`qwen3-coder:30b` is the first promoted local candidate:

- Pull and model metadata verified: `30.5B`, `qwen3moe`, `Q4_K_M`, 262,144
  model context reported by `ollama show`.
- Prompt Language smoke `A: Context file relay` passed through the live Ollama
  runner.
- Artifact:
  `scripts/eval/results/smoke-2026-05-07T23-47-53-328Z.json`.
- Result: `1/1` passed, 27.168 seconds total, 25.274 seconds test duration.
- Telemetry: 2 Ollama records, 492 input tokens, 187 output tokens, 679 total
  tokens, zero provider API cost, no retries.
- `/api/ps` during residency showed `qwen3-coder:30b`, 19,014,187,008 bytes
  loaded, 15,775,507,456 bytes VRAM, 4,096 context.

The generic `qwen3:30b` control passed the same smoke but is much less efficient:

- Artifact:
  `scripts/eval/results/smoke-2026-05-08T00-03-45-767Z.json`.
- Result: `1/1` passed, 411.654 seconds total, 368.643 seconds test duration.
- Telemetry: 2 Ollama records, 496 input tokens, 3,752 output tokens, 4,248 total
  tokens, zero provider API cost, no retries.
- `/api/ps` showed similar residency: 19,014,187,008 bytes loaded,
  15,775,507,456 bytes VRAM, 4,096 context.

The `qwen3-opencode:30b` control was stopped manually after about 8.5 minutes on
the same `A` smoke with no readiness pass. `/api/ps` confirmed it was resident
while running: 19,215,513,600 bytes loaded, 15,585,304,576 bytes VRAM, 8,192
context. Treat this as a readiness failure for promotion purposes unless a later
rerun with a tighter prompt and explicit timeout produces a normal artifact.

The preliminary `E: Run auto-execution` smoke also passed for `qwen3-coder:30b`
(`scripts/eval/results/smoke-2026-05-07T23-47-09-682Z.json`), but it produced no
provider telemetry and no model residency snapshot. Use `A`, not `E`, as the
minimum live-inference readiness slice.

Current decision from the readiness pass:

1. Promote `qwen3-coder:30b` to H14 subrole screening first.
2. Keep `qwen3:30b` as a slow general-model control, not the main local worker.
3. Do not run full H14 on `qwen3-opencode:30b` until it passes `A` under a
   bounded timeout.
4. Defer `gemma4-opencode` until after `qwen3-coder:30b` subrole results, because
   19 GB class models are already close to this host's practical VRAM boundary.

## Sources

- Ollama Qwen3-Coder: <https://ollama.com/library/qwen3-coder>
- Qwen3-Coder announcement: <https://qwenlm.github.io/blog/qwen3-coder/>
- Qwen3-Coder-Next technical report: <https://arxiv.org/abs/2603.00729>
- Ollama hardware support: <https://docs.ollama.com/gpu>
- AMD RX 7600 XT specs: <https://www.amd.com/en/products/graphics/desktops/radeon/7000-series/amd-radeon-rx-7600-xt.html>
