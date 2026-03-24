# The complete guide to chaining LLM calls

**The single most important architectural decision in any LLM application is how you chain calls together.** Every pattern — from a two-step sequential pipeline to a multi-agent debate — trades off latency, cost, reliability, and adaptability differently. This guide maps the full landscape of chaining patterns, compares seven major frameworks, analyzes when to use what, and provides working Python code for each approach. The core insight from both Anthropic and OpenAI's 2024–2025 guidance: start with the simplest pattern that works, and add complexity only when it demonstrably improves outcomes.

---

## Part I: The eight architectural patterns

Every LLM chaining architecture is a composition of eight fundamental patterns. They form a complexity spectrum — each pattern adds capability at the cost of predictability.

### Sequential chains are where most applications should start

The simplest pattern feeds the output of one LLM call into the prompt of the next. Step 1 generates an outline, step 2 expands it, step 3 polishes the result. The key mechanism is **variable substitution**: capture the output, optionally parse it (JSON, XML, regex), and inject it into the next prompt via template placeholders.

Sequential chains work because each step gets the LLM's full attention on a narrow task. A single prompt asking "research this topic, outline it, write it, and edit it" will drop instructions. Four focused calls won't. Anthropic's documentation emphasizes inserting **programmatic gates** between steps — validation checks that verify format, length, or required fields before proceeding. This catches errors early rather than letting them cascade.

The limitation is rigidity. The number of steps and their order are fixed at design time. If a task sometimes needs two steps and sometimes five, a sequential chain either wastes calls or lacks capability. Latency scales linearly with step count, and each API round-trip adds **200–800ms** depending on the provider.

### Branching routes inputs to specialized handlers

Routing classifies an input and directs it to one of several specialized downstream paths. A customer service system might route general questions to a lightweight model, refund requests to a chain with database access, and technical issues to an agent with documentation retrieval.

The classifier can be an LLM call (semantic routing), a traditional ML model, or even simple keyword matching. The key architectural benefit is **separation of concerns**: optimizing the refund-handling prompt doesn't risk degrading general Q&A performance. Model routing is a powerful cost optimization — sending **80% of easy queries to GPT-4o-mini** and only complex ones to a full-sized model can cut costs by 60%+ with minimal quality loss.

The main failure mode is misrouting. A misclassified input hits the wrong branch and produces confidently wrong output. Robust routing systems include a fallback "uncertain" path and log classification confidence for monitoring.

### Map-reduce parallelizes independent subtasks

When work decomposes into independent units — summarizing 20 document chunks, evaluating an essay on 5 criteria, extracting entities from 50 records — map-reduce fans out to parallel LLM calls and combines results in a reduction step. This directly mirrors the classical MapReduce paradigm.

The map phase processes chunks concurrently with identical prompts. The reduce phase synthesizes intermediate outputs into a unified result. For documents exceeding context limits, **recursive reduction** applies: summarize groups of summaries until everything fits in one call. Typical chunk sizes of **1,500–3,000 tokens with 10–20% overlap** balance coherence against parallelism.

The advantage is dramatic latency reduction — total time equals the single slowest call, not their sum. The limitation is **loss of cross-chunk context**. Each chunk is processed in isolation, so themes spanning multiple chunks may be missed or duplicated. When cross-document coherence matters more than speed, iterative refinement (process chunk 1, then refine with chunk 2) preserves continuity at the cost of sequential execution.

### DAG orchestration models complex workflows as graphs

When a workflow has both parallel and sequential segments, conditional branches, and merge points, modeling it as a directed acyclic graph makes the structure explicit. Nodes represent processing steps (LLM calls, tool invocations, transformations), and edges represent data dependencies. The execution engine runs nodes whose dependencies are satisfied, automatically parallelizing independent branches.

LCEL (LangChain Expression Language) and Haystack pipelines both implement DAG-based execution. The benefit is **visual clarity** and compile-time validation — you can inspect the workflow topology, verify type compatibility between connected nodes, and serialize the pipeline for version control.

The critical limitation is no cycles. DAGs cannot represent "try again if the output is wrong" — that requires a back-edge, which violates acyclicity. This is precisely why LangGraph exists: it extends DAG orchestration with cycle support for agent loops.

### Iterative refinement loops until quality converges

