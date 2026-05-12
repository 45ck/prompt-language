# GSLR-3 Policy Manifest Transform Fixture

This fixture tests the next route-policy neighbor after GSLR-2.

GSLR-2 validated one policy envelope. GSLR-3 transforms a Harness Arena manifest
into a Portarium evidence-card input. It is still a one-file code task with
public and private gates, but it exercises schema-to-schema generation instead
of validation only.

This is not Portarium product integration. The output is a static card-input
shape for evidence design only.

Model-visible files:

- `TASK.md`
- `README.md`
- `package.json`
- `src/evidence-card-transform.mjs`
- `test/public-gate.mjs`

Private oracle:

- `../../oracles/gslr3-policy-manifest-transform-oracle.mjs`
