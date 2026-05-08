<!-- cspell:ignore Aider Devstral ETIMEDOUT GDDR GLM Kimi KTransformers MiniMax MiniMaxAI Mistral Qwen qwen OpenCode Ollama Radeon ROCm SGLang subrole subroles SWE unpromoted vLLM Vulkan xLLM -->

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
  dominated after a local Ollama runtime failure;
- `qwen3-coder:30b` later passed the full H14 local-only lane `3/3` after the
  PowerShell stdin transport and socket-reset retry hardening;
- `devstral-small-2:24b` and `qwen3-opencode:30b` passed the two narrow H14
  implementation subrole screens at `3/3` each, but have not passed full H14;
- `qwen3.6:27b` passed readiness, then failed the first H14 API-preservation
  screen after consuming the full 900s budget.

It does not support a broad claim that local models cannot code, or that hybrid
routing cannot reduce cost. It says `qwen3:8b` should not own H14-style TDD
implementation under the measured policy, while `qwen3-coder:30b` is promoted for
that specific H14 route with the hardened flow and runtime. The fallback local
portfolio is narrower: `devstral-small-2:24b` and `qwen3-opencode:30b` are useful
bounded implementers for implementation-from-tests and API-preservation, not
full-TDD owners.

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

| Priority | Model                  | Local status                     | Why                                                                                                                  |
| -------- | ---------------------- | -------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| 1        | `qwen3-coder:30b`      | Promoted for full H14 TDD        | Official Ollama package; 30B-class MoE with about 3.3B active parameters; code and agent focused.                    |
| 2        | `devstral-small-2:24b` | Promoted for two H14 subroles    | Smaller installed coding model; strong H14 subrole pass rate, but failed the H15 validation-only model screen.       |
| 3        | `qwen3-opencode:30b`   | Promoted for two H14 subroles    | Coding-tuned installed variant; passed H14 subroles, but failed the H15 validation screen after a bridge timeout.    |
| 4        | `qwen3:30b`            | Slow general-model control       | Passed readiness, but produced far more tokens and latency than `qwen3-coder:30b`.                                   |
| 5        | `qwen3.6:27b`          | Reviewer/classifier control only | Passed readiness but failed API-preservation after the hard timeout.                                                 |
| 6        | `gemma4-opencode:e4b`  | Failed default-context readiness | Smaller package, but the live `A` smoke timed out at 32K context; retest only with an explicit low-context profile.  |
| 7        | GLM-4.7-Flash          | Promising follow-up              | 30B-class open-weight model with strong coding claims; add only after Ollama availability and host fit are verified. |

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

- H14-like TDD ownership for unpromoted local models; route `qwen3-coder:30b`
  locally only for the checked H14 full-TDD flow and keep frontier repair
  available on any public-gate or private-oracle failure;
- full H14 for fallback locals such as `devstral-small-2:24b` and
  `qwen3-opencode:30b` until they pass separate full-lane screens;
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

1. Keep `qwen3-coder:30b` as the promoted H14 full-TDD worker under the checked
   route policy.
2. Keep `devstral-small-2:24b` and `qwen3-opencode:30b` as fallback local
   implementers only for implementation-from-tests and API-preservation; do not
   route H15 validation ownership to either fallback after the devstral
   no-progress failure and the qwen3-opencode bridge-timeout failure.
3. Do not spend more H14 implementation-owner time on `qwen3.6:27b`; use it only
   as a reviewer/classifier control unless a new runtime lane changes its timeout
   behavior.
4. For local-cost reduction, move the next claim test to adjacent work:
   H15 hybrid endpoint repair, H11-style multi-file refactor, or cheap route
   classification. Repeating already-promoted H14 subroles has low value.
5. Before any new model enters task lanes, record `/api/version`, `/api/tags`,
   `/api/ps`, the runner command, model metadata, and sampled residency.

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

The first `qwen3-opencode:30b` smoke was stopped manually after about 8.5 minutes
with no readiness pass. That was an intermediate readiness failure, not the final
decision. A later bounded screen with sampled `/api/ps` residency passed H14
implementation-from-tests at `3/3` and API-preservation at `3/3`; keep it as a
promoted fallback implementer for those two subroles, but below
`qwen3-coder:30b` and `devstral-small-2:24b` because its subrole runs were much
slower.

The preliminary `E: Run auto-execution` smoke also passed for `qwen3-coder:30b`
(`scripts/eval/results/smoke-2026-05-07T23-47-09-682Z.json`), but it produced no
provider telemetry and no model residency snapshot. Use `A`, not `E`, as the
minimum live-inference readiness slice.

Current decision from the readiness and subrole screens:

1. Promote `qwen3-coder:30b` for full H14 TDD under the hardened PowerShell stdin
   route.
2. Promote `devstral-small-2:24b` and `qwen3-opencode:30b` only for the two
   narrow implementation subroles they passed.