The generate-evaluate-refine cycle is one of the most practically useful patterns. An LLM drafts output, a second call (or the same model with a different prompt) critiques it against specific criteria, and a third call revises based on the critique. This repeats until the evaluation passes or a maximum iteration limit is reached.

Anthropic calls this the **"evaluator-optimizer" workflow** and notes that "the review step consistently identifies issues like missing definitions, incomplete data, and gaps." In practice, **2–3 iterations** capture most of the improvement; returns diminish rapidly after that. Using separate system prompts (or even separate models) for generation and critique reduces self-reinforcement bias.

The key risk is **Degeneration-of-Thought** — when the same model critiques itself, it can reinforce errors rather than fix them. Grounded reflection, where the critic cites specific evidence or references external data, significantly mitigates this. Always set a `max_iterations` ceiling and detect no-change conditions to prevent infinite loops.

### Agent loops let the LLM decide what to do next

The defining shift from chains to agents: **the LLM chooses which actions to take and in what order**, rather than following a predetermined sequence. The ReAct (Reason + Act) pattern implements a think → act → observe loop. The LLM articulates its reasoning, selects a tool to invoke, receives the result, and decides whether to continue or deliver a final answer.

OpenAI's guidance: "This concept of a while loop is central to the functioning of an agent." The agent's action space is a set of tools with schemas (function name, description, parameter types). Modern implementations use native function calling — the LLM outputs structured tool invocations that the runtime executes and feeds back as observations.

Agents are powerful for open-ended tasks where the number of steps isn't predictable. A research query might need one search or five. But this flexibility comes with **non-deterministic execution, unpredictable cost, and risk of infinite loops**. Context windows fill with trajectory history, and poorly described tools lead to hallucinated tool calls. Always cap iterations and implement cost budgets.

### Multi-agent systems coordinate specialized LLMs

When a task genuinely requires different expertise, tools, or model configurations, multiple agents can outperform a single agent. Four coordination patterns dominate:

- **Hierarchical (manager/worker)**: A central agent orchestrates specialists via tool calls. OpenAI's Agents SDK implements this as "agents as tools." Clear coordination, but the manager is a bottleneck.
- **Peer-to-peer (handoffs)**: Agents transfer control to each other without a central coordinator. Natural for sequential specialist workflows (sales agent → billing agent → support agent).
- **Debate/adversarial**: Agents independently propose solutions, then critique each other over rounds. Research shows **+7 to +15 percentage-point improvements** on reasoning benchmarks, but gains plateau beyond 3–4 rounds and 4–5 agents.
- **Ensemble**: Multiple agents process the same input; results aggregated by voting or merging. Robust but expensive (N× single-agent cost).

The critical caveat: a 2025 study across 180 experiments found that **independent multi-agent systems without shared context sometimes performed worse** than single agents (−4.6%), because coordination overhead exceeds collaboration benefits. Start single-agent. Add agents only when you can measure the improvement.

### Memory architectures bridge the stateless gap

LLMs are stateless — memory must be explicitly managed. Five memory types serve different needs:

**Conversation buffer** stores the full message history. Simple and lossless, but linearly fills the context window. **Summary memory** periodically compresses history via an LLM call, reducing token usage by **over 90%** while maintaining competitive accuracy. **Vector store memory** (the RAG pattern) embeds experiences into a database and retrieves semantically relevant memories, enabling effectively unlimited recall. **Episodic memory** stores discrete past interactions with temporal metadata, answering "what happened when?" rather than "what do I know?" — critical for agents that learn from experience. **Procedural memory** encodes system instructions and behavioral patterns in fixed prompts.

The design principle: **memory complexity should scale with model capability**. Smaller models benefit most from RAG retrieval. Advanced instruction-tuned models benefit from richer episodic and semantic memory structures.

---

## Part II: Framework deep dives

### LangChain and LangGraph occupy different niches in the same ecosystem

**LangChain** provides the foundation: model abstractions, prompt templates, output parsers, tool connectors, and LCEL for composing DAG-style chains. The pipe operator (`|`) creates `RunnableSequence` objects:

```python
chain = ChatPromptTemplate.from_template("Explain {topic}") | ChatOpenAI() | StrOutputParser()
result = chain.invoke({"topic": "embeddings"})
```

