# Workspace Orchestration (WIP)

> **WIP: not implemented yet.** This page describes intended behavior, not current commands.

## Goal

Run flows across monorepo packages without manually writing one spawn per package.

## Proposed command

```bash
npx @45ck/prompt-language workspace --flow flows/fix-tests.flow
```

## Intended behavior

- detect workspace packages from common monorepo formats
- run child flows per package in parallel
- aggregate results across packages
- allow filtering to specific packages

## Current workaround

Write the monorepo fan-out manually with `spawn`, `await`, and directory-specific child flows.
