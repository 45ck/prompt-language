# Structured Capture (WIP)

> **Status: shipped.** See [let-var](../../reference/let-var.md) in the Language Reference.

## Goal

Let captured prompt output become validated structured data instead of an opaque string.

## Proposed syntax

```text
let analysis = prompt "Analyze the failures" as json {
  severity: "low" | "medium" | "high",
  files: string[],
  summary: string
}
```

Then use fields directly:

```text
if ${analysis.severity} == "high"
  prompt: Fix ${analysis.files_length} files immediately.
end
```

## Intended behavior

- the runtime instructs Claude to return JSON matching the schema
- JSON is validated before the capture succeeds
- malformed output triggers a bounded retry
- fields become addressable via dot notation such as `${analysis.summary}`
- validation failures show up clearly in capture diagnostics

## Current workaround

Capture plain text and parse it with follow-up prompts or shell tools.
