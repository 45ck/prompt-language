# Proposed Repo Changeset

This is a recommended file-level rollout, not a claim that these exact paths already exist or are already accepted.

## New files

### Documentation

- `docs/architecture/diagnostics-plan.md`
- `docs/reference/diagnostic-codes.md`
- `docs/reference/cli-exit-codes.md`

### Source

- `src/diagnostics/types.ts`
- `src/diagnostics/codes.ts`
- `src/diagnostics/report.ts`
- `src/diagnostics/classify.ts`
- `src/cli/exit-codes.ts`
- `src/cli/validate-profile.ts`

### Tests

- `test/diagnostics/contract.spec.ts`
- `test/diagnostics/classification.spec.ts`
- `test/diagnostics/exit-codes.spec.ts`

## Existing files to update

- CLI entrypoint for `validate` flag parsing
- CLI entrypoint for `run` / `ci` JSON emission
- README command examples
- reference docs for `validate`
- troubleshooting docs for new diagnostic categories and exit codes

## Manual wiring order

1. Add core types and code tables.
2. Add exit-code derivation and JSON report plumbing.
3. Reclassify major runtime cases.
4. Add profile checks to `validate`.
5. Update docs.
