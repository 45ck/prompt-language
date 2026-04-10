# TDD Examples by Ecosystem

## JavaScript/TypeScript

Use `npm test -- <target>` for red/green on one behavior slice, then run full `npm test` before finishing.

## Python

Use `pytest -q <test_file_or_node>` for the red step, then `pytest -q` for full verification.

## Go

Use `go test ./pkg/... -run TestFeatureName` during red/green, then `go test ./...` for full verification.

## Rust

Use `cargo test feature_name` during red/green, then `cargo test` for full verification.

## Notes

- Keep each cycle focused on one behavior.
- Ensure the new/updated test fails before implementation.
- Refactor only after green.
