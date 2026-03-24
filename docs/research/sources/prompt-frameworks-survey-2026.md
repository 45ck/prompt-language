# Prompt engineering frameworks and structured output techniques: a 2026 practitioner's survey

Every LLM application—whether an academic pipeline, an AI agent, or a production API—faces two fundamental challenges: **how to compose prompts programmatically** and **how to extract reliable structured data from model outputs**. This survey covers the full landscape of tools addressing both problems as of early 2026, with implementation-ready detail and honest tradeoffs. The ecosystem has matured dramatically: constrained decoding is now native to all major API providers, template languages range from simple Mustache to priority-aware JSX frameworks, and orchestration tools like DSPy are replacing manual prompt engineering with compiled optimization. What follows is organized into two parts—prompt engineering frameworks first, then structured output techniques—with comparative tables and opinionated recommendations throughout.

---

# PART 1 — Prompt engineering frameworks and template languages

---

## Constrained and grammar-based generation frameworks

Four frameworks define this category, each attacking the problem of controlling LLM output at the token level from a different angle. They range from research-grade query languages to production-scale serving engines.

### LMQL: a query language for language models

LMQL, created by the **SRI Lab at ETH Zurich** and published at PLDI'23, is a Python superset that interleaves natural language prompts with programmatic control and constraint specifications. A typical LMQL program looks like Python, but top-level strings become prompt statements, and template variables in brackets are completed by the model:

```python
@lmql.query
def meaning_of_life():
    '''lmql
    "Q: What is the answer to life, the universe and everything?"
    "A: [ANSWER]" where len(ANSWER) < 120 and STOPS_AT(ANSWER, ".")
    "The answer is [NUM: int]"
    return NUM
    '''
```

The `where` clause is LMQL's signature feature—it translates character-level constraints into sub-token masks applied eagerly during decoding, using speculative execution to prune the search space early. LMQL supports multiple decoding algorithms (`argmax`, `sample`, `beam`, `best_k`), async execution with cross-query batching, and backends including OpenAI, HuggingFace Transformers, and llama.cpp. It claims **75–85% fewer billable tokens** compared to standard decoding on constrained tasks.

The key limitation is maintenance. The original `eth-sri/lmql` repository (~4.1k GitHub stars) was reorganized into the `lmql-lang` organization, but activity has significantly slowed since mid-2024. Open issues from early 2025 remain unanswered. A teased "next major version" has not materialized. **New projects should avoid LMQL** given its uncertain future, though its design ideas influenced the field.

### Guidance: Microsoft's constrained generation DSL

Guidance, created by Scott Lundberg at Microsoft, treats the prompt as a linear execution stream where text and generation commands are appended sequentially. Its current API (v0.2+) uses Python's `+=` operator to build up prompts with role context managers, constrained generation primitives, and composable grammar functions:

```python
from guidance import system, user, assistant, gen, select

lm = model
with system():
    lm += "You are a helpful assistant"
with user():
    lm += "What is your name?"
with assistant():
    lm += gen(name="response", max_tokens=20)
    lm += "My age is " + gen("age", regex=r"\d+")
    lm += "I prefer " + select(["Python", "Rust", "Go"], name="lang")
```

Three innovations distinguish Guidance. First, **token healing** fixes tokenization artifacts at prompt boundaries by backing up one token and constraining the first generated token to have a matching prefix—this eliminates subtle bugs where BPE greedily splits characters in ways that confuse the model. Second, **fast-forwarding** inserts deterministic tokens (closing tags, JSON structural characters) without calling the model, saving GPU forward passes. Third, the **llguidance** Rust engine computes token masks on the fly at ~**50μs per token** for a 128k tokenizer with essentially zero startup cost—a fundamentally different approach than Outlines' precomputation.

