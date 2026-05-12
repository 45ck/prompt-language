# Portarium Evidence Envelope Projection

## Target Ref

`docs/architecture/mc-gslr-1-projection-scenario.md`

## Context Refs

- `docs/architecture/mc-governed-symphony-reference-vertical.md`
- `docs/architecture/mc-gslr-1-projection-scenario.md`

## Policy

This projection is read-only and no-mutation. All work is bounded by Prompt Language gates. Local model work is limited to drafting or refactoring low-risk content. Frontier model work performs classification, repair, or final review. No writes to source systems are permitted.

## Gates

- Markdown formatting checks
- Link and path validation
- Refs-only boundary inspection

## Approvals

- Human review prior to publishing or merging
- Verification of refs-only compliance
- Confirmation of deterministic gate results

## Evidence

- Route manifest: local bulk lane with frontier classification, repair, or review
- Gate result: formatting, links, and refs-only checks passed
- Final artifact: projection as defined in `mc-gslr-1-projection-scenario.md`
- Review verdict: safe for generic Portarium engineering bead review

## Route

- Local bulk lane execution
- Frontier model work: classification, repair, or review
- Portarium records route manifest, gate result, final artifact, approval, and evidence state

## Non-Goals

- No source-system writes
- No solo local ownership claim
- No raw vertical payloads
- No private grading machinery references
- No claims of live Portarium integration shipping
- No command output or raw data inclusion
