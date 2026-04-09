# Node.js SDK

## Goal

Expose prompt-language's core application layer as a stable programmatic SDK.

## Public API shape

```ts
import {
  parseFlow,
  createSession,
  advanceFlow,
  evaluateGates,
  renderFlow,
} from '@45ck/prompt-language';
```

## Status

- shipped public exports for parsing, session creation, advancement, gate evaluation, and rendering
- stable TypeScript types for the public surface
- hook entry points reuse the same exported functions internally

See the SDK section in the [README](../../../README.md) for the current import path and example usage.