Every component implements the **Runnable protocol** (`invoke`, `ainvoke`, `stream`, `batch`), making them composable. `RunnableParallel` runs sub-chains concurrently via dict syntax. `RunnableBranch` handles conditional routing. This is clean for linear and branching pipelines, but LCEL **cannot express cycles** — no loops, no retry logic, no agent iterations.

**LangGraph** solves this with `StateGraph`, a graph that supports cycles via conditional back-edges. The state is a `TypedDict` (or Pydantic model) that flows through nodes and accumulates updates. Reducer annotations (like `add_messages`) control how updates merge. Conditional edges inspect the state and route to different nodes, including previously visited ones — enabling ReAct loops, self-correction, and multi-agent coordination.

As of 2025, the recommended split is: **LangChain for simple pipelines and component integration, LangGraph for anything requiring state, loops, or multi-agent coordination.** Many production teams use both — LangChain components inside LangGraph nodes.

### DSPy treats prompts as parameters to optimize, not strings to handcraft

DSPy represents a fundamentally different philosophy: **"programming, not prompting, language models."** Instead of writing prompt strings, you declare typed signatures (`question -> answer`), wrap them in modules (`dspy.ChainOfThought`), and let optimizers automatically find effective prompts and few-shot examples.

The framework has three core abstractions. **Signatures** define input/output contracts with semantic field names. **Modules** implement prompting strategies — `Predict` for direct prompting, `ChainOfThought` for step-by-step reasoning, `ReAct` for tool-using agents. **Optimizers** (formerly Teleprompters) improve programs given training examples and a metric. `BootstrapFewShot` generates demonstrations from successful traces. `MIPROv2` jointly optimizes instructions and few-shot examples via Bayesian optimization.

Chaining happens via Python class composition in a `forward()` method — no special syntax. A RAG module simply calls `self.generate_query()`, then `self.retrieve()`, then `self.generate_answer()` in plain Python. The optimizer traces through all sub-modules holistically.

**Dropbox reported that DSPy reduced their relevance judge error by 45%** and cut adaptation time from 1–2 weeks to 1–2 days. Compilation costs are modest: **~$2–50 and 10–30 minutes**. The tradeoff is a steeper learning curve and the requirement for labeled evaluation data — at least 10–20 examples for `BootstrapFewShot`, 200+ for `MIPROv2`.

### CrewAI models teams of role-playing agents

CrewAI's metaphor is a human team. **Agents** have a `role`, `goal`, and `backstory` (all natural language). **Tasks** are assignments with descriptions, expected outputs, and agent assignments. **Crews** orchestrate agents and tasks with a `process` type — `sequential` (tasks execute in order) or `hierarchical` (a manager agent delegates dynamically).

Tasks chain via the `context` parameter — a task can reference other tasks whose outputs it needs. This is more explicit than conversation-based chaining (AutoGen) and more flexible than strict sequential ordering. CrewAI also supports **task guardrails** (validation functions between tasks), a **planning agent** (creates step-by-step plans before execution), and **Flows** (event-driven workflows for production use).

CrewAI is now independent of LangChain (it was originally built on top of it). Its strength is intuitive multi-agent collaboration with minimal code. Its weakness is that the role-playing abstraction adds overhead for tasks that don't naturally map to team structures.

### AutoGen pioneered conversation as orchestration, then fractured

Microsoft's AutoGen introduced a powerful idea: **multi-agent conversation IS the orchestration mechanism.** Agents send messages to each other, and the conversation history serves as shared state. `AssistantAgent` (LLM-powered) and `UserProxyAgent` (can execute code, provide human input) converse in turns. `GroupChat` extends this to N agents with managed speaker selection.

In late 2024, the framework split. The original creators forked it as **AG2** (community-governed, maintaining the 0.2 API). Microsoft rebuilt it as **AutoGen 0.4** with an async, event-driven, actor-model architecture. Then in October 2025, Microsoft merged AutoGen 0.4 and Semantic Kernel into the **Microsoft Agent Framework**, putting both predecessors into maintenance mode.

For new projects, the choice is: AG2 if you want the familiar conversational API and open governance, or the Microsoft Agent Framework if you're in the Azure ecosystem. The conversational paradigm remains AutoGen's unique contribution — it's the most natural model when agents genuinely need to discuss and negotiate.

### LlamaIndex Workflows use events instead of explicit graphs

