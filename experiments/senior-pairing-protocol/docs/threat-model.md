# Threat Model

## Prompt Theater

Risk: The model writes convincing senior-engineer language but does not improve
the artifact.

Mitigation: Score deterministic oracle result and final diff before transcript
quality.

## Overfitting

Risk: The flow becomes tuned to one fixture shape.

Mitigation: Use task families with different failure modes: ambiguous priority,
security boundary, migration compatibility, TDD, and performance.

## Judge Bias

Risk: A model judge rewards fluent explanations or agrees with the worker.

Mitigation: Judge only after deterministic gates and require concrete evidence
fields. Treat judge abstention as non-pass.

## Local Model Latency

Risk: Slow local inference makes the protocol look impractical.

Mitigation: Record runtime separately. Do not weight runtime heavily in the first
quality experiment.

## Hidden Oracle Leakage

Risk: If the model sees verifier internals too early, the task becomes oracle
gaming.

Mitigation: The initial task brief may mention verification commands, but the
full oracle output should only be fed back after a failed verification loop.

## Ambiguity Collapse

Risk: The flow forces the model to make up a requirement instead of escalating.

Mitigation: Require explicit ambiguity capture and an escalation decision before
implementation.
