# META-2: Meta-Flow Corpus (MF-1..MF-9)

The meta-factory corpus is the ordered set of meta-flows that together
prove prompt-language can develop prompt-language. Each corpus entry
targets a single concrete addition (per MD-5) and is gated by the five
acceptance oracles (per META-3).

The order is deliberate: each entry's success de-risks the next. M1 is
the foundation; MF-9 is the proof-of-capability ceiling.

| ID   | Name                      | Target addition                                                       | Novelty grep target              | Acceptance focus                                   |
|------|---------------------------|-----------------------------------------------------------------------|----------------------------------|----------------------------------------------------|
| MF-1 | PL-writes-smoke-test      | One new smoke test (`AW` fast, `AX` slow) covering an uncovered DSL feature | test id + keyword in smoke-test.mjs | O1–O5 full set; `SMOKE_ONLY=AW\|AX` passes        |
| MF-2 | PL-writes-docstring       | One JSDoc/TSDoc block on an undocumented exported symbol in `src/domain/` | symbol name + `@param`/`@returns` in source | O1 parse of doc-change flow; grep delta; `npm run ci` passes |
| MF-3 | PL-adds-parser-rule       | One new condition operator or let-source variant in `src/application/parse-flow.ts` | new token in parser + new unit test | `npm run test` passes; grammar docs updated        |
| MF-4 | PL-adds-gate-predicate    | One new `done when:` predicate (e.g., `all_tests_written`)            | predicate name in evaluate-completion.ts + smoke test | Smoke gate test demonstrates predicate blocks/unblocks |
| MF-5 | PL-adds-adapter           | One new infrastructure adapter (e.g., http-state-adapter)             | adapter file + unit test + port conformance | Dependency-cruiser clean; adapter tests pass       |
| MF-6 | PL-adds-control-flow-node | One new control-flow node kind (e.g., `switch` or `case`)             | node kind in flow-node.ts + render + advance + smoke | Full CI + targeted smoke; render round-trips       |
| MF-7 | PL-authors-adr            | One ADR under `docs/adr/` documenting a design decision               | ADR number + title keyword        | Markdown renders; references resolve; no broken links |
| MF-8 | PL-refactors-interpolate  | One measurable refactor in `src/domain/interpolate.ts` preserving behaviour | benchmark delta or LOC delta      | All existing tests pass; new property test added   |
| MF-9 | PL-authors-meta-flow      | One new meta-flow file (MF-10) that itself passes O1–O5               | new flow under `experiments/meta-factory/` + passing run | MF-10 runs to green; recursive self-hosting proven |

## Progression rationale

- **MF-1 (M1)** proves the loop closes: the DSL can observe its own
  coverage gap, author a new test, and pass it through the real gate.
- **MF-2..MF-4** exercise edits to source code (docs, parser, gates),
  testing that the meta-flow can land changes beyond `scripts/eval/`.
- **MF-5..MF-6** extend the language itself (adapters, node kinds),
  proving the meta-flow can introduce genuinely new DSL capability.
- **MF-7** tests non-code artifacts (architecture decisions) to confirm
  the meta-flow is not narrowly scoped to code.
- **MF-8** tests refactoring with preservation of behaviour, a harder
  problem than greenfield addition.
- **MF-9** tests recursion: a meta-flow writing a meta-flow. Success
  here demonstrates the program is self-reproducing.

## Selection criteria for "uncovered" targets

For MF-1, "uncovered" means: a DSL node kind, modifier, or combination
listed in `src/domain/flow-node.ts` whose keyword does not appear in the
smoke catalog (tests A through AV, Z1..Z7, AR..AV) and is not excluded
by the protocol's exclusion list (retry backoff, composite gates, spawn
modifiers, nested try/catch/finally, foreach-run-source).

For MF-2, "undocumented" means: an exported symbol in `src/domain/`
whose declaration is not preceded by a JSDoc block.

For MF-3..MF-9, the target must be chosen by the run-scoping phase
(phase-1-scope) and confirmed absent in the current tree before the
authoring phase begins.

## Cross-corpus invariants

- No corpus entry may weaken an existing test or oracle.
- Every corpus entry must leave `CLAUDE.md` internally consistent.
- Every corpus entry must be reproducible from its run's trace alone.
