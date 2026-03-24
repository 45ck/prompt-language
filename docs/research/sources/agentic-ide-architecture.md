# Building a next-generation agentic IDE: architecture deep dive

**The core unsolved problem in agentic IDEs isn't running multiple agents — it's merging their work back together reliably.** Every major tool in 2025-2026 (Codex, Cursor, Claude Code, Windsurf) uses git worktrees for isolation, but none have automated merge-back. This gap is exactly where Calvin's merge/review orchestration layer can differentiate. The architecture below synthesizes patterns from 20+ tools and projects into a concrete blueprint, with special emphasis on the merge layer, lightweight sandboxing without VMs, and desktop app architecture choices.

The landscape has converged on a few key primitives: git worktrees for filesystem isolation, bubblewrap/Landlock for process sandboxing, tree-sitter-based semantic merge for conflict resolution, and Electron for the desktop shell. The most exciting new tools — Weave for entity-level merge coordination, AgentFS for cross-platform CoW filesystems, and Portless for port routing — directly address the multi-agent local development problem.

---

## Isolation without containers: a layered approach

The research reveals a clear three-layer isolation strategy that avoids heavyweight VMs or Docker while giving each agent its own environment.

**Layer 1 — Port routing via Portless.** Vercel's open-source Portless project (github.com/vercel-labs/portless) is purpose-built for this exact scenario. It runs a local reverse-proxy daemon on port 1355 that assigns each dev server a `.localhost` subdomain — `agent-0.myapp.localhost:1355` routes to an auto-assigned port. It auto-detects git worktree names and prefixes subdomains accordingly. Zero overhead, cross-platform (macOS + Linux), and explicitly designed for "humans and agents." For frameworks like Vite that ignore the `PORT` env var, Portless auto-injects `--port` and `--host` flags. HTTPS support with auto-generated certificates is built in. **The critical limitation: Portless provides zero security isolation** — it only solves port conflicts. It must be paired with actual sandboxing.

**Layer 2 — Process sandboxing via bubblewrap (Linux) or Seatbelt (macOS).** Bubblewrap (`bwrap`) is the production-proven choice. Claude Code's `@anthropic-ai/sandbox-runtime`, OpenCode, and Flatpak all use it. A single bwrap invocation creates a full sandbox in **~4ms** (3x faster than Docker) with isolated PID, network, IPC, and UTS namespaces:

```bash
bwrap --ro-bind /usr /usr --ro-bind /lib /lib --ro-bind /etc /etc \
  --bind /path/to/worktree /workspace --proc /proc --dev /dev \
  --tmpfs /tmp --unshare-pid --unshare-net --unshare-ipc \
  --hostname agent-0 --new-session bash
```

Each agent gets its own network namespace, meaning **all agents can bind to port 3000 simultaneously** without conflicts. OpenAI's Codex takes a complementary approach — on Linux it uses **Landlock LSM** for filesystem ACLs plus **seccomp-bpf** for syscall filtering, implemented in pure Rust with no external dependencies. On macOS, Codex uses Apple's Seatbelt (`sandbox-exec`) with dynamically generated sandbox profiles. This dual-platform approach (bwrap/Landlock on Linux, Seatbelt on macOS) is the pattern to follow.

**Layer 3 — Filesystem isolation via AgentFS or OverlayFS.** AgentFS (github.com/tursodatabase/agentfs) from Turso is specifically designed for coding agents. It provides a **SQLite-backed copy-on-write overlay** where the host filesystem is the read-only base layer and all writes go to a SQLite delta. On Linux it uses FUSE; on macOS it uses NFS (avoiding the need for macFUSE kernel extensions). The agent sees the full filesystem but can't modify the host. For Linux-only deployments, kernel OverlayFS is faster — mount a writable upper directory over the read-only repo, and each agent gets instant CoW without duplicating the codebase.

