# Evaluation plan

## Purpose

Measure whether vNext features actually reduce supervision and improve bounded reliability.

## Core metrics

Track for every serious experiment:

- task success rate
- premature-stop rate
- human babysitting minutes
- human cleanup minutes
- repeated-failure rate
- out-of-scope diff rate
- policy violation rate
- approval count
- run-to-run variance
- total cost / latency

## Recommended experiments

### E1 — Strict mode vs permissive mode

Question:

- does strict mode reduce silent bad completions and later cleanup?

### E2 — Contracts vs gates-only

Question:

- do contracts reduce out-of-scope changes and manual diff review time?

### E3 — Effects/policy vs raw shell

Question:

- do explicit effects reduce retry/resume mistakes and approval fatigue?

### E4 — Event log + replay

Question:

- does replay reduce debug time and improve regression creation rate?

### E5 — Worktree spawn vs shared checkout spawn

Question:

- does isolation reduce integration conflict and supervision time?

### E6 — Wisdom governance

Question:

- does curated wisdom reduce repeated mistakes more than naive memory?

## Success criteria examples

- > 25% reduction in babysitting minutes on bounded engineering tasks
- > 30% reduction in repeated-failure rate
- materially lower out-of-scope diff rate under contracts
- reduced manual post-run audit time with replay reports
