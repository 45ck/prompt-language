# GSLR-1 MC Doc Projection Fixture

This fixture is a sanitized, no-mutation projection task for the governed
Symphony local-routing experiment.

The worker must create a refs-only Portarium evidence envelope from the supplied
source note. The output must not contain raw vertical or source-system payload
data. It must describe references, capabilities, gates, approvals, and evidence
states only.

Run the public gate from the workspace root:

```sh
node test/public-gate.mjs
```

Passing this gate is not claim-grade evidence by itself. Private grading and
final review still decide whether a live run can count.
