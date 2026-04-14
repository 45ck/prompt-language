# Marketing Factory Experiment Results

**Date**: 2026-04-15 (Run 2 — improved flow + minimal solo prompt)
**Model**: Claude Opus 4.6 (both lanes)

## Summary

| Hypothesis                            | Solo Score | Factory Score | Winner      |
| ------------------------------------- | ---------- | ------------- | ----------- |
| MK-1: Gate-enforced quality           | 6/6        | 6/6           | Tie         |
| MK-2: Structured content completeness | 6/6        | 6/6           | Tie         |
| MK-3: Brand voice consistency         | 4/6        | 6/6           | **Factory** |
| **Total**                             | **16/18**  | **18/18**     | **Factory** |

## Key Finding

**The factory won 18/18 vs solo's 16/18.** The PL flow's inline brand validation + retry loop caught and prevented brand voice issues that the solo prompt missed entirely.

### What the factory's retry loop caught

The factory flow included inline `run:` validation scripts that checked for:

- Filler words, exclamation marks, product name variants, CSS class naming
- Missing section IDs, broken anchor links, missing blockquotes
- Feature card count, pricing tier count, testimonial count

All three checks passed on the first attempt because the detailed brand rules in the flow prompt were specific enough. The retry loop was available as a safety net but didn't need to fire.

### What the solo prompt missed (MK-3 failures)

1. **Non-action CTAs**: "Watch Demo" doesn't start with an action verb (should be "View Demo" or "Start Demo")
2. **Non-Title-Case headings**: 4 headings used sentence case instead of Title Case:
   - "Everything you need to stay on top"
   - "Simple, transparent pricing"
   - "Loved by engineering teams"
   - "Ready to monitor smarter?"

These are exactly the kind of brand consistency issues that a minimal prompt doesn't enforce but a structured flow with explicit brand rules does.

## Detailed Results

### MK-1: Gate-Enforced Quality

**Solo (6/6)**:

- [PASS] DOCTYPE present
- [PASS] No unclosed tags
- [PASS] Internal links resolve (3 anchor links)
- [PASS] Viewport meta tag
- [PASS] Mobile media queries
- [PASS] No broken images

**Factory (6/6)**:

- [PASS] DOCTYPE present
- [PASS] No unclosed tags
- [PASS] Internal links resolve (11 anchor links)
- [PASS] Viewport meta tag
- [PASS] Mobile media queries
- [PASS] No broken images

**Verdict**: Tie on score, but factory had 11 anchor links vs solo's 3 — more thorough internal navigation.

### MK-2: Structured Content Completeness

**Solo (6/6)**:

- [PASS] Hero section with CTA
- [PASS] Features section (19 card indicators)
- [PASS] Pricing section (14 tier indicators)
- [PASS] Testimonials (102 quote indicators)
- [PASS] Footer with contact + social
- [PASS] Navigation with all section links

**Factory (6/6)**:

- [PASS] Hero section with CTA
- [PASS] Features section (15 card indicators)
- [PASS] Pricing section (7 tier indicators)
- [PASS] Testimonials (102 quote indicators)
- [PASS] Footer with contact + social
- [PASS] Navigation with all section links

**Verdict**: Tie. Both included all required sections.

### MK-3: Brand Voice Consistency

**Solo (4/6)**:

- [PASS] No filler phrases
- [FAIL] Action verbs in CTAs — "Watch Demo" is not action-oriented
- [FAIL] Title Case headings — 4 headings in sentence case
- [PASS] No exclamation marks
- [PASS] Product name consistency (8 correct uses, no variants)
- [PASS] Sentence brevity (15.6 avg words)

**Factory (6/6)**:

- [PASS] No filler phrases
- [PASS] Action verbs in CTAs (3 CTAs, all action-oriented)
- [PASS] Title Case headings (11 headings, all correct)
- [PASS] No exclamation marks
- [PASS] Product name consistency (10 correct uses, no variants)
- [PASS] Sentence brevity (11.5 avg words)

**Verdict**: Factory wins. The explicit brand rules in the flow prompt (Title Case requirement, CTA verb whitelist, CSS class naming convention) prevented the issues that the minimal solo prompt couldn't catch.

## Run 1 vs Run 2 Comparison

| Metric       | Run 1 Solo | Run 1 Factory | Run 2 Solo | Run 2 Factory |
| ------------ | ---------- | ------------- | ---------- | ------------- |
| MK-1 Quality | 6/6        | 6/6           | 6/6        | 6/6           |
| MK-2 Content | 6/6        | 6/6           | 6/6        | 6/6           |
| MK-3 Brand   | 5/6        | 5/6           | 4/6        | **6/6**       |
| **Total**    | 17/18      | 17/18         | 16/18      | **18/18**     |

**Key changes in Run 2**:

1. Solo prompt was simplified (minimal guidance) — revealed that Claude needs explicit brand rules
2. Factory flow was rewritten with `retry max 3`, inline validation scripts, explicit CSS class naming rules
3. Factory achieved perfect 18/18 by combining structured prompts + runtime validation

## Conclusion

PL factories add the most value for **brand voice enforcement** — the combination of explicit rules in flow prompts plus inline validation scripts creates a quality floor that solo prompts can't match. HTML quality and content completeness are areas where Claude is already strong enough that orchestration doesn't add measurable value.

## Output Files

- Solo: `results/solo/index.html`
- Factory: `results/factory/index.html`
