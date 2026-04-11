# Phase 1 Artifact Package Slice

## Objective

Land the smallest repo-owned artifact slice without introducing speculative runtime or UI semantics.

## Scope

- publish a repo-owned manifest schema
- publish one initial built-in payload schema
- check in a sample package with multiple renderer views

## Workstreams

1. Publish package envelope schema
2. Define one built-in payload contract
3. Ship a multi-view sample package

## Risks

- The fixture could drift if a renderer becomes more authoritative than `content/source.json`.
- The sample could overcommit later review-storage or DSL decisions.

## Exit Criteria

- `manifest.json` enumerates canonical content and multiple views
- the package shape is inspectable from the repo alone
- later validation and registry work can target this package without inventing a second convention