Guidance supports full context-free grammars via Lark format, JSON Schema constrained generation, and composable grammar functions. It has **~21.3k GitHub stars**, active development through 2025–2026, and Microsoft backing. The llguidance engine is now integrated into llama.cpp (via `-DLLAMA_LLGUIDANCE=ON`) and merged into Chromium for `window.ai`. OpenAI credited llguidance as foundational to their Structured Outputs implementation.

The main weakness is narrowing API model support—Guidance dropped Cohere, Gemini, and Anthropic backends, making it primarily a local-model tool. The `+=` streaming model and grammar composition also have a meaningful learning curve.

### Outlines: FSM-based guaranteed structured output

Outlines, created by Rémi Louf and Brandon Willard (commercialized as **dottxt**), guarantees structured outputs by converting format specifications into finite-state machines and precomputing valid token sets. The pipeline works as follows: JSON Schema → regex → deterministic finite automaton → vocabulary index mapping FSM states to allowed token IDs. At each generation step, the current FSM state determines which tokens are valid; all others are masked to −∞. This achieves **O(1) per-token lookup** after initial precomputation.

The v1.0 API is remarkably clean:

```python
import outlines
from pydantic import BaseModel

model = outlines.from_transformers(auto_model, auto_tokenizer)

class Character(BaseModel):
    name: str
    age: int
    weapon: str

result = model(prompt, Character)  # Always valid JSON
```

Outlines also supports regex-guided generation, `Literal` type enums, and CFG-based generation via Lark grammars (beta, LALR(1) only). It integrates with Transformers, vLLM, llama.cpp, MLX, OpenAI-compatible APIs, and HuggingFace TGI.

The critical tradeoff versus Guidance is **precomputation vs. on-the-fly masking**. Complex JSON schemas can cause exponential FSM state explosion in Outlines, leading to compilation times of **40 seconds to 10+ minutes** and high memory usage. JSONSchemaBench found Outlines had the lowest compliance rate among tested engines due to timeouts on complex schemas. Guidance's lazy computation avoids this entirely. Outlines also lacks token healing and template-based interleaving—it focuses purely on output structure.

**~10k+ GitHub stars**, active development (v1.2.12 as of March 2026), and commercial backing from dottxt ensure continued viability.

### SGLang: the performance-first serving engine

SGLang, from Stanford/UC Berkeley researchers and hosted under LMSYS, co-designs a frontend language with an optimized backend runtime. It is fundamentally a **serving engine** rather than a constraint library—structured generation is one feature among many.

The key innovation is **RadixAttention**, which maintains all KV caches in a radix tree for automatic prefix reuse. This handles few-shot sharing, multi-turn conversation prefixes, and tree-of-thought branching transparently, yielding up to **5x faster inference** on prefix-heavy workloads. SGLang also provides fork/join primitives for parallel generation:

```python
@sgl.function
def judge(s, essay):
    s += "Evaluate this essay:\n" + essay
    forks = s.fork(3)
    for i, f in enumerate(forks):
        f += f"Rate {['clarity','creativity','grammar'][i]}: "
        f += sgl.gen("score", max_tokens=3)
    s += sgl.gen("grade", choices=["A","B","C","D","F"])
```

Benchmarks show up to **6.4x higher throughput** versus vLLM and Guidance on complex LLM programs. SGLang uses compressed finite-state machines for **3x faster JSON decoding** compared to standard FSM approaches. It powers xAI's Grok 3, Microsoft Azure's DeepSeek R1 serving, and reportedly handles trillions of tokens daily across 400,000+ GPUs.

At **~24.2k GitHub stars**, SGLang is the most actively maintained framework in this category, with day-zero support for new models and hardware (NVIDIA GB200/H100, AMD MI300, Google TPUs, Intel CPUs). The limitation is that it requires GPU infrastructure—it's not a lightweight library for API-only use cases.

### Constrained generation frameworks compared

