# Metacognition Loop

Every senior-pairing run should force this loop:

1. Observe: read the task and current evidence.
2. Frame: restate the objective and identify unknowns.
3. Risk scan: classify safety, security, data, architecture, and test risks.
4. Decide: choose the smallest safe implementation strategy.
5. Act: make one coherent change set.
6. Verify: run tests and oracle.
7. Critique: compare output against the plan and risk scan.
8. Repair: use failing output to make a minimal correction.
9. Escalate: stop or request stronger review when evidence is insufficient.

The flow should make each stage observable through variables, logs, or captured
artifacts.
