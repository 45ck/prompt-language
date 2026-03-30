# remember

`remember` persists facts to the memory store at `.prompt-language/memory.json`.

## Syntax

Free-form text:

```yaml
remember "The user prefers TypeScript over JavaScript"
```

Key-value form:

```yaml
remember key="preferred-language" value="TypeScript"
```

With interpolation:

```yaml
remember key="last-branch" value="${branch}"
```

## memory: section

Declare a `memory:` section before `flow:` to prefetch stored keys into flow variables at startup:

```yaml
memory:
  preferred-language
  last-branch

flow:
  prompt: Use ${preferred-language} for this task
end
```

## Semantics

- Free-form text is stored with a timestamp.
- Key-value form enables structured retrieval; the key becomes the variable name when prefetched.
- The `memory:` section fetches the listed keys and injects them as variables before the first flow node runs.
- The memory file persists across flow runs.
- Unknown keys in `memory:` silently inject empty strings.

## Related

- [let / var](let-var.md)
- [spawn](spawn.md)
