# Report 04: Prompt Frameworks and Structured Output

> Q4: What template languages and structured output techniques exist, and how do they relate to our DSL?

## Abstract

The prompt engineering ecosystem in 2026 spans constrained decoding engines (Guidance, Outlines, SGLang), template languages (Jinja2, Mustache, Handlebars, Priompt), optimization compilers (DSPy), extraction libraries (Instructor), and native structured output APIs now available from all major providers. These tools solve two fundamental problems: composing prompts programmatically and extracting reliable structured data from model outputs. Most of this landscape is irrelevant to prompt-language's core loop because Claude Code already handles prompt rendering, output parsing, and tool invocation internally. Our DSL is a workflow language that orchestrates an autonomous agent, not a template language that constructs prompts for raw LLM API calls. However, two specific areas warrant attention: our `${var}` interpolation system is a minimal template language, and our `let x = prompt` capture mechanism is a free-form structured output technique that could benefit from the ideas in constrained decoding and schema-enforced extraction.

## Architecture Note

As established in [Report 00](00-architecture-position.md), prompt-language occupies a unique position: it is a meta-orchestration layer for an existing autonomous agent, not a chaining framework that sequences raw LLM API calls. Most prompt frameworks solve problems prompt-language does not have -- Claude Code already handles prompt rendering, response parsing, tool selection, and self-correction within each `prompt:` node. Our DSL contributes sequencing, variable management, and gate enforcement. The intersection with prompt framework research is narrow but real: our `${var}` interpolation is a template language (albeit intentionally minimal), and `let x = prompt` is our structured output mechanism (albeit free-form rather than schema-enforced).

## Key Findings

### Finding 1: Constrained decoding has gone mainstream but operates at a different layer

Four frameworks define token-level output control: LMQL (stalled, ~4.1k stars), Guidance (~21.3k stars, Microsoft), Outlines (~10k stars, dottxt), and SGLang (~24.2k stars, LMSYS). These operate by masking invalid tokens to negative infinity at each generation step, guaranteeing 100% syntactic validity of outputs. All major API providers (OpenAI, Anthropic) now offer native constrained decoding via JSON Schema mode, making these frameworks primarily relevant for self-hosted models. For prompt-language, constrained decoding is irrelevant to the core loop -- Claude Code handles its own output formatting. However, the concept of constraining agent responses is relevant to `let x = prompt` capture, where we currently rely on meta-prompt instructions and retry logic rather than structural guarantees ([source: prompt-frameworks-survey-2026.md, Part 1]).

### Finding 2: Guidance introduced token healing and fast-forwarding -- innovations with conceptual parallels

Guidance's two key innovations are **token healing** (backing up one token at prompt boundaries to fix BPE tokenization artifacts) and **fast-forwarding** (inserting deterministic tokens like JSON structural characters without calling the model). The llguidance Rust engine computes token masks at ~50 microseconds per token with negligible startup cost, and is now integrated into llama.cpp and Chromium's `window.ai`. OpenAI credited llguidance as foundational to their Structured Outputs implementation. These are infrastructure-level innovations that benefit prompt-language indirectly through improved model behavior, but they illustrate a broader principle: deterministic structure (what our DSL provides at the workflow level) and model reasoning (what Claude Code provides at the agent level) are complementary, not competing ([source: prompt-frameworks-survey-2026.md, Guidance section]).

### Finding 3: Template languages range from logic-less to priority-aware, but our needs are minimal

The template language landscape spans four approaches: **Jinja2** (Python de facto standard; powerful but risky with untrusted templates), **Handlebars** (Microsoft Semantic Kernel default; safer, cross-language), **Mustache** (logic-less, 40+ language implementations, safest), and **Priompt** (JSX-based, token-budget-aware). Jinja2 dominates in Python LLM tooling -- HuggingFace, Haystack, LangChain, and Azure PromptFlow all use it. However, these frameworks address the problem of composing complex prompts for raw API calls: conditional sections, loop-generated few-shot examples, filter pipelines, template inheritance. prompt-language's `${var}` interpolation is closer to Mustache in philosophy -- simple substitution with no logic in the template itself -- and this is by design. Complex logic belongs in the DSL's control flow (`if`, `while`, `foreach`), not in template expressions ([source: prompt-frameworks-survey-2026.md, Template languages section]).

### Finding 4: Priompt solves a problem we may eventually face -- context window budgeting

