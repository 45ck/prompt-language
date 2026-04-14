# Cross-Family Reviewer Lane

Status: design (META-5 operator sign-off #3 precondition). Not yet
implemented. This doc is the authoritative specification operators can
use today to judge whether a given pair of runners satisfies the
cross-family rule.

## Why this exists

META-5 bootstrap requires three human sign-offs (design, gate, merge).
Sign-off #3 in the post-F4 revision demands that the **reviewer lane**
auditing a factory/meta-flow output be in a different model family than
the factory lane. The F4 witness-chain review logs the same failure as
MR-9 ("blinding failure"): if the factory and its auditor share a
training lineage and an RLHF pipeline, the auditor is not independent —
it is a mirror that will mostly ratify the factory's style, vocabulary,
and silent assumptions (sycophancy collision; shared-prior bias).

Today's runner adapters (`claude-process-spawner`,
`codex-prompt-turn-runner`, `opencode-prompt-turn-runner`,
`ollama-prompt-turn-runner`, `aider-prompt-turn-runner`) wrap distinct
CLIs but not distinct models — two apparently different runners can
both resolve to Anthropic Claude, or both to GPT-5.2 via Codex/Aider.
The cross-family rule is defined on model identity, not CLI identity.

## 1. Family taxonomy

A **family** is an unordered group of model checkpoints that share a
vendor and a training lineage. The comparison axis is "would a review
from model X about model Y's output be systematically biased by shared
priors". Vendor + lineage is the strongest practical proxy.

| Family ID    | Vendor-ish              | Representative models                                        | Lineage note                                    |
| ------------ | ----------------------- | ------------------------------------------------------------ | ----------------------------------------------- |
| `anthropic`  | Anthropic               | claude-opus-4-6, claude-sonnet-4-6, claude-haiku-4-5         | One family across size tiers                    |
| `openai`     | OpenAI                  | gpt-5.2, gpt-4o, gpt-4.1, o3, o4-mini                        | One family across reasoning and chat variants   |
| `google`     | Google DeepMind         | gemini-2.5-pro, gemini-2.5-flash, gemini-1.5-pro             | One family                                      |
| `meta-llama` | Meta (weights)          | llama-3.3-70b, llama-3.1-405b, code-llama-*                  | Lineage group, hosting-agnostic                 |
| `qwen`       | Alibaba (weights)       | qwen2.5-coder-*, qwen3-*                                     | Lineage group                                   |
| `deepseek`   | DeepSeek (weights)      | deepseek-v3, deepseek-r1, deepseek-coder-*                   | Lineage group                                   |
| `mistral`    | Mistral (weights)       | mistral-large, mixtral-*, codestral                          | Lineage group                                   |
| `gemma`      | Google open-weights     | gemma-3-*, gemma-4-*                                         | Distinct from `google` closed API (per note A)  |
| `xai`        | xAI                     | grok-4, grok-3                                               | One family                                      |
| `unknown`    | —                       | any model not in the table                                   | Forces operator to classify before claim-runs   |

Note A: we classify `gemma` as its own family (not `google`) because
its training corpus is published and has historically diverged from
closed Gemini checkpoints. If Google ever re-merges them we collapse
the row and bump the table version.

Ollama is a **runtime**, not a family. `ollama/qwen2.5-coder:32b` maps
to `qwen`; `ollama/gemma-4:31b` maps to `gemma`; `ollama/llama3.3` maps
to `meta-llama`. Aider is also a runtime — the `--model` flag decides
the family. Codex always maps to `openai` today, but the table is
authoritative, not the adapter name.

## 2. Lane assignment rule

The authoritative predicate a preflight can enforce:

```
validPair(factory, reviewer) :=
  family(factory) != family(reviewer)
  AND family(factory) != 'unknown'
  AND family(reviewer) != 'unknown'
```

One-line enforcement: **the factory family and reviewer family must
both be known and must not be equal.**

