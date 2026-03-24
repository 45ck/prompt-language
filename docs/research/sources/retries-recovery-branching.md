# Retries, recovery, and branching across production AI agent frameworks

**LangGraph, CrewAI, AutoGen, Temporal, and Prefect each take fundamentally different architectural approaches to the three pillars of production reliability — retries, error recovery, and conditional branching — and these differences have profound implications for which framework suits which deployment scenario.** The agent-native frameworks (LangGraph, CrewAI, AutoGen) treat reliability as an opt-in concern layered atop graph or conversation abstractions, while workflow orchestrators (Temporal, Prefect) make durability the foundational primitive. This report provides a technically detailed comparison of how each framework implements these mechanisms, complete with code examples and production patterns, suitable for advanced coursework in AI systems engineering.

---

## How each framework models retries

Retry behavior varies dramatically across frameworks — from LangGraph's declarative per-node policies to Temporal's automatic activity-level retries with unlimited default attempts. Understanding the retry surface area (what triggers retries, at what granularity, and with what backoff) is essential for production agent deployments.

### LangGraph: declarative per-node RetryPolicy

LangGraph provides a first-class `RetryPolicy` NamedTuple attached per-node via the `add_node()` API. This is the most granular retry mechanism among agent-native frameworks:

```python
from langgraph.graph import StateGraph, START, END
from langgraph.types import RetryPolicy

builder = StateGraph(State)
builder.add_node(
    "call_model",
    call_model_fn,
    retry_policy=RetryPolicy(
        max_attempts=5,
        initial_interval=0.5,    # seconds
        backoff_factor=2.0,      # exponential
        max_interval=128.0,      # cap
        jitter=True,             # prevent thundering herd
    )
)
```

The default `retry_on` predicate retries on **all exceptions except** common programming errors (`ValueError`, `TypeError`, `ArithmeticError`, `ImportError`, `LookupError`, `NameError`, `SyntaxError`, `RuntimeError`). For HTTP libraries, it specifically retries only on **5xx status codes**, not 4xx. Custom filtering supports exception types, tuples, or callable predicates. Different nodes can carry different policies, and a graph-level default policy can be set on the compiled `Pregel` object. LangGraph also injects a `Runtime` object exposing `execution_info.node_attempt`, enabling a powerful **fallback-on-retry** pattern where later attempts can switch to a different model or API endpoint:

```python
from langgraph.runtime import Runtime

def my_node(state: State, runtime: Runtime):
    if runtime.execution_info.node_attempt > 1:
        return {"result": call_fallback_model()}
    return {"result": call_primary_model()}
```

Separately, LangChain Runnables within nodes support `.with_retry()` for Runnable-level retries, giving developers two independent retry layers.

### CrewAI: three-layer retry hierarchy

CrewAI distributes retry logic across **three distinct layers**, each addressing a different failure mode:

| Layer | Parameter | Default | Scope |
|-------|-----------|---------|-------|
| LLM API calls | `LLM(max_retries=N)` | Provider-dependent | Rate limits, timeouts, 5xx errors |
| Agent execution | `Agent(max_retry_limit=N)` | 2 | Parsing errors, tool failures, code errors |
| Task guardrails | `Task(guardrail_max_retries=N)` | 3 | Output validation failures |

The **guardrail retry** mechanism is particularly distinctive. When a guardrail function returns `(False, "error message")`, the error message is fed back to the agent as context, and the task re-executes — creating a self-correcting feedback loop. This is semantically different from blind retries: the agent receives explicit feedback about *why* its output was rejected. Additionally, **`Agent(max_iter=20)`** caps total reasoning loops per task, acting as a safety valve independent of retry limits. CrewAI does not expose explicit backoff configuration; backoff behavior is inherited from underlying LLM provider SDKs (OpenAI, Anthropic) or LiteLLM.

### AutoGen: config-list failover and code execution retries

AutoGen 0.2's signature retry mechanism is the **config_list failover** — an ordered list of model configurations where if one fails (rate limit, timeout), the next is tried automatically:

```python
config_list = [
    {"model": "gpt-4", "api_key": "key1"},       # Primary
    {"model": "gpt-4-32k", "api_key": "key2"},    # Fallback
    {"model": "gpt-3.5-turbo", "api_key": "key3"},# Last resort
]
```

