# Flow Registry (WIP)

> **WIP: not implemented yet.** This page describes intended behavior, not current commands.

## Goal

Make flows into real project assets instead of one-off prompt text.

## Proposed commands

```bash
npx @45ck/prompt-language run flows/fix-auth.flow
npx @45ck/prompt-language validate flows/fix-auth.flow
npx @45ck/prompt-language list
```

## Intended behavior

- `.flow` files become a standard convention
- `validate` parses, lints, and dry-runs a flow file
- `run` executes a flow file directly
- `list` discovers flow files in the project

## Current workaround

Keep flow text in markdown or snippets and paste it into `claude -p`.
