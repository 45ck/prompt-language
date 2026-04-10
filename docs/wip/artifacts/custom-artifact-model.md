# Custom Artifact Model

## Strong recommendation

Users should be able to define their own artifact types.

The recommended model is:

- runtime owns the envelope
- users own the payload
- renderers own presentation

That avoids both extremes:

- too rigid: only built-in artifacts are possible
- too loose: every random blob becomes an artifact

## Proposed contract

Every artifact shares a common manifest envelope:

- `id`
- `type`
- `status`
- `title`
- `summary`
- `payload`
- `attachments`
- `views`
- `producer`
- `created_at`
- `updated_at`
- `supersedes`
- `review`

Then users define custom types with:

- field schemas
- view mappings
- validation rules
- optional approval or review policies

## Example custom artifact types

- `browser_qa_packet`
- `release_readiness`
- `client_handoff`
- `security_review_packet`
- `migration_review`
- `deployment_packet`
- `design_review`

## Suggested runtime rule

A custom artifact type should behave like a user-defined struct or class implementing an `Artifact` interface, not like an untyped note.
