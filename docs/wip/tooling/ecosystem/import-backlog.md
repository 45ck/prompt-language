# Import Backlog

This page turns the ecosystem pack into explicit calls instead of vague inspiration.

## Import now

These fit prompt-language's current layer and already have a credible path into the repo.

### Fresh session boundaries

- Source: Archon, Agent Loom
- Primitive: explicit fresh-versus-threaded execution plus deterministic bootstrap handoff
- Why: this is the cleanest way to reduce context rot without bloating the language with more control flow
- Current backlog anchors: `prompt-language-r8vp.5`, `prompt-language-r8vp.6`, `prompt-language-r8vp.8`

### Runtime preflight

- Source: Hankweave Runtime
- Primitive: validate runner availability, required files, and gate prerequisites before execution
- Why: cheap reliability win for `validate`, `run`, `ci`, and smoke flows
- Current backlog anchor: `prompt-language-d1ag.6`

### Structured event journal

- Source: Hankweave Runtime, Druids
- Primitive: richer append-only execution events with replayable derived state
- Why: long runs become diagnosable instead of anecdotal
- Current backlog anchor: `prompt-language-zhog.3`

### Reference verifier patterns

- Source: Druids
- Primitive: reusable builder/critic, implementor/reviewer, and judge-worker reference flows
- Why: this can ship as docs, examples, and eval assets before it becomes syntax
- Current backlog anchor: `prompt-language-r8vp.7`

## Prototype next

These are promising, but they need evidence before they belong in the core runtime.

### Policy hooks

- Source: Streetrace, GitHub Agentic Workflows
- Primitive: explicit policy or constraint layer around input, tool use, and outputs
- Risk: this can easily become a half-built policy engine
- Current boundary check: `prompt-language-7kau`

### Compile targets

- Source: GitHub Agentic Workflows, Doctrine
- Primitive: compile or export prompt-language workflows into another runtime artifact
- Risk: this can distract from core runtime reliability
- Current architectural anchor: `prompt-language-zhog.8`

### Selective loading and context packs

- Source: Context Cascade, Agent Loom
- Primitive: explicit loading of only relevant rule, skill, or context subsets per task
- Risk: large architecture surface with weak evidence if copied wholesale
- Current nearby anchor: `prompt-language-9uqe.9`

## Reference only

Important to understand, but not near-term import targets.

### Full orchestration shell

- Source: Archon
- Call: reference for packaging and UX, not the core runtime direction today

### Production deployment substrate

- Source: AgentScope Runtime
- Call: relevant only if prompt-language becomes a served service or hosted runtime

### General prompt language ambitions

- Source: IBM PDL, Doctrine
- Call: useful as a design reference, but not the near-term problem the repo is solving

## Explicit non-goals for now

- rebuilding Archon's entire orchestrator shell
- rebuilding a hosted multi-VM agent platform
- turning prompt-language into a general serving framework
- building a giant cognitive architecture plugin tree
- adding syntax just because another project has a named primitive
