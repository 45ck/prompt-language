# Task: Sanitize a Raw-Payload-Adversarial Evidence Card Input

Implement:

- `src/evidence-card-sanitizer.mjs`

## Export

`src/evidence-card-sanitizer.mjs` must export:

```js
sanitizeEvidenceCardInput(input);
```

Return shape:

```js
{ ok: true, errors: [], card: sanitizedCard }
{ ok: false, errors: ["human-readable error", "..."], card: null }
```

## Required Behavior

The sanitizer receives a proposed static Portarium evidence-card input. It must
accept safe cards and reject cards that contain raw or secret payloads.

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
- Set `actionBoundary.status` on the returned card from the gates:
  `research-only` only when final verdict and private oracle are both `pass`
  and there are no blocking review defects; otherwise `blocked`.
- Reject negative or non-finite cost fields.
- Reject artifact refs containing query strings, fragments, absolute paths,
  parent traversal, or raw dump names.
- Reject raw or secret payload keys anywhere in the input, including nested
  objects and arrays.
- Key matching must be case-insensitive and separator-insensitive. For example,
  `sourcePayload`, `source_payload`, `source-payload`, and `source payload`
  are the same key.
- Forbidden key names are `rawPayload`, `sourcePayload`, `studentPayload`,
  `credential`, `secret`, `token`, `password`, `apiKey`, `oracleCommand`,
  `rawStdout`, `rawStderr`, `hiddenOracleBody`, `transcript`, `studentRecord`,
  and `rawDump`.
- Reject string values that expose raw payload boundaries or school/person data
  rather than aggregate evidence. Examples include `BEGIN RAW PAYLOAD`,
  `student id`, `student identifier`, `student record`, `raw transcript`,
  `oracle command`, `password`, `api key`, and `hidden oracle body`.
- Preserve only the allowed top-level card fields in the returned card:
  `schemaVersion`, `source`, `workItem`, `route`, `gates`, `cost`,
  `actionBoundary`, and `artifactRefs`.

Do not add product-ingestion behavior. This is a static research sanitizer only.
