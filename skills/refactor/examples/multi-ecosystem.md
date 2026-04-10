# Refactor Examples by Ecosystem

## JavaScript/TypeScript

1. Establish baseline with `npm test`.
2. Apply one structural change (extract function, rename, remove duplication).
3. Re-run `npm test` immediately.

## Python

1. Establish baseline with `pytest -q`.
2. Apply one behavior-preserving refactor.
3. Re-run `pytest -q`.

## Go

1. Baseline with `go test ./...`.
2. Apply one refactor pass.
3. Re-run `go test ./...`.

## Rust

1. Baseline with `cargo test`.
2. Apply one refactor pass.
3. Re-run `cargo test`.

## Guardrails

- Do not combine feature changes with refactoring.
- Keep refactor steps small enough to isolate regressions quickly.