| Dimension | LMQL | Guidance | Outlines | SGLang |
|---|---|---|---|---|
| **Primary focus** | Query language for LLMs | Constrained generation DSL | Guaranteed structured output | High-perf serving + DSL |
| **Constraint power** | Medium (len, stops, types) | High (regex, CFG, JSON) | High (regex, JSON, CFG) | Medium (choices, JSON, regex) |
| **Startup cost** | Low | Negligible | Can be very high | Low |
| **Per-token overhead** | Moderate | ~50μs (llguidance) | O(1) lookup | Lowest (compressed FSM) |
| **API model support** | Yes (OpenAI) | Limited (OpenAI mainly) | Yes (multi-provider) | Primarily local serving |
| **Token healing** | No | Yes | No | No |
| **GitHub stars** | ~4.1k | ~21.3k | ~10k+ | ~24.2k |
| **Status (early 2026)** | ⚠️ Stalled | ✅ Active (Microsoft) | ✅ Active (dottxt) | ✅ Very active (LMSYS) |

**Use SGLang** for production serving at scale. **Use Guidance** for complex constrained generation with local models needing CFG support. **Use Outlines** for clean, guaranteed structured outputs across multiple providers. **Avoid LMQL** for new projects.

---

## Template languages for prompt composition

### Jinja2 dominates the Python LLM ecosystem

Jinja2 is the **de facto standard** for prompt templating in Python. HuggingFace Transformers uses it for `apply_chat_template()` (the standard for formatting chat messages across model formats). Haystack uses it in `PromptBuilder`. Azure PromptFlow, Microsoft Semantic Kernel (Python SDK), LangChain, and PromptLayer all support it. Even standalone usage is common:

```jinja2
{% for doc in documents %}
Source {{ loop.index }}: {{ doc.title }}
{{ doc.content | truncate(500) }}
{% endfor %}

{% if patient.allergies %}
⚠️ Known allergies: {{ patient.allergies | join(', ') }}
{% endif %}
```

Jinja2's power—conditionals, loops, filters (`| upper`, `| join`, `| default`, `| tojson`), macros, template inheritance—makes it ideal for complex prompt logic. But three gotchas catch most developers. First, the `{{ }}` syntax **conflicts with JSON**: you must use `{% raw %}...{% endraw %}` blocks or escape with `{{ "{" }}`, which is ugly. Second, whitespace control requires careful use of `-` operators (`{%- -%}`) or `trim_blocks`/`lstrip_blocks` settings to avoid unwanted blank lines. Third, Jinja2 is **dangerous with untrusted templates**—it can execute arbitrary Python via template injection. LangChain explicitly warns against accepting Jinja2 templates from untrusted sources.

### Handlebars lives in Microsoft's ecosystem

Handlebars extends Mustache with helpers, block expressions, and partials. Its primary LLM home is **Microsoft Semantic Kernel**, where it serves as the default template language across .NET, Python, and Java. Registered kernel functions become Handlebars helpers callable from templates, and the Handlebars Planner generates executable plans in Handlebars syntax:

```handlebars
{{#each history}}
<message role="{{this.role}}">{{this.content}}</message>
{{/each}}
{{set "fact" (DailyFactPlugin-GetDailyFact today=today)}}
```

Handlebars is **safer than Jinja2** (less attack surface), **more portable** (implementations in 10+ languages), and pre-compilable for performance. But it lacks template inheritance, requires helper registration for custom logic, and is not the default in the Python ecosystem. Choose Handlebars for Semantic Kernel projects or cross-language codebases.

### Mustache for simplicity and safety

Mustache is "logic-less"—no if/else, no loops, no arbitrary code. Sections conditionally render based on data truthiness, and arrays iterate automatically. It appears in LangSmith/LangChain (as an alternative to f-strings), Portkey, Langflow, and Opik. With implementations in **40+ languages**, it's the most portable option and the safest choice for untrusted user-editable templates. The tradeoff is severe: complex prompt logic requires preprocessing data before passing it to the template.

### Priompt solves what text templating cannot

