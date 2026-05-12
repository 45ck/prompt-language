# GSLR-5 Local Repair Result: 2026-05-12

Status: live local diagnostic, positive prompt-repair evidence, not product promotion  
Tracking bead: `prompt-language-gslr17`  
Companion Portarium bead: `bead-1242`

## Runs

Durable run roots:

- Repair v1:
  `/tmp/prompt-language-gslr5-live/gslr5-raw-payload-adversarial-live-2026-05-12-04-local-repair`
- Repair v2:
  `/tmp/prompt-language-gslr5-live/gslr5-raw-payload-adversarial-live-2026-05-12-05-local-repair-v2`

## Result

| Arm                   | Final verdict | Private oracle | Failure boundary                                                | Frontier tokens | Provider USD | Step wall time |
| --------------------- | ------------- | -------------- | --------------------------------------------------------------- | --------------- | ------------ | -------------- |
| `local-repair-v1`     | fail          | fail           | Treated `blockingReviewDefects` array as a pass/fail gate value | 0               | 0            | 60.589s        |
| `local-repair-v2`     | pass          | pass           | none                                                            | 0               | 0            | 60.540s        |
| prior `frontier-only` | pass          | pass           | none                                                            | 53,668          | 5            | 457.843s       |

The passing local repair recorded two runtime samples during `local-bulk`.

## What Changed

The local lane prompt now makes two hidden assumptions explicit:

- artifact refs are repository-relative evidence paths, not URLs;
- `gates.blockingReviewDefects` is an array and must not be validated as a
  `pass`/`fail` gate value.

It also tells the local lane to scan every string value recursively for raw
payload text.

## Interpretation

This is positive evidence for prompt-language as a routing/repair language. The
local model did not need a frontier repair step after the lane contract was made
more precise.

It is not enough to promote privacy-sensitive sanitization to local-screen yet.
The original GSLR-5 local lane failed, the first repair failed, and this is only
one passing local diagnostic on one fixture. The route should remain
`frontier-baseline` with a new local-repair candidate.

## Next Decision

Run a small GSLR-5R repeat set before promotion:

- at least three clean local repair repeats;
- no changes to the private oracle;
- same zero-frontier-token lane;
- same resource snapshot evidence.

Only after repeat passes should the route policy consider a `local-screen` or
`local-repair-candidate` decision for this privacy-sensitive shape.
