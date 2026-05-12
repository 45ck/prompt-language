# Target Ref

projection/portarium-evidence-envelope.md

# Context Refs

- `docs/architecture/mc-governed-symphony-reference-vertical.md`
- `docs/architecture/mc-gslr-1-projection-scenario.md`

# Policy

This projection is read-only and no-mutation. It operates within data boundaries
defined by the governed-Symphony reference vertical. Source-system writes are
not performed. Portarium receives only references and evidence envelopes.
Local model work is bounded by Prompt Language gates. Frontier model work is
limited to classification, repair, or review.

# Gates

- Markdown formatting checks
- Link/path validation
- Refs-only inspection

# Approvals

Human review is required before publishing or merging.

# Evidence

- Route manifest: `projection/portarium-evidence-envelope.md`
- Gate result: All checks passed
- Final artifact: `projection/portarium-evidence-envelope.md`
- Review verdict: Approved for projection

# Route

Local bulk work occurs in the projection lane. Frontier work includes
classification, repair, or review.

# Non-Goals

- No source-system writes
- No claim of solo local ownership
- No assertion that Portarium integration is already shipped
- No raw vertical payloads or system records included
- No private grading or operational machinery references