Priompt ("priority + prompt"), created by Arvid Lunnemark at Anysphere (the company behind Cursor), is fundamentally different from the preceding three. It's a **JSX-based prompt composition framework** that manages context window budgets through declarative priority assignments:

```tsx
function ChatPrompt(props: PromptProps<{history: Message[]}>) {
  return (
    <>
      <SystemMessage>You are a helpful assistant.</SystemMessage>
      {props.history.map((m, i) => (
        <scope prel={-(props.history.length - i)}>
          <UserMessage>{m.content}</UserMessage>
        </scope>
      ))}
      <empty tokens={1000} />
    </>
  );
}
```

When total content exceeds the token budget, Priompt's renderer performs a **binary search for the optimal priority cutoff**—the minimum priority value such that including all content with priority ≥ cutoff fits within the token limit. Older history messages (lower `prel` values) are dropped first. The `<first>` element enables fallback chains (detailed → summary → "omitted"). The `<isolate>` element guarantees prefix stability for caching.

This solves a problem that Jinja2/Handlebars/Mustache fundamentally cannot: **dynamic, token-aware truncation**. Priompt powers Cursor's AI code editor internally and is open-sourced on GitHub, but external adoption remains limited. Python ports exist (`py-priompt`, `priomptipy`) but are community-maintained. Choose Priompt when composing prompts from many variable-length sources (code files, search results, conversation history) that may collectively exceed the context window.

### Template language decision guide

| Criterion | Jinja2 | Handlebars | Mustache | Priompt |
|---|---|---|---|---|
| **Complexity** | Most powerful | Medium | Simplest | Purpose-built |
| **Safety** | Risky (injection) | Safe | Safest | Safe (TypeScript) |
| **Portability** | Python-only | 10+ languages | 40+ languages | TS/JSX native |
| **Token awareness** | None | None | None | Built-in |
| **JSON conflicts** | Painful (`{{ }}`) | Moderate | Fewer issues | None (JSX) |
| **Best for** | Python LLM apps | Semantic Kernel/.NET | Simple/portable templates | Context window management |

---

## Higher-level orchestration frameworks

### LangChain: the batteries-included ecosystem

LangChain (now at **v1.2.x** as of March 2026, ~90k GitHub stars) provides `PromptTemplate` for completion models, `ChatPromptTemplate` for chat models with role tuples and `MessagesPlaceholder` for dynamic history injection, and `FewShotPromptTemplate` with example selectors (length-based, semantic similarity, max marginal relevance). LCEL (LangChain Expression Language) composes chains using the pipe operator:

```python
chain = ChatPromptTemplate.from_template("Describe {topic}") | ChatOpenAI() | StrOutputParser()
result = chain.invoke({"topic": "quantum computing"})
```

LCEL provides first-class streaming, `RunnableParallel` for concurrent operations, batch processing, and fallback chains. LangGraph handles stateful multi-agent workflows. The ecosystem is massive—120+ data source integrations, 35+ vector stores, all major LLM providers.

The well-documented criticisms remain relevant: **over-abstraction** for simple tasks, dependency bloat, LCEL's non-standard Python syntax, and documentation that trails code changes. But the v1.0+ stability commitment has addressed the breaking-changes problem, and for full-stack LLM applications needing agents, tools, and RAG, LangChain remains the most complete option.

### LlamaIndex: RAG-first prompt design

LlamaIndex takes a fundamentally different approach—prompts are embedded in modules, not standalone composable units. Every query engine, synthesizer, and evaluator has built-in default prompts accessed via `get_prompts()` and updated via `update_prompts()` with namespace-prefixed keys like `"response_synthesizer:text_qa_template"`. The newer `RichPromptTemplate` uses Jinja2 syntax with loops, conditionals, and image support. Choose LlamaIndex when building document Q&A or RAG pipelines where sensible defaults matter more than general-purpose prompt chaining.

### DSPy: compiling rather than writing prompts

