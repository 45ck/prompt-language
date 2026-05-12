# Task: Complete a Scaffolded Route-Decision Record Builder

Implement:

- `src/route-decision-record.mjs`

## Required Exports

The module must export these exact functions:

```js
normalizeRouteKey(value);
isUnsafeEvidenceKey(key);
containsUnsafeEvidenceText(value);
isSafeEvidenceRef(ref);
deriveEscalationReasons(input);
selectRouteDecision(input);
buildRouteDecisionRecord(input);
```

## Contract

This is a scaffolded route-decision record builder. Do not replace the helper
boundaries with one large free-form implementation.

Required behavior:

- Do not throw on malformed input.
- Do not mutate input.
- Reject null, arrays, missing objects, and unsupported schema versions.
- Require `schemaVersion === "harness.route-input.v1"`.
- Require `source.system === "prompt-language"` and
  `source.area === "harness-arena"`.
- Require `workItem.id` and `workItem.runId` to be non-empty strings.
- Require `route.arm` to be one of `local-only`, `frontier-only`,
  `advisor-only`, or `hybrid-router`.
- Gate values `finalVerdict` and `privateOracle` must be `pass` or `fail`.
- `blockingReviewDefects` must be an array.
- Reject negative or non-finite cost fields.
- Reject unsafe evidence keys anywhere in the input, including nested objects
  and arrays.
- Key matching must be case-insensitive and separator-insensitive. For example,
  `oracleCommand`, `oracle_command`, `oracle-command`, and `oracle command`
  must normalize to the same key.
- Unsafe key names are `rawPayload`, `sourcePayload`, `studentPayload`,
  `credential`, `secret`, `token`, `password`, `apiKey`, `oracleCommand`,
  `rawStdout`, `rawStderr`, `hiddenOracleBody`, `transcript`, `studentRecord`,
  and `rawDump`.
- Reject string values that expose raw payload boundaries or school/person data
  rather than aggregate evidence. Examples include `BEGIN RAW PAYLOAD`,
  `student id`, `student identifier`, `student record`, `raw transcript`,
  `oracle command`, `password`, `api key`, and `hidden oracle body`.
- Accept safe repository-relative evidence refs.
- Reject refs containing query strings, fragments, absolute paths, parent
  traversal, URL schemes, or raw dump names.
- `deriveEscalationReasons(input)` must return stable reason codes:
  `public-gate-failure`, `private-oracle-failure`, `blocking-review-defects`,
  `frontier-budget-used`, and `local-wall-time-high` where applicable.
- `selectRouteDecision(input)` must return:
  - `local-screen` only when final verdict and private oracle are both `pass`,
    there are no blocking review defects, the arm is `local-only`, and frontier
    tokens are zero;
  - `frontier-baseline` when the private oracle failed;
  - `advisor-escalate` for other public-gate or review-defect failures;
  - `frontier-baseline` for any non-local arm.
- `buildRouteDecisionRecord(input)` must preserve only the allowed top-level
  record fields: `schemaVersion`, `source`, `workItem`, `selectedRoute`,
  `gates`, `cost`, `escalationReasons`, and `artifactRefs`.

Do not add product-ingestion behavior. This is a static research record only.