**What T3 Code teaches us about the limits of worktrees alone.** T3 Code (github.com/pingdotgg/t3code) uses git worktrees as its only isolation primitive and has hit a documented wall: issue #525 describes the "Spotlight problem" — when agents work in isolated worktrees, testing against the full local dev stack is impractical because the rest of the stack doesn't know about the worktree. Their proposed workaround ("Spotlight mode") selectively syncs file changes back to the root repo for hot-reload testing. This confirms that **worktrees are necessary but not sufficient** — the sandboxing layers above solve what worktrees alone cannot.

---

## The merge orchestration layer: filling the industry's biggest gap

No major agentic IDE has automated multi-agent merge-back. This is the highest-value feature Calvin's tool can provide. The architecture has five components: conflict prevention, semantic merge, AI review, merge queue, and rollback.

**Conflict prevention starts at task planning time.** Microsoft's "Swarm Diaries" identified contract-first planning as "the single most impactful change" for multi-agent coordination. A coordinator agent decomposes each mission into tasks with explicit file boundaries, detects overlaps at planning time rather than merge time, and sequences tasks that touch the same files. BridgeSwarm makes merge conflicts "impossible by design" by giving each task exclusive file ownership. The practical implementation: maintain a `LockManager` backed by SQLite that tracks file-pattern locks per agent with TTL-based auto-expiry to prevent deadlocks from crashed agents.

**Weave is the breakthrough tool for semantic merge.** The Weave project (github.com/Ataraxy-Labs/weave) is an entity-level semantic merge driver built on tree-sitter that matches code entities by identity (name + type + scope) rather than line position. It achieves **31/31 clean merges** on benchmarks where standard git manages only 15/31. Weave supports 26+ languages and registers as a standard git merge driver via `.gitattributes`. Most critically for Calvin's use case, Weave ships an **MCP server with 14 tools for agent coordination**: `weave_claim_entity` and `weave_release_entity` for advisory function-level locking, `weave_potential_conflicts` for predictive conflict detection across branches, `weave_who_is_editing` for real-time overlap visibility, and `weave_preview_merge` for simulating merge outcomes. This enables **semantic region locking** — two agents can safely edit the same file if they touch different functions.

**The AI reviewer agent creates an adversarial quality gate.** The pattern, validated by Claude Code's Agent Teams documentation, is a "builder-validator chain": Agent A completes work → a distinct Reviewer Agent evaluates the diff against the mission spec, test results, and codebase conventions → if rejected, feedback loops back to Agent A (max 3 iterations before human escalation). The key design principle: **use a different model or system prompt than the coding agent** to reduce correlated failures. Structure the reviewer's output as a merge evidence record tied to the exact commit SHA:

```typescript
interface MergeEvidence {
  sha: string;
  testResults: TestReport;
  typeCheckClean: boolean;
  aiReviewVerdict: 'pass' | 'warn' | 'fail';
  confidenceScore: number; // 0-100, weighted composite
  stale: boolean; // true if code changed since evidence gathered
}
```

The confidence score aggregates signals: tests (30%), type-check (15%), security scan (15%), AI review (15%), lint (10%), coverage delta (10%), conflict risk (5%). Scores above 90 are auto-merge candidates; below 40 block merge entirely. Display this as a colored badge on each mission task card.

**The local merge queue processes agent work sequentially with test gates.** Adapted from Bors and GitHub's merge queue: each completed agent branch enters a FIFO queue. For each branch: create a checkpoint tag, merge into main, run the test suite, and either advance main (pass) or auto-revert and notify the agent (fail). Before individual merges, run **speculative integration testing** — merge all pending branches into a temporary branch and run tests on the combined result. If the combination fails, binary-search for the culprit (Mergify's pattern). This speculative test runs continuously in the background as agents work, surfacing integration problems before merge time.

**Rollback is checkpoint-based.** Tag main before every merge (`checkpoint/pre-merge-{mission}-{timestamp}`). On failure, `git reset --hard` to the checkpoint. For regression detection after merge, automated `git bisect run` with the failing test pinpoints the culprit commit. For high-risk changes, a canary merge pattern merges to an intermediate branch first, runs extended tests, and only fast-forwards main if stable.

---

## How the current agentic IDEs are actually built

The competitive landscape reveals clear architectural patterns worth adopting and gaps worth exploiting.