DSPy (Stanford NLP, **~16k+ GitHub stars**, approaching v3.0) represents the most radical departure from manual prompt engineering. Instead of writing prompt strings, you declare **signatures** specifying input/output behavior:

```python
class QA(dspy.Signature):
    """Answer questions given context."""
    context = dspy.InputField(desc="relevant passages")
    question = dspy.InputField()
    answer = dspy.OutputField(desc="concise answer")

cot = dspy.ChainOfThought(QA)
```

Programs compose like PyTorch modules. The revolutionary feature is **automatic optimization**: optimizers like **MIPROv2** (the recommended starting point) search the space of instructions and few-shot examples using your training data and evaluation metric. A typical optimization run costs ~**$2 and takes ~20 minutes**, and can dramatically improve scores (e.g., ReAct from 24% to 51% on benchmarks). Other optimizers include BootstrapFewShot, GEPA (NeurIPS 2025), SIMBA, and BetterTogether (which combines prompt optimization with fine-tuning).

The tradeoff is a steeper learning curve and the requirement for training data with evaluation metrics. DSPy is overkill for simple single-call tasks but transformative for complex multi-step pipelines where prompt quality is measurable and must work across different models.

### Instructor: structured output, nothing more

Instructor (by Jason Liu, **11k+ GitHub stars**, 3M+ monthly downloads) does one thing extremely well: it patches LLM client SDKs to accept a `response_model` parameter backed by Pydantic. It handles retries with validation errors fed back to the model, partial streaming of structured objects, nested Pydantic models, and supports **15+ providers** through a unified interface:

```python
client = instructor.from_provider("openai/gpt-4o-mini")
user = client.create(response_model=User, messages=[...], max_retries=3)
```

Instructor is not an orchestration framework—it has no pipeline composition, chaining, or agent capabilities. It's the right tool when you need reliable structured extraction and nothing else.

### Marvin: AI-native Python functions

Marvin (by Prefect, now at **v3.0**) provides the simplest AI abstractions in the ecosystem. The `@marvin.fn` decorator turns a Python function signature and docstring into an LLM call—no prompt writing at all:

```python
@marvin.fn
def sentiment(text: str) -> float:
    """Returns sentiment score between -1 and 1."""

sentiment("I love this!")  # 0.8
```

Marvin also offers `marvin.extract()`, `marvin.classify()`, `marvin.cast()`, and `marvin.generate()` as high-level utilities. Version 3.0 merges the ControlFlow agentic engine with Marvin's DX, using PydanticAI as the LLM backend. Choose Marvin for quick AI augmentation of existing Python code and prototyping.

### Orchestration framework comparison

| Framework | Primary strength | Best for | Learning curve | Status |
|---|---|---|---|---|
| **LangChain** | Ecosystem breadth | Full-stack LLM apps, agents, tools | Medium-high | Very active (v1.2.x) |
| **LlamaIndex** | RAG-first design | Document Q&A, retrieval pipelines | Medium | Very active |
| **DSPy** | Auto prompt optimization | Multi-step pipelines with metrics | High | Active (approaching v3.0) |
| **Instructor** | Structured extraction | Reliable JSON from any LLM | Low | Very active (v1.14.5) |
| **Marvin** | Simplicity | Quick AI in Python code | Very low | Active (v3.0) |

---

## Prompt registries and version management

Three platforms dominate prompt management. **Langfuse** is the leading open-source option (MIT-licensed core, self-hostable), combining observability, prompt versioning with label-based deployment (`production`, `staging`, `latest`), and evaluation—all with **no per-seat pricing** (free tier: 50k units/month). **PromptLayer** is purpose-built for prompt engineering with a visual CMS, A/B testing, scheduled regression tests against golden datasets, and SOC2/HIPAA compliance. **Humanloop** targets enterprise cross-functional teams with the most polished collaboration UI, human-in-the-loop feedback, and statistical A/B testing with confidence intervals.

