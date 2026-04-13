## A13 Incomplete Launch

This run was preserved as incomplete because the `factory-quality` paired harness failed during lane setup before a valid experiment execution began.

- Run ID: `a13-e4-b03-fq1-gpt52-pilot-p01-factory-quality-codex-first`
- Attempt label: `A13`
- Scenario: `factory-quality`
- Order: `codex-first`
- Git commit at launch: `9300cc197a8e56b025b0d71ed4e2cf3b7b63e74f`
- Failure class: `harness bug`

Observed failure:

```text
ReferenceError: Cannot access 'scenarioKind' before initialization
```

Evidence retained in this directory:

- [run.json](/D:/Visual%20Studio%20Projects/prompt-language/experiments/results/e4-factory/incomplete/a13-e4-b03-fq1-gpt52-pilot-p01-factory-quality-codex-first/run.json)
- [run-error.txt](/D:/Visual%20Studio%20Projects/prompt-language/experiments/results/e4-factory/incomplete/a13-e4-b03-fq1-gpt52-pilot-p01-factory-quality-codex-first/run-error.txt)
- `bootstrap/`
- `codex-alone/`

Important notes:

- failure happened before either lane actually executed
- `codex-alone/` is an empty pre-created lane directory, not evidence of a partial run
- the scratch workspaces under `experiments/full-saas-factory/e4-codex-crm-factory/workspaces/incomplete/` are bootstrap copies only
- there are no lane traces such as `session-state.json`, `audit.jsonl`, `events.jsonl`, `stderr.log`, or `last-message.txt`

The large scratch workspace created for this aborted launch is intentionally excluded from version control under `experiments/full-saas-factory/e4-codex-crm-factory/workspaces/incomplete/`.
