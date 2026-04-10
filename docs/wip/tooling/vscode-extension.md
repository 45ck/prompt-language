# VS Code Extension

> **Status: basic package shipped; richer editor tooling remains WIP.** This page remains under `docs/wip/` because the shipped syntax-highlighting package and the still-planned diagnostics/autocomplete work are described together.

## Goal

Make flow files pleasant to author in VS Code.

## Available now

A basic extension package lives in `vscode-extension/` at the project root. It provides:

- syntax highlighting for `.flow` files (TextMate grammar)
- comment toggling with `#`
- variable interpolation highlighting inside strings (`${...}`)
- keyword coloring for all DSL primitives and section headers
- built-in predicate highlighting (`tests_pass`, `command_failed`, etc.)

To package for local install:

```bash
cd vscode-extension
npm install -g @vscode/vsce
vsce package
code --install-extension prompt-language-0.1.0.vsix
```

## Intended features (future)

- inline lint warnings
- keyword autocomplete
- "did you mean?" suggestions from the linter
