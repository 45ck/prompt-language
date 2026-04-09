# Spec 008 — Safe parallelism: worktrees, locks, and ownership

## Problem

Existing `spawn`/`await` coordination is useful, but coordination is not yet safe concurrency. Parallel child flows need isolation and conflict control.

## Goals

- Make spawned child flows safer by default
- Add worktree isolation
- Add ownership declarations
- Add resource locking
- Add merge/backout policies

## Non-goals

- This spec does not attempt to solve arbitrary distributed systems scheduling
- This spec does not require full transactional merges

## Proposed syntax

### Worktree-backed spawn

```yaml
spawn "frontend" worktree auto owns:
  - apps/web/**
  - packages/ui/**
  prompt: Fix the React regression.
end
```

```yaml
spawn "backend" worktree auto owns:
  - packages/api/**
  prompt: Fix the API regression.
end
```

### Resource lock

```yaml
lock "db-schema"
  effect "apply_migration" risk high once key="${migration_id}"
    run: npm run migrate
  end
end
```

### Merge policy

```yaml
await all
merge "frontend" strategy ours_if_nonoverlap
merge "backend" strategy ours_if_nonoverlap
```

## Semantics

### Worktree isolation

Each spawned child can get:

- its own checkout
- its own branch
- its own derived state directory
- its own artifact/event log namespace

### Ownership

Child flows declare owned paths. The runtime/linter can detect overlap.

### Locks

Locks serialize access to shared resources:

- schema
- package manifests
- release artifacts
- deployment slots

### Merge strategies

Start simple:

- `manual`
- `fail_on_overlap`
- `ours_if_nonoverlap`
- `squash_patch`

## Static analysis

The linter should detect:

- overlapping ownership declarations
- unsafe merge strategy with overlapping scopes
- lock acquisition order violations
- child flows that modify shared resources without locks

## Acceptance criteria

- Spawn can use isolated worktrees
- Ownership is explicit and lintable
- Resource locks exist
- Merge policies are explicit
- Parallel child flow conflicts are observable and replayable

## Open questions

- Should `worktree auto` become default for multi-child runs?
- How should locks interact with external systems beyond git/files?
