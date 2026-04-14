# Marketing Factory Experiment Results

**Date**: 2026-04-15
**Model**: Claude Opus 4.6 (both lanes)

## Summary

| Hypothesis                            | Solo Score | Factory Score | Winner  |
| ------------------------------------- | ---------- | ------------- | ------- |
| MK-1: Gate-enforced quality           | 6/6        | 6/6           | Tie     |
| MK-2: Structured content completeness | 6/6        | 6/6           | Tie     |
| MK-3: Brand voice consistency         | 5/6        | 5/6           | Tie     |
| **Total**                             | **17/18**  | **17/18**     | **Tie** |

## Detailed Results

### MK-1: Gate-Enforced Quality

**Solo (6/6)**:

- [PASS] DOCTYPE present
- [PASS] No unclosed tags
- [PASS] Internal links resolve (10 anchor links)
- [PASS] Viewport meta tag
- [PASS] Mobile media queries
- [PASS] No broken images

**Factory (6/6)**:

- [PASS] DOCTYPE present
- [PASS] No unclosed tags
- [PASS] Internal links resolve (9 anchor links)
- [PASS] Viewport meta tag
- [PASS] Mobile media queries
- [PASS] No broken images

**Verdict**: Tie. Both approaches produced valid HTML5 with full responsive support. The solo prompt was detailed enough that Claude nailed all quality checks on the first shot — the factory's validation+retry loop never triggered.

### MK-2: Structured Content Completeness

**Solo (6/6)**:

- [PASS] Hero section with CTA
- [PASS] Features section (18 card indicators)
- [PASS] Pricing section (14 tier indicators)
- [PASS] Testimonials (144 quote indicators)
- [PASS] Footer with contact + social
- [PASS] Navigation with all section links

**Factory (6/6)**:

- [PASS] Hero section with CTA
- [PASS] Features section (20 card indicators)
- [PASS] Pricing section (13 tier indicators)
- [PASS] Testimonials (105 quote indicators)
- [PASS] Footer with contact + social
- [PASS] Navigation with all section links

**Verdict**: Tie. Both approaches included all 6 required sections. The factory's foreach-driven section generation produced comparable completeness to the solo prompt's single-shot approach. Solo produced a slightly larger file (29KB vs 24KB).

### MK-3: Brand Voice Consistency

**Solo (5/6)**:

- [PASS] No filler phrases
- [PASS] Action verbs in CTAs (6 CTAs)
- [PASS] Title Case headings (16 headings)
- [PASS] No exclamation marks
- [FAIL] Product name consistency — "cloudpulse" variant found (likely in CSS class)
- [PASS] Sentence brevity (15.2 avg words)

**Factory (5/6)**:

- [PASS] No filler phrases
- [PASS] Action verbs in CTAs (7 CTAs)
- [PASS] Title Case headings (18 headings)
- [PASS] No exclamation marks
- [FAIL] Product name consistency — "Cloud Pulse" and "cloudpulse" variants found
- [PASS] Sentence brevity (15.9 avg words)

**Verdict**: Tie. Both failed on product name consistency — CSS class names like `cloudpulse-*` or alternate "Cloud Pulse" spellings appeared despite instructions. The factory actually had _more_ variants (2 types vs 1), suggesting the section-by-section approach introduced inconsistency across sections.

## Analysis

### Why the hypotheses didn't differentiate

1. **Claude Opus 4.6 is too capable for this test**: The model is strong enough that a well-structured single prompt already produces high-quality, complete, standards-compliant HTML. The factory's retry loops and validation gates never triggered because there were no errors to fix.

2. **The solo prompt was too detailed**: It included the same section requirements, brand guidelines, and technical specs that the factory flow used. A fairer test would use a minimal solo prompt (just "build a marketing site for CloudPulse") to test the _guidance_ value of the flow.

3. **Product name consistency is genuinely hard**: Both approaches failed on CSS class names containing lowercase variants. This would require a post-processing step or explicit "never use cloudpulse as a CSS class" instruction.

### Where PL factories would differentiate

- **Weaker models** (Haiku, Codestral, Ollama): Less capable models benefit more from structured guidance
- **Larger websites** (10+ pages): Solo prompts can't fit multi-page generation context
- **Iterative refinement**: Real marketing sites go through multiple review cycles — the factory flow structure supports this naturally
- **Team coordination**: Factory flows with spawn/await support parallel work streams (designer + copywriter + developer)

## Output Files

- Solo: `results/solo/index.html` (29,150 bytes)
- Factory: `results/factory/index.html` (23,976 bytes)
