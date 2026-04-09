# Routing and Dispatch (WIP)

> **WIP: not implemented yet.** This page describes a proposed dispatch layer for prompt-language, not shipped syntax.

## Goal

Add a cleaner way to dispatch between predeclared flow targets when a project needs to classify work and then route execution into the right bounded path.

The motivating use case is a software-factory style repo that can choose between bounded software archetypes such as:

- CRM
- helpdesk
- booking
- generic B2B SaaS

## Problem

The current runtime already has enough primitives to approximate routing:

- `import` / `use` for reusable flow libraries
- `if` for branching
- `ask` for subjective true/false classification
- structured JSON capture for extracting typed model output

That means routing can be built in user space today, but the resulting flows become awkward once the number of branches grows.

### Current approximation

```yaml
import "archetypes/crm/index.flow" as crm
import "archetypes/helpdesk/index.flow" as helpdesk
import "archetypes/booking/index.flow" as booking
import "archetypes/generic/index.flow" as generic

flow:
  let route = prompt "Classify docs/brief.md into exactly one archetype" as json {
    "label": "crm | helpdesk | booking | generic",
    "confidence": "number",
    "reason": "string"
  }

  if ${route.confidence} < 0.75
    approve "Low-confidence route: ${route.label}. Reason: ${route.reason}"
  end

  if ${route.label} == "crm"
    use crm.run()
  else if ${route.label} == "helpdesk"
    use helpdesk.run()
  else if ${route.label} == "booking"
    use booking.run()
  else
    use generic.run()
  end
```

This works. The question is whether the language should expose a first-class construct for it.

## Scrutiny result

The idea is promising, but it is **not obviously a language feature yet**.

The first missing primitive may not be `route`. It may simply be a more general symbolic dispatch construct such as `match` or `switch`.

### Why this matters

If the main pain is ugly multi-branch selection, then a general-purpose `match` feature solves more problems than an AI-specific routing feature.

If the main pain is specifically classification plus dispatch with confidence handling, closed-world labels, and route metadata, then a dedicated `route` feature may be justified.

## Design principles

1. **Closed world only.** Routing must choose among predeclared labels or branches. The model must not invent arbitrary file paths or dynamic imports.
2. **Labels over paths.** Good routing targets are symbolic labels such as `crm` or `helpdesk`, not model-generated paths.
3. **Confidence is not enough.** Confidence should be accompanied by explicit reasoning and a clear low-confidence behavior.
4. **Inspection matters.** Routing decisions should be visible in state and artifacts so they can be evaluated later.
5. **Generality first.** Prefer the smallest feature that solves the general dispatch problem before adding a specialized router construct.
6. **No hidden magic.** A routing construct should remain legible as ordinary flow control, not become opaque AI behavior.
7. **Evaluation-friendly by design.** If the feature exists, it should make route correctness measurable.

## Recommendation

### Stage 1 — prove the pattern in user space

Build routing using existing features first:

- predeclared imported archetype libraries
- structured JSON capture for route selection
- explicit branch logic
- approvals for low-confidence cases

This reveals where the real friction is.

### Stage 2 — consider `match` first

If the real problem is branch verbosity, add a general symbolic dispatch feature before adding a specialized router.

### Stage 3 — add `route` only if it adds real semantics

A dedicated `route` feature earns its place only if it provides more than syntax sugar, for example:

- closed-world label validation
- built-in confidence + reason capture
- standardized low-confidence handling
- auto-exposed route metadata
- evaluation hooks for route correctness

## Proposed layered design

## Option A — `match` / `switch`

This is the more general and lower-risk feature.

### Example

```yaml
match ${route.label}
case "crm"
use crm.run()
case "helpdesk"
use helpdesk.run()
case "booking"
use booking.run()
default
use generic.run()
end
```

### Why it is attractive

- solves routing and many non-routing dispatch cases
- avoids AI-specific semantics at the language core
- keeps route selection separate from route execution
- has clearer boundaries and fewer surprises than a magic router

## Option B — `route`

This is the more specialized feature.

### Example shape