In AutoGen 0.4+, the `OpenAIChatCompletionClient` passes `max_retries` directly to the OpenAI SDK, which handles exponential backoff for 429 and 5xx errors. A notable gap exists: the client does not auto-retry on broader transient errors (e.g., 424 `failed_dependency`), which remains an open feature request. For code execution, **`CodeExecutorAgent(max_retries_on_error=3)`** implements an intelligent self-correction loop: after a code execution failure, the model receives the error output, generates a `RetryDecision` structured output, and — if it decides to retry — produces corrected code.

### Temporal and Prefect: infrastructure-grade retry primitives

**Temporal** activities retry by default with **unlimited attempts** and exponential backoff — the only framework where retries are opt-out rather than opt-in:

```python
retry_policy = RetryPolicy(
    initial_interval=timedelta(seconds=10),
    backoff_coefficient=3.0,
    maximum_interval=timedelta(minutes=5),
    maximum_attempts=20,
    non_retryable_error_types=["InvalidInput"],
)
```

Non-retryable errors can be marked from either the caller side (via `non_retryable_error_types`) or the callee side (via `ApplicationError(non_retryable=True)`). Workflows themselves do not retry by default — failures typically indicate code bugs and trigger indefinite Workflow Task retries, allowing hot-fix deployment without state loss.

**Prefect** takes the opposite default — **no retries unless configured** — but offers rich retry customization including `retry_condition_fn` for conditional retries and the `exponential_backoff()` helper:

```python
from prefect.tasks import exponential_backoff

@task(
    retries=5,
    retry_delay_seconds=exponential_backoff(backoff_factor=2),
    retry_jitter_factor=0.2,
    retry_condition_fn=lambda task, run, state: not is_permanent_error(state)
)
def call_llm(prompt: str):
    ...
```

Prefect also supports **global retry defaults** via configuration (`PREFECT_TASK_DEFAULT_RETRIES`), and runtime overrides with `.with_options(retries=10)`.

---

## Error recovery and state persistence across failures

The most consequential architectural difference between these frameworks lies in how they handle partial failures and preserve state. This is where workflow orchestrators demonstrate their production advantage: **Temporal's durable execution model and LangGraph's checkpointing system represent opposite ends of a spectrum from automatic to manual state recovery.**

### LangGraph: checkpoint-based recovery

LangGraph's persistence layer saves a **checkpoint** (state snapshot) at every **superstep** boundary. Supersteps are atomic units where all scheduled nodes execute in parallel. The checkpointer ecosystem includes `InMemorySaver` (development), `SqliteSaver` (local), and `PostgresSaver` (production):

```python
from langgraph.checkpoint.postgres import PostgresSaver

checkpointer = PostgresSaver(conn)
graph = builder.compile(checkpointer=checkpointer)
result = graph.invoke(input_data, {"configurable": {"thread_id": "session-123"}})
```

When a node fails mid-superstep, LangGraph stores **pending writes** from successfully completed sibling nodes. On resume, only the failed node re-executes — successful nodes are not re-run. This provides transactional semantics per superstep while preventing redundant work. Recovery is straightforward: re-invoking with the same `thread_id` loads the last checkpoint. Errors thrown by nodes are stored in the checkpointer for debugging.

LangGraph's **human-in-the-loop** mechanism uses `interrupt()`, which suspends execution, stores the interrupt payload in the checkpoint, and allows the thread to be resumed **months later, on a different machine** via `Command(resume=value)`. This is architecturally powerful but requires explicit checkpointer configuration. Without a checkpointer, LangGraph has no recovery capability.

### CrewAI: guardrail feedback loops and task replay

CrewAI's error recovery is more lightweight. When a task fails, the agent retries up to `max_retry_limit` times. If `max_iter` iterations are exhausted without a final answer, the agent returns its best attempt. **There is no automatic crew-level retry** — a task failure propagates up and the crew raises an exception.

The **guardrail system** functions as CrewAI's primary self-healing mechanism. Guardrails create a feedback loop where the validation error message is sent back to the agent as context for its next attempt, enabling informed rather than blind retries. CrewAI also supports **task replay** via CLI (`crewai replay -t <task_id>`), which re-executes from a specific task in the most recent kickoff — but only the latest kickoff is supported, with no historical record.

