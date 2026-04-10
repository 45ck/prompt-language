# Open Questions

## Type system

- Are custom artifact types declared in-flow, in imported libraries, or in separate schema files?
- Can types inherit from other artifact types?
- Are attachments strongly typed or only categorized?

## Review model

- Are comments stored in the manifest or in parallel review event logs?
- Should approvals attach to a specific artifact version only?
- Should an artifact support partial approvals by section?

## Runtime

- Are artifacts emitted only by explicit `emit artifact`, or can `review`, `approve`, or `judge` auto-emit them?
- Does every emitted artifact get a stable alias in state?
- How are superseded versions referenced?

## Rendering

- Which renderers ship in-core?
- Is DOCX/PDF export core or plugin-based?
- Can third parties register custom renderers?

## Gates

- Should artifacts be usable inside `if`, `while`, and `until` conditions, or only inside `done when:`?
- Should failed artifact validation halt the flow immediately or just fail a gate?

## Storage

- Per-run artifact store only, or durable cross-run artifact registry?
- How are very large binary attachments handled?
