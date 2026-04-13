# Outcome

Run: `20260414-0619-a19-core-proof-paired-clean`
Order: `pl-first`
Scenario: `recovery`

## Lane Results

- `prompt-language`: `success` (completed)
- `codex-alone`: `success` (completed)

## Verification

- `prompt-language`: lint=pass, typecheck=pass, test=pass
- `codex-alone`: lint=pass, typecheck=pass, test=pass

## Governed Recovery

- `prompt-language` interrupted as planned: true
- `prompt-language` recovered after interruption: true
- `prompt-language` interrupt to green: 1011.91s
- `prompt-language` resume to green: 1011.81s
- `codex-alone` interrupted as planned: true
- `codex-alone` recovered after interruption: true
- `codex-alone` interrupt to green: 144.43s
- `codex-alone` resume to green: 144.28s

## Verdict

- comparative verdict: `codex-alone-better`
- admissibility: `supporting-context`
- reason: This is a trace-backed S2 governed-recovery pilot on the same bounded CRM contract, but it remains supporting context until repeated predeclared interruption/resume pairs agree.