**Codex (OpenAI)** is the most architecturally sophisticated open-source option. Originally TypeScript, it's being rewritten in Rust for native security bindings. Its three-tier sandbox architecture dispatches to platform-specific enforcement (Seatbelt → Landlock+seccomp → Windows Restricted Tokens). It supports spawning up to 6 concurrent subagents that inherit sandbox rules, with custom agent definitions via `.codex/agents/` TOML files. Codex Cloud uses Firecracker microVMs with two-phase runtime (setup with network → agent offline) and achieved **90% faster cold starts** (48s → 5s) via container caching.

**Cursor** runs up to **8 parallel agents** in git worktrees locally, with Background Agents running in isolated Ubuntu VMs on AWS for async work. Background Agents clone from GitHub, work on a branch, push, and create a PR. Configuration via `.cursor/environment.json` specifies install commands, terminal processes, and encrypted secrets. BugBot provides automated pre-merge PR scanning. Cursor's token-based pricing ($20/mo Pro tier gives ~225 Sonnet 4 requests) and closed-source model represent the commercial benchmark.

**Claude Code's Agent Teams** (shipped February 2026) provides native multi-agent orchestration where one session acts as team lead, spawning up to 10 teammates that communicate via shared JSON inbox files. Anthropic built a C compiler using 16 parallel Claude agents across ~2,000 sessions for under $20K. They used **git-based file locking** for coordination — a simple but effective approach.

**Windsurf** has the best browser integration for web development: an **embedded browser panel** that bidirectionally communicates with the Cascade agentic engine. Click any element in the preview → Cascade reshapes it. This is the gold standard UX for web dev preview and worth emulating.

**Bolt.new's WebContainers** represent an alternative architecture — WebAssembly-compiled Node.js running entirely in the browser, with a virtual TCP stack mapped to Service Workers for localhost simulation. Impressive for hosted tools, but the JavaScript-only runtime and commercial licensing for production use limit its applicability for a local desktop IDE.

**Two emerging protocols matter.** The **Agent Client Protocol (ACP)**, co-developed by Zed and JetBrains, is becoming the standard for agent-IDE interoperability. The **Model Context Protocol (MCP)** is already supported by Cursor, Windsurf, Codex, Zed, and Bolt.diy as the universal plugin/tool system. Calvin's IDE should support both.

---

## Mission-centered UX for merge state

Calvin's mission-centered operating model should completely abstract git. Users see missions and tasks, never branches. Each completed task shows its **merge confidence score** as a colored badge. An integration health indicator runs speculative merge testing in the background and surfaces results as "Integration Health: ✅ Pass" or "⚠️ Conflict between Task B and Task C." Conflict warnings are expressed as task relationships ("Agent D is waiting — Agent C is editing shared files"), not git jargon.

The mission dashboard should display: task status per agent, confidence scores, integration health, and action buttons (Review Changes, Merge Completed Tasks, Pause). The "Review Changes" button opens a clean diff view showing only what changed for that specific task. "Merge Completed Tasks" triggers the sequential merge queue with test gates. Internally, branches use `mission-{id}/task-{id}` naming, but this is never exposed to the user. The one-click merge handles the entire pipeline: sequential merge → test gate → checkpoint → advance main or rollback.

---

## Desktop app architecture: Electron with Rust sidecars

**Electron is the right choice for this specific use case**, despite Tauri's advantages in other contexts. The decisive factors: full Node.js access for process/PTY/container management, Chromium consistency across platforms (Tauri's OS WebViews have documented SVG/CSS fragmentation bugs), `WebContentsView` for embedded browser previews (no Tauri equivalent), and ecosystem alignment — VS Code, Cursor, Windsurf, and T3 Code all use Electron. The entire IDE tooling stack (node-pty, xterm.js, Monaco) is Node.js-native.

**Terminal multiplexing follows VS Code's PTY Host pattern.** Run all PTY sessions in a dedicated Electron utility process (not the main process), communicating with the renderer via MessagePorts for direct, low-latency streaming. Each agent gets its own `node-pty` session pointed at its worktree directory. For N agents, expect ~2-5MB per PTY process. Use `xterm.js` with the WebGL addon for GPU-accelerated terminal rendering in the UI. Buffer output for inactive agent terminals and detach xterm.js instances from the DOM until the user switches to that agent's tab.

