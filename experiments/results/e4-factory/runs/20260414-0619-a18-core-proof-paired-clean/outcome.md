# Outcome

Run: `20260414-0619-a18-core-proof-paired-clean`
Order: `codex-first`
Scenario: `recovery`

## Lane Results

- `prompt-language`: `partial` (partial)
- `codex-alone`: `success` (completed)

## Verification

- `prompt-language`: lint=fail, typecheck=pass, test=pass
- `codex-alone`: lint=pass, typecheck=pass, test=pass

## Governed Recovery

- `prompt-language` interrupted as planned: true
- `prompt-language` recovered after interruption: false
- `prompt-language` interrupt to green: n/as
- `prompt-language` resume to green: n/as
- `codex-alone` interrupted as planned: true
- `codex-alone` recovered after interruption: true
- `codex-alone` interrupt to green: 189.84s
- `codex-alone` resume to green: 189.75s

## Verdict

- comparative verdict: `codex-alone-better`
- admissibility: `supporting-context`
- reason: This is a trace-backed S2 governed-recovery pilot on the same bounded CRM contract, but it remains supporting context until repeated predeclared interruption/resume pairs agree.
