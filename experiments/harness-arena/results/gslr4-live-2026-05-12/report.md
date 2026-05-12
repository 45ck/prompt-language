# GSLR-4 Live Two-File Validator Result: 2026-05-12

Status: live model evidence, negative local-screen result, negative advisor-cost result, positive frontier baseline  
Tracking bead: `prompt-language-gslr15`  
Companion Portarium bead: `bead-1240`

## Runs

Durable run roots:

- Advisor-only hypothesis:
  `/tmp/prompt-language-gslr4-live/gslr4-two-file-validator-live-2026-05-12-01-advisor-only`
- Frontier-only baseline:
  `/tmp/prompt-language-gslr4-live/gslr4-two-file-validator-live-2026-05-12-02-frontier-only`
- Local-only diagnostic:
  `/tmp/prompt-language-gslr4-live/gslr4-two-file-validator-live-2026-05-12-03-local-only-diagnostic`

## Result

| Arm             | Final verdict | Private oracle | Failure boundary                                | Frontier tokens | Provider USD | Step wall time |
| --------------- | ------------- | -------------- | ----------------------------------------------- | --------------- | ------------ | -------------- |
| `advisor-only`  | pass          | pass           | none                                            | 32,862          | 4            | 159.068s       |
| `frontier-only` | pass          | pass           | none                                            | 20,579          | 4            | 151.941s       |
| `local-only`    | fail          | fail           | Validator threw on `null` during private oracle | 0               | 0            | 60.525s        |

Local-only and advisor-only both recorded local resource snapshots. Advisor-only
recorded three local runtime samples during `local-apply`; local-only recorded
two local runtime samples during `local-bulk`.

## Interpretation

GSLR-4 is positive evidence that frontier advice can help a local model complete
a two-file static validator. It is not positive cost evidence for advisor-only.

The local-only diagnostic failed the private oracle with:

```text
null rejected without throwing: validator threw Cannot read properties of null (reading 'schemaVersion')
```

That says the current local lane still misses malformed-input hardening unless
frontier advice is present. But the advisor route used more frontier tokens than
the frontier-only baseline:

- advisor-only: 32,862 frontier tokens;
- frontier-only: 20,579 frontier tokens.

The route for `gslr4-two-file-validator` should therefore be
`frontier-baseline` under the current lanes. Advisor-only remains a useful
repair/learning signal, but it is not the selected cost route.

## Decision

Do not promote GSLR-4 to local-screen.

Do not promote GSLR-4 to advisor-only as the selected route yet.

Update the checked-in route policy:

- keep `gslr2-policy-schema` as `local-screen`;
- keep `gslr3-policy-manifest-transform` as `frontier-baseline`;
- set `gslr4-two-file-validator` to `frontier-baseline` until a cheaper advisor
  prompt or local-lane repair passes with fewer frontier tokens than
  frontier-only.

## Product Boundary

Portarium runtime ingestion remains blocked.

Live Cockpit cards remain blocked.

The static `EngineeringEvidenceCardInputV1` contract remains docs/test-only.
GSLR-4 strengthens the validation boundary but does not justify product
ingestion or MC connector work.
