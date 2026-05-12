# Task: Implement the GSLR Action Policy Validator

Implement `validateActionPolicyEnvelope(envelope)` in
`src/action-policy-schema.mjs`.

Return shape:

```js
{ ok: true, errors: [] }
{ ok: false, errors: ["human-readable error", "..."] }
```

Required validation rules:

- `version` must be exactly `gslr.action-policy.v1`.
- `workItem.id` must be a string matching `bead-0000` style IDs or
  `prompt-language-*` IDs.
- `workItem.repo` must be one of `prompt-language`, `Portarium`, or
  `MacquarieCollege`.
- `workItem.intent` must be a non-empty string no longer than 240 characters.
- `route.providerClass` must be one of `local`, `frontier`, `hybrid`, or
  `deterministic`.
- `route.reason` must be a non-empty string.
- `gates` must be a non-empty array. Every gate must have:
  - non-empty string `id`;
  - `kind` equal to `public`, `private`, or `review`;
  - `required` exactly `true`.
- `budget.frontierCallLimit` must be a non-negative integer.
- `budget.usdLimit` must be a non-negative number.
- `budget.requiresTokenTelemetry` must be exactly `true`.
- `evidence.finalVerdictRequired` must be exactly `true`.
- `evidence.blockingReviewDefectsFail` must be exactly `true`.
- `evidence.manifestRef` must end with `hybrid-routing-manifest.json`.
- Reject raw or secret payloads anywhere in the envelope, including nested
  objects and arrays. Forbidden key names are `rawPayload`, `sourcePayload`,
  `studentPayload`, `credential`, `secret`, `token`, and `password`, matched
  case-insensitively.

Do not throw on malformed input. Non-object and array inputs must return
`{ ok: false, errors: [...] }`.

Do not mutate the input object.
