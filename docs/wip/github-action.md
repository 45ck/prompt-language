# GitHub Action (WIP)

> **Status: shipped.** The action is available at `45ck/prompt-language-action`. See `action/action.yml` in the project root.

## Goal

Make prompt-language usable in CI through a dedicated GitHub Action wrapper.

## Intended workflow

```yaml
- uses: 45ck/prompt-language-action@v1
  with:
    flow-file: flows/fix-and-test.flow
    api-key: ${{ secrets.ANTHROPIC_API_KEY }}
```

## Intended behavior

- wraps the existing headless CLI path
- surfaces pass or fail as a normal GitHub Action result
- uploads gate results and audit output as artifacts

## Current workaround

Call the CLI directly from workflow steps.
