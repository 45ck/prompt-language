<!-- cspell:ignore FrugalGPT RouteLLM SGLang Agentless -->

# Post-GSLR-5R Scaffolded Sanitizer Decision: 2026-05-12

Status: research decision and next-experiment contract  
Primary bead: `prompt-language-gslr19`  
Companion Portarium bead: `bead-1244`

## Question

After the GSLR-5R repaired-local repeat failed all three runs, what should we do
next, and why?

## Conclusion

Do not run another free-form local sanitizer prompt.

The next experiment is GSLR-6: a scaffolded sanitizer contract where Prompt
Language supplies fixed helper boundaries and the local model fills only small
policy predicates or tables.

The defensible claim is now:

```text
Local models can reduce frontier cost only when Prompt Language narrows the
task into small, oracle-checked, reversible contracts. Privacy-sensitive
evidence-card sanitization stays frontier-baseline until that scaffold passes
repeat hidden-oracle testing.
```

## What We Learned Internally

GSLR-5R is negative promotion evidence, not a project failure.

The one repaired local pass did not repeat:

- repeat 1 failed by accepting a source payload raw key;
- repeat 2 failed by accepting an unsafe raw-dump parent-traversal artifact ref;
- repeat 3 failed by accepting a source payload raw key.

The failure pattern matters. The local lane could sometimes understand the
intent, but it did not consistently preserve the invariants:

- key matching must be normalized before comparing against forbidden keys;
- artifact refs must reject parent traversal and raw-dump names;
- action-boundary status must be recomputed from gates and defects;
- raw payload strings must be rejected recursively.

That means the weak hypothesis is rejected:

```text
A clearer natural-language prompt is enough for local privacy-sensitive
sanitizer ownership.
```

The stronger hypothesis remains alive:

```text
Prompt Language can reduce cost by converting privacy-sensitive work into a
small helper contract that local models can complete and hidden oracles can
falsify.
```

## External Research Read

The research points in the same direction:

- OpenAI Symphony validates board-to-agent orchestration, so the board itself is
  not the new claim. Prompt Language's role is the executable work-item
  contract inside the board lane.
- OpenAI harness engineering says the leverage is increasingly in scaffolding,
  feedback loops, repository legibility, and control systems. GSLR-5R is exactly
  that kind of harness feedback.
- OpenAI Agents SDK guardrails distinguish blocking checks, output checks, and
  tool checks. GSLR-6 should use deterministic helper contracts before any
  product-facing action, not rely on final prose review.
- OpenAI open-weight `gpt-oss-20b` and local Ollama candidates make local lanes
  practical, but model availability is not route evidence. Promotion still
  requires repo-local hidden-oracle repeats.
- FrugalGPT and RouteLLM make model routing and cascades credible, but software
  engineering needs task-specific gates, diffs, hidden oracles, and product
  boundaries.
- SWE-agent shows the interface given to an agent changes performance.
  Therefore the GSLR-6 scaffold is part of the model capability test, not just
  prompt decoration.
- Agentless warns that simple localization, repair, and validation can beat
  complex autonomy. GSLR-6 should be a simple scaffolded validation task before
  any bigger agent team.
- DSPy, LMQL, and SGLang show prompt-programming is established prior art.
  Prompt Language's differentiator is not "prompts as code"; it is gates,
  artifacts, route policy, evidence, and governance handoff.
- NIST AI RMF supports the governance framing: privacy-sensitive automation
  needs traceability, oversight, and risk controls near the action boundary.

## GSLR-6 Contract

GSLR-6 should keep the GSLR-5 adversarial fixture and private oracle unchanged
where possible, but change the local lane shape.

The local model should not write the whole sanitizer from scratch. It should
fill or preserve fixed helper boundaries:

- `normalizeEvidenceKey(value)`
- `isForbiddenRawKey(key)`
- `containsRawPayloadText(value)`
- `isSafeArtifactRef(ref)`
- `deriveActionBoundary(gates)`
- `sanitizeEvidenceCardInput(input)`

The scaffold should include fixed tests or public gates for:

- separator-insensitive raw and secret key matching;
- safe relative artifact refs;
- rejection of absolute, query, fragment, parent traversal, and raw-dump refs;
- recursive string scanning for raw payload boundaries and school/person data;
- action-boundary recomputation from final verdict, private oracle, and blocking
  review defects;
- non-mutation of input;
- allowed top-level output fields only.

## Promotion Bar

GSLR-6 can only change routing if all of these are true:

- N=3 local repeats pass;
- frontier tokens remain zero for the local lane;
- the private oracle is unchanged or stricter than GSLR-5;
- every manifest has `finalVerdict.status == "pass"`;
- local resource samples are recorded;
- no run leaks oracle commands, raw payloads, or unsafe artifact refs;
- the route policy names the exact scaffolded task shape, not broad sanitizer
  ownership.

Anything less keeps `gslr5-raw-payload-adversarial` and adjacent
privacy-sensitive evidence-card work on `frontier-baseline`.

## Product Boundary

Do not build Portarium runtime ingestion from this result.

Do not build live Cockpit cards from prompt-language manifests yet.

Do not move MacquarieCollege connector payloads, raw school data, or source
system observations through this pipeline.

## Next Step

Build the GSLR-6 scaffold and deterministic fake-live lane first. Run live local
repeats only after the public gate proves the scaffold and oracle wiring.

## Sources

- Internal GSLR-5R result:
  `experiments/harness-arena/results/gslr5r-local-repeat-2026-05-12/report.md`
- Current route policy:
  `experiments/harness-arena/gslr-policy-schema-routing-policy.v1.json`
- OpenAI Symphony:
  <https://openai.com/so-DJ/index/open-source-codex-orchestration-symphony/>
- OpenAI harness engineering:
  <https://openai.com/index/harness-engineering/>
- OpenAI Agents SDK guardrails:
  <https://openai.github.io/openai-agents-python/guardrails/>
- OpenAI `gpt-oss-20b` model docs:
  <https://developers.openai.com/api/docs/models/gpt-oss-20b>
- FrugalGPT: <https://arxiv.org/abs/2305.05176>
- RouteLLM: <https://arxiv.org/abs/2406.18665>
- SWE-agent: <https://arxiv.org/abs/2405.15793>
- Agentless: <https://arxiv.org/abs/2407.01489>
- DSPy: <https://arxiv.org/abs/2310.03714>
- LMQL: <https://arxiv.org/abs/2212.06094>
- SGLang: <https://arxiv.org/abs/2312.07104>
- NIST AI RMF: <https://www.nist.gov/itl/ai-risk-management-framework>

## Execution Record

2026-05-12:

- Recorded the post-GSLR-5R research conclusion.
- Defined GSLR-6 as a scaffolded sanitizer-contract experiment.
- Kept privacy-sensitive evidence-card sanitization on `frontier-baseline`.
- Kept Portarium ingestion, live Cockpit cards, and MC connector/raw-data work
  blocked.