LlamaIndex Workflows (v1.0, June 2025) take an event-driven approach. **Steps** are async methods decorated with `@step` that accept typed **Events** and emit new ones. The framework infers the workflow graph from type annotations — no explicit `add_edge()` calls. A step accepting `JokeEvent` automatically connects to any step that emits `JokeEvent`.

This is more Pythonic than graph-based frameworks. Branching happens by emitting different event types. Loops work naturally — a step can emit an event type that triggers an earlier step. Fan-out/fan-in uses `ctx.collect()` to gather multiple events before proceeding. The `Context` object provides shared typed state across steps.

LlamaIndex Workflows are now a **standalone package** (`llama-index-workflows`) usable independently of the LlamaIndex data framework. Their strength is async-native, type-safe orchestration with low boilerplate. Their weakness is a smaller ecosystem and less community adoption than LangChain/LangGraph.

### Haystack prioritizes production-grade typed pipelines

Haystack 2.x (by deepset) builds pipelines from **Components** with explicitly typed input/output sockets. The `@component` decorator and `@component.output_types()` annotation enable **compile-time type validation** — connecting incompatible types raises errors before runtime.

Unlike LangChain, Haystack validates the entire pipeline graph at construction time. Pipelines support cycles natively (with `max_runs_per_component` safety limits), parallel branches via `AsyncPipeline`, and hierarchical composition via **SuperComponents** (a pipeline wrapped as a single reusable component). Pipelines serialize to YAML for version control.

Benchmark data (AIMultiple, 2025) shows Haystack has **~5.9ms framework overhead** versus LangChain's ~10ms and LangGraph's ~14ms, with **~1,570 tokens per query** versus LangChain's ~2,400. Haystack's strength is production-grade rigor for RAG and document processing pipelines. Its weakness is a smaller general-purpose ecosystem and less agentic tooling.

### Other frameworks worth knowing

**Semantic Kernel** (Microsoft) uses a plugin/function architecture where the LLM discovers and invokes registered functions via native function calling. As of October 2025, it's merged into the Microsoft Agent Framework and is in maintenance mode — don't start new projects on it.

**Agno** (formerly Phidata) optimizes for simplicity: a production-ready agent in 10–20 lines of code. Agents compose into Teams with coordinator, route, or collaborate modes. Extremely lightweight, but less suited for complex DAG-style workflows.

**PydanticAI** (by the Pydantic team) brings type-safe agent development with the "FastAPI feeling." Agents are generic typed containers (`Agent[DepsType, OutputType]`) with dependency injection, structured validation, and graph support for complex workflows. Rapidly growing as the type-safety-focused alternative.

**Instructor** (3M+ monthly PyPI downloads) isn't an orchestration framework — it's an extraction layer that patches LLM clients to return validated Pydantic objects. It's often the glue between chain steps, ensuring each call produces structured output that the next step can parse reliably.

---

## Part III: When to use what

### Deterministic pipelines cover 80% of production use cases

The most counterintuitive finding from production experience: **splitting tasks into smaller, simpler LLM calls reliably improved latency, cost, AND reliability** versus monolithic agents (HockeyStack, 2025, 1+ year production data). Atomic tasks use cheaper models, fail independently, and are easier to debug. Agentic loops should be reserved for genuinely open-ended problems where the steps can't be predetermined.

Deterministic pipeline failure modes are predictable — a step produces malformed output, a gate check fails. Agent failure modes are chaotic — infinite loops, hallucinated tool names, context overflow, contradictory reasoning. An arxiv study across 180 experiments found agents have a **coefficient of variation of 0.32** versus 0.12 for deterministic tasks.

Anthropic's explicit recommendation: "For many applications, optimizing single LLM calls with retrieval and in-context examples is usually enough."

### The cost/latency equation favors fewer, smarter calls

Each LLM call adds 200–800ms latency and costs tokens. Caching strategies dramatically change the economics:

**Prompt prefix caching** (native in OpenAI and Anthropic) cuts costs up to 50% for repeated system prompts. **Plan caching** — storing successful tool-call sequences and replaying them for similar inputs — reduces costs by **50.3%** and latency by **27.3%** while maintaining 96.6% accuracy. **Model tiering** routes simple subtasks to GPT-4o-mini ($0.15/1M input tokens) and reserves GPT-4o ($2.50/1M) for final synthesis.