For Flows, the `@persist` decorator enables state persistence via SQLite, but **does not auto-resume on crash**. The developer must detect failures, find the persisted flow ID, and manually route past completed steps. Tool execution errors are handled gracefully: the error message becomes an "Observation" sent to the agent, which can retry the tool, try a different tool, or proceed without it.

### AutoGen: self-correction as error recovery

AutoGen's most distinctive error recovery pattern is **conversational self-correction**. In the classic two-agent pattern, `UserProxyAgent` executes code and returns exit codes; `AssistantAgent` receives error output and generates corrected code. The `DEFAULT_SYSTEM_MESSAGE` explicitly instructs agents to "analyze the problem, revisit your assumption, collect additional info you need, and think of a different approach." In 0.4, `CodeExecutorAgent` formalizes this with `max_retries_on_error` and model-driven `RetryDecision` structured outputs.

State persistence in AutoGen 0.4 uses `save_state()` / `load_state()` on agents and teams, returning JSON-serializable dictionaries. However, **there is no automatic checkpointing during execution** — state must be explicitly saved by the developer. A `CheckpointEvent` proposal exists but is not implemented. The `GraphFlow` abstraction has known bugs with state persistence after interruption.

### Temporal: automatic durable execution via event sourcing

**Temporal fundamentally solves the recovery problem through deterministic replay.** Every activity result is recorded in an append-only Event History. When a worker crashes, the workflow replays its history, restoring exact pre-failure state without re-executing completed activities:

```python
@workflow.defn
class AIAgentWorkflow:
    @workflow.run
    async def run(self, goal: str):
        # If worker crashes after step 1 completes, replay loads step 1's result
        step1_result = await workflow.execute_activity(
            call_llm, goal,
            start_to_close_timeout=timedelta(seconds=30),
        )
        # Only step 2 re-executes on recovery
        step2_result = await workflow.execute_activity(
            use_tool, step1_result,
            start_to_close_timeout=timedelta(seconds=30),
        )
```

For AI agents, this means an agent 45 minutes into a multi-step tool-calling loop can recover from a crash **without re-executing completed LLM calls** — saving tokens, time, and money. The Saga pattern enables compensating transactions for partially completed multi-step operations. `continue_as_new()` handles the Event History size limit for very long-running agents. Heartbeats signal liveness during long activities.

**Prefect** offers result persistence and caching as its recovery mechanism. Tasks with `persist_result=True` store outputs to configurable backends (local, S3, GCS). On re-run, cached results skip re-execution. The `pause_flow_run()` and `suspend_flow_run()` functions enable human-in-the-loop patterns, with `suspend` fully releasing the execution thread and relying on persisted results to resume later.

### Recovery capability comparison

| Capability | LangGraph | CrewAI | AutoGen | Temporal | Prefect |
|-----------|-----------|--------|---------|----------|---------|
| **Automatic state recovery** | Checkpoint-based | None (manual replay) | Manual save/load | Event sourcing (automatic) | Result caching (opt-in) |
| **Granularity** | Per-superstep | Per-task (latest only) | Per-agent/team | Per-activity | Per-task |
| **Survives process crash** | Yes (with DB checkpointer) | No | No | Yes (always) | Yes (with persistence) |
| **Human-in-the-loop** | `interrupt()` + `Command(resume=)` | `human_input=True` on tasks | `HandoffTermination` + `UserProxyAgent` | Signals, Updates, wait_condition | `pause_flow_run()` with `RunInput` |
| **Long-duration waits** | Yes (persisted interrupts) | Limited | Limited | Hours/days/months (durable timers) | Hours (pause/suspend) |

---

## Conditional branching: from graph edges to "just code"

Conditional branching — the ability to route execution based on runtime state, LLM output, or tool results — is where the architectural philosophies diverge most sharply. LangGraph and AutoGen 0.4 use explicit graph structures. CrewAI uses event-driven Flows. Temporal and Prefect use native Python control flow made durable.

### LangGraph: conditional edges and the Command API

LangGraph's primary branching mechanism is `add_conditional_edges()`, where a routing function inspects the graph state and returns the next node(s):

