# WIP Runtime Proposals

This folder is primarily for unshipped runtime and integration proposals.

If a runtime capability is already documented in the [Language Reference](../../reference/index.md), [README](../../../README.md), or [Roadmap](../../roadmap.md), treat it as shipped even if a legacy design note still lives here.

## Active proposals

| Page                                            | Focus                                                                         | Status          |
| ----------------------------------------------- | ----------------------------------------------------------------------------- | --------------- |
| [Flow Registry](flow-registry.md)               | Canonical `.flow` registry and file-first workflow around shipped commands    | Active proposal |
| [MCP Server](mcp.md)                            | Flow-facing MCP state/resources surface, not host-extension administration    | Active proposal |
| [Workspace Orchestration](workspace.md)         | Monorepo-aware flow execution and safer parallel work                         | Active proposal |
| [Routing and Dispatch](routing-and-dispatch.md) | Decision note choosing `match` first while keeping dedicated `route` deferred | Decision note   |

## Shipped context

These pages remain in WIP as transition or design-history material, but they are not future-only proposals:

| Page                  | Why it still appears here                                                                                 | Status      |
| --------------------- | --------------------------------------------------------------------------------------------------------- | ----------- |
| [Node.js SDK](sdk.md) | Historical design note for a capability now shipped publicly; see [SDK Reference](../../reference/sdk.md) | Shipped now |