3. Keep `qwen3:30b` as a slow general-model control, not the main local worker.
4. Keep `qwen3.6:27b` out of implementation ownership after its 900s
   API-preservation failure.
5. Do not route `gemma4-opencode:e4b` as the cheap classifier under the current
   default-context Prompt Language smoke path; it needs a low-context profile
   before another readiness attempt is useful.

## 2026-05-09 Gemma4 OpenCode E4B Screen

A live Prompt Language smoke tried `gemma4-opencode:e4b` as the cheap
classifier/reviewer candidate:

```sh
PROMPT_LANGUAGE_OLLAMA_TRANSPORT=powershell \
  EVAL_MODEL=ollama/gemma4-opencode:e4b \
  EVAL_TIMEOUT_MS=900000 \
  node scripts/eval/smoke-test.mjs --harness ollama --quick --only A
```

Result:

- smoke process failed with `spawnSync node ETIMEDOUT`;
- no new completed smoke result artifact was written;
- sampled residency during the run showed `gemma4-opencode:e4b`, `10 GB`,
  `67%/33% CPU/GPU`, `32768` context;
- post-run `ollama stop gemma4-opencode:e4b` cleared model residency.

Decision: this is negative readiness evidence for the current default-context
route, not a broad quality judgment about Gemma. Keep it out of classifier or
reviewer routing until the harness can launch it with a small explicit context
and record that lower-context setting in the evidence trail.

## 2026-05-09 Live Health Check

A fresh bounded smoke confirmed that local inference is still usable through the
PowerShell transport even though WSL `127.0.0.1:11434` and the prior gateway HTTP
listener were not reachable.

Command shape:

```sh
PROMPT_LANGUAGE_OLLAMA_TRANSPORT=powershell \
  EVAL_MODEL=ollama/qwen3-coder:30b \
  EVAL_TIMEOUT_MS=1800000 \
  node scripts/eval/smoke-test.mjs --harness ollama --quick --only A
```

Result artifact:
`scripts/eval/results/smoke-2026-05-08T18-35-17-272Z.json`.

Outcome:

- smoke case `A: Context file relay`: passed `1/1`;
- model: `qwen3-coder:30b`;
- transport telemetry: `metadata.transport=powershell`;
- provider records: `2`;
- tokens: `492` input, `187` output, `679` total;
- retries: `0`;
- total smoke wall time: `101.615s`;
- post-run residency: `19 GB`, `13%/87% CPU/GPU`, `4096` context.

Decision: continue using PowerShell stdin transport for live local checks on this
host. Do not spend time restoring WSL HTTP before the next claim run unless a
specific runner needs HTTP-only sampling. The immediate bottleneck is model-task
fit and budgeted routing, not basic local inference.

## Next Cost-Reduction Screen

The next useful claim screen is not another broad H14 local run. H14 already has
a promoted `qwen3-coder:30b` local route, and H15 full endpoint ownership already
routes to frontier-only after local resource and completeness failures.

Run the next experiment as a budgeted adjacent-task screen:

1. H11 local-only replay under `qwen3-coder:30b` remains promoted for the exact
   checked route, but use it mainly as a health/control lane.
2. H15 validation-only stays local-screen positive for `qwen3-coder:30b`; repeat
   only if the flow changes.
3. H15 PATCH test-authoring has now replayed cleanly as a promoted local route
   with zero frontier calls; use it as a tests-only local lane, not as evidence
   for full endpoint ownership.
4. Any H15 hybrid retry must use `--frontier-call-limit 2` when it is only
   classifier plus final review, or `--frontier-call-limit 3` when one repair is
   intentionally allowed. The dynamic repair insertion now respects that cap, so
   the manifest can prove the experiment did not silently spend extra frontier
   calls.
5. A hybrid route is promoted only if it passes at least `2/3`, uses fewer
   frontier calls than frontier-only, and avoids local runtime resource failure.

## Latest Model Scan

The May 8, 2026 scan changes the shortlist, but not the decision boundary:
newer public models are useful to track, while only models that survive the live
Prompt Language smoke should enter H14 subrole screening.

DeepSeek's latest public family is `DeepSeek-V4 Preview`, released on April 24,
2026:

- `DeepSeek-V4-Pro`: 1.6T total parameters, 49B active parameters.
- `DeepSeek-V4-Flash`: 284B total parameters, 13B active parameters.
- Both official variants advertise 1M context and thinking/non-thinking modes.

This is important as a cloud/API comparison arm, especially for long-context
agentic coding, but not as a workstation-local candidate for this host. Even
the Flash model is far beyond the 31 GiB WSL RAM and 16 GB VRAM envelope.

`qwen3.6:27b` was pulled and inspected because it is a newer local-looking Qwen
candidate in Ollama:

- Ollama metadata: `27.8B`, `qwen35`, `Q4_K_M`, 17 GB package, capabilities
  `completion`, `vision`, `tools`, and `thinking`.
