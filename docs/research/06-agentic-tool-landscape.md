# Report 06: Agentic Tool Landscape

> Q6: How do current agentic coding tools handle orchestration, and where does prompt-language fit?

## Abstract

The agentic coding tool market has converged on a remarkably uniform set of architectural primitives: ReAct-style agent loops for reasoning, git worktrees for filesystem isolation, CI pipelines as quality gates, and MCP as the universal plugin protocol. Every major tool -- Copilot, Cursor, Devin, Claude Code, Codex, Windsurf -- uses some variant of this stack. Yet none of them exposes a user-facing workflow DSL that lets developers specify how the agent should sequence its work, when to loop, what variables to capture, or which gates must pass before completion. The industry has invested heavily in making agents more autonomous and more parallel, but has left the orchestration layer -- the part that tells a skilled agent _what to do next_ -- entirely implicit, embedded in natural language prompts or hidden inside platform-internal control logic. prompt-language occupies this gap. It is not competing with these tools; it sits on top of them (currently Claude Code) as a meta-orchestration layer that provides the structured workflow semantics no other tool offers. This report synthesizes findings from eight source documents covering IDE architecture, mission-centered UX, VAOP platforms, OpenClaw agent ecosystems, and competitive landscape analysis.

## Architecture Note

The landscape is converging on a few dominant patterns -- git worktrees for isolation, ReAct loops for agent reasoning, and CI as the quality gate -- but no tool provides a user-facing workflow DSL that developers can author to control agent behavior. prompt-language fills this gap as a layer that sits ON TOP of any agent, currently Claude Code, providing sequencing, variable management, control flow, and gate enforcement without replacing the agent's own reasoning capabilities. As established in Report 00, this is the distinction between a chaining framework (which sequences raw LLM calls) and a meta-orchestrator (which structures goals for an already-autonomous agent).

## Key Findings

### Finding 1: The Industry Has Converged on ReAct-Style Agent Loops

Every major agentic coding tool uses a variant of the ReAct (Reason + Act) pattern: the agent reasons about a goal, selects and invokes a tool, observes the result, and loops. Cursor, Claude Code, Codex, Devin, and Windsurf all implement this core loop. Claude Code operates as a "single-threaded master loop" where one agent session handles reasoning, tool use, and self-correction iteratively [agentic-ide-architecture]. The OpenAI Codex CLI follows the same pattern with its agent dispatching tool calls within a sandboxed environment [agentic-ide-architecture]. This convergence means the _inner_ agent loop is commoditized; the differentiation frontier has moved outward to orchestration, parallelism, and governance.

### Finding 2: Git Worktrees Have Become the Standard Isolation Primitive

