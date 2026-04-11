# Manifest And Renderer Model

## Canonical form

The canonical artifact should be a folder backed by a machine-readable manifest and zero or more attached views or assets.

Example layout:

```text
.prompt-language/artifacts/run-2026-04-10/browser-qa-packet-001/
  manifest.json
  summary.md
  review.html
  data.json
  screenshots/
    checkout-1.png
    checkout-2.png
  recordings/
    checkout.webm
```

## Why a package is better than a single file

This supports:

- machine consumption
- browser-friendly review
- IDE integration
- plain-text inspection
- Word/PDF export
- attached evidence

## Recommended views

| View key | Purpose                                   | Typical file                   |
| -------- | ----------------------------------------- | ------------------------------ |
| `json`   | runtime and agent consumption             | `manifest.json` or `data.json` |
| `md`     | plain text editors / Notepad-like reading | `summary.md`                   |
| `html`   | browser review surface                    | `review.html`                  |
| `docx`   | Word-oriented review/export               | generated export               |
| `pdf`    | sharing / print / archival                | generated export               |
| `csv`    | spreadsheet-friendly tabular artifacts    | optional export                |

## Important rule

The artifact is not the HTML file or the DOCX file.

The artifact is the package plus manifest. HTML, Markdown, DOCX, and PDF are views.

## Recommended manifest fields

### Identity

- `id`
- `type`
- `schema_version`

### Lifecycle

- `status`
- `created_at`
- `updated_at`
- `phase`

### Human summary

- `title`
- `summary`

### Machine content

- `payload`

### Provenance

- `producer`
- `flow_node`
- `run_id`
- `inputs`

### Attachments and views

- `attachments`
- `views`

### Candidate review metadata for a later design slice

`prompt-language-50m6.1` does not settle where review comments, approvals, or review-state transitions live.

Possible fields for a later manifest contract:

- `review.comments`
- `review.approvals`
- `review.state`

That storage boundary is intentionally deferred to `prompt-language-50m6.8`.

## Renderer idea

A renderer system could map one artifact into multiple views:

- `render browser` -> HTML review view
- `render notepad` -> Markdown or text view
- `render word` -> DOCX export
- `render share` -> PDF export
- `render api` -> normalized JSON
