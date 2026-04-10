# Change Plan

## Immediate objective

Make prompt-language easier to understand, easier to trust, and harder to dismiss.

## P0 — do now

### 1) Tighten the top-level positioning

Replace diffuse messaging with one primary sentence:

> prompt-language is a verification-first supervision runtime for existing coding agents.

Acceptance criteria:

- README opening section uses this framing
- docs homepage reflects the same framing
- thesis language is moved below the fold or into a dedicated research section

### 2) Separate Product from Research

Create two clear entry points:

- Product
- Research

Acceptance criteria:

- README has a product-first path for new users
- research and thesis pages are linked as secondary material
- roadmap clearly labels shipped, experimental, and research

### 3) Fix documentation inconsistencies

Audit all places where shipped/planned/dead-code claims disagree.

Start with:

- `approve`
- `review`
- OpenCode runner status

Acceptance criteria:

- one canonical shipped-vs-experimental matrix
- contradictory pages updated or removed
- dates or status annotations added

### 4) Add docs-consistency CI

Add automated checks that every feature labeled “shipped” has:

- parser support
- runtime or advancement support
- renderer or roundtrip support
- at least one representative test

Acceptance criteria:

- CI job fails when status claims and implementation checks diverge
- feature matrix generated from code/tests where possible

## P1 — next

### 5) Recenter evaluation around gates

Produce a short public evaluation summary answering:

- what actually works
- what does not yet show wins
- what overhead is incurred
- where prompt-language should be used despite the cost

Acceptance criteria:

- short evaluation page aimed at new readers
- gates are explicitly identified as the strongest proven mechanism
- caveats are visible, not buried

### 6) Define the next moat experiments

Run targeted experiments on:

- multi-file project structure
- wisdom accumulation / memory reuse
- repeated failure elimination
- specialist coordination
- bounded-software workflows

Acceptance criteria:

- each experiment has hypothesis, metric, dataset/task, and success bar
- results are publishable even if mixed

## P2 — later

### 7) Explore orchestration-shell compatibility

Treat tools like Archon as potential shells or adjacent layers.

Questions to test:

- can prompt-language be embedded as a stricter execution substrate?
- can it export predictable interfaces for higher-level orchestrators?
- can it interoperate without losing its trust model?

Acceptance criteria:

- architecture note on integration patterns
- at least one thin interoperability experiment
