# Target Ref

projection/portarium-evidence-envelope.md

# Context Refs

- `docs/architecture/mc-governed-symphony-reference-vertical.md`
- `docs/architecture/mc-gslr-1-projection-scenario.md`

# Policy

This scenario is read-only and no-mutation. Local model work is bounded by Prompt Language gates to ensure formatting, link/path integrity, and refs-only inspection. Frontier model work performs classification, repair, or final review. No source-system writes occur. Data boundaries are maintained per the governed-Symphony reference vertical.

# Gates

- Markdown formatting checks
- Link/path validation
- Refs-only inspection

# Approvals

Human review points are required before publishing or merging the projection.

# Evidence

- Route manifest: local bulk lane with frontier classification, repair, or review
- Gate result: successful formatting, link/path, and refs-only checks
- Final artifact: projection/portarium-evidence-envelope.md
- Review verdict: acceptable for generic Portarium engineering bead review

# Route

Local bulk lane for drafting and refactoring low-risk content. Frontier model work performs classification, repair, or final review. Portarium records route manifest, gate result, final artifact, approval, and evidence state.

# Non-Goals

There are no source-system writes. No claim of solo local ownership is made. Portarium integration is not yet shipped. The scenario does not include raw vertical payloads or private-grading terminology.