**Browser previews use WebContentsView** (Electron's replacement for the deprecated BrowserView). Each active agent gets its own WebContentsView loading its dev server URL. Each view spawns a separate renderer process (~30-80MB). Mitigation: pool and reuse views, destroy views for inactive agents, or use a single preview panel that switches between agent URLs. Figma pioneered this pattern and found it dramatically better than `<webview>` for performance.

**The process supervision layer manages agent lifecycles** in a utility process with health checks (periodic heartbeat, memory/CPU monitoring), restart policies (configurable: always, on-failure, never, with exponential backoff), graceful shutdown (SIGTERM → wait → SIGKILL), and resource limits. Use the `tree-kill` npm package to kill entire process trees when an agent spawns sub-processes. The `pidusage` package provides cross-platform CPU/memory stats per process.

**IPC topology uses three layers**: `ipcMain.handle` for request/response between renderer and main process, `MessagePort` channels for high-throughput streaming between renderer and utility processes (PTY Host, Agent Supervisor, File Watcher), and Electron's event system for broadcast notifications. SharedArrayBuffer is not supported over Electron IPC, so MessagePorts are the fastest option for binary data.

For container management when sandboxing beyond bwrap is needed, shell out to **rootless Podman** via its REST API (Unix socket at `/run/user/${uid}/podman/podman.sock`) or CLI. No daemon required, no root required. Each container gets automatic network namespace isolation. The app should never require elevated privileges for normal operation.

---

## Key repositories and tools to integrate

The most impactful open-source tools for Calvin's architecture, prioritized by relevance:

- **Weave** (github.com/Ataraxy-Labs/weave) — Entity-level semantic merge driver with MCP agent coordination tools. This is the single most important integration for the merge layer.
- **Portless** (github.com/vercel-labs/portless) — Zero-overhead port routing via `.localhost` subdomains, with native git worktree support.
- **AgentFS** (github.com/tursodatabase/agentfs) — Cross-platform CoW filesystem overlay for agent sandboxing, SQLite-backed.
- **Bubblewrap** (github.com/containers/bubblewrap) — Lightweight namespace sandboxing, ~4ms per sandbox. Used by Claude Code and OpenCode.
- **OpenAI Codex** (github.com/openai/codex) — Reference implementation for multi-platform sandboxing in Rust (Seatbelt + Landlock + seccomp).
- **Mergiraf** (codeberg.org/mergiraf/mergiraf) — Syntax-aware git merge driver using tree-sitter, 83% resolution rate vs git's 48%.
- **Rizzler** (github.com/ghuntley/rizzler) — AI-powered merge conflict resolver supporting multiple LLM providers, registers as git merge driver.
- **dmux** (npm) — Dev agent multiplexer with smart merge workflow, pre/post-merge hooks, AI-powered branch naming.
- **Worktrunk** (cargo install worktrunk) — CLI for git worktree lifecycle management designed for parallel agent workflows.
- **T3 Code** (github.com/pingdotgg/t3code) — Reference for worktree-first agent GUI patterns, MIT licensed.

## Conclusion

The agentic IDE space has converged on git worktrees as the isolation primitive but left the merge problem unsolved. Calvin's key architectural insight should be that **merge orchestration is the product** — the coordinator agent, semantic merge via Weave, speculative integration testing, and confidence-scored review gates compose into something no existing tool offers. The sandboxing stack (Portless + bwrap/Seatbelt + AgentFS) provides real isolation without container overhead. Electron provides the necessary ecosystem depth for managing PTYs, embedded browsers, and agent lifecycles. The most counterintuitive finding: intent-based task decomposition at planning time prevents more merge conflicts than any merge tool can resolve after the fact. Building the coordinator agent that decomposes missions into non-overlapping tasks — using Weave's MCP tools for entity-level advisory locking — may be the single highest-leverage investment in the entire architecture.
