# Spec 012 — Memory governance and wisdom promotion

## Problem

The runtime already has `remember` and `memory:`. That proves the storage mechanism, but not the governance model. Without governance, memory becomes a junk drawer and can even make the system worse.

## Goals

- Separate facts, policies, wisdom, and scratch memory
- Add provenance/confidence/expiry
- Add promotion workflows from failure to durable knowledge
- Connect wisdom updates to eval/regression evidence

## Proposed syntax

### Namespaced memory write

```yaml
remember namespace="wisdom" key="auth.empty_state"
value="Always test missing and expired session states."
source="run_2026_04_09_001"
confidence=0.86
ttl="90d"
tags=["auth", "api"]
end
```

### Memory prefetch

```yaml
memory: wisdom.auth.*
  policy.deploy.*
  facts.env.*
```

## Memory classes

- `facts` — stable environment/project facts
- `policy` — durable rules and permissions
- `wisdom` — learned heuristics and recurring lessons
- `scratch` — temporary notes not meant to persist long-term

## Promotion workflow

### CLI

```bash
prompt-language wisdom propose run_2026_04_09_001
prompt-language wisdom promote proposal_123
prompt-language wisdom demote key=auth.empty_state
```

### Desired flow

1. failure or repeated correction detected
2. candidate wisdom/contract/judge proposal created
3. human reviews proposal
4. approved proposal enters namespace with provenance
5. related regression is added or updated

## Governance rules

- wisdom should never silently become policy
- every durable item should have provenance
- every high-impact item should be linked to evidence/evals
- staleness/expiry should be visible

## Acceptance criteria

- Memory namespaces exist
- Durable items include provenance/confidence/TTL
- Promotion workflow exists
- Wisdom is linkable to regressions/evals
