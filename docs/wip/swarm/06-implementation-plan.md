# Implementation Plan

## Phase 0 — Design docs

Deliver these before code:

- WIP feature doc for `swarm`
- syntax section for `role`, `start`, `return`
- rationale doc that positions `swarm` as lowering over existing primitives

## Phase 1 — Parser and AST

Tasks:

- add AST node for `swarm`
- add AST node for `role`
- add AST node for `start`
- add AST node for `return`
- validate role name uniqueness
- validate legal placement of `return`
- validate legal placement of `start`
- reject nested `swarm` in v1
- reject undeclared role names

Acceptance:

- `validate` can parse and render the structure
- malformed swarms fail with targeted diagnostics

## Phase 2 — Lowering pass

Tasks:

- create a desugaring pass from swarm AST to ordinary flow AST
- lower `start` to `spawn`
- lower `return` to `send parent`
- lower `await role` to `await + receive + namespace assignment`
- ensure deterministic receive ordering for `await all`

Acceptance:

- expanded flow is inspectable
- execution behavior matches hand-written equivalent flows

## Phase 3 — Runtime integration

Tasks:

- namespace returned values under `<swarm>.<role>.*`
- store child status/metadata
- parse JSON return payloads when valid
- preserve raw payload on parse failure

Acceptance:

- parent can read structured results predictably
- failures surface clearly in status and logs

## Phase 4 — Tooling

Tasks:

- `validate --expand` or equivalent lowered-flow preview
- watch/statusline support for active swarm role
- clear error messages when roles fail or do not return

Acceptance:

- swarm execution is understandable from CLI output
- lowered flow can be inspected during debugging

## Phase 5 — Tests

Required test layers:

### Parser tests

- valid swarm parse
- duplicate role names
- illegal return placement
- unknown role in `start`
- unknown role in `await`
- nested swarm rejection

### Lowering tests

- start -> spawn
- return -> send parent
- await -> receive + namespace fill
- multi-role start/await order

### Smoke/e2e tests

- manager-worker happy path
- JSON return decoding
- plain string return
- role failure propagation
- reviewer-after-workers pattern
- race + judge pattern using ordinary constructs around swarm outputs

## Phase 6 — Rollout

- ship behind documented “experimental” label first
- add examples
- run evals against equivalent hand-written spawn/await flows
- only promote to main reference if readability and reliability improve
