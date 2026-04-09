# Open questions and risks

## Open questions

### A. How strict should strict mode be by default?

Open issue:

- Should strict mode be global default, or opt-in per project?

Recommendation:

- Keep permissive mode for experimentation, but make strict mode the recommended production default.

### B. How much of contracts should be static vs dynamic?

Some checks can be static (forbidden path touched).
Some are dynamic (changed public API).
Some are semantic (tenant isolation preserved).

Recommendation:

- support static constraints first
- allow custom analyzers and gates for richer semantics

### C. How much belongs in the DSL versus tooling?

Examples:

- replay
- annotations
- baseline locking
- flow unit tests
- wisdom promotion

Recommendation:

- keep heavy observability/reporting in CLI/tooling
- keep only declarative hooks in the DSL

### D. How strongly should provider adapters abstract model behavior?

If adapters become too thin, the IR is not portable.
If adapters become too thick, they may erase useful provider-native features.

Recommendation:

- adapt execution and tool semantics
- do not over-abstract model-specific strengths prematurely

### E. How should event logs be stored?

Options:

- JSONL events
- SQLite
- embedded KV store
- remote trace backend

Recommendation:

- start with append-only JSONL + derived state snapshots
- leave room for SQLite later if compaction/querying becomes painful

### F. How should lock ordering work?

If resource locks are added, deadlocks become a real concern.

Recommendation:

- define deterministic lock ordering
- lint conflicting lock declarations
- fail fast on violations

## Risks

### 1. Overbuilding before proving value

There is a real risk of turning the language into an overdesigned operating system before trust features show measurable value.

Mitigation:

- ship in thin vertical slices
- measure reduction in babysitting minutes
- prioritize high-leverage trust features first

### 2. Contract explosion

If every team writes giant unreadable contracts, the new abstraction becomes worse than code review.

Mitigation:

- encourage small composable contracts
- support inheritance/composition
- add contract linting

### 3. False confidence from model judges

Judges can become disguised vibes if not calibrated.

Mitigation:

- deterministic completion remains primary
- require evidence and abstention
- compare judges against humans

### 4. Provider lock-in by accident

If the runtime remains deeply tied to Claude Code hooks, portability becomes a marketing claim rather than a technical property.

Mitigation:

- define Flow IR early
- keep provider adapters thin and explicit

### 5. Too many layers of policy

Capabilities, contracts, budgets, policy tiers, effect classes, judges, and specs can become overwhelming.

Mitigation:

- ship sensible presets
- build strong linting and documentation
- expose an autonomy ladder rather than forcing every project to define everything manually

## Anti-goals

Do not:

- turn prompt-language into a giant general-purpose programming language
- rely on giant opaque judges
- put model judgments into `done when:` by default
- make natural-language execution the only trusted path
- oversell “no human oversight”
- treat replay/observability as optional
