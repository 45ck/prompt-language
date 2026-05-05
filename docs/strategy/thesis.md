# Prompt Language Thesis

## One-line thesis

Prompt language is not just a way to prompt models better.
It is a higher-level engineering medium where humans program the execution system, and code becomes a downstream artifact produced, repaired, and maintained by agents.

## Important boundary

This page is intentionally broader than the current shipped product.

Today, prompt-language is best understood as a **verification-first supervision runtime for coding agents**. The thesis on this page is the larger bet the repo is trying to prove or disprove over time:

- product today: reliable supervision, verification, recovery structure, and inspectable agent execution
- thesis later: prompt-language artifacts become a primary engineering surface for bounded software

If the evidence never supports that larger step, the product can still succeed as a runtime.

## Core claim

Traditional software engineering treats source code as the primary thing engineers write.

Prompt language shifts that upward.

In the prompt-language world, engineers primarily write:

- goals
- constraints
- architecture
- workflows
- verification gates
- approvals
- parallel work decomposition
- memory
- reusable wisdom
- recovery logic

The agents then produce and maintain the code beneath that layer.

## What this means

The long-term goal is not merely:

- "help Claude follow steps better"

The long-term goal is:

- to make prompt-language projects the main engineering surface
- to make raw code increasingly generated and maintained under those flows
- to let engineers fix recurring failures in prompt language itself, so the system improves structurally rather than requiring repeated babysitting
- to let teams accumulate reusable operational wisdom in multi-file prompt-language projects

In this model:

- code is no longer the only source of truth
- prompt-language becomes part of the source of truth
- over time, it may become the primary source of truth for bounded classes of software systems

## End-state vision

When prompt language is fully realized, engineers will increasingly work on prompt-language projects instead of directly on code.

A prompt-language project may contain:

- product and architecture intent
- reusable flow libraries
- environment-specific procedures
- safety and approval rules
- domain wisdom
- debugging and recovery playbooks
- quality gates
- task decomposition logic
- multi-agent orchestration logic
- persistent memory and lessons learned

When a problem occurs, the engineer should be able to fix the system at the prompt-language layer so the same class of failure is less likely to happen again.

That is a major shift:

- from fixing outputs manually
- to fixing the execution system that produces the outputs

## Multi-file project vision

Prompt-language should evolve toward multi-file projects, not just single flows.

A mature prompt-language project could include files like:

- `vision.flow` — product and mission intent
- `architecture.flow` — system design and constraints
- `policies.flow` — approvals, risk limits, and guardrails
- `wisdom.flow` — lessons, heuristics, and recurring patterns
- `build.flow` — main software factory flow
- `repair.flow` — standard recovery loops
- `review.flow` — critique and evaluation logic
- `gates.flow` — shared verification gates
- `agents/` — specialist worker flows
- `memory/` — persistent captured context and operating knowledge

The point is to make agentic work programmable, reusable, and accumulative.

## Strongest hypothesis

Prompt language can become the main medium engineers use to build and operate bounded software systems by turning software development into an executable, reusable, multi-agent control system rather than a direct code-writing activity.

## What must be true for this thesis to hold

For this to be true, prompt language must prove that it can do more than simple gating.

It must show that it can reliably improve real engineering outcomes through:

1. structured execution
2. reusable multi-file project composition
3. accumulated wisdom and memory
4. parallel specialist coordination
5. stronger recovery from recurring failures
6. reduced need for human babysitting
7. bounded software delivery with hard verification

## What is already true

Prompt-language already has the shape of an execution runtime rather than a mere syntax toy: it provides persistent state, verification gates, control flow, parallel work, imports/reuse, memory, approvals, and inter-process messaging. See the [README feature surface](../../README.md) for the full list.

Current evaluation evidence shows its clearest proven strength is structural enforcement through gates: it wins when prompts are misleading, incomplete, or omit required criteria, while many pure control-flow and context-management tests currently tie with vanilla Claude. See the [evaluation analysis](../evaluation/eval-analysis.md) for hypothesis-by-hypothesis results.

The FSCRUD R30-R45 diagnostics add a narrower local-model finding: local inference
can be useful as a bounded semantic selector/ranker/rationale source when
prompt-language owns deterministic validation, normalization, rendering, and
verification. That is stronger than "write prompts better," but weaker than
"local model implements the product."

That means the repo's strongest grounded claim right now is not "prompt-language replaces software engineering." The strongest grounded claim is: **prompt-language can act as a useful supervision runtime with explicit verification and control structure around coding agents.**

For the current cross-experiment verdicts, see
[Research Synthesis: 2026-05-06](../evaluation/2026-05-06-research-synthesis.md).
The short version is: the runtime-supervision hypothesis has held up; the
local-autonomous-engineering hypothesis has not; bounded local semantic judgment
inside a deterministic PL envelope is the strongest new local-model finding; the
primary-engineering-medium thesis remains open.

## What is not yet proven

The following are still hypotheses, not established facts:

- that engineers will prefer editing prompt-language projects over editing code directly
- that multi-file prompt-language repositories become a stable engineering pattern
- that stored wisdom materially reduces babysitting over time
- that multi-agent prompt-language systems can build bounded software reliably
- that problems can be permanently "fixed at the prompt-language layer"
- that prompt language can become a primary engineering surface rather than just a supervision layer
- that local-only models can own full-stack implementation without deterministic
  product scaffolds and protected artifacts

## Research agenda

The repo should explicitly orient toward proving or disproving this larger thesis.

The next phase is not just:

- "does gating help?"

