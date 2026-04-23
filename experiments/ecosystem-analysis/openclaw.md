# OpenClaw

Source: https://github.com/openclaw/openclaw (fetched 2026-04-20)
Homepage: https://openclaw.ai — Docs: https://docs.openclaw.ai
License: MIT. Primary language: TypeScript. Node 24 (or 22.16+).

## 1. Ground-truth description

OpenClaw is a personal, single-user AI assistant you run on your own devices. Built by Peter Steinberger ("for Molty, a space lobster AI assistant"). The product is the always-on assistant; the **Gateway** is a local control-plane daemon (launchd/systemd service) that fronts a **multi-channel inbox** (WhatsApp, Telegram, Slack, Discord, Signal, iMessage, Matrix, IRC, Teams, WebChat, etc.) and exposes companion surfaces (macOS menu-bar app, iOS/Android "nodes", a live "Canvas"). It is explicitly **not** a developer orchestration runtime — it is a consumer assistant whose internals happen to include an agent loop, tool registry, sessions, and skills.

Key abstractions (from README + architecture docs):

- **Gateway** — WebSocket RPC daemon; typed request/response + server-push events (`agent`, `chat`, `presence`, `health`, `heartbeat`, `cron`), idempotency keys, TypeBox/JSON-Schema validation.
- **Agents / Sessions** — multi-agent routing: inbound channels/peers map to isolated agents with per-session workspaces and optional Docker sandboxing (`agents.defaults.sandbox.mode`).
- **Skills** — `~/.openclaw/workspace/skills/<skill>/SKILL.md` (same shape Anthropic is pushing); registry at ClawHub.
- **Nodes** — paired devices (iOS/Android/macOS) forwarding voice, Canvas, camera.
- **Agent runtime** — the docs state the embedded runtime is built on the **Pi agent core** (badlogic/pi-mono — models, tools, prompt pipeline). OpenClaw owns session management, discovery, tool wiring, channel delivery.

Execution model: React-style agent loop inherited from pi-mono, not a deterministic state machine. No gates, no spawn/await/race primitives exposed as first-class orchestration surface.

## 2. Maintenance signal

Active daily (last push 2026-04-20, same day as this review). Reported stars (~360k) and forks (~73k) on the GitHub API response are implausibly large for a repo created 2025-11-24 and should be treated with suspicion — probably inflated, mirrored, or a metadata artefact; do **not** cite as traction evidence. Verifiable signals: Discord, public sponsor list (OpenAI, GitHub, NVIDIA, Vercel, Convex, Blacksmith), ~10 visible "clawtributors," dev/beta/stable release channels, CI workflow, detect-secrets config. Treat as a **real, well-resourced, Steinberger-led** project with thin external contributor base.

## 3. Interop patterns with prompt-language, ranked

**(a) PL wraps OpenClaw as runner — LOW-MEDIUM feasibility.** OpenClaw is not a headless CLI coding agent in the aider/opencode mould. The closest surface is `openclaw agent --message "..." --thinking high`, which invokes the assistant loop and returns streamed events. PL could wrap this as a ~300-line TS adapter, but the product assumes channel delivery, skills, sessions — most of which PL does not need. Value is low; PL would be paying for a messaging gateway it doesn't use.

**(b) OpenClaw wraps PL — MEDIUM feasibility, highest semantic value.** OpenClaw already exposes `tools` and `skills` as extension points. PL could register as a **tool** ("run verified multi-step plan") or as a **skill** that drives an entire verification-first workflow from a single chat turn. This gives OpenClaw users deterministic gated execution they currently lack; gives PL a channel-native trigger (WhatsApp → PL flow → verified result).

**(c) Side-by-side comparator — HIGH feasibility.** Same task, same model (ollama qwen3-opencode:30b), OpenClaw assistant loop vs. PL verification flow. Compare: steps to completion, tool-call count, verification failures caught, token spend. Runs today on this PC.

## 4. Local-first fit

Confirmed local: **Ollama** (`ollama` provider, auto-detected at 127.0.0.1:11434, requires `OLLAMA_API_KEY` opt-in), **LM Studio**, **vLLM**, **SGLang**, plus arbitrary OpenAI-compatible proxies. Coding-agent backends: **Claude**, **OpenCode** (zen + go runtimes), **OpenAI Codex**. **Aider: not supported.** Not cloud-only — the Gateway runs locally; only channel transports and chosen model provider cross the network. Windows is supported via WSL2 (strongly recommended), not native.

## 5. Experiment designs

**Experiment 1: Comparator on a fixed refactor task (local-only).**
Setup: same small TS refactor brief, same model (`qwen3-opencode:30b` via ollama). Run (i) OpenClaw `openclaw agent` single-shot, (ii) PL flow with explicit gates (plan → patch → typecheck → test). Capture wall-clock, tool-calls, gate failures, final diff quality.
Prediction: OpenClaw finishes faster on average but PL produces fewer regressions and catches at least one hallucinated import/API that OpenClaw ships.
Success criterion: PL flow rejects ≥1 failing patch that OpenClaw accepts on ≥3 of 5 tasks, with no more than 2× wall-clock overhead.

**Experiment 2: PL-as-skill inside OpenClaw.**
Setup: add a `pl-verify` skill to `~/.openclaw/workspace/skills/` that shells out to PL (`prompt-language run <flow>`) with the user turn as input, returning the verified result as the assistant reply. Trigger via WebChat. Use `qwen3:8b` as routing model, `qwen3-opencode:30b` for PL's coding gates.
Prediction: end-to-end channel → PL flow → reply works, but OpenClaw's streaming assumptions will clash with PL's blocking gate semantics; initial latency will be bad without a progress-event bridge.
Success criterion: 5/5 chat-initiated PL runs complete and return to WebChat; identify exactly what progress-event contract is missing between PL and OpenClaw's agent event stream.

## 6. Evidence strength

High confidence: identity, tech stack, local-model support (README + docs explicit). Medium: agent-loop internals (docs thin, relies on pi-mono). Low: stars/forks counts (implausible — ignore). All interop claims above are inferences from surface docs; no code was read.
