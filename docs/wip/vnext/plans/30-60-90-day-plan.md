# 30 / 60 / 90 day plan

## Day 0–30

### Objectives

- harden the trust model
- stop the most dangerous fail-open paths
- produce a tighter execution story quickly

### Ship

- `review strict`
- `approve ... on_timeout`
- unknown-var strict linting
- checkpoint primitive
- basic `budget:` block
- docs update that clearly distinguishes permissive vs strict mode

### Docs to add/update

- trust model page
- migration guide
- examples for strict vs permissive mode

## Day 31–60

### Objectives

- reduce scope babysitting
- make side effects explicit
- create the beginnings of a policy engine

### Ship

- contracts v1
- effect nodes v1
- risk tiers
- policy block
- contract-aware linting
- one or two high-value typed adapters (e.g. GitHub PR, npm test/build)

### Internal proof tasks

- safe auth fix
- release prep
- monorepo package-local test fix

## Day 61–90

### Objectives

- make runs replayable and evaluable
- start proving improvement scientifically

### Ship

- append-only event log
- replay CLI
- structured run report
- rubrics/judges v1
- `eval` runner v1
- failure-to-regression promotion prototype

### Measurement

Track:

- babysitting minutes per task
- cleanup minutes per task
- repeated-failure rate
- out-of-scope change rate
- approval count / approval fatigue