Framework overhead is negligible: all major frameworks add **3–14ms** of processing time, dwarfed by API latency. The real cost difference comes from how many calls and tokens each framework's abstractions generate — LangChain averaged **~2,400 tokens** per query in benchmarks versus Haystack's ~1,570 for the same task.

### DSPy optimization versus manual prompting is not an either/or choice

Manual prompt engineering is faster for initial prototyping and simple tasks near ceiling performance. DSPy optimization wins when you have measurable metrics, sufficient training data, and need systematic improvement. The practical workflow: **manual first to validate feasibility, then DSPy to optimize** once you have evaluation data.

DSPy requires a minimum investment: 10–20 labeled examples for `BootstrapFewShot`, 50+ for `BootstrapFewShotWithRandomSearch`, 200+ for `MIPROv2`. Without good metrics and data, optimizers can actually degrade performance. With them, gains are significant — Dropbox's 45% error reduction is representative of well-configured deployments.

### Choosing a framework versus rolling your own

Use a framework when you need complex workflows (3+ chained operations, routing, state management), team standardization, or built-in observability. Use raw API calls when you need maximum performance control, have simple use cases, or want minimal dependencies.

The practical decision matrix:

- **Raw OpenAI/Anthropic SDK**: Best for simple chains, maximum control, minimal overhead. Add Instructor for structured outputs.
- **LangChain + LangGraph**: Best for rapid prototyping and complex agent workflows. Largest ecosystem, most examples, most integrations. Higher abstraction overhead.
- **DSPy**: Best when you can define metrics and have training data. Unique value: automatic prompt optimization and model portability.
- **Haystack**: Best for production RAG pipelines requiring type safety, serialization, and validation. Lower overhead than LangChain.
- **CrewAI**: Best for multi-agent collaboration when tasks naturally map to team roles. Intuitive but less flexible for non-team patterns.
- **LlamaIndex Workflows**: Best for async, event-driven pipelines with type-safe orchestration. Good standalone option.
- **PydanticAI**: Best for type-safe agent development with structured outputs. Growing fast, built by the Pydantic team.

---

## Part IV: Working code for every major pattern

### A sequential chain with raw API calls

No framework needed — just Python variables and f-strings passing output between calls:

```python
"""
Sequential chain: Generate outline → Expand each section → Combine
pip install openai
"""
from openai import OpenAI

client = OpenAI()  # Reads OPENAI_API_KEY from env

def call_llm(system: str, user: str, model: str = "gpt-4o") -> str:
    response = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
    )
    return response.choices[0].message.content

# Step 1: Generate outline
topic = "Introduction to Vector Databases"
outline = call_llm(
    system="You are a technical writer. Output a numbered outline with 3-4 sections.",
    user=f"Create an outline for a blog post about: {topic}",
)

# Step 2: Expand each section (output of step 1 → input of step 2)
sections = [line.strip() for line in outline.split("\n")
            if line.strip() and line.strip()[0].isdigit()]
expanded = []
for section in sections:
    content = call_llm(
        system="You are a technical writer. Write 2-3 detailed paragraphs.",
        user=f"Blog topic: {topic}\nFull outline:\n{outline}\n\nExpand this section:\n{section}",
    )
    expanded.append(f"## {section}\n{content}")

# Step 3: Combine and polish (output of step 2 → input of step 3)
final = call_llm(
    system="You are an editor. Polish into a cohesive blog post with intro and conclusion.",
    user=f"Topic: {topic}\n\nSections:\n" + "\n\n".join(expanded),
)
print(final)
```

Each `call_llm()` output is a plain string injected into the next call's prompt. No state management, no abstractions — just sequential function calls. This pattern handles 80% of real-world chaining needs.

### An LCEL chain with tool binding in LangChain

The pipe operator composes Runnables into a sequence. `bind_tools()` attaches Pydantic-defined tool schemas to the model:

