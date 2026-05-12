# Task: Validate a Portarium Evidence Card Input

Implement these two files:

- `src/action-boundary-policy.mjs`
- `src/evidence-card-validator.mjs`

`evidence-card-validator.mjs` must import and use the action-boundary helper.

## Exports

`src/action-boundary-policy.mjs` must export:

```js
deriveActionBoundary(card);
```

Return shape:

```js
{ status: "research-only", reason: "human-readable reason" }
{ status: "blocked", reason: "human-readable reason" }
```

`src/evidence-card-validator.mjs` must export:

```js
validateEngineeringEvidenceCard(card);
```

Return shape:

```js
{ ok: true, errors: [] }
{ ok: false, errors: ["human-readable error", "..."] }
```

## Action Boundary Rules

`deriveActionBoundary(card).status` is `research-only` only when:

- `card.gates.finalVerdict === "pass"`;
- `card.gates.privateOracle === "pass"`;
- `card.gates.blockingReviewDefects` is an empty array.

Otherwise it is `blocked`.

## Validation Rules

Validate the static card shape from
`portarium.evidence-card-input.v1`.

Required rules:

- Do not throw on malformed input.
- Do not mutate the input.
- Reject null, arrays, missing objects, and unsupported schema versions.
- Require `source.system === "prompt-language"` and
  `source.area === "harness-arena"`.
- Require `workItem.id` and `workItem.runId` to be non-empty strings.
- Require `route.arm` to be one of `local-only`, `frontier-only`,
  `advisor-only`, or `hybrid-router`.
- Require gate values to be `pass` or `fail`.
- Accept failed evidence cards when `actionBoundary.status === "blocked"`.
- Reject a card marked `research-only` when the derived action boundary is
  `blocked`.
- Reject negative or non-finite cost fields.
- Reject artifact refs containing query strings or fragments.
- Reject raw or secret payload keys anywhere in the card, including nested
  objects and arrays. Forbidden key names are `rawPayload`, `sourcePayload`,
  `studentPayload`, `credential`, `secret`, `token`, `password`,
  `oracleCommand`, `rawStdout`, `rawStderr`, and `hiddenOracleBody`, matched
  case-insensitively.
