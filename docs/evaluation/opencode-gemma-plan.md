# OpenCode Gemma 4 Plan

This note records the bounded `opencode` plus `ollama/gemma4:e2b` comparison track in this repo.

Workstation rule for this repository: do not install local models on the main development PC just to exercise the OpenCode runner path. The default verification path on this host is the hosted OpenCode baseline (`opencode/gpt-5-nano`). Gemma 4 remains an optional comparison only when the environment is already provisioned elsewhere.

Status on April 10, 2026:

- prompt-only headless runs are documented as working through OpenCode
- the OpenCode runner surface can complete at least one tool-driven smoke case on this host with `opencode/gpt-5-nano`
- Gemma 4 still fails the same tool-driven smoke case on this host
- the historical comparative harness still targets Claude/Codex, not OpenCode

The goal is not to claim parity early. The goal is to decide whether OpenCode plus Gemma 4 is useful enough to justify cheaper repeatable experiments before the full CRM/helpdesk starter runs, without making local-model setup a default requirement.

## Decision target

Answer one question first:

Can OpenCode plus Gemma 4 act as a credible low-cost experimentation surface for prompt-language, or is it only good for prompt-only smoke?

## Stage 1: Baseline evidence pack

Run the smallest three checks that separate "prompt-only works" from "runner is useful":

1. Prompt-only headless flow
2. File-write flow
3. Gate or command-driven flow

Capture for each run:

- date
- host OS
- CPU-only vs GPU Ollama
- runner and model
- exact command
- exit code
- pass/fail summary
- notable degradation notes

Required outcome:

- prompt-only must pass
- at least one file/tool-driven path must pass
- any unsupported behavior must fail loudly and be documented

If only prompt-only passes for Gemma 4, stop there and classify Gemma as not ready for comparative reruns on that host.

## Stage 2: Minimal historical rerun subset

Do not start by porting the full 45-hypothesis corpus.

Start with the smallest subset most likely to show whether prompt-language still provides structural value when model quality drops:

1. Gaslighting resistance
2. Scope mismatch
3. Unstated criteria / multi-gate
4. Inverted gate

Reason for this subset:

- these are the repo's proven win patterns in the Claude-based evidence
- they test prompt-language's core claim: structural enforcement, not general prompting
- they avoid spending time on categories that historically tied even on stronger models

Initial comparison target:

- directional agreement with the Claude baseline matters more than raw pass rate
- a weaker model may degrade overall, but prompt-language should still outperform non-gated runs on the same failure shape

Current blocker:

- the checked-in eval harness still supports Claude/Codex only
- OpenCode reruns therefore depend on the OpenCode smoke/eval baseline and harness generalization work

Current evidence on this host:

- `opencode/gpt-5-nano` now passes smoke test `A` through `prompt-language ci --runner opencode`
- `ollama/gemma4-cpu:e2b` still fails smoke test `A`
- this means the runner path is no longer the primary blocker; Gemma 4 capability on this host is
  the blocker

## Stage 3: Starter workflow experiments

Only after Stages 1 and 2:

1. CRM starter on the low-cost OpenCode baseline
2. Helpdesk starter on the same baseline

These are follow-on experiments, not the first proof step.

## What not to do

- do not treat direct Gemma integration inside prompt-language as the first path
- do not rerun context-memory or long-horizon tie-heavy experiments first
- do not count prompt-only success as runner parity
- do not mix OpenCode baseline notes into the fixed-stack thesis runs

## Go / no-go rule

Proceed to the starter experiments only if all of the following are true:

- OpenCode has a documented smoke/eval command path
- Gemma 4 can complete at least one tool or gate-driven run, not just prompt-only
- the minimal rerun subset shows the same directional value signal as the Claude baseline

Otherwise:

- keep OpenCode plus Gemma 4 in baseline-only status
- file follow-up bugs for the specific unsupported behaviors
- defer CRM/helpdesk low-cost runs until the runner surface improves
