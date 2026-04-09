# Example: JSON Capture

Compare plain prompt capture with structured JSON capture when you need Claude's response as either free-form text or reliable fields.

## Natural language

```
Review the diff and tell me what matters. In the simple version, give me a short summary I can paste into a follow-up prompt. In the structured version, return a summary, a risk level, and whether tests are needed so the flow can branch on those fields.
```

## Plain capture

```yaml
Goal: review a diff with plain text capture

flow:
  let analysis = prompt "Review the diff. Return a short summary of the main change and any obvious risk."
  prompt: Use this review summary to plan the next step: ${analysis}

done when:
  file_exists .
```

Plain capture is best when the result is meant to be read as a single block of text. The flow stores Claude's response in one variable and reuses it later, but the runtime does not validate its shape.

## Structured JSON capture

```yaml
Goal: review a diff with structured JSON capture

flow:
  let analysis = prompt "Review the diff and return structured triage data." as json {
    "summary": "string",
    "risk": "low | medium | high",
    "needs_tests": "boolean"
  }
  prompt: Summary: ${analysis.summary}
  if ${analysis.risk} == "high"
    prompt: Treat this as high risk. Review carefully before making changes.
  end
  if ${analysis.needs_tests} == "true"
    prompt: Add or update tests for this change.
  end

done when:
  file_exists .
```

Structured JSON capture is worth using when later steps need stable fields for branching, templating, or validation. If you only need a readable summary, plain capture is simpler. If the flow depends on named values like risk, counts, flags, or lists, JSON capture removes ambiguity and makes those fields directly addressable.