```python
"""
LangChain LCEL chain with tool binding
pip install langchain-core langchain-openai
"""
from pydantic import BaseModel, Field
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import RunnableParallel
from langchain_openai import ChatOpenAI

# Define tools as Pydantic models
class GetWeather(BaseModel):
    """Get the current weather in a given location."""
    location: str = Field(description="City and state, e.g. 'San Francisco, CA'")

class SearchWeb(BaseModel):
    """Search the web for current information."""
    query: str = Field(description="The search query")

# Bind tools to the model
llm = ChatOpenAI(model="gpt-4o", temperature=0)
llm_with_tools = llm.bind_tools([GetWeather, SearchWeb])

# LCEL chain: prompt | model_with_tools
prompt = ChatPromptTemplate.from_messages([
    ("system", "You are a helpful assistant. Use tools when needed."),
    ("human", "{question}"),
])
chain = prompt | llm_with_tools
result = chain.invoke({"question": "What's the weather in San Francisco?"})
print("Tool calls:", result.tool_calls)
# [{'name': 'GetWeather', 'args': {'location': 'San Francisco, CA'}, 'id': '...'}]

# Parallel sub-chains with RunnableParallel
analysis = RunnableParallel(
    summary=ChatPromptTemplate.from_template("Summarize: {text}") | llm | StrOutputParser(),
    sentiment=ChatPromptTemplate.from_template("Sentiment of: {text}") | llm | StrOutputParser(),
)
result = analysis.invoke({"text": "The product launch exceeded all expectations!"})
print(result)  # {"summary": "...", "sentiment": "..."}
```

The `|` operator creates a `RunnableSequence`. Every component — prompts, models, parsers — implements the same Runnable protocol with `invoke`, `stream`, `batch`, and async variants. `RunnableParallel` runs sub-chains concurrently and returns a dict of results.

### A LangGraph stateful graph with conditional edges

LangGraph adds cycles, shared state, and conditional routing to LangChain's DAG model:

```python
"""
LangGraph research agent with conditional routing
pip install langgraph langchain-openai
"""
from typing import TypedDict, Literal
from langgraph.graph import StateGraph, START, END
from langchain_openai import ChatOpenAI

llm = ChatOpenAI(model="gpt-4o", temperature=0)

# Shared state schema — flows through every node
class ResearchState(TypedDict):
    question: str
    search_results: str
    answer: str
    needs_search: bool
    iterations: int

# Node: decide whether to search or answer directly
def decide(state: ResearchState) -> dict:
    response = llm.invoke(
        f"Can you answer this from general knowledge alone? "
        f"Question: {state['question']}\nReply ONLY 'yes' or 'no'."
    )
    needs_search = "no" in response.content.lower()
    return {"needs_search": needs_search, "iterations": state.get("iterations", 0) + 1}

# Node: perform search (simulated here)
def search(state: ResearchState) -> dict:
    results = f"[Results for '{state['question']}']: Relevant factual information..."
    return {"search_results": results}

# Node: generate final answer
def respond(state: ResearchState) -> dict:
    context = state.get("search_results", "No search performed.")
    response = llm.invoke(
        f"Question: {state['question']}\nContext: {context}\nProvide a concise answer."
    )
    return {"answer": response.content}

# Conditional routing function
def route_after_decide(state: ResearchState) -> Literal["search", "respond"]:
    if state["needs_search"] and state["iterations"] < 3:
        return "search"
    return "respond"

# Build and compile the graph
workflow = StateGraph(ResearchState)
workflow.add_node("decide", decide)
workflow.add_node("search", search)
workflow.add_node("respond", respond)

workflow.add_edge(START, "decide")
workflow.add_conditional_edges("decide", route_after_decide,
                                {"search": "search", "respond": "respond"})
workflow.add_edge("search", "respond")
workflow.add_edge("respond", END)

app = workflow.compile()
result = app.invoke({
    "question": "What are the leading vector databases in 2025?",
    "search_results": "", "answer": "", "needs_search": False, "iterations": 0,
})
print(result["answer"])
```

The `StateGraph` takes a `TypedDict` schema. Each node function receives the full state and returns a partial update dict. `add_conditional_edges` takes a routing function that inspects the state and returns the name of the next node. The graph must be `.compile()`'d before invocation. Cycles are expressed naturally — a node can route back to a previous node via conditional edges, enabling retry and refinement loops.

### A DSPy module with ChainOfThought and optimization

DSPy separates the "what" (signatures) from the "how" (optimized prompts):

