# Node.js SDK (WIP)

> **WIP: not implemented yet.** This page describes intended behavior, not current API.

## Goal

Expose prompt-language's core application layer as a stable programmatic SDK.

## Intended API shape

```ts
import {
  parseFlow,
  createSession,
  advanceFlow,
  evaluateGates,
  renderFlow,
} from '@45ck/prompt-language';
```

## Intended behavior

- public exports for parsing, session creation, advancement, gate evaluation, and rendering
- stable TypeScript types for the public surface
- hook entry points reuse the same exported functions internally

## Current workaround

Use the CLI and hook protocol directly.
