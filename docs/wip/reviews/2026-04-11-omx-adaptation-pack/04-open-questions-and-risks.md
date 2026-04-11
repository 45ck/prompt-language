# Open Questions and Risks

## Open questions

### 1. How far should hook management go across runners?

The repo already has a Codex scaffold and a broader harness-abstraction roadmap. The open question is whether hook management should be:

- Claude-first with partial Codex support
- adapter-based from day one
- or staged by runner

Recommendation: design the ownership model once, ship adapters incrementally.

### 2. Should there be a first-class binary alias?

There is product value in a short binary, but introducing a new brand-level CLI too early could confuse the current surface.

Recommendation: extend the current CLI subcommands first; decide on a shorter alias later.

### 3. How much project scaffolding is appropriate?

There is a line between useful bootstrap and overbearing project takeover.

Recommendation: scaffold only:

- AGENTS template
- flow-library seed
- operator config seed
- example workflows
- docs/wip pack seed

### 4. How should team supervision relate to the swarm pack?

The repo already contains a swarm planning pack that insists on lowering to existing primitives. Team supervision must not duplicate or contradict that direction.

Recommendation: define team supervision as the operational shell around child-flow orchestration, not a new orchestration semantics.

### 5. What belongs in shipped docs versus imported packs?

This repo is unusually disciplined about doc truthfulness. That is a strength and must be preserved.

Recommendation: land the pack as an imported review pack first, then promote only settled items into roadmap or shipped docs.

## Main risks

### Risk: shell eclipses runtime

If the shell becomes more memorable than the language, prompt-language loses its strongest moat.

### Risk: state sprawl without observability

Adding many directories without good views, cleanup, and migration would worsen reliability.

### Risk: runner fragmentation

A weak abstraction could cause each runner to have incompatible install, hook, and recovery behavior.

### Risk: team features overreach

If team supervision ships before recovery, state layout, and hook ownership are solid, failures will be hard to diagnose.

### Risk: documentation dishonesty

If proposed shell features leak into README-level claims too early, the current docs-trust model breaks.

## Mitigations

- require lowering / visibility for every convenience feature
- ship run-state layout with migration and doctor support
- gate new shell surfaces behind operator docs before README promotion
- tie team features to recovery and eval milestones
- keep imported packs clearly separate from shipped and tracked docs
