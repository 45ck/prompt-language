<!-- cspell:ignore mewj s5cx -->

# Design: Variable Data Structure Roadmap

## Status

Accepted research note for bead `prompt-language-ag2z.2`.

Related beads:

- `prompt-language-mewj`
- `prompt-language-s5cx`

Primary anchors:

- `src/domain/session-state.ts`
- `src/domain/list-variable.ts`
- `src/domain/split-iterable.ts`
- `src/domain/interpolate.ts`
- `src/domain/evaluate-condition.ts`
- `src/application/advance-flow.ts`
- `src/application/parse-flow.ts`
- `docs/reference/let-var.md`
- `docs/reference/foreach.md`
- `docs/wip/vnext/specs/004-typed-state-and-artifacts.md`

## Decision

The next reasonable step is **not** native arrays or native maps.

If variable work moves from research into implementation, prompt-language should:

- keep the canonical runtime store scalar-first
- keep current list support as an encoded compatibility layer
- add **opt-in typed declarations** before widening `SessionState` to native
  arrays or objects/maps

This gives the repo better diagnostics and user guidance without forcing a
breaking reinterpretation of interpolation, persistence, rendering, linting,
and child-variable import all at once.

## Current shipped model

### Canonical store

The authoritative runtime store in `SessionState` is still:

- `Record<string, string | number | boolean>`

That shape is used directly by:

- runtime state creation and persistence
- interpolation
- condition evaluation
- flow rendering
- child spawn status import

This is not merely a docs convention. It is the current execution contract.

### List behavior today

Lists exist, but as an encoded layer over the scalar store rather than a native
runtime value kind.

The codebase currently implements lists through several cooperating behaviors:

- `let items = []` stores the literal string `[]`
- `let items += ...` uses `appendToList()` to parse an existing JSON array
  string or auto-upgrade a scalar into an array string
- `listLength()` derives `${name}_length` from a JSON-array string
- `interpolate()` supports `${items[0]}` and `${items[-1]}` by JSON-parsing the
  stored string at access time
- `splitIterable()` accepts JSON arrays, markdown lists, newline lists, and
  whitespace-delimited strings for `foreach`
- `prompt_json` field expansion stores top-level array fields as JSON strings
  plus `<field>_length`

So the shipped list story is real, but it is intentionally asymmetric:

- append and index access assume JSON-array encoding
- `foreach` is broader and more forgiving than the canonical store
- rendered output summarizes encoded arrays for readability

### Object behavior today

There is no native object/map value in the runtime store.

The nearest existing structured behavior is `prompt ... as json`, which:

- stores the root capture as a JSON string
- flattens top-level object fields into `name.field` keys
- stores top-level array fields as JSON strings

This means dot notation already has shipped meaning, but that meaning is
**flat-key lookup**, not nested object traversal.

That detail matters because it constrains any future move toward maps:

- `${analysis.summary}` currently means "look up flat key `analysis.summary`"
- condition evaluation follows the same rule
- child imports also use flat prefixed names such as `childName.variable`

## Option comparison

| Direction                           | Compatibility impact                                                                                    | UX impact                                                                      | Main risk                                                                          | Recommendation       |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- | -------------------- |
| Keep scalar-only plus JSON strings  | Best match for current runtime, persistence, interpolation, and flat imports                            | Already usable but uneven, especially for lists and structured captures        | Users can misread encoded lists as first-class values                              | Keep as the baseline |
| Add native arrays only              | Requires widening `SessionState`, interpolation, rendering, persistence, and spawn/import assumptions   | Makes list operations cleaner, but leaves objects and dot semantics unresolved | Creates a half-structured model with new semantics pressure everywhere else        | Not the next slice   |
| Add native arrays plus objects/maps | Largest compatibility shift across parser, runtime, lint, render, eval, and docs                        | Most expressive on paper                                                       | Collides with flat-key dot access, child imports, and current observability limits | Defer                |
| Add opt-in typed declarations first | Lower blast radius because storage can remain scalar-first while declarations add intent and validation | Better error messages, clearer author intent, and a cleaner migration path     | Requires new metadata, validation rules, and syntax design                         | Best next candidate  |

## Compatibility tradeoffs

### Scalar-only plus JSON strings

What it preserves:

- existing `SessionState` serialization shape
- current `interpolate()` and `evaluateCondition()` contracts
- current flat-key semantics for `${name.field}`
- current child import model after `await`
- current rendering and lint expectations

What it costs:

- lists behave like a convention, not a type
- object captures remain partially flattened and partially encoded
- users must remember which surfaces accept loose list formats versus strict
  JSON-array strings

### Native arrays

What it improves:

- no repeated parse/stringify loop for list operations
- clearer future list APIs
- less surprise around append and indexing

What it breaks or complicates:

- `SessionState.variables` type
- persistence and any tooling that assumes scalar values
- rendering, because variables would no longer be trivial to format as strings
- shell interpolation and command preparation rules
- child variable import, because imported values are currently flattened and
  string-safe

Native arrays alone also do not solve the more important structural question:
should `analysis.summary` remain a flat alias, or become nested traversal?

### Arrays plus objects/maps

What it improves:

- cleaner model for grouped values and structured captures
- more intuitive long-term semantics for rich data

What it conflicts with today:

- dot notation already means flat-key access
- `prompt_json` top-level flattening is already shipped behavior
- lint and render logic assume a mostly flat variable namespace
- debug surfaces are still optimized for scalar display, not nested inspection

The repo would need a deliberate migration for:

- lookup precedence between `analysis.summary` flat aliases and
  `analysis -> { summary }`
- import/merge semantics for child variables
- shell escaping and prompt interpolation for nested values

That is a much larger language/runtime change than "better variable data
structures" first suggests.

### Typed declarations

What they improve without forcing immediate runtime widening:

- authors can declare intent explicitly
- captures can validate against known expectations
- diagnostics can distinguish "missing", "wrong shape", and "wrong coercion"
- migration to richer value kinds can stay staged instead of implicit

What they still require:

- declaration syntax and lifecycle rules
- validation/coercion policy
- a clear decision on whether types describe stored values, captured artifacts,
  or both

The vNext typed-state note already points in this direction and fits the repo
better than jumping straight to native maps.

## UX tradeoffs

The biggest current user problem is not lack of expressiveness. It is that the
same variable system exposes several different mental models at once:

- scalars in `SessionState`
- JSON-array strings for append/index behavior
- loose list parsing for `foreach`
- flat aliases for structured JSON capture

This is workable for disciplined users, but it is easy to misread.

Native arrays or maps would add even more possible readings unless the repo
first improves:

- declaration clarity
- validation messaging
- variable inspection and rendering
- docs around flat aliases versus encoded values

Typed declarations improve UX sooner because they answer "what is this supposed
to be?" without immediately changing every runtime surface.

## Recommendation

The next reasonable step is:

1. keep `SessionState.variables` scalar-first
2. keep encoded lists as the compatibility mechanism for current flows
3. add opt-in typed declarations before native arrays or maps

That sequencing is the best fit for both compatibility and user experience.

It preserves what already works:

- append lists
- indexed interpolation over JSON-array strings
- flat child imports
- flat JSON field aliases

And it improves the next thing users actually need:

- explicit intent
- better diagnostics
- clearer migration boundaries

## Near-term follow-up shape

If this area gets implemented, the safest next slice is:

- declare variable intent explicitly
- validate prompt/run capture against that declared intent
- keep storage backward-compatible for now
- postpone native maps until flat-key versus nested-path semantics are settled

In short:

- **do not add native maps next**
- **do not add native arrays next as a standalone move**
- **add opt-in typed declarations first**
