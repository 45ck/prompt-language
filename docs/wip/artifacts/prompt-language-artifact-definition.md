# Prompt-language Artifact Definition

## Proposed definition

Artifacts are durable, human-reviewable, machine-readable objects emitted by a run phase or step so a person can inspect intent, progress, proof, or requested action.

## Why not define artifact as “any generated file”

That definition is too loose.

A good artifact should be:

- recognized by the runtime
- typed
- inspectable by humans
- consumable by machines
- optionally gateable
- attachable to approvals, reviews, and handoffs

A random output file may be useful, but it is not necessarily an artifact.

## Clean separation of concepts

| Concept     | Purpose                                                          |
| ----------- | ---------------------------------------------------------------- |
| State       | lets the runtime resume execution                                |
| Memory      | stores durable lessons or reusable knowledge                     |
| Log         | low-level event trace                                            |
| Artifact    | human-facing review/proof/handoff object                         |
| Side effect | real-world change, such as file edits, PRs, deploys, or messages |

## Core principles

1. Artifacts are not hidden chain-of-thought dumps.
2. Artifacts are not a substitute for gates.
3. Artifacts are not the same thing as memory.
4. Artifacts should be open, inspectable, and renderer-neutral.
5. Artifacts should support both humans and other programs.
