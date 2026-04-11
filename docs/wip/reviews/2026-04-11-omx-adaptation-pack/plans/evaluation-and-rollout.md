# Evaluation and Rollout

## Rollout principle

This work should be judged primarily on **operator reliability and legibility**, not on novelty.

## Pre-promotion checks

Before any slice becomes shipped surface:

- unit / snapshot tests for rendering and lowering
- install / uninstall / refresh safety tests
- interrupted-run recovery test
- docs path updated
- troubleshooting path written

## Suggested metrics

### Reliability

- hook refresh preserves user entries in 100% of tested scenarios
- uninstall removes only managed artifacts
- doctor detects stale / conflicting state deterministically

### Recovery

- median time to identify last failing gate decreases
- resumed runs correctly locate child topology and last checkpoint

### Adoption

- new-user path from install -> run -> diagnose -> recover is shorter
- maintainers use generated issue templates and pack docs to open slices cleanly

### Documentation honesty

- no new shell surface appears in shipped docs before it passes the promotion gate
- imported pack language is clearly marked as non-shipped

## Rollout order

1. internal planning pack
2. issue slicing
3. hook/doctor MVP
4. state layout migration
5. cockpit
6. workflow lowering
7. team supervisor
8. documentation promotion where earned

## Kill criteria

Stop or rescope if:

- shell features start bypassing runtime semantics
- state layout becomes harder to reason about than the old single-file model
- team features create more recovery failures than they prevent
