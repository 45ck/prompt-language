# File Map

The experiment is organized for growth. Add new task families without changing
the protocol files.

```text
experiments/senior-pairing-protocol/
  README.md
  docs/
    experiment-plan.md
    file-map.md
    runbook.md
    threat-model.md
  flows/
    solo-baseline.flow
    persona-control.flow
    senior-pairing-v1.flow
    hybrid-judge-v1.flow
  manifests/
    experiment-manifest.json
  protocol/
    00-principles.md
    01-metacognition-loop.md
    02-risk-taxonomy.md
    03-escalation-policy.md
    04-time-policy.md
  rubrics/
    senior-engineering-rubric.md
    scorecard.schema.json
    scorecard.template.json
  tasks/
    sp01-ambiguous-priority.md
    sp02-auth-boundary.md
    sp03-config-migration.md
  results/
    README.md
    templates/
      run-manifest.template.json
      notes.template.md
```

## Naming Rules

- Task IDs use `spNN-short-name`.
- Flow versions use `name-vN.flow`.
- Result directories should use `YYYYMMDD-HHMMSS/task-id/arm/`.
- Raw workspace directories should stay ignored unless intentionally flattened.
- Scorecards should remain JSON for aggregation and Markdown for human notes.