Pseudocode (preflight):

```
for each lane in run:
  lane.family = familyOf(lane.model)   // table lookup, case-insensitive on vendor
  if lane.family == 'unknown': fail "classify model before claim-run"

factoryFamilies = set(family(f) for f in run.factoryLanes)   // usually 1
reviewerFamily  = family(run.reviewerLane)

if reviewerFamily in factoryFamilies:
    fail "same-family review; choose a reviewer from a different family"
```

Ensemble case (rare today): if the factory is an ensemble over
`{anthropic, openai}`, the reviewer family must be neither. This is
the only reason `factoryFamilies` is a set.

Case-insensitive on vendor string; lineage IDs are lowercase kebab-case
by convention.

## 3. Evidence captured per review

Every review writes a record consumable by `verify-trace.mjs` and by
the scorecard aggregator. Required fields:

| Field                           | Source                              | Purpose                                  |
| ------------------------------- | ----------------------------------- | ---------------------------------------- |
| `factory.model`                 | factory runner config               | Identifier (e.g. `claude-opus-4-6`)      |
| `factory.modelVersion`          | runner `--version` probe            | Patch-level tracking                     |
| `factory.family`                | `model-family.ts` lookup            | The classification used for the rule     |
| `factory.systemPromptSha256`    | hash of the assembled system prompt | Detects silent prompt drift              |
| `reviewer.model`                | reviewer runner config              | Identifier                               |
| `reviewer.modelVersion`         | runner `--version` probe            | —                                        |
| `reviewer.family`               | `model-family.ts` lookup            | —                                        |
| `reviewer.systemPromptSha256`   | hash of the reviewer system prompt  | —                                        |
| `rulePassed`                    | `validPair(...)` result             | Explicit Boolean in the bundle           |
| `familyTableVersion`            | committed `model-family.ts` header  | Reproducibility if taxonomy changes      |

Logging placement:

- `shim_invocation_begin` entries already carry `binaryPath` and may
  carry `binarySha256` (see `verify-trace.mjs` AP-3 guard). Extend the
  shim envelope with an optional `modelIdentifier` and `modelFamily`
  derived at launch; `verify-trace` learns to pair both sides and
  agree on them (same pattern as `binarySha256` in AP-3).
- The scorecard JSON gains an `evaluationModel` block with the full
  table above.
- The admissibility block gains `crossFamilyReviewer: pass|downgrade|fail`.

A run is `claim-eligible` for META-3 cross-witness purposes only if
`rulePassed == true` and the verifier has seen both family identifiers
on matched pairs.

## 4. Non-hermetic handling

| Situation                                   | Behavior                                                                                                             | Admissibility          |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| Only one provider available locally         | Run allowed; admissibility set to `developer-local`; NOT claim-eligible; scorecard flagged                           | `developer-local`      |
| Same-family pair explicitly configured      | Preflight refuses to launch; suggests the cross-family combinations found in the operator's probed environment       | N/A (refused)          |
| Reviewer model unknown / not in table       | Preflight refuses; operator must add the lineage classification via a one-line PR to the family table                | N/A (refused)          |
| Cross-family pair runs and reviewer vetoes  | Claim fails. The cross-family review is the veto; METRIC-3 aggregation does not override it (see §5)                 | `claim-failed`         |
| Cross-family pair, reviewer disagrees mildly (partial) | Claim blocked until a second cross-family reviewer from a third family adjudicates; log both reviews               | `claim-blocked`        |
| Reviewer persistently rejects valid work    | Suspected reviewer-bias; escalate to human; track per-reviewer false-reject rate in the scorecard rollup             | open metric            |

"Bias vs legitimate disagreement" is not decidable from a single run;
it is observed across batches. The scorecard tracks
`reviewerVetoRate` per `(factoryFamily, reviewerFamily)` cell so a
systematically over-rejecting reviewer family is visible over time.