- `ollama show` reports a 262,144 model context and Apache 2.0 license.
- A later readiness run passed with sampled residency evidence at 8,192 context.
- The first H14 API-preservation screen then timed out at 900.102s and failed
  both public and hidden merge semantics with oracle `3/5`.

Treat this as negative implementation-owner evidence under the current runtime,
not just a host-fit failure. It may still be useful as a local reviewer or
classifier, but it should not own H14 API-preserving implementation work without
a new prompt or runtime lane.

`devstral-small-2:24b` initially failed the same `A` smoke, then passed later
readiness and H14 subrole screens:

- Ollama metadata: `24.0B`, `mistral3`, `Q4_K_M`, 15 GB package, Apache 2.0
  model card license.
- `/api/ps` during the run showed 16,340,389,904 bytes loaded and
  14,556,266,512 bytes in VRAM at 4,096 context.
- Later H14 implementation-from-tests passed `3/3` with private oracle `6/6` in
  every run.
- Later H14 API-preservation passed `3/3` with private oracle `5/5` in every run.
- Every subrole sample tick across those six runs contained the resident
  `devstral-small-2:24b` `/api/ps` row.

Promote Devstral Small 2 only for those two bounded implementation subroles. It
is not promoted for standalone test authoring or full H14 local-only.

Current latest-model ranking for this PC:

| Rank | Candidate              | Decision                                                                                                 |
| ---- | ---------------------- | -------------------------------------------------------------------------------------------------------- |
| 1    | `qwen3-coder:30b`      | Promoted full H14 worker under the hardened route; best local implementation owner.                      |
| 2    | `devstral-small-2:24b` | Promoted fallback for two bounded H14 implementation subroles; not full-H14 promoted.                    |
| 3    | `qwen3-opencode:30b`   | Promoted fallback for the same two subroles, but slower than Devstral and Qwen Coder.                    |
| 4    | `qwen3:30b`            | Passed `A` but too slow; keep as general-model control.                                                  |
| 5    | `qwen3.6:27b`          | Passed readiness but failed API-preservation after timeout; reviewer/classifier control only.            |
| 6    | `GLM-4.7-Flash`        | Strong 30B-A3B paper/model-card candidate; test only after locating a runner package that fits the host. |
| 7    | `gemma4-opencode:e4b`  | Failed the default-context smoke timeout; only retry with a low-context route.                           |

Latest large open-weight models worth tracking, but not workstation-local here:

- `DeepSeek-V4-Pro` / `DeepSeek-V4-Flash`: latest DeepSeek family; cloud/API
  comparison arm.
- `GLM-5.1`: strong agentic-engineering claims and local server support through
  SGLang, vLLM, xLLM, Transformers, and KTransformers; too large for this host
  as a local workstation lane.
- `MiniMax-M2.5`: strong SWE-Bench Verified and agentic cost claims; server/API
  comparison arm, not an Ollama-on-this-PC candidate.
- `Kimi-K2.5`: 1T total / 32B active MoE, 256K context; server/API comparison
  arm.

The engineering conclusion is still not "local failed." The better conclusion
is narrower: `qwen3-coder:30b` is the only current local model with enough live
Prompt Language evidence to own full H14 TDD. Devstral Small 2 and Qwen3 OpenCode
are useful local fallback implementers for bounded subroles. Qwen3.6 and larger
new open-weight families belong in reviewer/classifier or API/server comparison
lanes until they produce workstation-local promotion evidence.

## Sources

- Ollama Qwen3-Coder: <https://ollama.com/library/qwen3-coder>
- Ollama Qwen3.6: <https://ollama.com/library/qwen3.6:27b>
- Ollama Devstral Small 2: <https://ollama.com/library/devstral-small-2:24b>
- Qwen3-Coder announcement: <https://qwenlm.github.io/blog/qwen3-coder/>
- Qwen3-Coder-Next technical report: <https://arxiv.org/abs/2603.00729>
- DeepSeek V4 preview release: <https://api-docs.deepseek.com/news/news260424>
- DeepSeek V4 open-weight collection: <https://huggingface.co/collections/deepseek-ai/deepseek-v4>
- GLM-4.7-Flash model card: <https://huggingface.co/zai-org/GLM-4.7-Flash>
- GLM-5.1 model card: <https://huggingface.co/zai-org/GLM-5.1>
- MiniMax-M2.5 model card: <https://huggingface.co/MiniMaxAI/MiniMax-M2.5>
- Kimi-K2.5 model card: <https://huggingface.co/moonshotai/Kimi-K2.5>
- Ollama hardware support: <https://docs.ollama.com/gpu>
- AMD RX 7600 XT specs: <https://www.amd.com/en/products/graphics/desktops/radeon/7000-series/amd-radeon-rx-7600-xt.html>
