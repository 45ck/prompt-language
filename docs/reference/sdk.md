# SDK

`prompt-language` ships a stable programmatic SDK for integrations that want to work with flow text and session state directly instead of going through the CLI.

## Import paths

Use either the root package export or the dedicated SDK subpath:

```ts
import {
  parseFlow,
  createSession,
  advanceFlow,
  evaluateGates,
  renderFlow,
} from '@45ck/prompt-language';
```

```ts
import {
  parseFlow,
  createSession,
  advanceFlow,
  evaluateGates,
  renderFlow,
} from '@45ck/prompt-language/sdk';
```

## Shipped surface

The stable SDK surface is:

- `parseFlow`
- `createSession`
- `advanceFlow`
- `evaluateGates`
- `renderFlow`

These exports are intended for tooling, integrations, and programmatic flow execution that need the same core parse/session/advance/gate/render behavior used by the runtime itself.

## What this does not cover

This page is only about the shipped programmatic API. It is not the contract for:

- plugin installation or uninstall commands
- interactive hook entry points
- status line or watch-mode UX
- future runner abstraction or cross-client packaging work

For those surfaces, see the [CLI Reference](cli-reference.md), the [Roadmap](../roadmap.md), and [WIP Features](../wip/index.md).

## Related

- [CLI Reference](cli-reference.md)
- [Documentation Governance](../documentation-governance.md)
