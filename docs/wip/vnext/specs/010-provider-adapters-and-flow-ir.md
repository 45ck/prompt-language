# Spec 010 — Provider adapters and Flow IR

## Problem

The runtime is currently grounded in provider-specific hook behavior. That is workable short term, but risks reducing prompt-language to “a Claude integration with extras” rather than a language/runtime that can survive across providers.

## Goals

- Define a stable Flow IR
- Separate compile/runtime from provider adapters
- Support multiple execution backends over the same IR
- Make static analysis and simulation easier

## Non-goals

- Do not prematurely erase useful provider-specific capabilities
- Do not attempt perfect portability on day one

## Proposed model

### Source layers

- specs
- contracts
- schemas
- policies
- flows

### Compile output

Flow IR should contain:

- explicit nodes and edges
- node classes
- effect metadata
- capability requirements
- contracts and policy refs
- schema refs
- artifact producers/consumers
- budget info
- child flow topology

### Provider adapters

Adapters interpret Flow IR for specific runtimes:

- Claude Code adapter
- Codex CLI adapter
- future adapters

### Tool adapters

Optional typed adapters interpret operations against:

- git
- npm
- GitHub
- deploy systems
- browser/test harnesses

## Proposed CLI

```bash
prompt-language compile flows/fix-auth.flow --emit ir.json
prompt-language explain flows/fix-auth.flow
prompt-language lint flows/fix-auth.flow
prompt-language simulate flows/fix-auth.flow
prompt-language run flows/fix-auth.flow --provider claude-code
prompt-language run flows/fix-auth.flow --provider codex-cli
```

## Benefits

- provider portability
- easier testing
- clearer reviewability
- stronger compile-time diagnostics
- decoupling hooks from architecture

## Static analysis

The linter/compiler should:

- validate adapter capability coverage
- detect provider-incompatible nodes
- detect missing tool adapters for strict flows
- emit compatibility reports

## Acceptance criteria

- Flow IR exists and is stable enough for tooling
- The compile/explain/lint path exists
- Provider adapters are explicit
- Claude/Codex can target the same conceptual runtime

## Open questions

- How opinionated should Flow IR be about provider-native prompts/tool semantics?
- Should compile output be human-readable JSON, binary, or both?