Common version control patterns include sequential versioning (v1, v2, v3), label-based deployment (promoting labels rather than deploying code), Git integration via webhooks for CI/CD on prompt changes, and prompt-as-code approaches storing templates in YAML/JSON alongside application code. The best practice is to **decouple prompts from application code**, always link prompts to execution traces for observability, and run automated evaluations before promoting to production.

| Tool | Type | Self-host | Free tier | Best for |
|---|---|---|---|---|
| **Langfuse** | Open source + cloud | Yes (MIT core) | 50k units/month | Technical teams wanting control + observability |
| **PromptLayer** | Commercial SaaS | Enterprise only | Yes | Prompt-first teams, compliance-heavy orgs |
| **Humanloop** | Commercial SaaS | Enterprise only | Yes | Cross-functional enterprise teams |

---

# PART 2 — Structured output and response capture techniques

---

## Native model structured output features

### OpenAI: two modes, one clear winner

OpenAI offers two `response_format` options. **JSON mode** (`type: "json_object"`, since November 2023) guarantees valid JSON syntax but enforces no schema—any valid JSON can be returned. **JSON Schema mode** (`type: "json_schema"`, since August 2024) guarantees output conforming to your exact schema with **100% structural compliance** via constrained decoding. OpenAI recommends always using Schema mode when available.

```python
from pydantic import BaseModel

class CalendarEvent(BaseModel):
    name: str
    date: str
    participants: list[str]

completion = client.chat.completions.parse(
    model="gpt-4o-2024-08-06",
    messages=[...],
    response_format=CalendarEvent
)
event = completion.choices[0].message.parsed  # typed object
```

Internally, the JSON Schema is compiled into a grammar/automaton, and at each token generation step, tokens that would violate the grammar are masked to −∞ before sampling. Schemas are cached server-side for **24 hours**; first requests with a new schema may have slightly higher latency. Schema limitations include: root must be an object, all fields must be `required`, `additionalProperties` must be `false`, and some advanced JSON Schema features are unsupported.

Function/tool calling with `strict: true` provides the same guarantee for tool call arguments, available on GPT-4o, o1, o3-mini, and GPT-4.1 series.

### Anthropic: native structured outputs now GA

Anthropic's structured outputs moved from public beta (November 2025) to **GA in early 2026**. Two mechanisms exist. The `output_config.format` parameter with `type: "json_schema"` provides constrained decoding analogous to OpenAI's approach. Tool definitions with `strict: true` guarantee tool call inputs match the schema. Both use server-side schema compilation cached for 24 hours.

```python
response = client.messages.parse(
    model="claude-opus-4-6",
    max_tokens=1024,
    messages=[...],
    output_format=ContactInfo  # Pydantic model
)
contact = response.parsed_output
```

Before native structured outputs, the standard pattern was defining a dummy tool with the desired JSON schema and forcing tool use via `tool_choice`. This still works for backward compatibility. Claude also supports **assistant message prefilling**—starting the response with an opening tag forces the model into the expected format.

### How constrained decoding works mechanically

Constrained decoding masks invalid tokens to −∞ at each generation step, guaranteeing 100% syntactic validity. This can actually **speed up generation** by reducing the sampling space and allowing deterministic tokens to be inserted without model calls. Post-hoc parsing, by contrast, lets the model generate freely and validates afterward—it works with any LLM but provides no structural guarantee, requiring retries on failure.

An important nuance: research from EMNLP 2024 ("Let Me Speak Freely?") and NeurIPS 2024 (Grammar-Aligned Decoding) shows that rigid format constraints can **distort the probability distribution**, degrading reasoning quality on math and multi-hop QA tasks while helping classification tasks. The mitigation is to include a `chain_of_thought` or `reasoning` string field **ordered before** the answer fields in your schema, letting the model reason within the constrained format.

---

## Schema-based extraction libraries

### Instructor: the cross-provider standard

