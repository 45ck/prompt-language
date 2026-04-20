# pi-mono — Ecosystem Analysis for PL Integration

Source: https://github.com/badlogic/pi-mono (fetched 2026-04-20 via WebFetch; not cloned)
Author: badlogic (Mario Zechner). License: MIT.

> Note on metrics: WebFetch summaries returned 37.5k stars / 4.3k forks. That number is inconsistent with an 8-month-old single-author niche toolkit and likely a hallucination by the fetch summarizer. Treat popularity numbers below as **unverified**. Everything else is taken from the README structure and package names surfaced in the repo.

## 1. What pi-mono is (verified)

pi-mono is a TypeScript monorepo of "tools for building AI agents and managing LLM deployments." The centerpiece is **`pi`**, a coding agent CLI (`@mariozechner/pi-coding-agent`), plus supporting packages.

Verified packages (from `/packages` directory listing):
- **ai** (`pi-ai`) — unified multi-provider LLM client (OpenAI, Anthropic, Google, Bedrock, Mistral, Groq, Cerebras, xAI, OpenRouter, HF, Vercel Gateway, and subscription-auth flows for Claude/ChatGPT/Copilot/Gemini). ollama is not explicitly listed in fetched excerpts — **unknown**.
- **agent** (`pi-agent-core`) — agent runtime: tool calling + state management.
- **coding-agent** — the `pi` CLI. Supports `-p/--print`, `--mode json` (JSONL event stream), `--mode rpc` (stdin/stdout RPC for non-Node embedding), `--tools read,bash,edit,write,grep,find,ls`, `--no-tools`, `-c/-r/--session/--fork` for session state, extensions/skills/themes.
- **tui** — terminal UI lib with differential rendering.
- **web-ui** — web components for chat.
- **mom** — Slack bot that delegates to the coding agent.
- **pods** — vLLM deployment management on GPU pods.

**Unknowns:** exact ollama support; whether `--mode rpc` framing is line-delimited JSON-RPC or custom; whether tool-use can be intercepted/approved mid-turn; stars/activity counts (fetch returned suspicious values).

## 2. Architecture / key abstractions

Three-layer stack: **pi-ai** (provider fan-out) → **pi-agent-core** (turn loop, tools, state) → **coding-agent / mom / web-ui** (surfaces). The relevant abstractions for PL are:
- **Headless execution modes**: `--print` (one-shot), `--mode json` (event stream), `--mode rpc` (embedded control).
- **Session files** (`--session <path>`, `--fork`) — durable context snapshots.
- **Tool allow-lists** via `--tools` — deterministic capability restriction.
- **SDK embedding** — pi-agent-core is reusable outside the CLI.

## 3. Maintenance signal

- Created 2025-08; last push 2026-04-19; releases reach v0.67.68 (2026-04-17) — **very active, fast-moving**.
- Single-author project; MIT; TypeScript 96%.
- Stars/forks/open-issues counts from fetch are unreliable (see note above). Activity cadence (release every few days) is the strongest positive signal.
- Risk: API churn at v0.67.x implies breaking changes likely; pin version.

## 4. Three PL × pi-mono interoperation modes

| # | Mode | Feasibility | Value | Effort |
|---|------|-------------|-------|--------|
| a | **PL orchestrates pi as a runner** | High | High | ~300 LOC adapter |
| b | **pi orchestrates PL flows** (pi calls PL as a tool) | Medium | Low-Medium | PL needs tool-facing entrypoint |
| c | **Side-by-side comparison** (H1-H10 bake-off) | High | Medium | Fixture reuse, no new code |

**Ranked by feasibility × value:** (a) > (c) > (b).

**(a) is the win.** pi's `--print`, `--mode json`, and `--mode rpc` are exactly the surface PL's existing runners (claude, codex, opencode, aider) consume. A `PiRunner` implementing `PromptTurnRunner + ProcessSpawner` would spawn `pi -p "<prompt>" --mode json --tools read,bash,edit,write`, stream JSONL events into PL's state machine, and gate with `tests_pass`/`lint_pass`/custom `gate` — same pattern as the aider runner. pi adds value the current runner set lacks: native multi-provider auth (subscription + 20+ API keys in one adapter) and SDK-level session forking, which PL's `spawn`/`race` could exploit.

**(b) is weak** because PL's control flow (`while`, `retry`, `foreach`) is the outer loop by design; inverting it makes pi the supervisor and loses PL's determinism guarantees.

**(c) is cheap and informative** — run the same H1-H10 fixtures through solo-pi vs PL+pi and measure the gate-pass delta, mirroring the existing PL+aider 6-0-3 result.

## 5. Local-first models

pi-ai's public provider list (from fetched README excerpts) emphasizes hosted providers. **ollama is not explicitly listed** — unknown whether pi supports it natively, via OpenAI-compatible base URL override, or not at all. This matters because PL's proven local stack is qwen3-opencode:30b / qwen3:8b / gemma4-opencode:* on ollama.

Plausible integration paths, ranked:
1. **OpenAI-compatible shim**: point `pi-ai` at `http://localhost:11434/v1` via provider config — likely works if pi-ai exposes a custom base URL (standard in multi-provider libs). **Needs verification.**
2. **Via vLLM + pi-pods**: run qwen3 on vLLM locally; pi-pods is designed for this exact deployment model.
3. **Native ollama provider**: would require upstream contribution if absent.

If (1) works, PL+pi+qwen3-opencode:30b becomes the direct analog of today's PL+opencode+qwen3-opencode-big:30b scaffolding stack with broader tool support and session forking.

## 6. Two concrete experiments

**E1 — PL+pi vs solo-pi on H1-H10 fixtures (local qwen3-opencode:30b via OAI-compat shim).**
- Prediction: PL+pi wins ≥6/10, matching the PL+aider 6-0-3 pattern, because pi's richer tool set makes the verification-gate amplification larger, not smaller.
- Success: `gates_passed(PL+pi) - gates_passed(solo-pi) ≥ 3` across H1-H10.

**E2 — Multi-provider race: PL `spawn` runs pi with three providers (Claude subscription, ollama qwen3-opencode:30b, OpenRouter gemini-flash) on the same bounded-feature task; PL `race` accepts first gate-passing candidate.**
- Prediction: median wall-clock beats best single-provider baseline by ≥25%, and local qwen3 wins ≥1/5 trials on simple tasks.
- Success: `median(race_time) ≤ 0.75 × median(best_single_provider_time)` over 5 trials on `bounded-feature-benchmark`.

## 7. Existence check

pi-mono exists at the given URL and matches the description. No disambiguation needed. Do not confuse with:
- `pi-hole/*` (DNS ad-blocker), unrelated.
- `raspberry-pi` ecosystem repos, unrelated.
- `pi-apps` (Raspberry Pi app store), unrelated.

badlogic's pi-mono is the correct target.