```python
def route_after_llm(state: State) -> str:
    last_message = state["messages"][-1]
    if last_message.tool_calls:
        return "tool_node"
    return END

builder.add_conditional_edges("llm_node", route_after_llm, {
    "tool_node": "tool_node",
    END: END,
})
```

Returning a **list of node names** triggers parallel fan-out. The `Send` primitive enables **dynamic map-reduce** where the number of parallel branches is determined at runtime:

```python
from langgraph.types import Send

def fan_out_to_workers(state):
    return [Send("process", {"item": item}) for item in state["items"]]
```

The newer `Command` object combines state updates with routing in a single return value, eliminating the separation between node logic and routing logic:

```python
from langgraph.types import Command

def agent_node(state) -> Command[Literal["tool_node", END]]:
    if needs_tool(state):
        return Command(update={"messages": [response]}, goto="tool_node")
    return Command(update={"messages": [response]}, goto=END)
```

A key distinction: `add_conditional_edges` defines routing logic **external** to nodes (in a separate function), while `Command` moves routing **inside** nodes. Static edges from `add_edge` always execute alongside `Command` dynamic edges, which can cause surprising double-execution if not carefully managed.

### CrewAI: Flows with @router decorators

CrewAI's Flows provide an event-driven branching model using Python decorators. The `@router` decorator marks a method whose return value determines which downstream listeners activate:

```python
from crewai.flow.flow import Flow, listen, router, start

class AgentFlow(Flow):
    @start()
    def classify_input(self):
        self.state.category = llm_classify(self.state.input)

    @router(classify_input)
    def route_by_category(self):
        return self.state.category  # "billing", "technical", etc.

    @listen("billing")
    def handle_billing(self):
        crew = Crew(agents=[billing_agent], tasks=[billing_task])
        return crew.kickoff().raw

    @listen("technical")
    def handle_technical(self):
        crew = Crew(agents=[tech_agent], tasks=[tech_task])
        return crew.kickoff().raw
```

The `or_()` and `and_()` combinators enable fork-join patterns. CrewAI also offers `ConditionalTask` for simpler skip/execute logic in sequential crews, where a condition function receiving the previous task's output returns `True` (execute) or `False` (skip). The `Pipeline` class with `Router` and `Route` objects provides yet another conditional abstraction at the pipeline level, using lambda conditions to route between sub-pipelines.

### AutoGen 0.4: GraphFlow with DiGraphBuilder

AutoGen's most powerful branching mechanism is `GraphFlow`, which defines explicit DAGs with conditional edges:

```python
from autogen_agentchat.teams import DiGraphBuilder, GraphFlow

builder = DiGraphBuilder()
builder.add_node(classifier).add_node(search_agent).add_node(gen_agent)
builder.add_conditional_edges(classifier, {
    "SEARCH": search_agent,
    "GENERATE": gen_agent,
})
```