Instructor (v1.14.5, January 2026) wraps LLM client SDKs to add a `response_model` parameter backed by Pydantic. Under the hood, it converts the Pydantic model to JSON Schema and uses the provider's native structured output mechanism. When Pydantic validation fails, Instructor automatically retries, **feeding the validation error back to the model** as conversation context so it can self-correct (powered by Tenacity):

```python
from pydantic import BaseModel, field_validator

class User(BaseModel):
    name: str
    age: int
    
    @field_validator('age')
    def validate_age(cls, v):
        if v < 0: raise ValueError('Age must be positive')
        return v

user = client.create(response_model=User, messages=[...], max_retries=3)
```

Partial streaming returns progressively complete Pydantic objects as tokens arrive. Nested models, discriminated unions, and semantic validators all work. Instructor supports modes including `Mode.TOOLS` (function calling), `Mode.JSON` (JSON mode), `Mode.JSON_SCHEMA` (structured outputs), and `Mode.MD_JSON` (for providers without native JSON support). It is available in Python, TypeScript, Go, Ruby, Elixir, and Rust.

### Outlines: token-level structural guarantees

Outlines' FSM approach (detailed in Part 1) is the most theoretically rigorous extraction method. The `outlines-core` Rust engine precomputes vocabulary indices for each FSM state. When only one valid next token exists, the LLM forward pass is **skipped entirely**, providing a speed advantage. Outlines supports regex, JSON Schema, Literal types, and CFG-based generation. The tradeoff is compilation time for complex schemas and the requirement for logit access (limiting API-only use).

### Guidance: the most expressive option

Guidance's `gen(regex=...)`, `select()`, and `json()` primitives capture structured data into named variables accessible via `lm["variable_name"]`. The `select` primitive is uniquely powerful—it evaluates all options by computing **log-probabilities for each choice**, selecting the highest-probability option. This is more accurate than regex-based constrained decoding for multiple-choice tasks. Guidance achieves the **highest empirical JSON Schema coverage** on JSONSchemaBench (6 of 8 datasets), handling recursive schemas that Outlines' FSM approach cannot represent.

### Kor: a deprecated predecessor

Kor (by Eugene Yurtsev, last release v3.0.0 September 2024, effectively inactive) used prompt engineering with few-shot examples to extract structured data via LangChain chains. It had no constrained decoding, no function calling, no retry logic—just long prompts hoping the LLM would follow the format. Kor is superseded by Instructor, native structured outputs, and LangChain's own improved extraction capabilities. The author now redirects users to LangChain's extraction documentation.

### Schema-based extraction comparison

| Criterion | Native APIs | Instructor | Outlines | Guidance |
|---|---|---|---|---|
| **Guarantee level** | 100% (constrained) | High (retry-based) | 100% (constrained) | 100% (constrained) |
| **Provider support** | Provider-specific | 15+ providers, unified | Any with logit access | Transformers, llama.cpp |
| **Setup complexity** | Low (API params) | Very low (3 lines) | Medium (model loading) | Medium-high |
| **Validation** | Structural only | Structural + semantic | Structural only | Structural only |
| **Retry on failure** | No | Yes (error feedback) | N/A (always valid) | N/A (always valid) |
| **Streaming** | Yes | Yes (partial objects) | Limited | Yes |
| **Best for** | Direct API use | Multi-provider apps | Local models, guarantees | Complex generation programs |

---

## Parsing and capture patterns for when you don't use constrained decoding

### XML tags: Claude's native structured format

Anthropic's documentation states Claude was **"trained specifically to recognize XML tags as a prompt organizing mechanism."** The pattern uses semantic tag names to separate sections:

```
<instructions>Extract customer info from the email below.</instructions>
<email>{content}</email>
Return your answer inside <result> tags as JSON.
```

Parsing with regex is more robust than XML parsers for LLM output (models sometimes produce non-well-formed XML):

```python
match = re.search(r'<result>(.*?)</result>', response, re.DOTALL)
data = json.loads(match.group(1).strip())
```