```python
"""
DSPy: Signatures → ChainOfThought → Module composition → Optimization
pip install dspy
"""
import dspy

# Configure the language model
lm = dspy.LM("openai/gpt-4o-mini", temperature=0.7)
dspy.configure(lm=lm)

# Signatures define typed I/O contracts (not prompt strings)
class GenerateQuery(dspy.Signature):
    """Generate a focused search query from a question."""
    question = dspy.InputField(desc="The user's question")
    search_query = dspy.OutputField(desc="A search query to find relevant info")

class AnswerWithContext(dspy.Signature):
    """Answer a question using provided context. Be concise and factual."""
    context = dspy.InputField(desc="Retrieved passages")
    question = dspy.InputField(desc="The question to answer")
    answer = dspy.OutputField(desc="A short factual answer")

# Custom module chains sub-modules in forward()
class RAG(dspy.Module):
    def __init__(self, num_passages=3):
        super().__init__()
        self.gen_query = dspy.ChainOfThought(GenerateQuery)   # Adds reasoning
        self.retrieve = dspy.Retrieve(k=num_passages)
        self.answer = dspy.ChainOfThought(AnswerWithContext)

    def forward(self, question):
        query = self.gen_query(question=question).search_query
        passages = self.retrieve(query).passages
        return self.answer(context=passages, question=question)

# Use the uncompiled module
rag = RAG()
result = rag(question="What language did the author learn in college?")
print(f"Answer: {result.answer}")

# Optimize with BootstrapFewShot (needs labeled examples + metric)
from dspy.teleprompt import BootstrapFewShot

trainset = [
    dspy.Example(question="What did the author do before college?",
                 answer="Writing and programming").with_inputs("question"),
    dspy.Example(question="What language did the author learn?",
                 answer="Lisp").with_inputs("question"),
]

def metric(example, pred, trace=None):
    return pred.answer.lower().strip() in example.answer.lower()

optimizer = BootstrapFewShot(metric=metric, max_bootstrapped_demos=4)
compiled_rag = optimizer.compile(RAG(), trainset=trainset)

# The compiled module uses optimized prompts with few-shot demonstrations
result = compiled_rag(question="What kind of writing did the author do?")
print(f"Optimized answer: {result.answer}")
```

`ChainOfThought` extends `Predict` by injecting a `reasoning` field before the output, causing the LLM to think step-by-step. The optimizer runs the program on training examples, keeps successful traces as demonstrations, and embeds them in future prompts. No prompt strings are handwritten — DSPy generates them.

### A CrewAI multi-agent crew

CrewAI's role-based metaphor makes multi-agent coordination intuitive:

```python
"""
CrewAI: Researcher → Writer → Editor pipeline
pip install crewai
"""
from crewai import Agent, Task, Crew, Process

researcher = Agent(
    role="Senior Research Analyst",
    goal="Find comprehensive, accurate information about the given topic",
    backstory="Experienced analyst who verifies everything thoroughly.",
    verbose=True,
    allow_delegation=False,
)
writer = Agent(
    role="Technical Content Writer",
    goal="Create engaging blog posts from research findings",
    backstory="Skilled writer who transforms complex research into clear content.",
    verbose=True,
    allow_delegation=False,
)
editor = Agent(
    role="Senior Editor",
    goal="Polish content for clarity, grammar, and SEO",
    backstory="Meticulous editor with years in technical publishing.",
    verbose=True,
    allow_delegation=False,
)

research_task = Task(
    description="Research '{topic}' thoroughly. Provide structured summary with key findings.",
    expected_output="Detailed research brief with data points.",
    agent=researcher,
)
writing_task = Task(
    description="Write a comprehensive 800-word blog post about '{topic}'.",
    expected_output="Well-structured blog post in Markdown.",
    agent=writer,
    context=[research_task],  # Output of research feeds into writing
)
editing_task = Task(
    description="Review and polish the blog post. Fix grammar, improve clarity.",
    expected_output="Publication-ready blog post.",
    agent=editor,
    context=[writing_task],
)

crew = Crew(
    agents=[researcher, writer, editor],
    tasks=[research_task, writing_task, editing_task],
    process=Process.sequential,  # Or Process.hierarchical for manager delegation
    verbose=True,
)
result = crew.kickoff(inputs={"topic": "Vector Databases in 2025"})
print(result.raw)
```

