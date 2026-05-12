# Task: Create a Portarium Evidence Envelope Projection

Create `projection/portarium-evidence-envelope.md`.

Use `src/source-projection.md` and `src/expected-envelope-checklist.md` as your
only source material.

## Requirements

- Produce a refs-only Portarium evidence envelope for the MC governed-Symphony
  reference vertical.
- Include sections named `Target Ref`, `Context Refs`, `Policy`, `Gates`,
  `Approvals`, `Evidence`, `Route`, and `Non-Goals`.
- Keep MC-specific details as references or summaries only.
- Make clear that the scenario is read-only and no-mutation.
- Make clear that local model work is bounded by Prompt Language gates.
- Make clear that frontier model work is classification, repair, or review.

## Hard Boundaries

- Do not invent source-system writes.
- Do not include raw student, staff, ticket, device, room, connector, or
  credential payloads.
- Do not claim local-only autonomy.
- Do not claim that Portarium integration is already shipped.
- Do not mention or depend on a hidden oracle.

When done, run:

```sh
node test/public-gate.mjs
```