Cursor runs up to 8 parallel agents in git worktrees locally. Claude Code's Agent Teams uses worktree-based isolation for its 10-teammate coordination. Augment Code's Intent system runs each Implementor agent in its own worktree. Boris Cherny (Claude Code's creator) called worktrees his "#1 productivity tip," running 3-5 simultaneously [mission-centered-ide]. However, T3 Code's documented "Spotlight problem" demonstrates that worktrees alone are insufficient: testing against the full local dev stack is impractical because the rest of the stack does not know about the worktree [agentic-ide-architecture]. Worktrees solve filesystem isolation but not integration testing, port conflicts, or process sandboxing.

### Finding 3: No Tool Has Automated Multi-Agent Merge-Back

This is the single largest unsolved problem in the agentic IDE space. Every tool that supports parallel agents (Cursor's 8-agent parallelism, Claude Code's Agent Teams, Codex's 6 subagents) produces isolated branches, but none provides automated merge-back with conflict resolution. Standard git manages only 15/31 clean merges on benchmark conflicts. Tools like Weave (entity-level semantic merge via tree-sitter, achieving 31/31 on the same benchmark) and Mergiraf (83% resolution rate vs git's 48%) exist but are not integrated into any mainstream agentic IDE [agentic-ide-architecture]. The merge problem is especially relevant for prompt-language's `spawn`/`await` pattern, which creates parallel child agents that must eventually reconcile their work.

### Finding 4: Sandboxing Strategies Range from Lightweight to Heavyweight

The sandboxing spectrum reveals clear architectural trade-offs. OpenAI Codex uses a three-tier approach: Landlock LSM + seccomp-bpf on Linux, Seatbelt (`sandbox-exec`) on macOS, and Windows Restricted Tokens, all implemented in pure Rust with no external dependencies. Codex Cloud runs Firecracker microVMs with two-phase runtime (setup with network, then agent offline), achieving 90% faster cold starts (48s to 5s) via container caching. At the lightweight end, bubblewrap (`bwrap`) creates full sandboxes in approximately 4ms (3x faster than Docker) and is used by Claude Code's `@anthropic-ai/sandbox-runtime`. OpenClaw uses Docker containers with no network by default, requiring explicit opt-in for egress [agentic-ide-architecture, openclaw-hardening]. prompt-language currently inherits whatever sandboxing Claude Code provides, delegating security to the host agent's infrastructure.

### Finding 5: CI-as-Gate Is the Universal Quality Mechanism, but It Is Implicit

Devin's core workflow is "auto-fix until CI passes" -- it runs code, checks CI, and loops on failures automatically. Cursor's BugBot provides automated pre-merge PR scanning. GitHub Copilot's coding agent assigns issues, produces PRs, and triggers CI. Claude Code's hooks system allows pre/post-execution checks [agentic-ide-architecture, mission-centered-ide]. In every case, the gate logic is hardcoded into the platform or expressed as CI configuration external to the agent's workflow. prompt-language makes gates _explicit and user-authored_: `done when: tests_pass` is a first-class DSL primitive that the developer writes directly in the workflow. This is a fundamental difference -- the gate is part of the workflow definition, not a platform feature or CI configuration.

### Finding 6: MCP and Agent Client Protocol Are Emerging as Interoperability Standards

The Model Context Protocol (MCP), introduced by Anthropic, is already supported by Cursor, Windsurf, Codex, Zed, Bolt.diy, and Claude Code as the universal plugin/tool system. The Agent Client Protocol (ACP), co-developed by Zed and JetBrains, is becoming the standard for agent-IDE interoperability [agentic-ide-architecture]. OpenClaw's architecture also relies on typed tools with allow/deny policies, a pattern that aligns with MCP's capability-based model [openclaw-extending]. For prompt-language, MCP is significant because it means the DSL's `run:` nodes can potentially invoke any MCP-connected tool, and the plugin itself is installed via Claude Code's MCP-adjacent plugin system.

### Finding 7: The "Mission-Centered" UX Paradigm Remains Unclaimed

HCI research strongly validates task-based navigation over file-based navigation (Kersten and Murphy's Mylyn research showed 15% improvement in edit ratio across 16 industry programmers). No major product owns the full Plan-Execute-Review-Escalate lifecycle. Kiro has Plan-Approve-Execute but lacks dynamic escalation. Devin plans and executes autonomously but is opaque during execution. Copilot produces PRs but has no structured planning phase [mission-centered-ide]. prompt-language's flow blocks represent a user-authored plan: the developer specifies what the agent should do, in what order, with what conditions. This is a lightweight form of mission specification -- not a full dashboard, but a textual workflow that provides the structure the "mission-centered" paradigm calls for.

### Finding 8: Always-On Agent Deployments Reveal Orchestration as the Core Challenge

OpenClaw demonstrates what happens when an agent runs continuously: the architecture evolves into "connectors + durable workflows + policy gates + agents-as-planners" rather than "one smart agent." OpenClaw's always-on systems use cron-driven loops, durable state in memory files, ingest/commit tier separation, and approval-gated actuator planes [openclaw-hardening, openclaw-extending]. The VAOP (Vertical Autonomous Operations Provider) model makes the same observation from a business perspective: reliable autonomous operations require durable workflow orchestration, strict interface contracts, idempotent writes, and human-in-the-loop checkpoints [vaop-orchestration-ecosystem, vaop-modular-platform]. This is the exact set of concerns prompt-language addresses for coding workflows: sequencing (flow blocks), variable contracts (`let`/`var`), retry semantics (`retry max N`), and gate enforcement (`done when:`).

### Finding 9: Parallel Agent Coordination Is Nascent and Fragile

Cursor's 8 parallel agents and Claude Code's Agent Teams (up to 10 teammates) represent the state of the art in multi-agent coding. Anthropic built a C compiler using 16 parallel Claude agents across approximately 2,000 sessions for under $20K, using git-based file locking for coordination [agentic-ide-architecture]. OpenClaw's multi-agent routing uses per-agent workspace isolation with deterministic bindings and tool-policy restrictions [openclaw-extending]. However, coordination semantics are primitive: there is no standard way to express "wait for these three agents, then merge their results and continue." prompt-language's `spawn "name"` / `await "name"` / `await all` provides exactly this pattern, with variable import from child processes (`childName.varName`), making it one of the few tools that gives users declarative control over parallel agent coordination.

### Finding 10: The Extension Ecosystem Is a Security Attack Surface

OpenClaw's skills marketplace suffered documented malicious extension incidents in early 2026, including infostealer delivery via "skill" bundles that are essentially Markdown instruction files [openclaw-extending, openclaw-hardening]. The VAOP research emphasizes that agent tool integrations create supply-chain attack surfaces: "installing a skill is equivalent to granting executable authority" [vaop-orchestration-ecosystem]. prompt-language mitigates this by design: it is a workflow definition language, not an extension marketplace. The DSL's primitives (`prompt:`, `run:`, `let`, `if`, `while`) are fixed and interpreted by the plugin; there is no mechanism for third-party code injection through the DSL itself. Security risk is inherited from Claude Code's own permission model and `--dangerously-skip-permissions` flag, not from the workflow specification.

### Finding 11: The Gap Between IDE Orchestration and User-Specified Workflow Control Is Fundamental

Every tool in the landscape embeds orchestration logic _inside the platform_: Devin's planner-executor split is internal, Cursor's parallel agent dispatch is automatic, Claude Code's Agent Teams coordination is managed by the team lead session. The user's only control surface is the natural language prompt and platform configuration (`.cursor/environment.json`, `.codex/agents/` TOML files, Claude Code's `CLAUDE.md`). No tool lets the user write `while tests_fail max 3 / prompt: Fix the error / end` as a declarative workflow. This is not a minor UX gap; it is a fundamental architectural absence. Durable workflow engines like Temporal provide this for backend services. BPMN provides this for business processes. prompt-language provides this for agentic coding -- making it the only tool that treats agent workflow as a user-authored artifact [agentic-ide-architecture, mission-centered-ide, vaop-orchestration-ecosystem].

## How prompt-language Compares

| Finding                 | Industry Pattern                                                     | prompt-language Today                                                                           | Gap?                                                           |
| ----------------------- | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| ReAct agent loops       | All tools use reason-act-observe loops internally                    | Each `prompt:` node invokes Claude Code's full ReAct loop; the DSL sequences goals across loops | No -- delegates reasoning to the agent by design               |
| Git worktree isolation  | Cursor (8 agents), Claude Code Agent Teams, Codex (6 subagents)      | `spawn`/`await` creates child `claude -p` processes with separate state dirs                    | Partial -- no worktree creation; children share the filesystem |
| Multi-agent merge-back  | Unsolved across the industry; no automated merge                     | `await` imports child variables but does not merge file changes                                 | Yes -- same gap as the rest of the industry                    |
| Sandboxing              | Codex (Firecracker/Landlock), Claude Code (bwrap), OpenClaw (Docker) | Inherits Claude Code's sandboxing; no additional isolation                                      | No -- appropriate for a meta-orchestration layer               |
| CI-as-gate              | Devin auto-loops on CI; Copilot triggers CI; implicit platform logic | `done when: tests_pass` is explicit, user-authored DSL syntax                                   | No -- prompt-language makes this declarative, which is better  |
| MCP/ACP protocols       | Universal adoption across Cursor, Windsurf, Codex, Zed               | Plugin installs via Claude Code's plugin system; `run:` can invoke any CLI                      | No -- benefits from MCP ecosystem automatically                |
| Mission-centered UX     | Unclaimed; no tool owns the full lifecycle                           | Flow blocks provide a textual "mission plan" with sequencing and gates                          | Partial -- textual only, no dashboard or confidence scores     |
| Always-on orchestration | OpenClaw uses cron + durable state + approval gates                  | Designed for session-scoped workflows, not persistent daemon operation                          | Yes -- not designed for always-on; session-based               |
| Parallel coordination   | Primitive across all tools; no declarative semantics                 | `spawn`/`await`/`await all` with variable import                                                | No -- one of the most explicit coordination models available   |
| Extension security      | OpenClaw skill marketplace compromised; supply-chain risk            | Fixed DSL primitives; no third-party code injection via workflow                                | No -- secure by design                                         |
| User-specified workflow | No tool provides this; orchestration is internal to platforms        | Core value proposition: 12 node kinds, control flow, gates, variables                           | No -- this is the unique contribution                          |

## DSL Examples

### Gate enforcement vs. Devin's auto-fix-until-CI-passes

Devin's CI loop is hardcoded into the platform. In prompt-language, the same pattern is explicit and composable:

```
flow:
  prompt: Implement the authentication module
  run: npm test

done when:
  tests_pass
```

The developer authors the gate. They can use built-in predicates (`tests_pass`, `file_exists`, `lint_pass`) or custom gates (`gate build_passes: npm run build`). Devin's loop is binary (CI pass/fail); prompt-language's gates can compose multiple checks.

### `spawn`/`await` vs. Cursor's parallel agents

Cursor automatically dispatches up to 8 agents in worktrees. In prompt-language, parallelism is declared by the user:

```
flow:
  spawn "auth"
    prompt: Implement the auth service in src/auth/
  end
  spawn "api"
    prompt: Implement the API routes in src/api/
  end
  await all
  prompt: Integrate auth and API. Auth result: ${auth.result}, API result: ${api.result}
```

The key difference: Cursor decides what to parallelize; prompt-language lets the developer decide. Child variables are imported with name prefixes (`auth.result`, `api.result`), giving the subsequent prompt explicit access to parallel results.

### Gate system vs. CI integration

GitHub Copilot triggers CI as a side effect of PR creation. prompt-language makes the gate a blocking condition in the workflow:

```
flow:
  retry max 3
    run: npm run build
    if command_failed
      prompt: Fix the build error shown in ${last_stderr}
    end
  end
  run: npm test

done when:
  tests_pass
  gate lint_clean: npm run lint
```

Multiple gates compose: `tests_pass` uses the built-in test runner resolution, while `gate lint_clean:` runs an arbitrary command as a custom gate predicate. The agent cannot declare the workflow complete until all gates pass.

### Variable capture vs. framework state management

LangChain and similar frameworks manage state through Python/TypeScript objects with explicit serialization. prompt-language manages state through DSL-level variables:

```
flow:
  let version = run "node -v"
  let status = run "git status --porcelain"
  if ${status} != ""
    prompt: There are uncommitted changes. Node version is ${version}. Please review and commit.
  end
  let result = prompt "Summarize what you committed"
  prompt: The commit summary was: ${result}
```

Variables are captured from command output (`let x = run "cmd"`), from agent responses (`let x = prompt "question"`), or from literals (`let x = "value"`). They interpolate into subsequent nodes via `${varName}`. This is simpler than framework state management because the state model matches the workflow's sequential execution -- there is no serialization layer, no database, and no distributed state.

## Enhancement Opportunities

Based on the landscape analysis, several areas merit future investigation (cross-ref Report 07 when available):

1. **Worktree-aware spawn**: `spawn` could create git worktrees for child agents, aligning with the industry pattern and providing true filesystem isolation. This would move prompt-language from "shared filesystem parallelism" to the same isolation model as Cursor and Agent Teams.

2. **Merge-back primitives**: After `await all`, a `merge` node or automatic merge-back step could invoke semantic merge tools (Weave, Mergiraf) to reconcile parallel agent work. This would address the industry's largest unsolved problem.

3. **Confidence-based gates**: Beyond binary pass/fail, gates could report confidence scores (test coverage percentage, lint warning count, type-check severity) and enforce thresholds, aligning with the mission-centered IDE research on trust calibration through evidence trails.

4. **MCP tool integration in `run:` nodes**: Explicit MCP server invocation from `run:` nodes would let workflows call any MCP-connected tool, not just shell commands, expanding the DSL's reach to the full MCP ecosystem.

5. **Persistent workflow mode**: For always-on use cases (inspired by OpenClaw's cron-driven loops and the VAOP model), prompt-language could support durable workflows that survive session restarts, with checkpoint/resume semantics similar to Temporal's event-sourced execution.

6. **Approval gates**: A `gate` variant that pauses execution and waits for human approval before continuing, inspired by OpenClaw's exec approval model and the VAOP "A1: agent-proposed, human-approved" execution tier.

## Sources

- [agentic-ide-architecture.md](sources/agentic-ide-architecture.md) -- Building next-gen agentic IDE architecture
- [mission-centered-ide.md](sources/mission-centered-ide.md) -- The mission-centered IDE: market, science, architecture, and validation
- [vaop-orchestration-ecosystem.md](sources/vaop-orchestration-ecosystem.md) -- VAOP orchestration ecosystem
- [vaop-modular-platform.md](sources/vaop-modular-platform.md) -- VAOP modular platform
- [vaop-mvp-research.md](sources/vaop-mvp-research.md) -- VAOP MVP research programme
- [openclaw-docs-combined.md](sources/openclaw-docs-combined.md) -- OpenClaw documentation (643 files)
- [openclaw-hardening.md](sources/openclaw-hardening.md) -- OpenClaw hardening for high-privilege deployments
- [openclaw-extending.md](sources/openclaw-extending.md) -- Extending OpenClaw beyond baseline capabilities
