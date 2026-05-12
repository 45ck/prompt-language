# GSLR-6 Local Scaffolded Sanitizer Repeat Result: 2026-05-13

Status: live local repeat evidence, positive exact-route result  
Tracking bead: `prompt-language-gslr21`  
Companion Portarium bead: `bead-1246`

## Question

Does the GSLR-6 scaffolded sanitizer contract let `qwen3-coder:30b` pass the
same privacy-sensitive sanitizer shape that failed under the GSLR-5 free-form
local prompt?

## Runs

Pre-repeat hardening runs:

- v1:
  `/tmp/prompt-language-gslr6-live/gslr6-scaffolded-sanitizer-live-2026-05-13-01-local-repeat`
- v2:
  `/tmp/prompt-language-gslr6-live/gslr6-scaffolded-sanitizer-live-2026-05-13-v2-01-local-repeat`

Clean v3 repeat roots:

- Repeat 1:
  `/tmp/prompt-language-gslr6-live/gslr6-scaffolded-sanitizer-live-2026-05-13-v3-01-local-repeat`
- Repeat 2:
  `/tmp/prompt-language-gslr6-live/gslr6-scaffolded-sanitizer-live-2026-05-13-v3-02-local-repeat`
- Repeat 3:
  `/tmp/prompt-language-gslr6-live/gslr6-scaffolded-sanitizer-live-2026-05-13-v3-03-local-repeat`

## Result

The final v3 lane passed all three local repeats with zero frontier tokens.

| Repeat | Final verdict | Private oracle | Frontier tokens | Provider USD | Step wall time |
| ------ | ------------- | -------------- | --------------- | ------------ | -------------- |
| 1      | pass          | pass           | 0               | 0            | 75.301s        |
| 2      | pass          | pass           | 0               | 0            | 51.215s        |
| 3      | pass          | pass           | 0               | 0            | 52.569s        |

Each repeat recorded before/after local resource snapshots for `local-bulk`.

## Pre-Repeat Lane Hardening

The first two live local attempts were useful prompt-contract failures:

- v1 implemented helper functions but did not export them, so the public gate
  failed on named imports.
- v2 exported helpers but copied the public-gate import into the target file,
  creating a self-import and duplicate declarations.

The v3 lane made those boundaries explicit: all six helpers must be top-level
named exports, the file must be self-contained, and the model must not paste
public-gate imports into the implementation.

## Interpretation

GSLR-6 is the first positive evidence that the GSLR-5 local failure was partly
a contract-shape failure.

The local model did not become generally trusted for privacy-sensitive
sanitization. It became reliable for this exact static scaffold:

- one implementation file;
- fixed helper boundaries;
- public gate visible to the model;
- unchanged or stricter hidden oracle;
- no product writes;
- zero frontier repair.

This supports `local-screen` for `gslr6-scaffolded-sanitizer` only. It does not
promote the broader `gslr5-raw-payload-adversarial` free-form route.

## Decision

Promote `gslr6-scaffolded-sanitizer` to an exact `local-screen` route in the
GSLR policy.

Keep adjacent privacy-sensitive, free-form, or product-ingestion work on
`frontier-baseline` until it has its own repeated hidden-oracle evidence.

## Product Boundary

Portarium runtime ingestion remains blocked.

Live Cockpit cards remain blocked.

MacquarieCollege connector/raw school-data movement remains blocked.