Edge conditions can be **string-based** (checks if the string appears in the agent's message) or **callable** (lambda/function receiving the message). The `Swarm` abstraction implements decentralized handoff-based branching where agents declare `handoffs=["agent_a", "agent_b"]` and the model's tool-calling capability drives routing via auto-generated `transfer_to_<agent>` tool calls. `SelectorGroupChat` provides LLM-driven or custom-function-driven speaker selection, with a `selector_func` that can return `None` to fall back to LLM-based selection. `SocietyOfMindAgent` enables nested teams, packaging entire multi-agent workflows as single participants in outer teams.

### Temporal and Prefect: branching as native code

Both workflow orchestrators take the "just code" approach — conditional branching uses standard Python `if/else`, loops, and exception handling, made durable through their respective execution models:

```python
# Temporal: branching is standard Python, made durable via replay
@workflow.defn
class AgentWorkflow:
    @workflow.run
    async def run(self, request):
        plan = await workflow.execute_activity(call_planner, request, ...)
        if plan.action == "search":
            return await workflow.execute_activity(search_tool, plan.query, ...)
        elif plan.action == "ask_human":
            await workflow.wait_condition(lambda: self.human_input is not None)
            return self.human_input
```

Temporal's **signals** inject data into running workflows for dynamic modification (e.g., human approvals), while **queries** read workflow state without side effects. **Child workflows** create modular sub-branches with independent event histories. Prefect uses `.map()` for dynamic parallelism, `.submit()` for concurrent task execution, and `wait_for` for explicit dependency management. Both frameworks make branching logic immediately readable as standard Python — no graph DSL to learn.

---

## Architectural differences that shape production choices

The five frameworks cluster into three distinct architectural paradigms, each with different tradeoffs for production AI agents:

**Graph-native frameworks** (LangGraph, AutoGen 0.4 GraphFlow) model agent workflows as explicit directed graphs with typed state flowing between nodes. This provides excellent visualization, clear execution semantics, and natural support for parallel fan-out. The tradeoff is added complexity in graph construction and the constraint that all branching must be expressible as edges.

**Role-based agent frameworks** (CrewAI, AutoGen Swarm/SelectorGroupChat) model workflows as teams of agents with defined roles, where routing emerges from agent capabilities and LLM-driven delegation. This is more natural for multi-agent scenarios but harder to reason about deterministically. CrewAI's Flows layer adds deterministic control on top, creating a useful dual-layer architecture.

**Durable workflow engines** (Temporal, Prefect) model agent execution as ordinary code made reliable through infrastructure. Temporal's event sourcing provides the strongest guarantees: **exactly-once activity execution semantics, automatic crash recovery, and the ability to run agents for hours or days without state loss**. The tradeoff is operational complexity — Temporal requires a server deployment and understanding of deterministic replay constraints.

---

## Production patterns and best practices

Several cross-cutting production patterns emerge from this analysis. **Idempotency** is natively supported only by Temporal (via stable `workflow_run_id + activity_id` keys) and must be manually implemented in agent frameworks. For LLM calls that trigger real-world side effects (sending emails, making purchases), wrapping them in idempotent activities is critical.

**Circuit breaker patterns** manifest differently: Temporal implements them declaratively through `maximum_attempts` and `non_retryable_error_types`; Prefect through `retry_condition_fn`; LangGraph through the `retry_on` predicate; CrewAI through `max_iter` and `max_retry_limit` caps. None of the agent frameworks provide true circuit breakers with half-open states — this requires external libraries or custom implementation.

**Dead-letter queue equivalents** exist in Temporal (failed workflows remain queryable with full event histories) and Prefect (automation triggers can route failures to cleanup flows). Agent frameworks typically log failures and lose context. For production deployments, wrapping agent execution inside a Temporal workflow provides both the agent-native abstractions and infrastructure-grade reliability. **OpenAI Codex, Replit Agent, and Retool Agents all run on Temporal in production** — a strong signal that durable execution is becoming the standard for production AI agents.

**Layered retry strategies** represent a best practice across all frameworks. LangGraph enables this with per-node `RetryPolicy` plus Runnable-level `.with_retry()`. CrewAI's three-layer hierarchy (LLM retries → agent retries → guardrail retries) addresses failures at increasing semantic levels. The most robust production pattern combines fast, automatic retries for transient infrastructure errors with slower, feedback-driven retries for semantic failures (wrong output format, failed validation), and human escalation as the final fallback.

---

## Conclusion

The central tension in production AI agent reliability is between **developer ergonomics and operational guarantees**. LangGraph offers the best balance within the agent-native category: its `RetryPolicy`, checkpoint-based recovery, and `add_conditional_edges` / `Command` APIs provide meaningful production primitives without leaving the graph abstraction. CrewAI's Flows add deterministic control to an otherwise LLM-driven framework, but its recovery story remains weak — `@persist` is a save point, not durable execution. AutoGen 0.4's `GraphFlow` is architecturally promising but immature, with known state persistence bugs and incomplete error-handling APIs.

For truly production-critical deployments, **the emerging industry pattern is to use agent frameworks for reasoning and tool-calling logic while wrapping execution in Temporal for durability**. This sidesteps the fundamental limitation of agent-native checkpointing: it is bolted on after the fact rather than baked into the execution model. Temporal's deterministic replay guarantees that completed LLM calls are never re-executed on recovery — a property no agent framework achieves natively — saving both tokens and money at scale. Prefect occupies a middle ground well-suited for data pipelines with AI components, offering strong retry primitives and result caching without Temporal's operational complexity. The field is converging toward a layered architecture where agent reasoning, execution durability, and infrastructure reliability are addressed by purpose-built tools at each layer rather than a single monolithic framework.