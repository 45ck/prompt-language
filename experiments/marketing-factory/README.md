# Marketing Website Factory Experiment

## Purpose

Compare two approaches to building a marketing website:

1. **Solo lane** (raw Claude/Codex): Single prompt, no orchestration
2. **Factory lane** (PL runtime + Claude/Codex): Marketing factory flow with gates, reviews, and structured SDLC

## Hypotheses

### MK-1: Gate-enforced quality

**Claim**: PL gate loops produce websites that pass automated quality checks (valid HTML, working links, responsive layout) more reliably than a single-shot solo prompt.

**Test**: Run both lanes, then execute `verify-mk1.js` which checks:

- Valid HTML (no unclosed tags)
- All internal links resolve
- Responsive meta viewport tag present
- CSS media queries for mobile
- No broken image references

**Expected**: Solo gets 3-4/6 checks. PL gets 6/6 via retry loop.

### MK-2: Structured content completeness

**Claim**: PL `foreach` over required sections produces marketing sites with all required pages/sections, while solo prompts miss sections.

**Test**: Run both lanes, then execute `verify-mk2.js` which checks:

- Hero section with headline + CTA button
- Features section with 3+ feature cards
- Pricing section with 2+ tiers
- Testimonials section with 2+ quotes
- Footer with contact info + social links
- Navigation with links to all sections

**Expected**: Solo gets 4-5/6 sections. PL gets 6/6 via section-by-section generation.

### MK-3: Brand voice consistency

**Claim**: PL review loops produce copy that consistently matches a defined brand voice (professional, concise, action-oriented), while solo output drifts in tone.

**Test**: Run both lanes, then execute `verify-mk3.js` which checks:

- No filler phrases ("very", "really", "just", "basically")
- Action verbs in CTAs (not passive voice)
- Consistent heading capitalization (Title Case)
- No exclamation marks in body copy (professional tone)
- Product name used consistently (exact match)
- Under 20 words per sentence average

**Expected**: Solo gets 3-4/6 brand checks. PL gets 5-6/6 via review + retry.

## File Structure

```
experiments/marketing-factory/
  README.md                    # This file
  factory/
    marketing.flow             # PL marketing factory flow
    brand-guidelines.md        # Brand voice reference
  solo/
    solo-prompt.md             # The single prompt for solo lane
  verify-mk1.cjs              # Quality gate verifier
  verify-mk2.cjs              # Content completeness verifier
  verify-mk3.cjs              # Brand voice verifier
  run-experiment.sh            # Run both lanes + verify
  results/                    # Output from runs
```

## Running

```bash
# Preview the experiment files
cat factory/marketing.flow
cat solo/solo-prompt.md

# Run the experiment (requires claude CLI auth)
bash run-experiment.sh
```