A powerful technique is **prefilling the assistant response** with the opening tag, forcing Claude to start in the expected format. XML tags remain the best general-purpose pattern for Claude even after native structured outputs launched, particularly for mixed-content outputs combining reasoning with structured data.

### Chain-of-thought separation preserves reasoning quality

The most effective pattern for tasks requiring both reasoning and structured output separates the two concerns. Prompt the model to reason in a `<thinking>` section, then provide its answer in an `<answer>` section. When using constrained decoding, include a `chain_of_thought` string field **ordered before** the answer fields in your schema—JSON is generated left-to-right, so the model completes reasoning before the constraint forces structured output.

Claude's native **extended thinking** feature implements this at the API level, returning internal reasoning in a separate `thinking` block with the final response in `content`.

### Few-shot examples and retry loops

Research consistently shows **2–3 carefully crafted examples** provide the bulk of format compliance improvement, with diminishing returns beyond that. Examples must be structurally consistent—the pattern must be "flawless" across examples, varying only where input content varies. Include the most relevant example last (recency bias). Note that OpenAI models, heavily shaped by RLHF, are less responsive to few-shot nuances than Claude or open-source models; comprehensive system-prompt instructions may be more cost-effective for OpenAI.

Retry loops (attempt → parse → on failure → feed error back → retry) are Instructor's core mechanism. A DIY version appends the failed output and validation error to the conversation, asking the model to fix specific errors. Each retry resends the entire prompt, so costs multiply—retries are cost-effective when failure rates are below ~10% and the schema is relatively simple, but constrained decoding is strictly superior when available.

---

## When to use which approach: an opinionated decision framework

The hierarchy of reliability is clear: **constrained decoding (100%)** > tool/function calling (~97%) > Instructor with retries (~95–99%) > prompting with few-shot (~90–95%) > prompting alone (~80–90%). But reliability is only one dimension.

**For production APIs** using OpenAI or Anthropic, use native structured outputs as the default. Include a reasoning field before answer fields to preserve quality. Fall back to Instructor with `max_retries=2` for edge cases.

**For research prototypes**, XML tag patterns with regex extraction iterate fastest. Add 2–3 few-shot examples for format compliance. No schema compilation, works across any model.

**For agent pipelines**, use native structured outputs for each step's schema and tool calling for action steps. Validate with Pydantic models at each pipeline boundary.

**For self-hosted models**, constrained decoding via SGLang/XGrammar (integrated into vLLM) provides the highest throughput at the lowest per-token cost—and can actually be **faster than unconstrained generation** because deterministic tokens are skipped.

**For small models under 10B parameters**, constrained decoding is not optional—it's mandatory. Prompting alone produces **15–40%+ format error rates** on complex schemas. Even Llama 3.2 3B "performs poorly for all but the simplest schema" without constrained decoding.

**For cross-provider compatibility**, Instructor is the clear winner with its unified API across 15+ providers, built-in validation, and automatic retries.

---

## Conclusion: the landscape is converging

Three trends define the 2026 structured LLM output landscape. First, **constrained decoding has gone mainstream**—all three major API providers now offer it natively, making the era of regex-parsing LLM outputs obsolete for production systems. Second, **the template language choice matters less than the composition strategy**: Jinja2 handles 90% of Python prompt templating needs, but Priompt's priority-based approach solves the context window management problem that no text templating language can. Third, **DSPy's compile-don't-write philosophy** is gaining traction as teams realize that optimized prompts consistently outperform hand-crafted ones on measurable metrics.

For a student building AI agents and pipelines, the practical stack in 2026 is: **Jinja2** for prompt templates, **Instructor** for structured extraction across providers, **native structured outputs** for production reliability, and **DSPy** when you have training data and need to optimize. Keep XML tags in your toolkit for Claude—they remain the most versatile parsing pattern. And watch SGLang if you're heading toward self-hosted deployment: its performance advantages and ecosystem momentum make it the default serving engine for serious workloads.