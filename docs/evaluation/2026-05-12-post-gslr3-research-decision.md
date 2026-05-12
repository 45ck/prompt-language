<!-- cspell:words FrugalGPT RouteLLM LLMLingua Ollama -->

# Post-GSLR-3 Research Decision: 2026-05-12

Status: research decision record  
Tracking bead: `prompt-language-gslr11`  
Companion Portarium bead: `bead-1236`

## Short Answer

GSLR-3 has not proved local-model capability yet. It proved the scaffold around
the next task shape.

The next move is:

1. build the live GSLR-3 local/frontier lane scripts;
2. run `local-only` first;
3. if `local-only` passes, run one `frontier-only` baseline to price the avoided
   frontier work;
4. run `advisor-only` only if local fails or the review budget is the question;
5. run `hybrid-router` only when governance policy requires a final frontier
   review.

Do not run all four arms by reflex. The GSLR-2 evidence already showed that
hybrid review can pass while being the wrong economic choice for a tiny gated
task.

## What We Just Learned

GSLR-3 changed one important product assumption:

```text
A failed or blocked manifest is still evidence and must still become a card.
```

The transform should not discard a failed final verdict, failed private oracle,
or blocking review defect. It should preserve the aggregate, non-secret evidence
and set `actionBoundary.status` to `blocked`.

That is a Portarium-relevant result. Operators need to see why a bead is blocked,
not just see successful cards.

GSLR-3 did not prove that a local model can implement the manifest-to-card
transform. The deterministic lane wrote the solution. The result is
harness-plumbing evidence only.

## External Research Check

OpenAI Symphony is strong prior art for board-driven coding-agent orchestration:
issue tracker, per-issue workspace, in-repo workflow policy, retries, status, and
human review packets. That validates the Cockpit/Beads direction, but it also
means "board starts agents" is not the novel claim.

OpenAI harness engineering points to the deeper layer: agent-friendly repos,
tests, guardrails, observability, and clear feedback loops. This is exactly
where Prompt Language can matter: PL should be the executable contract and
measurement layer inside each bead.

FrugalGPT and RouteLLM support routing and cascades, but only when the routing
policy is measured. Our internal evidence agrees: local-only can be best for a
bounded gated task, while hybrid can be wasteful if used as a habit.

SWE-agent's agent-computer-interface work supports the same conclusion from a
coding-agent angle: models need compact, structured interfaces and executable
feedback, not just bigger prompts.

DSPy and LLMLingua show another cost lever: prompt programs can be compiled,
optimized, and compressed. For PL, the cost strategy should include stable
schemas, reusable prompt prefixes, cached-token telemetry, and smaller local
lanes, not only model substitution.

OpenAI `gpt-oss-20b` and local inference stacks make local reasoning lanes
practical for bounded structured-output work. They do not remove the need for
public gates, private oracles, route policies, and action-boundary approval.

## Internal Evidence Check

GSLR-2 is the live result that matters most right now:

| Arm             | Result | Frontier tokens | Interpretation                                     |
| --------------- | ------ | --------------- | -------------------------------------------------- |
| `local-only`    | pass   | 0               | Best route for the exact tiny policy/schema task   |
| `frontier-only` | pass   | 45,713          | Useful price baseline                              |
| `advisor-only`  | pass   | 15,301          | Cheaper escalation candidate                       |
| `hybrid-router` | pass   | 91,279          | Passed, but not cost-effective for this task shape |

GSLR-3 is the newest scaffold result:

- deterministic `hybrid-router` fake-live proof passed;
- private oracle passed;
- final verdict passed;
- cached-token parser coverage worked;
- no model capability was measured.

The most useful GSLR-3 design correction is that blocked evidence must survive
the transform.

## Conclusion

The exciting thing is not "we can replace frontier Codex with a local model."

The more defensible claim is:

```text
Prompt Language can turn agent work into measured contracts, and Portarium can
turn those contracts into governed action-boundary evidence.
```

Local models become useful when the contract is bounded enough to screen them
cheaply. Frontier models remain valuable for difficult reasoning, repair, and
review. The research question is where the boundary sits by task shape.

## What Now

Build live GSLR-3 lane scripts and run `local-only`.

If it passes, run `frontier-only` once. That will answer the concrete question:
how many frontier tokens did the local lane avoid for the same transform task?

If it fails, do not hide the failure. Run `advisor-only`, record whether a small
frontier advisory pass repairs the local lane, and keep `hybrid-router` reserved
for policy-required review.

Only after that should we update the route policy for:

```text
gslr3-policy-manifest-transform
```

Then proceed to `gslr4-two-file-validator`. That is where file coupling should
start exposing whether local-screen generalizes or needs advisor escalation.

## Product Boundary

Portarium runtime ingestion remains blocked.

Live Cockpit evidence cards remain blocked.

MC connector observation remains blocked.

The next product-facing idea is still only a static evidence-card schema, and it
should wait until GSLR-3 live evidence exists.

## Sources

- OpenAI, "An open-source spec for Codex orchestration: Symphony":
  <https://openai.com/index/open-source-codex-orchestration-symphony/>
- OpenAI Symphony specification:
  <https://github.com/openai/symphony/blob/main/SPEC.md>
- OpenAI, "Harness engineering: leveraging Codex in an agent-first world":
  <https://openai.com/index/harness-engineering/>
- OpenAI API, `gpt-oss-20b` model page:
  <https://developers.openai.com/api/docs/models/gpt-oss-20b>
- OpenAI API, Prompt caching:
  <https://developers.openai.com/api/docs/guides/prompt-caching>
- FrugalGPT:
  <https://arxiv.org/abs/2305.05176>
- RouteLLM:
  <https://openreview.net/forum?id=8sSqNntaMr>
- SWE-agent agent-computer interface:
  <https://swe-agent.com/0.7/background/aci/>
- DSPy:
  <https://proceedings.iclr.cc/paper_files/paper/2024/hash/f1cf02ce09757f57c3b93c0db83181e0-Abstract-Conference.html>
- LLMLingua:
  <https://arxiv.org/abs/2310.05736>

## Execution Record

2026-05-12:

- Re-checked OpenAI Symphony, the Symphony specification, harness engineering,
  prompt caching, open/local model docs, routing/cascade literature,
  agent-interface work, and prompt-program/prompt-compression papers.
- Re-read the internal GSLR-2 live result and GSLR-3 deterministic result.
- Recorded the post-GSLR-3 decision: run GSLR-3 live local-first, add a
  frontier-only price baseline if local passes, and keep advisor/hybrid runs
  conditional.
- Kept Portarium runtime ingestion, live Cockpit cards, and MC connector
  observation blocked.
- Follow-up live evidence: `local-only` failed on malformed array input,
  `advisor-only` failed on local wall-time aggregation, and `frontier-only`
  passed with 33,913 frontier tokens. The route for
  `gslr3-policy-manifest-transform` is now `frontier-baseline`, not
  `local-screen`.
