# H8: Foreach Batch Operations - PL WINS (decisive)

- Solo: 4/4 files created, 0/4 spec-conformant
  - Missing export on interfaces
  - Hallucinated defaults ('Anonymous' instead of '')
  - Used || instead of ?? (real bug: price 0 gets overridden)
- PL: 4/4 files created, 4/4 spec-conformant
  - All interfaces exported
  - All defaults match spec exactly
  - Uses ?? (nullish coalescing) correctly
- Solo 3.6x faster (164s vs 585s) but zero spec compliance
- Focused single-purpose prompts dramatically outperform batched prompts
