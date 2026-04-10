# GitHub Action

> **Status: shipped integration, retained here as transition context.** The action is available at `45ck/prompt-language-action`. This page stays under `docs/wip/` because the repo does not yet have a dedicated shipped integrations section.

## Goal

Make prompt-language usable in CI through a dedicated GitHub Action wrapper.

## Available workflow

```yaml
- uses: 45ck/prompt-language-action@v1
  with:
    flow-file: flows/fix-and-test.flow
    api-key: ${{ secrets.ANTHROPIC_API_KEY }}
```

## Current behavior

- wraps the existing headless CLI path
- surfaces pass or fail as a normal GitHub Action result
- uploads gate results and audit output as artifacts

## Related

- [CLI Reference](../../reference/cli-reference.md)
- [Roadmap](../../roadmap.md)
