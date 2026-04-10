# Flow Registry (WIP)

> **WIP: the registry conventions described here are not the public contract yet.** The shipped CLI already supports `.flow` files through `run`, `validate`, and `list`; this page is about turning that raw capability into a canonical project convention.

For the shipped command surface, see the [CLI Reference](../../reference/cli-reference.md).

## Shipped today

These capabilities already exist:

```bash
npx @45ck/prompt-language run flows/fix-auth.flow
npx @45ck/prompt-language validate flows/fix-auth.flow
npx @45ck/prompt-language list
```

## Proposed registry layer

The still-open proposal is to make file-based usage feel like a first-class, documented convention rather than just a raw command surface:

- treat `.flow` files as a standard repo artifact rather than an ad hoc convention
- document a canonical `flows/` directory or equivalent team convention
- make file-first authoring, review, and discovery the expected workflow
- tighten how direct file execution and registry-style discovery are presented in the docs

## Current workaround

Use the shipped CLI commands directly today, but treat project layout and naming as a team convention rather than a guaranteed product contract.
