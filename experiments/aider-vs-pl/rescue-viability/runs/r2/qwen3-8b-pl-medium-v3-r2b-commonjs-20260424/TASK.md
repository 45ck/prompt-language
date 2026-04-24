# H8 Repair Fixture V3

Repair the existing TypeScript model modules in `src/` so they satisfy `contract.json`.

Rules:

- Do not add dependencies.
- Do not rename files.
- Keep one exported interface and one exported factory function per file.
- The factory must accept `input: Partial<InterfaceName> = {}`.
- The factory must return every field listed in `contract.json`.
- Explicit falsy values from `input` must be preserved. For example, if the caller passes `0`, `false`, or `""`, the factory must keep that value instead of replacing it with a default.

The external scorer checks named exports, exact property sets, defaults, partial overrides, and falsy-value preservation.