## 5. Reviewer prompt contract

Input the reviewer receives:

- The finished workspace diff (post-factory) OR the change-request
  output workspace (the same view `run-change-request.mjs` hands to
  the blind maintenance lane today)
- The original requirement text and the acceptance journeys/tests
- The factory's **final artifact** narration, if any, that the
  operator has explicitly marked as user-facing deliverable

Input the reviewer MUST NOT receive:

- The factory's `.flow` source or any prompt-language artifact
- The factory's trace logs, scratchpads, or chain-of-thought
- Any indication of which factory lane (PL-first vs codex-first) was used
- Any self-scoring the factory wrote about itself

The blinding discipline is the same as the E5 maintenance lane
(`experiments/results/e5-maintenance/program.md` §"Blinding") and is
enforced by the same stripping harness plus a grep guard for banned
substrings (`/prompt[- ]?language/i`, `/\.flow\b/i`, `/factory[- ]?lane/i`).

Reviewer output JSON schema (strict; verifier rejects off-schema):

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "required": ["verdict", "rationale", "risks", "reviewerModel", "reviewerFamily", "schemaVersion"],
  "properties": {
    "schemaVersion":   { "const": "1.0.0" },
    "verdict":         { "enum": ["pass", "partial", "fail"] },
    "rationale":       { "type": "string", "minLength": 40, "maxLength": 4000 },
    "risks": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["id", "severity", "summary"],
        "properties": {
          "id":       { "type": "string", "pattern": "^R[0-9]+$" },
          "severity": { "enum": ["low", "medium", "high", "critical"] },
          "summary":  { "type": "string", "minLength": 10, "maxLength": 400 },
          "evidence": { "type": "string" }
        }
      }
    },
    "requirementsCovered":   { "type": "array", "items": { "type": "string" } },
    "requirementsMissed":    { "type": "array", "items": { "type": "string" } },
    "reviewerModel":         { "type": "string" },
    "reviewerFamily":        { "type": "string" },
    "reviewerConfidence":    { "type": "number", "minimum": 0, "maximum": 1 }
  },
  "additionalProperties": false
}
```

Veto semantics (META-3 aligned): a `fail` verdict from a valid
cross-family reviewer fails the claim regardless of other metric
outcomes. A `partial` requires a second cross-family reviewer from a
third family (see §4 row 5). A `pass` lets scorecard aggregation
proceed.

## 6. Integration points

No code in this doc; the list below enumerates the files that will
change and what kind of change each carries.

| File                                                                             | Change kind                                                                                                   |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `src/domain/model-family.ts` (new)                                               | Pure table + `familyOf(model: string): FamilyId` function; zero deps per domain rule                          |
| `src/domain/model-family.test.ts` (new)                                          | Unit coverage for each row in §1 + `unknown` fallthrough + case-insensitivity                                 |
| `src/application/ports/reviewer-port.ts` (new)                                   | Port interface `review(input): Promise<ReviewVerdict>`                                                        |
| `src/infrastructure/adapters/claude-process-spawner.ts` and the four runners     | Surface `modelIdentifier` in the returned runner metadata (currently implicit); no behavioral change          |
| `scripts/experiments/e5/run-reviewer.mjs` (new)                                  | Orchestrates the reviewer call given a workspace, requirements doc, and a chosen reviewer runner+model        |
| `scripts/experiments/e5/run-pair.mjs`                                            | Add a `cross-family-review` stage after `gate-family-1-2-3`; preflight with the §2 rule; short-circuit on fail |
| `scripts/experiments/meta/run-meta-experiment.mjs`                               | Add preflight entry: refuse to launch if the resolved factory family equals the resolved reviewer family      |
| `scripts/eval/verify-trace.mjs`                                                  | Require a `reviewer.family` identifier in the evidence block when `--expected-reviewer-family` is passed      |
| `experiments/meta-factory/design/risks.md`                                       | Flip MR-9 mitigation from "blinding discipline" to "cross-family reviewer + blinding"; bump META version      |
| `experiments/results/e5-maintenance/templates/scorecard.template.json`           | Add `evaluationModel` and `admissibility.crossFamilyReviewer`                                                 |
| `docs/strategy/index.md`                                                         | Add link row for this doc under "Pages"                                                                       |

Out of scope for this doc: rewriting any of the above. Code lands
under the normal bead/commit flow in phase 2 (§7).

## 7. Bootstrap and rollout

| Phase | Scope                                                                                                                                     | Concrete shipping unit                                                                                              |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| 1     | This design doc + the `model-family.ts` table + a warning-only preflight (logs same-family pairs, does not fail)                          | Beads `META-5.XFR-1` (doc), `META-5.XFR-2` (table), `META-5.XFR-3` (warn preflight)                                 |
| 2     | Hard-fail preflight; admissibility downgrades for same-family runs; scorecard schema update; verifier recognises reviewer family          | Beads `META-5.XFR-4` (preflight hard-fail), `META-5.XFR-5` (scorecard schema), `META-5.XFR-6` (verify-trace update) |
| 3     | Scorecard aggregation refuses to flag a pair `claim-eligible` without cross-family evidence; ADR lands under `docs/adr/`                  | Beads `META-5.XFR-7` (aggregator), `META-5.XFR-8` (ADR)                                                             |
| 4     | CI job runs the reviewer loop end-to-end using a free Gemini or Gemma model reviewing Claude-produced workspace                           | Beads `META-5.XFR-9` (CI harness), `META-5.XFR-10` (reviewer-quality baseline)                                      |

Phase 1 is non-breaking and can land immediately. Phase 2 is the
breaking phase — existing single-family smoke runs must declare
themselves `developer-local` to keep passing.

## 8. Known limits

- **Shared-prior contamination is not eliminated.** Different families
  are trained on overlapping internet-scale corpora; their RLHF
  pipelines use partly overlapping human raters and reward traditions.
  A cross-family reviewer reduces collision, it does not remove it.
- **Reviewer competence floor.** A weaker reviewer model may reject
  correct work. `reviewerVetoRate` per family-pair (§4) is how this
  shows up; human escalation handles it until we have a baseline.
- **Cost doubles.** Every claim-eligible run now pays two different
  API/CLI surfaces, two auth paths, two rate-limit budgets. Local
  runs (`developer-local`) remain single-family to keep dev cheap.
- **Ollama is a hosting choice, not a family.** The §1 table maps
  ollama model names to their lineage (gemma, llama, qwen, deepseek,
  mistral). If the operator runs a fine-tune that diverges
  meaningfully from the base, the classification is wrong until the
  table is updated.
- **Table drift.** `model-family.ts` is committed static data. When
  vendors release new checkpoints, someone must classify them before
  claim-eligible runs can use them (`unknown` blocks the preflight by
  design in §2).
- **No defence against collusion at the infra layer.** If both
  vendors route through the same prompt-caching proxy or the same
  injected safety layer, the families become effectively correlated
  in ways this rule cannot see. Out of scope here; tracked in the
  witness-chain report (`docs/security/witness-chain-attacks.md`).
- **Veto-first semantics can stall progress.** A partial verdict
  currently requires a third-family adjudicator (§4). In environments
  where only two providers are available this is a hard stall; the
  fallback is human-in-the-loop sign-off recorded in the admissibility
  block.

## Handoff

Next artifacts:

- ADR under `docs/adr/` recording the §2 rule and the §1 taxonomy
  version (handoff: `adr-writer`).
- Risk register update for `experiments/meta-factory/design/risks.md`
  MR-9 row and a new residual-risk row referencing §8 (handoff:
  `architecture-risk-assessor`).
- Deployment-view note for the CI reviewer lane in phase 4
  (handoff: `deployment-view-writer`).
