# Expected Envelope Checklist

The projection is acceptable only if it is safe to show inside a generic
Portarium engineering bead review.

It must include:

- `Target Ref`: a stable identifier for the requested projection task.
- `Context Refs`: source document refs, not copied raw records. Include
  `docs/architecture/mc-governed-symphony-reference-vertical.md` and
  `docs/architecture/mc-gslr-1-projection-scenario.md`.
- `Policy`: read-only/no-mutation status and data-boundary notes.
- `Gates`: markdown formatting, link/path checks, and refs-only inspection.
- `Approvals`: human review points before publishing or merging.
- `Evidence`: route manifest, gate result, final artifact, and review verdict.
- `Route`: local bulk lane plus frontier classification, repair, or review.
- `Non-Goals`: no source-system writes and no solo local ownership claim.

It must avoid:

- raw vertical source-system payloads;
- command output;
- private-grading wording;
- claims that live Portarium integration already exists.
