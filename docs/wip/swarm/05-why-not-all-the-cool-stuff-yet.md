# Why Not All the Cool Stuff Yet

The short answer: those features are cool, but they are not all the **same kind** of feature.

Some are:

- ergonomic sugar over capabilities the runtime already has

Others are:

- new execution semantics
- new safety model
- new state model
- new debugging burden
- new evaluation burden

That distinction matters.

## The real split

### Category A — cheap and credible soon

These are close to the current runtime and are plausible for v1.5/v2.

- explicit role declarations
- explicit role returns
- named join/merge results
- nicer syntax around manager-worker orchestration
- optional “cancel losers” for `race`-style swarms
- better role metadata / status inspection
- typed result schemas

### Category B — cool but expensive

These move prompt-language from “macro over current primitives” toward “new multi-agent platform”.

- peer-to-peer handoffs
- sibling-to-sibling free chat
- nested swarms
- shared mutable blackboard memory
- automatic dynamic role spawning
- per-role hard permission enforcement in the runtime
- decentralized control transfer

These are not “bad”. They are just qualitatively more expensive.

## Feature-by-feature assessment

### 1. Peer handoffs

**Why it is cool**

- natural for specialist chains
- feels more “agentic”
- reduces manager bottlenecks

**Why it should probably wait**

- transfers control authority away from the parent
- complicates traceability
- complicates completion ownership
- makes it less obvious which agent is responsible for next actions

**Recommended phase**

- v2 or later, after v1 swarm traces/evals exist

### 2. Sibling-to-sibling chat

**Why it is cool**

- enables negotiation
- enables pair-debugging and debate patterns

**Why it should probably wait**

- increases message topology complexity fast
- harder to inspect and replay
- easier to create loops, deadlocks, and pointless chatter
- manager-mediated messaging gets most of the value with much less complexity

**Recommended phase**

- v1.5 or v2 only if manager-mediated message relay proves too limiting

### 3. Nested swarms

**Why it is cool**

- recursive delegation
- fractal planning
- more expressive for large programs

**Why it should wait**

- multiplies state/debug complexity
- explodes trace depth
- raises scheduler questions
- raises parentage and namespace questions
- easy to create runaway orchestration

**Recommended phase**

- v3+, and only after strong evidence that shallow swarms are insufficient

### 4. Shared mutable blackboard memory

**Why it is cool**

- common scratchpad
- less message passing
- more collaborative feel

**Why it should wait**

- introduces contention and conflict semantics
- harder to understand causality
- harder to isolate bugs
- easy to reintroduce the exact chaos prompt-language is trying to reduce

**Recommended phase**

- maybe never as mutable shared state
- safer alternative: explicit append-only reports or parent-owned merge steps

### 5. Automatic dynamic role spawning

**Why it is cool**

- adaptive scale-out
- closer to “true swarm” behavior

**Why it should wait**

- budget control gets harder
- evaluation gets harder
- deterministic reasoning about flow gets worse
- compile-time understanding of the workflow weakens

**Recommended phase**

- v2+ only with strict budget caps and trace requirements

### 6. Per-role hard permission enforcement

**Why it is cool**

- safety
- least-privilege design
- cleaner specialization

**Why it should wait**

- very desirable, but not cheap if enforcement is real rather than prompt-only
- requires runtime/tooling integration, not just syntax
- needs a robust permissions model and failure model

**Recommended phase**

- v2 as a serious follow-on, not as mere syntax decoration

## Better framing

The right framing is not:

- “don’t include these”

The right framing is:

- “separate **v1 language ergonomics** from **v2 runtime semantics**”

That keeps the cool features alive without making v1 mushy.

## Suggested phased roadmap

### V1

- manager-owned swarm blocks
- role declarations
- start/await
- return
- result namespaces
- validate-time expansion

### V1.5

- optional `cancel_losers`
- reducer / merge helpers
- role result schema declarations
- role-level timeouts / budget hints

### V2

- runtime-enforced role permissions
- controlled sibling messaging
- limited handoffs with explicit ownership transfer
- richer trace visualization

### V3

- nested swarms
- dynamic role spawning
- advanced shared-context mechanisms only if evals justify them
