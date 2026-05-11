---
title: tinymd — real-software hybrid build experiment
status: ad-hoc evidence — non-claim-eligible per program-status §3a
operator: 45ck
host: i7-14700K / RX 7600 XT 16GB / 64GB RAM
date: 2026-05-11
scope-tag: real-software-multistage
---

# tinymd — Markdown → HTML converter, hybrid build

Third pilot in the same-day Concord/VHO arc. Tests the routing
pattern at **intermediate scope**: bigger than the v2 micro-task
battery, smaller than the morning's TODO CLI. Real multi-stage
pipeline: lex → parse → render. Roughly the shape and difficulty of
a small npm utility module someone might actually publish.

## Hypothesis under test

For real-software builds with a clear architecture and many discrete
pure-function components, hybrid routing **at the function level**
(frontier writes architecture + integration + tests; local writes
individual function bodies) is cost-positive vs frontier-only when
prompts meet the v2 spec-density requirement and the integration
surface is large enough to amortise scaffolding cost.

## Scope of supported markdown

Deliberately tiny. Sufficient to exercise multi-stage parsing, not
ambitious enough to require deep markdown-spec compliance.

| Feature        | Syntax                | Output                           |
| -------------- | --------------------- | -------------------------------- |
| Heading        | `# h1` ... `###### h6` | `<h1>h1</h1>` ... `<h6>h6</h6>`  |
| Paragraph      | plain line(s)         | `<p>...</p>`                     |
| Bold           | `**text**`            | `<strong>text</strong>`          |
| Italic         | `*text*`              | `<em>text</em>`                  |
| Inline code    | `` `text` ``          | `<code>text</code>`              |
| Code block     | ` ``` ... ``` `       | `<pre><code>...</code></pre>`    |
| Unordered list | `- item`              | `<ul><li>item</li>...</ul>`      |
| Link           | `[text](url)`         | `<a href="url">text</a>`         |

Out of scope: ordered lists, tables, blockquotes, images, HTML
embedding, autolinks, ATX heading trailing #, setext headings,
nested formatting beyond one level, line-break-only paragraphs,
HTML escaping inside code blocks (verbatim is fine).

## Decomposition into routable functions

All functions live in a single ESM module `tinymd.mjs`. The frontier
writes the integration (`convert`) plus shared types; the router
fills in each helper function's body via local model.

| ID  | Function                  | Routable? | Why                                           |
| --- | ------------------------- | --------- | --------------------------------------------- |
| F1  | `escapeHtml(text)`        | Yes       | Pure, well-specified, deterministic           |
| F2  | `parseHeading(line)`      | Yes       | Pattern match, returns `{level, text}` or null |
| F3  | `parseListItem(line)`     | Yes       | Pattern match, returns text or null           |
| F4  | `isFenceLine(line)`       | Yes       | Boolean classifier                            |
| F5  | `parseInline(text)`       | Yes       | Recursive inline-format substitution          |
| F6  | `tokenize(markdown)`      | Yes       | Block-level lexer                             |
| F7  | `renderToken(token)`      | Yes       | Token → HTML string                           |
| F8  | `groupListTokens(tokens)` | Yes       | Wrap consecutive list-item tokens in `<ul>`   |
| F9  | `convert(markdown)`       | **No — frontier** | Orchestrator; ties all pieces together |

8 routable + 1 frontier-owned integration = comparable scale to a
small npm utility.

## Two arms

**Arm A (hybrid):** Frontier writes:
- `spec.md`, `tasks.json` (this artifact)
- `arm-a-hybrid/workspace/tinymd.mjs` skeleton with stubs for F1-F8
  and complete impl of F9 (`convert`)
- `oracle/integration.test.mjs` end-to-end conversion tests
- `runner.mjs` (extension of v2 router)

Then router (`runner.mjs`) routes each F1-F8 to qwen3-coder:30b at
**full prompt density** (per v2 ablation finding: 4/10 at starved is
unacceptable). On per-function oracle fail, frontier (me) repairs.

**Arm B (frontier-only):** I write `arm-b-frontier/tinymd.mjs` as a
single coherent module — all functions including `convert`, all in
one file written in one pass.

## Per-function oracle vs integration oracle

Two layers of test, intentionally separate:

1. **Per-function tests** (`oracle/per-function/`): each F1-F8 has
   focused unit tests with adversarial cases. Used by the router to
   gate each routed task. Independent — no cross-function dependencies
   in tests (lesson from morning's TODO CLI pilot).
2. **Integration tests** (`oracle/integration.test.mjs`): full
   markdown → HTML conversion fixtures including adversarial inputs.
   Run after the workspace is fully assembled. Both arms must pass.

## Promotion / escalation

- F1-F8 each: qwen3-coder:30b first attempt → oracle. Pass = local
  closed. Fail = mark for frontier repair (no second-opinion lane).
- F9 (`convert`): frontier-only by design.
- After all functions assembled: integration tests must pass.
  Frontier handles any integration-level repair.

## Token economy formula

```
armA_frontier_tokens = scaffolding (spec + tasks + tests + skeleton + convert + runner)
                     + repair (any per-function frontier rewrites)
                     + integration_repair (any integration fixes)

armB_frontier_tokens = chars(arm-b-frontier/tinymd.mjs) tokens via tiktoken
                     + chars(arm-b-frontier/tinymd.test.mjs) tokens
                     (frontier writes both impl AND tests to be a fair baseline)

per-pilot saving = armB_frontier_tokens - armA_frontier_tokens
```

The honest comparison includes the integration test suite on both
sides — if hybrid needs more tests written by frontier (because the
critic agent flagged earlier that test design is real frontier work),
that counts.

## Methodology fixes inherited from v2

- Pre-committed Arm B written BEFORE running Arm A
- tiktoken cl100k_base for token counting
- k=1 per function (not k=3) — tradeoff: faster, less stable. Good
  enough for this pilot scope.
- Warm-up call discarded
- Seeded random in adversarial test inputs
- Tutorial-quality prompts (full description per v2 ablation)

## What this pilot is and is NOT

**Is:** A real test of "can hybrid routing build software people
might actually use?" at intermediate scope.

**Is NOT:**
- Production-quality markdown parser (deliberately limited subset)
- Claim-eligible per §3a (still no signed trace, no cross-family review)
- Generalisable to multi-file/multi-package projects (one file)
- A statement about hybrid for unbounded "build me an app" requests
