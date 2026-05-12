# GSLR-4 Two-File Validator Fixture

This fixture tests the next route-policy neighbor after GSLR-3.

GSLR-3 asked for a one-file manifest-to-card transform and live evidence routed
that shape to `frontier-baseline`. GSLR-4 keeps the same static Portarium
evidence-card domain, but changes the task shape: the model must coordinate a
validator with a separate action-boundary policy helper.

This is not Portarium product integration. The output is a static validator for
research evidence only.

Model-visible files:

- `TASK.md`
- `README.md`
- `package.json`
- `src/action-boundary-policy.mjs`
- `src/evidence-card-validator.mjs`
- `test/public-gate.mjs`

Private oracle:

- `../../oracles/gslr4-two-file-validator-oracle.mjs`