```yaml
import "archetypes/crm/index.flow" as crm
import "archetypes/helpdesk/index.flow" as helpdesk
import "archetypes/booking/index.flow" as booking
import "archetypes/generic/index.flow" as generic

flow:
  route product_type using prompt "Classify docs/brief.md into exactly one declared archetype" as json {
    "label": "crm | helpdesk | booking | generic",
    "confidence": "number",
    "reason": "string"
  } into:
    crm => use crm.run()
    helpdesk => use helpdesk.run()
    booking => use booking.run()
    generic => use generic.run()
  end
```

### Auto-set variables

A first-class `route` feature should probably expose:

- `route_choice`
- `route_confidence`
- `route_reason`

### Low-confidence behavior

A safe shape would support explicit fail-open or fail-closed behavior, for example:

```yaml
route product_type using ... into:
  crm => use crm.run()
  helpdesk => use helpdesk.run()
  generic => use generic.run()
  on low-confidence approve
end
```

## Why `route` is not obviously first

A specialized router is only worth adding if it contributes behavior that is awkward to implement correctly in user space.

If it only compresses a few lines of `if` statements, it is weak.

If it provides:

- guaranteed closed-world dispatch
- standardized metadata
- explicit ambiguity handling
- better evaluation surfaces

then it becomes a real feature rather than decorative sugar.

## Risks and failure modes

### 1. DSL bloat

If prompt-language absorbs every useful orchestration pattern directly, it becomes a kitchen-sink DSL.

### 2. Hidden model magic

A router that appears to “just figure it out” can become less legible than ordinary branching unless the label set is explicit and the reasoning is captured.

### 3. Dynamic loading and path injection

Routing must never let the model fabricate arbitrary flow paths.

### 4. Confidence theater

Confidence values are useful only if they correlate with real route quality and influence behavior meaningfully.

### 5. Product-specific bias

The main motivation here comes from software-factory style repos. That is a real use case, but it may not justify core syntax unless the feature generalizes.

## Non-goals

- Do not support arbitrary runtime-generated import paths.
- Do not allow route targets outside the declared routing table.
- Do not turn routing into a hidden replacement for explicit branching everywhere.
- Do not make route confidence a meaningless number with no effect on behavior.
- Do not assume the language should classify and build all software categories equally well.

## Current workaround

Today, the disciplined workaround is:

1. import all candidate archetype libraries up front
2. capture a structured route decision using `prompt ... as json`
3. require the label to come from a closed set
4. pause for approval when confidence is low
5. dispatch explicitly using ordinary branching

This is good enough to prototype a software-factory repo and gather evidence before changing the language.

## Acceptance criteria for the proposal

A routing feature should not ship unless it satisfies all of the following:

- the feature is measurably more useful than ordinary structured capture plus branching
- route targets are closed-world and declared up front
- the model cannot invent paths or escape the declared dispatch table
- route decisions can be inspected after the run
- low-confidence behavior is explicit
- the feature supports evaluation of route correctness
- the language remains honest about what is shipped versus proposed

## Suggested evaluation questions

1. How often does routing logic repeat across real factory-style projects?
2. Is the pain mostly branching syntax, or classification plus dispatch semantics?
3. Do low-confidence routes actually correlate with wrong choices?
4. Does a generic `match` feature remove most of the need for `route`?
5. Do users want route metadata and ambiguity handling often enough to justify a dedicated construct?

## Open questions

1. Should the language add `match` first and delay `route`?
2. Should `route` be limited to structured JSON outputs rather than boolean `ask` conditions?
3. Should low-confidence cases default to approval, failure, or explicit fallback labels?
4. Should route results be stored in ordinary variables or in dedicated runtime fields?
5. Should route correctness become part of first-class eval tooling if `eval` / `judge` features land later?

## Best next step

Do not add `route` immediately.

Instead:

- prototype a router pattern in user space with today's features
- build at least two or three real bounded-software archetype starters
- compare whether the pain is mostly branching verbosity or true routing semantics
- add `match` first if that solves most of the problem
- add `route` later only if the evidence shows that closed-world classification plus dispatch deserves first-class syntax
