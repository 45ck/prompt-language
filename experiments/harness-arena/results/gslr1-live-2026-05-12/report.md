# GSLR-1 Live Result: MC Projection

Date: 2026-05-12  
Tracking bead: `prompt-language-gslr3`  
Parent bead: `prompt-language-sfd3`  
Run group: `gslr1-live-2026-05-12-01`

## Verdict

GSLR-1 produced useful live evidence, but it did **not** prove the governed
hybrid cost-routing thesis.

Positive evidence:

- the live harness ran real local and frontier lanes;
- the private oracle stayed outside model-visible fixture input;
- `local-only`, `frontier-only`, and an `advisor-only` rerun all passed the
  public gate and private oracle;
- local Ollama resource snapshots were captured during local steps;
- all durable manifests validate against the harness schema.

Negative or narrowing evidence:

- `hybrid-router` used two planned frontier calls while `frontier-only` used one;
- `hybrid-router` was slower than `local-only` and `frontier-only`;
- `hybrid-router` passed the private oracle but its frontier review wrote a
  blocking finding, so it is not positive architecture evidence;
- the primary `advisor-only` run exposed an oracle-calibration bug, then passed
  after the oracle was fixed and rerun;
- model-reported cost/tokens are not yet parsed into the manifest cost fields.

The honest conclusion is:

```text
GSLR-1 proves the live harness can compare governed local/frontier arms on a
safe projection task. It does not prove cost reduction. This fixture is too easy
for the local model and the hybrid route is over-controlled for the task.
```

## Runs

Primary run artifacts were copied from:

```text
/tmp/prompt-language-gslr1-live/gslr1-live-2026-05-12-01
```

Advisor rerun artifacts were copied from:

```text
/tmp/prompt-language-gslr1-live/gslr1-live-2026-05-12-01-advisor-rerun
```

Compact durable artifacts in this directory:

- `summary-primary.json`
- `summary-advisor-rerun.json`
- `manifests/*.json`
- `projections/*.md`
- `oracle/*.txt`

Large Codex stdout/stderr transcripts were intentionally not copied into git.
The manifests retain step artifact refs from the original run root.

## Arm Results

| Arm             | Source  | Frontier steps | Local steps | Step wall seconds | Public/private gate                 | Review state     | Verdict                              |
| --------------- | ------- | -------------: | ----------: | ----------------: | ----------------------------------- | ---------------- | ------------------------------------ |
| `local-only`    | primary |              0 |           1 |            10.339 | pass                                | none             | positive local docs-task evidence    |
| `frontier-only` | primary |              1 |           0 |            39.016 | pass                                | none             | positive frontier baseline           |
| `advisor-only`  | primary |              1 |           1 |            68.831 | oracle false before calibration fix | none             | invalidated by oracle false positive |
| `advisor-only`  | rerun   |              1 |           1 |            66.262 | pass                                | none             | positive advisor control             |
| `hybrid-router` | primary |              2 |           1 |           125.054 | pass                                | blocking finding | negative hybrid verdict              |

The primary advisor-only oracle failure was:

```text
forbidden private-oracle signal: shipped integration claim
```

Manual inspection showed this was triggered by a negative non-goal sentence
stating no shipped integration claim. The oracle now allows explicit negative
statements of that form, and the advisor-only rerun passed.

The hybrid review defect was:

```text
projection/portarium-evidence-envelope.md includes internal evaluation wording
in the Non-Goals section.
```

Because the review marked this as blocking and did not repair it, the hybrid arm
does not satisfy the GSLR-1 verdict rule requiring no unresolved blocking review
defect.

## What We Learned

### 1. The fixture is too easy for the local lane

`qwen3-coder:30b` produced an acceptable docs projection with zero frontier
calls. That is good local-model evidence for this narrow task, but it makes the
hybrid arm hard to justify.

For this task shape, local-only is the best measured route.

### 2. The hybrid route is too expensive for this task

The current `hybrid-router` arm performs:

1. frontier classification;
2. local bulk work;
3. frontier review.

That is two frontier calls before any repair. The `frontier-only` control uses
one frontier call. Therefore GSLR-1 cannot prove frontier-call reduction under
the current arm definitions.

### 3. Review defects must affect verdicts directly

The hybrid private oracle passed, but frontier review found a blocking issue.
That means the result needs a stronger final verdict aggregator:

```text
public gate pass + private oracle pass + blocking review defect = fail
```

Today that rule lives in the report/verdict text, not in the manifest
classification logic.

### 4. The harness needs token/cost extraction

Codex stderr included model and token summaries, but the manifest still records
cost basis as `none`. Cost-routing claims need parsed provider telemetry, not
manual transcript inspection.

Observed frontier token summaries from the original stderr artifacts:

- `frontier-only/frontier-full`: 15,776 tokens
- `hybrid-router/frontier-classify`: 18,047 tokens
- `hybrid-router/frontier-review`: 16,235 tokens
- `advisor-only/rerun frontier-advice`: 20,489 tokens

The hybrid arm used more frontier calls and more frontier tokens than the
frontier-only control.

## Decision

Do not build a Portarium static evidence card yet.

The next step is to revise the experiment design before product integration:

1. add a manifest-level final verdict that fails on blocking review defects;
2. parse frontier token/cost telemetry into manifest cost fields;
3. choose a harder GSLR-2 task where local-only is not already sufficient, such
   as a tiny schema/code change with tests;
4. make the hybrid route cheaper than the frontier baseline by design, or change
   the success metric from call count to verified cost/tokens if final review is
   mandatory;
5. only after a positive hybrid result, create a Portarium static evidence card.

## Commands

Primary live run:

```sh
PROMPT_LANGUAGE_OLLAMA_TRANSPORT=powershell \
PROMPT_LANGUAGE_OLLAMA_TIMEOUT_MS=600000 \
node experiments/harness-arena/runner.mjs \
  --live \
  --fixture experiments/harness-arena/fixtures/gslr1-mc-doc-projection \
  --task-id GSLR-1-mc-doc-projection \
  --run-id gslr1-live-2026-05-12-01 \
  --policy-version gslr-v0.1 \
  --live-local-command "node <repoRoot>/experiments/harness-arena/live/gslr1-local-lane.mjs --workspace <workspace> --arm <arm> --step <stepId> --model qwen3-coder:30b" \
  --live-frontier-command "node <repoRoot>/experiments/harness-arena/live/gslr1-frontier-lane.mjs --workspace <workspace> --arm <arm> --step <stepId>" \
  --oracle-command "node <repoRoot>/experiments/harness-arena/oracles/gslr1-mc-doc-projection-oracle.mjs --workspace <workspace>" \
  --local-model qwen3-coder:30b \
  --local-provider ollama \
  --local-runner ollama \
  --local-endpoint http://127.0.0.1:11434 \
  --frontier-model gpt-5.5 \
  --frontier-provider openai \
  --frontier-runner codex \
  --frontier-call-limit 5 \
  --usd-limit 2 \
  --wall-seconds-limit 900 \
  --step-timeout-ms 360000 \
  --oracle-timeout-ms 30000 \
  --command-output-limit-bytes 250000 \
  --local-resource-snapshot-command "node <repoRoot>/experiments/harness-arena/live/gslr1-resource-snapshot.mjs --endpoint <localEndpoint>" \
  --local-resource-snapshot-interval-ms 10000 \
  --output-root /tmp/prompt-language-gslr1-live
```

Advisor rerun used the same command with `--arms advisor-only`, run id
`gslr1-live-2026-05-12-01-advisor-rerun`, and `--frontier-call-limit 1`.
