# Ecosystem Analysis: NousResearch/hermes-agent

Source: https://github.com/NousResearch/hermes-agent
Fetched: 2026-04-20. All stats from GitHub REST API; descriptive claims from README + official docs (hermes-agent.nousresearch.com).

## 1. What it is (verified)

Hermes Agent is a self-improving, long-running AI agent framework by Nous Research.
Tagline: "The agent that grows with you." Python, MIT licensed, created 2025-07-22,
last pushed 2026-04-20. It is **not** a wrapper around a specific Hermes model
family - the repo is provider-agnostic and ships no weights. It pairs any chat
LLM with persistent memory (FTS5 session search + LLM summarization), an
autonomous "skills" loop based on the open agentskills.io standard, a Honcho-
backed user model, and a cross-platform messaging gateway (Telegram, Discord,
Slack, WhatsApp, Signal, email).

## 2. Tool-calling format, execution model, harness architecture

CLI entrypoints: `hermes` (TUI), `hermes gateway`, `hermes tools`, `hermes model`,
`hermes cron`. Execution runs in one of six terminal backends - local, Docker,
SSH, Daytona, Singularity, Modal - with the last two offering serverless
hibernation. Tool calling is mediated through MCP (Model Context Protocol)
servers plus ~40 built-in tools; the README does not pin a specific JSON schema
dialect, and tool invocations are dispatched through the agent's provider layer,
so the wire format is whatever the upstream provider accepts (OpenAI-style by
default). The execution model is long-lived and stateful: conversations,
memory, and skills persist in `~/.hermes/`, and the agent can be nudged to
self-persist knowledge between sessions.

## 3. Activity

- Stars: 102,734
- Forks: 14,654
- Open issues: 5,709
- License: MIT | Language: Python (primary)
- Latest push: 2026-04-20 (same-day as this analysis - very active)
- Age: ~9 months, so growth is unusually steep; contributor count and issue
  volume suggest real traction rather than a list-driven star spike.

## 4. PL orchestration path

Hermes Agent is explicitly Ollama-compatible. The docs instruct users to run
`hermes model`, pick "Custom endpoint," and point at `http://localhost:11434/v1`
(Ollama's OpenAI-compatible server). Hard constraint: minimum 64K context
window - Hermes refuses smaller models because its memory/tool loops exceed
short contexts. This means a PL runner for hermes-agent is viable via two paths:
(a) treat `hermes` CLI as a new runner (~300 LoC per the PL runner pattern),
driving it with stdin prompts and capturing transcript output, or (b) bypass
the CLI and instead plug PL gates around the OpenAI-compatible endpoint Hermes
is already calling - using PL as the outer supervisor and Hermes as the inner
persistent agent. Path (a) is a cleaner fit for the gates/retries/review-loop
model because PL can own the outer state machine while Hermes handles skill
reuse inside each turn. Because Hermes delegates the actual model call to
Ollama, PL + Hermes + any Hermes-family GGUF (e.g. Hermes-3, DeepHermes-3)
served by Ollama is a near-zero-cost experiment.

## 5. Comparison vs qwen3-opencode:30b baseline

Qwen3-opencode:30b is specifically post-trained for code-agent tool calling and
is the stronger baseline on *raw tool-call reliability* at comparable parameter
counts. Hermes-3 and DeepHermes-3 are generalist open-weights models with
strong function-calling (Hermes-Function-Calling is a sibling repo), but the
coding-specific RL signal is weaker. Expectation: **Hermes models are
orthogonal, not strictly better** - stronger on free-form reasoning, memory-
aware multi-turn dialogue, and skill synthesis; weaker or at-parity on
deterministic schema-bound tool calls in code-heavy flows. The hermes-agent
*harness* adds value PL does not currently exercise: persistent skills and
long-horizon memory. That is where the delta would appear, not in single-turn
tool accuracy.

## 6. Two experiment ideas

**(a) Drop-in on H1-H10 scorecard arm.** Swap qwen3-opencode:30b for a Hermes-
family GGUF on the existing H1-H10 arm, keeping PL gates, retries, and review
loops identical. Measures whether PL's rescue delta transfers across model
families or is partially co-adapted to qwen3's failure modes. Low cost, high
diagnostic value.

**(b) Skill-reuse arm (novel).** Run a multi-task suite where tasks share
latent sub-procedures (e.g. repeated refactor pattern, repeated test-fix
pattern). Arm A is PL alone. Arm B is PL wrapping hermes-agent so Hermes
accrues skills across tasks. Hypothesis: PL+Hermes beats PL-alone on task N>1
because Hermes's persistent skill store amortizes setup that PL otherwise
redoes each run. This directly tests whether verification-first supervision
and agent-side procedural memory compose or conflict.

## 7. Edge case

Not triggered - the URL resolves, the repo is real and active. Adjacent Nous
Research agentic projects worth flagging for context: `Hermes-Function-Calling`
(tool-use training/eval for Hermes models), `hermes-agent-self-evolution`
(DSPy+GEPA optimization of Hermes Agent), and `atropos` (LLM RL environments
framework). DeepHermes-3 is a model family, not a harness, and lives on
HuggingFace rather than as a repo here.
