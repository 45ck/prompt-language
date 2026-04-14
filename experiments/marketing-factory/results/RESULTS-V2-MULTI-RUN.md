# Marketing Factory V2 — Multi-Run Results (3 runs)

## Aggregate Scores

| Run | Factory (PL) | Solo (CLAUDE.md+Skills) | Gap  |
| --- | ------------ | ----------------------- | ---- |
| 2   | **30/30**    | 28/30                   | +2   |
| 3   | **30/30**    | 29/30                   | +1   |
| 4   | **30/30**    | 28/30                   | +2   |
| Avg | **30.0**     | 28.3                    | +1.7 |

Factory: **100% consistency** (30/30 every run)
Solo: **94.4% average** (28-29/30, variance across runs)

## Per-Check Breakdown

### MK-1: Quality + Accessibility (10 checks)

| Run | Factory | Solo  | Solo failures         |
| --- | ------- | ----- | --------------------- |
| 2   | 10/10   | 10/10 | (none after fair fix) |
| 3   | 10/10   | 10/10 | (none)                |
| 4   | 10/10   | 10/10 | (none)                |

Both perfect. Quality/a11y is table-stakes for Claude — CLAUDE.md alone handles it.

### MK-2: Content + SEO (10 checks)

| Run | Factory | Solo | Solo failures |
| --- | ------- | ---- | ------------- |
| 2   | 10/10   | 9/10 | Favicon       |
| 3   | 10/10   | 9/10 | Favicon       |
| 4   | 10/10   | 9/10 | Favicon       |

**Favicon is a systematic solo failure** (3/3 runs). The solo CLAUDE.md explicitly requires `<link rel="icon">` but Claude consistently omits it. The factory flow includes the exact favicon data URI in the prompt, and the SEO validation script enforces it inside `retry max 3`.

### MK-3: Brand Voice + Design (10 checks)

| Run | Factory | Solo  | Solo failures               |
| --- | ------- | ----- | --------------------------- |
| 2   | 10/10   | 10/10 | (none after fair fix)       |
| 3   | 10/10   | 10/10 | (none)                      |
| 4   | 10/10   | 9/10  | Product name: "Cloud Pulse" |

Product name consistency is **intermittent** (1/3 runs). When it fails, Claude writes "Cloud Pulse" (two words) despite CLAUDE.md saying "always written as one word". The factory's brand voice validation script catches this via regex and forces correction.

## Failure Analysis

### Why solo fails on favicon (100% failure rate)

The `<link rel="icon">` tag is a low-salience requirement. Claude prioritizes structural HTML, content, styling, and SEO meta tags. The favicon is listed in CLAUDE.md among 16 quality checklist items, but there's no enforcement mechanism. Without a validation script that specifically checks for it, Claude "forgets" it every time.

**PL fix**: The factory flow includes the exact favicon markup in the prompt AND validates it in the SEO check script. If missing, the retry loop forces Claude to add it.

### Why solo fails on product name (33% failure rate)

"CloudPulse" vs "Cloud Pulse" is a subtle distinction. Claude's language model naturally word-breaks compound nouns. Despite explicit instructions, 1 in 3 runs produces the two-word variant somewhere in the copy.

**PL fix**: The factory's brand voice validation script uses regex to detect `cloud\s+pulse|Cloud\s+Pulse|CLOUDPULSE` variants and fails the check, triggering retry.

## Key Findings

1. **PL delivers 100% consistency** — the factory scored 30/30 in all 3 runs. Solo varied between 28-29/30.

2. **The enforcement gap is narrow but real** — solo gets 94-97% right, but the remaining 3-6% are exactly the kind of edge cases that matter in production (brand consistency, complete SEO).

3. **Retry-with-validation is the killer pattern** — not complex multi-agent orchestration, not phased workflows, just `retry max 3` with inline validation scripts. Simple, effective, deterministic.

4. **MK-1 (quality/a11y) shows no gap** — both lanes handle structural HTML equally well. The value of PL is in the harder-to-enforce requirements (brand voice, SEO completeness).

5. **Solo's strength is first-pass quality** — Claude with good CLAUDE.md instructions produces excellent output ~94% of the time. PL's value is eliminating the remaining variance.

## Methodology Notes

- All runs use the same verification scripts (`verify-mk1-v2.cjs`, `verify-mk2-v2.cjs`, `verify-mk3-v2.cjs`)
- MK-1 media query check was fixed after run 2 to accept both `min-width` and `max-width` approaches (run 2 solo scores adjusted from 9/10 to 10/10)
- Each run uses `claude -p --dangerously-skip-permissions` in a clean temp directory
- Factory uses the same `project.flow` across all runs
- Solo uses the same `CLAUDE.md` + `prompt.md` + 4 skills across all runs