Priompt, created at Anysphere (Cursor's parent company), uses JSX-based priority annotations to manage context window budgets. When total content exceeds the token limit, a binary search finds the optimal priority cutoff and drops lower-priority content first. This solves a problem that Jinja2, Handlebars, and Mustache cannot: **dynamic, token-aware truncation**. prompt-language does not currently face this problem because each `prompt:` node injects a relatively short goal string, and Claude Code manages its own context window. However, as workflows grow more complex and variable values grow larger (e.g., list variables accumulating `run` outputs via `let x += run`), context pressure could become relevant. The priority-based approach is worth monitoring for potential future `additionalContext` injection strategies ([source: prompt-frameworks-survey-2026.md, Priompt section]).

### Finding 5: DSPy's "programming not prompting" philosophy validates our approach from a different angle

DSPy (~16k+ stars, approaching v3.0) replaces handwritten prompt strings with typed signatures that optimizers automatically compile into effective prompts. MIPROv2 uses Bayesian optimization to search the space of instructions and few-shot examples, costing ~$2 and ~20 minutes per optimization run. Dropbox reported 45% error reduction using DSPy. The validation for prompt-language: DSPy demonstrates that **declarative intent specification** ("what I want, not how to prompt for it") consistently outperforms manual prompt engineering. Our `prompt: Fix the failing auth tests` is a declarative goal specification, not a prompt template. The key difference is that DSPy optimizes the prompt text itself, while we delegate prompt interpretation entirely to an autonomous agent. DSPy would be irrelevant as a dependency but relevant as conceptual validation ([source: llm-chaining-patterns.md, DSPy section; prompt-frameworks-survey-2026.md, DSPy section]).

### Finding 6: Native structured outputs from API providers reduce the need for extraction frameworks

OpenAI's JSON Schema mode (August 2024) and Anthropic's native structured outputs (GA early 2026) provide 100% structural compliance via server-side constrained decoding. Schemas are compiled into grammars and cached for 24 hours. This makes extraction libraries like Instructor (for schema enforcement) and Outlines (for local constrained decoding) less critical for API-based applications. For prompt-language, the implication is that a hypothetical `let x: json = prompt "..."` enhancement could leverage Anthropic's native structured output API to guarantee valid JSON capture, eliminating the retry-based capture mechanism we currently use in `buildCapturePrompt()` and `buildCaptureRetryPrompt()`. However, this would require prompt-language to interact with the API layer, which currently sits below Claude Code's abstraction ([source: prompt-frameworks-survey-2026.md, Native model structured output section]).

### Finding 7: Instructor demonstrates the value of validation-with-retry for structured extraction

Instructor (~11k stars, 3M+ monthly downloads) does one thing well: it patches LLM client SDKs to accept a `response_model` parameter backed by Pydantic, then handles retries by feeding validation errors back to the model. This retry-with-error-feedback pattern achieves ~95-99% success rates. prompt-language's `let x = prompt` capture already implements a conceptually similar pattern: `buildCapturePrompt()` instructs Claude to wrap responses in `<prompt-language-capture>` tags, and `buildCaptureRetryPrompt()` re-asks on failure with up to `DEFAULT_MAX_CAPTURE_RETRIES` (3) attempts. The difference is that Instructor validates against a schema while our capture validates only for presence (non-empty). Adding type-based validation (e.g., verifying captured JSON parses correctly) would bring our mechanism closer to Instructor's reliability profile ([source: prompt-frameworks-survey-2026.md, Instructor section; llm-chaining-patterns.md, Instructor section]).

### Finding 8: Research shows rigid format constraints can degrade reasoning quality

EMNLP 2024 ("Let Me Speak Freely?") and NeurIPS 2024 (Grammar-Aligned Decoding) demonstrated that constrained decoding can **distort the probability distribution**, degrading performance on reasoning-heavy tasks (math, multi-hop QA) while improving classification tasks. The mitigation is to include a `chain_of_thought` or `reasoning` field **ordered before** answer fields in the schema, allowing the model to reason before the constraint forces structured output. This finding validates prompt-language's design choice of free-form capture: `let x = prompt` allows Claude to reason naturally within a full agent loop before producing output, rather than constraining token-level generation. If typed captures are added in the future, they should preserve reasoning space ([source: prompt-frameworks-survey-2026.md, "How constrained decoding works mechanically" section]).

### Finding 9: XML tag patterns remain the best general-purpose capture mechanism for Claude

Anthropic's documentation states Claude was "trained specifically to recognize XML tags as a prompt organizing mechanism." XML tags with regex extraction are more robust than XML parsers for LLM output. Assistant message prefilling (starting the response with an opening tag) forces the model into the expected format. This directly validates our capture mechanism: `buildCapturePrompt()` instructs Claude to wrap responses in `<prompt-language-capture name="${varName}">` tags, which is precisely the pattern Anthropic recommends. Our dual-strategy approach (inline tag extraction as primary, file write as fallback) adds resilience beyond what simple tag parsing provides ([source: prompt-frameworks-survey-2026.md, "XML tags: Claude's native structured format" section]).

### Finding 10: The chaining framework pattern of variable substitution between steps is universal

Sequential chains across every framework use the same core mechanism: capture output from step N, optionally parse it, and inject it into step N+1 via template placeholders. LangChain uses `{topic}` in `PromptTemplate`, raw API approaches use Python f-strings, and Haystack uses Jinja2. prompt-language's `${varName}` interpolation serves this exact purpose but at the agent workflow level rather than the API call level. Our `interpolate()` function replaces `${varName}` tokens with values from a variables record, with unknown variables left as-is. The `shellInterpolate()` variant wraps substituted values in single-quotes for shell safety in `run:` nodes. This is intentionally simpler than Jinja2 (no filters, conditionals, or loops in templates) because our control flow is expressed in the DSL itself ([source: llm-chaining-patterns.md, Sequential chains section; domain/interpolate.ts]).

### Finding 11: Few-shot examples provide format compliance but are unnecessary for agent orchestration

Research shows 2-3 carefully crafted few-shot examples provide the bulk of format compliance improvement for raw LLM API calls, with diminishing returns beyond that. This is critical for chaining frameworks where each step must produce parseable output. For prompt-language, few-shot examples are unnecessary in the core loop because Claude Code already understands tool use, file operations, and command execution natively. The one area where this finding applies is `let x = prompt` capture: our `buildCapturePrompt()` function uses instructions rather than examples to guide the capture format. Adding a single example of the expected `<prompt-language-capture>` tag format to the capture prompt could improve first-attempt success rates, following the principle that examples outperform instructions for format compliance ([source: prompt-frameworks-survey-2026.md, "Few-shot examples and retry loops" section]).

### Finding 12: The original DSL feasibility research proposed structured output schemas for node results

The DSL plugin deep research document proposed a "node-level result output contract" -- a stable JSON envelope that every node returns, including `node_id`, `status`, timestamps, `artifacts`, `vars_delta`, and `summary`. It also proposed `--output-schema` validation for Codex adapter integration. While prompt-language implemented a simpler approach (session state JSON with path-based node tracking), the structured output envelope concept aligns with the broader trend toward schema-enforced interfaces between pipeline steps. The current `session-state.json` format serves the same purpose but without the per-node artifact granularity envisioned in the original research ([source: dsl-plugin-deep-research.md, "Node-level result output contract" section]).

## How prompt-language Compares

| Finding                             | Industry Pattern                             | prompt-language Today                                | Gap?                                         |
| ----------------------------------- | -------------------------------------------- | ---------------------------------------------------- | -------------------------------------------- |
| Constrained decoding                | Token-level output masking via JSON Schema   | Not applicable -- Claude Code handles its own output | No gap (different layer)                     |
| Token healing / fast-forwarding     | Fix BPE artifacts, skip deterministic tokens | Benefits indirectly via improved model behavior      | No gap (infrastructure)                      |
| Template languages (Jinja2 etc.)    | Conditionals, loops, filters in templates    | `${var}` substitution + `${var:-default}` defaults   | Intentional simplicity, not a gap            |
| Context window budgeting (Priompt)  | Priority-based token-aware truncation        | No budget management for injected context            | Minor -- monitor as workflows grow           |
| DSPy compiled optimization          | Auto-tune prompts via training data          | Declarative goals delegated to autonomous agent      | Different approach, not a gap                |
| Native structured outputs           | API-level JSON Schema enforcement            | Free-form `let x = prompt` with tag-based capture    | Enhancement opportunity for typed captures   |
| Instructor retry-with-validation    | Schema validation + error feedback + retry   | Presence-only validation + retry (3 attempts)        | Could add type validation to capture         |
| Reasoning quality under constraints | CoT field before structured output           | Free-form agent reasoning (no constraints)           | No gap (design advantage)                    |
| XML tag capture                     | Claude-optimized `<tag>` extraction          | `<prompt-language-capture>` tags + file fallback     | Aligned with best practice                   |
| Variable substitution between steps | `{var}` / `{{ var }}` template placeholders  | `${var}` interpolation + `shellInterpolate()`        | No gap                                       |
| Few-shot format compliance          | 2-3 examples for output formatting           | Instruction-based capture prompts, no examples       | Minor -- could add example to capture prompt |
| Structured node output contracts    | JSON envelope per pipeline step              | Session state with path-based tracking               | Could add per-node artifact logging          |

## DSL Examples

### Our capture mechanism versus framework extraction

prompt-language captures agent output into variables using `let x = prompt`:

```
flow:
  let summary = prompt "Summarize the changes in src/"
  prompt: Write release notes using this summary: ${summary}
```

Under the hood, `buildCapturePrompt()` wraps the prompt text with instructions to emit `<prompt-language-capture name="summary">...</prompt-language-capture>` tags and write to `.prompt-language/vars/summary`. The agent reasons freely, then the capture extracts the tagged value. Compare this to Instructor's approach:

```python
# Instructor: schema-enforced extraction from a raw API call
class Summary(BaseModel):
    text: str
    key_changes: list[str]

summary = client.create(response_model=Summary, messages=[...], max_retries=3)
```

The fundamental difference: Instructor constrains a single LLM call. Our capture wraps a full agent session where Claude may read files, run commands, and reason across multiple tool calls before producing the captured value.

### Our template system versus Jinja2/Mustache/Handlebars

prompt-language uses `${var}` interpolation in prompt and run text:

```
flow:
  let module = "auth"
  let version = run "node -p \"require('./package.json').version\""
  prompt: Fix the failing tests in the ${module} module (v${version})
  run: npm test -- --filter ${module}
```

This is intentionally simpler than Jinja2:

```jinja2
{# Jinja2: powerful but overkill for agent orchestration #}
{% for module in modules %}
Fix the failing tests in {{ module.name }} (v{{ module.version | default("unknown") }})
{% endfor %}
```

In prompt-language, the loop is expressed in the DSL, not the template:

```
flow:
  let modules = "auth api billing"
  foreach module in modules
    let version = run "node -p \"require('./packages/${module}/package.json').version\""
    prompt: Fix the failing tests in the ${module} module (v${version})
  end
```

Our control flow handles iteration. Our interpolation handles substitution. Template-level logic is unnecessary because the DSL itself is the control flow language.

### Structured data via command output

For structured data extraction, prompt-language uses command output rather than constrained decoding:

```
flow:
  let failures = run "npm test 2>&1 | grep 'FAIL' | head -20"
  let count = run "npm test 2>&1 | grep -c 'FAIL'"
  if ${count} > 0
    prompt: Fix these ${count} failing tests: ${failures}
  end
```

This is closer to Unix pipeline composition than to JSON Schema extraction. The `run:` node captures stdout, which the DSL stores as a variable and interpolates into subsequent prompts. For cases requiring structured JSON, the pattern extends naturally:

```
flow:
  let config = run "cat tsconfig.json"
  let deps = run "node -p \"JSON.stringify(Object.keys(require('./package.json').dependencies))\""
  prompt: Analyze the TypeScript config and dependencies. Config: ${config}. Deps: ${deps}.
```

### Default values for resilient interpolation

The `${var:-default}` syntax (H#10) provides template-level fallback values:

```
flow:
  prompt: Deploy to ${environment:-staging} using ${strategy:-rolling} strategy
  run: ./deploy.sh --env ${environment:-staging}
```

This is comparable to Mustache's limited conditional rendering and Handlebars' `{{#if}}` helpers, but expressed as inline defaults rather than block-level conditionals.

## Enhancement Opportunities

Several enhancements emerge from this analysis (cross-reference Report 07 for prioritization):

1. **Typed captures** (`let x: json = prompt "..."`) -- Leverage the principle behind constrained decoding to validate captured values. Rather than token-level constraints (which would require API-layer access), validate the captured string against a type specification (JSON, number, list) and retry with a type-specific error message on failure. This extends the existing `buildCaptureRetryPrompt()` mechanism.

2. **Capture examples in meta-prompts** -- Add a single concrete example to `buildCapturePrompt()` showing the expected `<prompt-language-capture>` tag format. Research consistently shows examples outperform instructions for format compliance. This is a low-cost, high-value change.

3. **Per-node artifact logging** -- The original feasibility research proposed structured node result envelopes. Adding optional per-node output logging (command, exit code, captured variables, timing) would improve debuggability without changing the execution model.

4. **Variable truncation with priority** -- Inspired by Priompt's priority-based truncation, add optional length limits to variable interpolation (e.g., `${var:500}` for first 500 chars) to prevent context overflow when accumulating large command outputs.

5. **Schema-validated run output** -- For `let x = run "cmd"`, add optional JSON validation: `let x: json = run "node extract.js"`. If the command output is not valid JSON, set `command_failed` and allow retry logic to handle it.

## Sources

- [sources/prompt-frameworks-survey-2026.md](sources/prompt-frameworks-survey-2026.md) -- Full survey of prompt engineering frameworks and structured output techniques
- [sources/llm-chaining-patterns.md](sources/llm-chaining-patterns.md) -- Chaining patterns with template/output parsing details
- [sources/dsl-plugin-deep-research.md](sources/dsl-plugin-deep-research.md) -- DSL design decisions and original feasibility research
- [00-architecture-position.md](00-architecture-position.md) -- Architecture position paper establishing prompt-language's unique position
