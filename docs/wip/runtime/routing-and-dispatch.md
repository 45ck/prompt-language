# Routing and Dispatch Decision Note

> **Not shipped.** This document records a design decision about a possible future dispatch feature. The syntax shown here is illustrative only and is not implemented in prompt-language today.

## Decision Question

When prompt-language needs bounded dispatch between predeclared flow targets, should it pursue:

- a general `match`-style construct first, or
- a dedicated `route` construct for classification plus dispatch?

## Decision

Prompt-language should pursue **`match` first**, not a dedicated `route` feature.

The current recommendation is:

1. prove bounded routing in user space with existing primitives
2. add a general symbolic dispatch construct if branch verbosity is the real pain
3. revisit a dedicated `route` feature only if real usage shows that closed-world classification semantics need first-class support

## Why This Decision Wins

`match` is the better first move because it solves the general dispatch problem without committing the language to AI-specific routing semantics too early.

The dedicated `route` idea is still plausible, but it does not yet clear the bar for a core language feature. At this stage, the evidence supports reducing branching friction first, not introducing specialized routing syntax.

## Context

The motivating use case is a software-factory style repo that classifies work into bounded archetypes such as:

- CRM
- helpdesk
- booking
- generic B2B SaaS

Today the runtime already has enough primitives to approximate this pattern:

- `import` / `use` for reusable flow libraries
- `if` for branching
- structured JSON capture for typed model output
- approval steps for low-confidence or ambiguous cases

That means the immediate problem is not capability. The immediate problem is whether the repeated branching shape is awkward enough to justify new syntax, and if so, what the smallest correct feature is.

## Current User-Space Approximation

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

This works today. The language question is whether the next improvement should be general dispatch or specialized routing.

## Option Comparison

### Option A: `match` first

Illustrative shape:

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

Why this is the winning direction:

- solves routing and non-routing symbolic dispatch with one feature
- keeps model classification separate from execution control
- preserves explicitness around confidence handling and approvals
- avoids baking AI-specific behavior into the language core too early
- has a clearer boundary: it is flow control, not hidden orchestration magic

Limits of `match`:

- it does not standardize route metadata on its own
- it does not enforce a classification protocol by itself
- it still relies on user-space conventions for low-confidence handling

Those limits are acceptable at this stage because they are exactly the semantics that still need evidence.

### Option B: dedicated `route`

Illustrative shape:

```yaml
route product_type using prompt "Classify docs/brief.md into exactly one declared archetype" as json {
  "label": "crm | helpdesk | booking | generic",
  "confidence": "number",
  "reason": "string"
} into:
  crm => use crm.run()
  helpdesk => use helpdesk.run()
  booking => use booking.run()
  generic => use generic.run()
  on low-confidence approve
end
```

Why this does not win yet:

- too much of its value is still hypothetical
- it risks being mostly syntax sugar over structured capture plus branching
- it introduces specialized semantics before the general dispatch shape is settled
- it narrows the design space before there is evidence that built-in route metadata and ambiguity handling are common enough to justify a dedicated construct

`route` becomes worth reconsidering only if it adds real semantics that are repeatedly awkward in user space, such as:

- closed-world label validation
- standardized confidence and reason capture
- explicit ambiguity or low-confidence policies
- automatic exposure of route artifacts for evaluation

## Design Principles

1. **Closed world only.** Dispatch must select among predeclared symbolic targets.
2. **Labels over paths.** The model should choose labels like `crm`, not invent file paths.
3. **No hidden magic.** Classification and branching should remain legible.
4. **Confidence must affect behavior.** It is not enough to record a number.
5. **Inspection matters.** Decisions should remain visible for later evaluation.
6. **Generality first.** Prefer the smallest feature that solves the broader problem.

## What This Decision Does Not Claim

- It does **not** claim that `route` is a bad idea.
- It does **not** claim that the illustrative `match` syntax is final.
- It does **not** claim that prompt-language already ships either feature.
- It does **not** claim that user-space routing is perfect.

It only claims that the next language move, if any, should be toward general dispatch rather than dedicated routing.

## Follow-Up Boundary

The follow-up boundary is explicit:

- near term: keep routing in user space using structured capture plus explicit branching
- next syntax candidate: evaluate a general `match` construct
- do not design or ship `route` unless real projects show repeated need for first-class routing semantics that `match` cannot cover cleanly

That boundary matters because it prevents prompt-language from adding a specialized router before it has proved that the general dispatch problem is insufficient.

## Risks if We Skip This Boundary

### 1. DSL bloat

Adding `route` too early turns one useful orchestration pattern into permanent language surface area before its necessity is established.

### 2. Hidden model behavior

A dedicated router can look smarter than it really is unless its closed set, reasoning, and fallback behavior stay explicit.

### 3. False confidence in semantics

If route confidence, ambiguity handling, or metadata conventions are weakly specified, a first-class feature can prematurely standardize the wrong behavior.

### 4. Collapsing two problems into one

Classification and dispatch are related but not identical. A dedicated `route` construct risks fusing them before the boundaries are understood.

## Practical Recommendation

For now, teams should:

1. import candidate flow libraries up front
2. capture a structured label, confidence, and reason
3. keep the label set closed and explicit
4. handle low-confidence cases explicitly
5. dispatch with normal branching

If that pattern keeps repeating and the real pain is mostly branch verbosity, pursue `match`.

If later evidence shows that teams repeatedly need built-in route metadata, ambiguity policies, and evaluation hooks, reopen the case for `route` with concrete examples from real repos.