Agents are defined with natural-language `role`, `goal`, and `backstory`. Tasks chain through the `context` parameter — each task can reference other tasks whose outputs it needs as input. `Process.sequential` runs tasks in order; `Process.hierarchical` adds a manager agent that delegates dynamically.

### A ReAct agent loop from scratch

The think-act-observe cycle implemented with raw OpenAI function calling — no framework required:

```python
"""
ReAct agent from scratch: Think → Act → Observe loop
pip install openai
"""
import json
from openai import OpenAI

client = OpenAI()

# Define tools: implementations and schemas
def search(query: str) -> str:
    """Simulated search — replace with real API."""
    data = {
        "capital of france": "Paris is the capital of France.",
        "population of paris": "Paris has ~2.1 million (city), ~12 million (metro).",
        "eiffel tower height": "The Eiffel Tower is 330 meters tall.",
    }
    return data.get(query.lower(), f"No results for: '{query}'")

def calculator(expression: str) -> str:
    allowed = set("0123456789+-*/.() ")
    if all(c in allowed for c in expression):
        return str(eval(expression))
    return "Error: only numeric expressions allowed"

TOOLS = {"search": search, "calculator": calculator}
TOOL_SCHEMAS = [
    {"type": "function", "function": {
        "name": "search",
        "description": "Search for factual information",
        "parameters": {"type": "object", "properties": {
            "query": {"type": "string", "description": "The search query"}
        }, "required": ["query"]}}},
    {"type": "function", "function": {
        "name": "calculator",
        "description": "Evaluate a math expression",
        "parameters": {"type": "object", "properties": {
            "expression": {"type": "string", "description": "e.g. '330 * 3.281'"}
        }, "required": ["expression"]}}},
]

SYSTEM = """You are a ReAct agent. For each step:
1. THINK about what information you need
2. ACT by calling a tool if needed
3. OBSERVE the result and decide your next step
When you have enough information, respond directly without calling tools."""

def react_agent(question: str, max_iterations: int = 6) -> str:
    messages = [
        {"role": "system", "content": SYSTEM},
        {"role": "user", "content": question},
    ]

    for i in range(max_iterations):
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=messages,
            tools=TOOL_SCHEMAS,
            tool_choice="auto",
        )
        msg = response.choices[0].message

        # No tool calls = final answer
        if not msg.tool_calls:
            print(f"\n✅ Final answer (step {i+1}): {msg.content}")
            return msg.content

        # Execute each tool call and feed results back
        messages.append(msg)
        for tc in msg.tool_calls:
            fn_name = tc.function.name
            args = json.loads(tc.function.arguments)
            print(f"🔧 Step {i+1}: {fn_name}({args})")

            result = TOOLS[fn_name](**args) if fn_name in TOOLS else f"Unknown tool"
            print(f"   → {result}")

            messages.append({"role": "tool", "tool_call_id": tc.id, "content": result})

    return "Max iterations reached without final answer."

# Run it
react_agent("How tall is the Eiffel Tower in feet? Calculate the conversion.")
```

The loop continues until the model responds without `tool_calls` (indicating it has enough information to answer) or hits `max_iterations`. Each tool result is appended as a `role: "tool"` message with a matching `tool_call_id`. The full trajectory — all reasoning, tool calls, and observations — stays in the message history, giving the model context for its next decision.

---

## Conclusion: pick the minimum viable complexity

The landscape of LLM chaining patterns is converging on a clear hierarchy. **Sequential chains handle 80% of production needs** and should always be the starting point. Add routing when input types vary. Add parallelism when subtasks are independent. Reserve agent loops for genuinely open-ended problems, and multi-agent systems for tasks requiring distinct expertise that measurably outperforms a single agent.

The framework choice matters less than the pattern choice. Framework overhead (3–14ms) is negligible compared to API latency (200–800ms per call). What matters is whether the framework's abstractions match your workflow's structure: LangGraph for stateful cyclic graphs, DSPy for optimizable pipelines, Haystack for typed production RAG, CrewAI for natural multi-agent collaboration.

The most underappreciated insight: **DSPy's automatic optimization and plan caching** represent the frontier of practical cost reduction. Manual prompt engineering hits a ceiling; systematic optimization with metrics and training data consistently outperforms it. But you need evaluation infrastructure first — metrics, labeled data, and the discipline to measure before you optimize. Build the simple version, measure it, then decide what to optimize and how.