The next phase is:

- "can prompt language become a durable engineering substrate?"

## Falsifiable hypotheses

### H1 — Prompt-language projects outperform one-shot prompting

Multi-step prompt-language projects with gates and reusable flows produce more reliable outcomes than plain prompting on bounded software tasks.

### H2 — Multi-file prompt-language projects outperform single-file flows

Projects with separated architecture, policies, wisdom, and worker flows are more maintainable and more reliable than one large flat flow.

### H3 — Wisdom files reduce babysitting

A reusable `wisdom.flow` or equivalent project memory reduces repeated human corrections across runs of similar tasks.

### H4 — Recovery logic can be lifted into prompt language

When a recurring failure happens, encoding the recovery in prompt language improves future success more than fixing the final code output alone.

### H5 — Parallel specialist workers help when seams are real

Prompt-language coordination of planner / architect / implementer / tester / reviewer agents improves medium-complexity bounded software delivery when work is split across real boundaries.

### H6 — Prompt language can become the primary engineering surface for bounded software

For a narrow class of apps, the majority of meaningful engineering work can be expressed in prompt-language artifacts rather than direct code edits.

## Experiments that can prove or disprove the thesis

### Experiment 1 — Repeated failure elimination

Goal: test whether a recurring failure can be solved structurally.

Method:

- choose 10 recurring failure patterns
- run baseline agent workflows
- record repeated human interventions
- encode fixes into prompt language
- rerun the same task family

Success criteria:

- fewer repeated interventions
- lower cleanup time
- higher pass rate
- failures shift from known patterns to new patterns

Interpretation:

- if successful, this supports the claim that problems can be fixed at the execution layer rather than repeatedly at the output layer

### Experiment 2 — Single-file vs multi-file prompt-language projects

Goal: test whether project structure matters.

Method:

- implement the same bounded feature factory twice:
  - one giant flow
  - one multi-file project with imports, shared gates, policies, and wisdom
- compare reliability and maintainability over multiple tasks

Success criteria:

- fewer regressions
- easier edits
- lower duplication
- better composability
- lower prompt churn

Interpretation:

- if multi-file projects win, that supports the "prompt-language repository" vision

### Experiment 3 — Wisdom accumulation

Goal: test whether explicit stored heuristics improve later runs.

Method:

- create a `wisdom.flow` with concrete lessons such as:
  - always verify tenant isolation
  - never trust self-reported completion
  - check loading / empty / error states
  - prefer boring migrations
  - repair root causes, not symptoms
- run a set of tasks with and without wisdom loaded

Success criteria:

- fewer repeated mistakes
- better evaluation scores
- lower babysitting
- more stable outcomes across runs

Interpretation:

- if successful, this supports the claim that teams will encode engineering wisdom directly in prompt-language projects

### Experiment 4 — Prompt-language-first software factory

Goal: test whether prompt language can act as the main engineering layer.

Method:

- choose one bounded app type, e.g. CRUD SaaS on a fixed stack
- require that all meaningful engineering intent be expressed in prompt-language files first
- let agents generate and maintain the code from that layer
- humans edit the prompt-language project first, and code only secondarily when needed

Success criteria:

- working app delivered
- core journeys pass
- code mostly conforms to prompt-language structure
- new changes are easier to express in prompt language than direct code edits

Interpretation:

- if this works well, it is the strongest evidence for the thesis

### Experiment 5 — Parallel specialist orchestration

Goal: test whether prompt language can coordinate a real bounded multi-agent system.

Method:

- split work into planner, architect, backend, frontend, QA, and reviewer flows
- isolate their artifacts and integration points
- evaluate against a single-agent version

Success criteria:

- better plan quality
- higher acceptance-criteria coverage
- lower missed requirements
- acceptable integration cost
- net reduction in human supervision

Interpretation:

- if successful, this supports the "software factory" direction

## Evaluation criteria

Every major experiment should track:

- task success rate
- premature-stop rate
- human babysitting minutes
- human cleanup minutes
- repeated-failure rate
- integration bug count
- run-to-run variance
- total cost / latency
- usefulness of produced artifacts
- whether the human preferred editing prompt language or raw code

The final metric is especially important:

### Engineering Surface Preference

For each change, ask:

- was it easier to modify the prompt-language project or the code directly?

This is the key leading indicator of the long-term thesis.

## What would strongly confirm the thesis

The thesis is strongly supported if:

- prompt-language projects become easier to change than raw code for a meaningful subset of work
- wisdom files measurably reduce babysitting
- recurring failures are eliminated by changing prompt-language artifacts
- multi-file projects outperform flat flows
- bounded software can be built and evolved primarily through prompt-language edits
- engineers increasingly operate at the prompt-language layer first

## What would weaken the thesis

The thesis is weakened if:

- prompt language only helps through gates and little else
- multi-file structure adds complexity without reliability gains
- wisdom files do not reduce repeated mistakes
- humans still prefer direct code edits for most real changes
- software-factory experiments collapse into heavy manual cleanup
- parallel coordination adds more instability than value

## Product direction implied by this thesis

If this thesis is true, prompt language should be developed not just as a syntax or plugin, but as:

- a project system
- a reusable engineering medium
- a memory and wisdom layer
- a multi-agent orchestration runtime
- a control plane for bounded software production

## North star

The north star is not:

- "better prompts"

The north star is:

- engineers building and evolving software systems by editing prompt-language projects that produce, verify, repair, and improve code over time.

Code remains important.

But prompt language becomes the higher-order medium that engineers work in first.
