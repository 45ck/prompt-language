# Portarium Evidence Envelope Projection

## Target Ref

`docs/architecture/mc-gslr-1-projection-scenario.md`

## Context Refs

- `docs/architecture/mc-governed-symphony-reference-vertical.md`
- `docs/architecture/mc-gslr-1-projection-scenario.md`

## Policy

This projection is read-only and no-mutation. All work is bounded by Prompt Language gates. Local model work is limited to drafting or refactoring low-risk content. Frontier model work performs classification, repair, or final review. No source-system writes are permitted. The scenario operates within refs-only boundaries and maintains honest proof constraints.

## Gates

- Markdown formatting checks
- Link and path validation
- Refs-only boundary inspection

## Approvals

- Human review prior to publishing or merging
- Verification of refs-only compliance
- Confirmation of deterministic gate results

## Evidence

- Route manifest: local bulk lane with hybrid-router arm
- Gate result: successful formatting, link, and refs-only inspection
- Final artifact: projection as defined in `mc-gslr-1-projection-scenario.md`
- Review verdict: compliant with governed-Symphony reference vertical

## Route

- Local bulk lane with hybrid-router arm
- Frontier model work: classification, repair, or review
- No writes to SEQTA, IXL, Jamf, Google Workspace, PaperCut, Freshservice, or other source systems

## Non-Goals

- No source-system writes
- No solo local ownership claims
- No raw vertical payloads
- No private grading machinery references
- No claims of live Portarium integration shipping
- No command output or internal tooling details
