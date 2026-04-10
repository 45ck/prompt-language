# Repo Scrutiny: prompt-language

## Executive assessment

prompt-language is stronger than its current adoption suggests, but weaker than its broadest thesis currently justifies.

### The strongest parts

- Gate-first supervision is the clearest proven value.
- Engineering hygiene looks serious.
- The docs structure is unusually well organized for a research-heavy repo.
- The project has a coherent underlying worldview instead of random feature sprawl.

### The weakest parts

- The product story and the research thesis are mixed together.
- Some docs appear stale or internally inconsistent.
- Claims of uniqueness are too absolute for the market reality.
- The next moat is not yet proven beyond gates.

## What is genuinely good

### 1) Gates are the real core

The evaluation framing is disciplined: success comes from verification and enforced completion criteria, not from pretending the model got smarter because the syntax is nicer.

That matters because many prompt DSLs fail by confusing expressiveness with reliability. The review's key point is that flow control alone does not win much, variable capture alone does not win much, and gates do the measurable work.

### 2) The repo shows real engineering intent

The project is not just a README and a parser. It shows:

- substantial code surface
- CI discipline
- test and evaluation infrastructure
- documentation separation by function
- explicit roadmap and design notes

### 3) The documentation system is well structured

The split between guides, reference, research, strategy, evaluation, and roadmap is strong. The review argues that the main weakness is not structure, but synchronization.

## What is fragile

### 1) Two stories are competing

The repo currently tells both of these stories:

Product story:

> turn Claude Code into a supervised runtime

Thesis story:

> prompt-language may become the main medium for bounded software systems, with multi-file project structure, specialist agents, memory/wisdom layers, and system-level engineering flows

Both can exist, but they cannot sit at the same level in the public pitch. The practical product story is more proven today.

### 2) “No other tool occupies this exact position” is too aggressive

The review considers that phrasing risky. A safer framing is to emphasize a different layer, trust boundary, and design center instead of absolute uniqueness.

### 3) Documentation drift is dangerous

The review highlights `approve` / `review` / runner-status contradictions as examples of trust erosion caused by stale docs.

### 4) Runner status is ambiguous

If OpenCode support is present in README, CLI, and package scripts but still marked planned elsewhere, the project looks confused about shipped versus experimental versus partial.

### 5) Syntax completeness is not the main problem

Even if the language surface is largely complete, that does not solve adoption, clarity, product differentiation, trust, or proof of outcomes.

## Strategic interpretation

The pack argues that prompt-language should be treated as a supervision substrate, not primarily as a workflow-packaging product.

That implies:

- tighter positioning
- clearer proof
- less ambition leakage into the default pitch
- more focus on the layer where the project is genuinely differentiated

## Bottom line

This is not a failed idea. It is a good core idea with an overextended narrative envelope.

The proposed sequence is:

1. sharpen the current product
2. remove trust-eroding inconsistencies
3. prove the next research claims one by one
4. only then broaden the narrative
