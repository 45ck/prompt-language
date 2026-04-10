# Node.js SDK

> **Status: shipped.** The public SDK now lives in the shipped docs set. This page remains under `docs/wip/` only as transitional context.

See [SDK Reference](../../reference/sdk.md) for the current contract and [README](../../../README.md) for the install-time overview.

## Historical goal

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

The live contract is now documented in [SDK Reference](../../reference/sdk.md).
